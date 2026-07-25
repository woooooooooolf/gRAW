use std::{
    fs::{self, File, OpenOptions},
    io::{BufWriter, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

use serde::Serialize;

use super::{
    model::{FrameLayout, RawConfig},
    packing::pack_row,
    patterns::pixel_value,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationProgress {
    pub stage: &'static str,
    pub bytes_written: u64,
    pub total_bytes: u64,
    pub current_frame: u32,
    pub frame_count: u32,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationResult {
    pub output_path: String,
    pub total_bytes: u64,
    pub elapsed_ms: u64,
}

pub fn generate_to_path<F>(
    config: RawConfig,
    output_path: &Path,
    cancelled: &AtomicBool,
    mut on_progress: F,
) -> Result<GenerationResult, String>
where
    F: FnMut(GenerationProgress),
{
    let layout = config.validate()?;
    let parent = output_path
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    if !parent.is_dir() {
        return Err("输出目录不存在".into());
    }

    let available = fs2::available_space(parent)
        .map_err(|error| format!("无法检查目标磁盘剩余空间：{error}"))?;
    if available < layout.total_size {
        return Err(format!(
            "目标磁盘空间不足：需要 {} 字节，可用 {} 字节",
            layout.total_size, available
        ));
    }

    let temporary_path = temporary_path(output_path);
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_path)
        .map_err(|error| format!("无法创建临时输出文件：{error}"))?;

    let started = Instant::now();
    let outcome = write_image(file, &config, layout, cancelled, started, &mut on_progress);

    if let Err(error) = outcome {
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }

    if cancelled.load(Ordering::Relaxed) {
        let _ = fs::remove_file(&temporary_path);
        return Err("已取消生成".into());
    }

    on_progress(GenerationProgress {
        stage: "finalizing",
        bytes_written: layout.total_size,
        total_bytes: layout.total_size,
        current_frame: config.frame_count,
        frame_count: config.frame_count,
        elapsed_ms: elapsed_ms(started),
    });

    if output_path.exists() {
        fs::remove_file(output_path).map_err(|error| {
            let _ = fs::remove_file(&temporary_path);
            format!("无法替换已有文件：{error}")
        })?;
    }
    fs::rename(&temporary_path, output_path).map_err(|error| {
        let _ = fs::remove_file(&temporary_path);
        format!("无法完成输出文件：{error}")
    })?;

    Ok(GenerationResult {
        output_path: output_path.to_string_lossy().into_owned(),
        total_bytes: layout.total_size,
        elapsed_ms: elapsed_ms(started),
    })
}

fn write_image<F>(
    file: File,
    config: &RawConfig,
    layout: FrameLayout,
    cancelled: &AtomicBool,
    started: Instant,
    on_progress: &mut F,
) -> Result<(), String>
where
    F: FnMut(GenerationProgress),
{
    let mut writer = BufWriter::with_capacity(1024 * 1024, file);
    let mut tracker = ProgressTracker::new(layout.total_size, config.frame_count, started);
    tracker.emit("preparing", 0, true, on_progress);

    write_fill(
        &mut writer,
        config.offset_fill,
        config.file_offset,
        cancelled,
        &mut tracker,
        "offset",
        0,
        on_progress,
    )?;

    let mut pixels = vec![0u16; config.width as usize];
    let mut packed_row = Vec::with_capacity(layout.row_payload as usize);

    for frame in 0..config.frame_count {
        check_cancelled(cancelled)?;
        for y in 0..config.height {
            for (x, value) in pixels.iter_mut().enumerate() {
                *value = pixel_value(config, frame, x as u32, y, layout.max_value);
            }
            pack_row(config, &pixels, &mut packed_row);
            writer
                .write_all(&packed_row)
                .map_err(|error| format!("写入像素数据失败：{error}"))?;
            tracker.advance(packed_row.len() as u64);
            tracker.emit("pixels", frame + 1, false, on_progress);

            write_fill(
                &mut writer,
                config.row_padding_fill,
                layout.row_padding,
                cancelled,
                &mut tracker,
                "pixels",
                frame + 1,
                on_progress,
            )?;
            check_cancelled(cancelled)?;
        }
        write_fill(
            &mut writer,
            config.frame_padding_fill,
            layout.frame_padding,
            cancelled,
            &mut tracker,
            "framePadding",
            frame + 1,
            on_progress,
        )?;
        tracker.emit("pixels", frame + 1, true, on_progress);
    }

    writer
        .flush()
        .map_err(|error| format!("刷新输出文件失败：{error}"))?;
    let file = writer
        .into_inner()
        .map_err(|error| format!("完成输出缓冲区失败：{error}"))?;
    file.sync_all()
        .map_err(|error| format!("同步输出文件失败：{error}"))?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn write_fill<F>(
    writer: &mut BufWriter<File>,
    value: u8,
    mut remaining: u64,
    cancelled: &AtomicBool,
    tracker: &mut ProgressTracker,
    stage: &'static str,
    current_frame: u32,
    on_progress: &mut F,
) -> Result<(), String>
where
    F: FnMut(GenerationProgress),
{
    if remaining == 0 {
        return Ok(());
    }
    let buffer = vec![value; (remaining.min(1024 * 1024)) as usize];
    while remaining > 0 {
        check_cancelled(cancelled)?;
        let count = remaining.min(buffer.len() as u64) as usize;
        writer
            .write_all(&buffer[..count])
            .map_err(|error| format!("写入填充数据失败：{error}"))?;
        remaining -= count as u64;
        tracker.advance(count as u64);
        tracker.emit(stage, current_frame, false, on_progress);
    }
    Ok(())
}

fn check_cancelled(cancelled: &AtomicBool) -> Result<(), String> {
    if cancelled.load(Ordering::Relaxed) {
        Err("已取消生成".into())
    } else {
        Ok(())
    }
}

fn temporary_path(output_path: &Path) -> PathBuf {
    let mut name = output_path.as_os_str().to_os_string();
    name.push(format!(".graw.{}.part", std::process::id()));
    PathBuf::from(name)
}

struct ProgressTracker {
    bytes_written: u64,
    total_bytes: u64,
    frame_count: u32,
    started: Instant,
    last_emit: Instant,
}

impl ProgressTracker {
    fn new(total_bytes: u64, frame_count: u32, started: Instant) -> Self {
        Self {
            bytes_written: 0,
            total_bytes,
            frame_count,
            started,
            last_emit: started
                .checked_sub(Duration::from_secs(1))
                .unwrap_or(started),
        }
    }

    fn advance(&mut self, amount: u64) {
        self.bytes_written += amount;
    }

    fn emit<F>(&mut self, stage: &'static str, current_frame: u32, force: bool, callback: &mut F)
    where
        F: FnMut(GenerationProgress),
    {
        if !force && self.last_emit.elapsed() < Duration::from_millis(80) {
            return;
        }
        self.last_emit = Instant::now();
        callback(GenerationProgress {
            stage,
            bytes_written: self.bytes_written,
            total_bytes: self.total_bytes,
            current_frame,
            frame_count: self.frame_count,
            elapsed_ms: elapsed_ms(self.started),
        });
    }
}

fn elapsed_ms(started: Instant) -> u64 {
    started.elapsed().as_millis().min(u64::MAX as u128) as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::raw::model::{
        BitAlignment, CfaPattern, Endianness, PixelValues, StorageFormat, TestPattern,
    };
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_expected_layout_and_fill_bytes() {
        let config = RawConfig {
            width: 4,
            height: 2,
            bit_depth: 10,
            storage_format: StorageFormat::Mipi10,
            endianness: Endianness::Little,
            bit_alignment: BitAlignment::Lsb,
            cfa_pattern: CfaPattern::Mono,
            test_pattern: TestPattern::White,
            pixel_values: PixelValues {
                mono: 0,
                r: 0,
                gr: 0,
                gb: 0,
                b: 0,
            },
            gray_steps: 2,
            checker_size: 1,
            noise_seed: 0,
            row_alignment: 8,
            frame_alignment: 32,
            file_offset: 4,
            offset_fill: 0xa5,
            row_padding_fill: 0xcc,
            frame_padding_fill: 0x5a,
            frame_count: 2,
        };
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("graw-test-{stamp}.raw"));
        let result = generate_to_path(config, &path, &AtomicBool::new(false), |_| {}).unwrap();
        let bytes = fs::read(&path).unwrap();
        assert_eq!(result.total_bytes, 68);
        assert_eq!(bytes.len(), 68);
        assert_eq!(&bytes[0..4], &[0xa5; 4]);
        assert_eq!(&bytes[9..12], &[0xcc; 3]);
        assert_eq!(&bytes[20..36], &[0x5a; 16]);
        fs::remove_file(path).unwrap();
    }
}
