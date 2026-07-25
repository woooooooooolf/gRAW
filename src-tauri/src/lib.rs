mod raw;

use std::{
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

use raw::{FrameLayout, GenerationResult, RawConfig};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
struct GenerationState {
    active: Mutex<Option<Arc<AtomicBool>>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerationRequest {
    output_path: String,
    config: RawConfig,
}

#[tauri::command]
fn calculate_layout(config: RawConfig) -> Result<FrameLayout, String> {
    config.validate()
}

#[tauri::command]
async fn generate_raw(
    app: AppHandle,
    state: State<'_, GenerationState>,
    request: GenerationRequest,
) -> Result<GenerationResult, String> {
    let cancellation = Arc::new(AtomicBool::new(false));
    {
        let mut active = state
            .active
            .lock()
            .map_err(|_| "生成状态锁已损坏".to_string())?;
        if active.is_some() {
            return Err("已有生成任务正在运行".into());
        }
        *active = Some(cancellation.clone());
    }

    let app_for_task = app.clone();
    let cancellation_for_task = cancellation.clone();
    let output_path = PathBuf::from(request.output_path);
    let result = tauri::async_runtime::spawn_blocking(move || {
        raw::generate_to_path(
            request.config,
            &output_path,
            &cancellation_for_task,
            |progress| {
                let _ = app_for_task.emit("generation-progress", progress);
            },
        )
    })
    .await
    .map_err(|error| format!("生成任务异常终止：{error}"))
    .and_then(|result| result);

    if let Ok(mut active) = state.active.lock() {
        *active = None;
    }
    result
}

#[tauri::command]
fn cancel_generation(state: State<'_, GenerationState>) -> Result<bool, String> {
    let active = state
        .active
        .lock()
        .map_err(|_| "生成状态锁已损坏".to_string())?;
    if let Some(cancellation) = active.as_ref() {
        cancellation.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(GenerationState::default())
        .invoke_handler(tauri::generate_handler![
            calculate_layout,
            generate_raw,
            cancel_generation
        ])
        .run(tauri::generate_context!())
        .expect("error while running gRAW");
}
