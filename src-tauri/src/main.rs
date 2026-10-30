// Keep the portable GUI free of an extra console window on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() -> std::process::ExitCode {
    if std::env::args_os().nth(1).is_some() {
        std::process::ExitCode::from(graw_lib::run_cli())
    } else {
        graw_lib::run();
        std::process::ExitCode::SUCCESS
    }
}
