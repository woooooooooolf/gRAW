use std::{
    ffi::OsString,
    io::{self, IsTerminal, Write},
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
};

use clap::Parser;

use crate::raw::{
    GenerationError, generate_to_path,
    model::{
        BitAlignment, CfaPattern, Endianness, FrameLayout, PixelValues, RawConfig, StorageFormat,
        TestPattern,
    },
};

static CANCELLED: AtomicBool = AtomicBool::new(false);

/// Generate headerless RAW images without opening the GUI.
///
/// No image-generation defaults are supplied. Parameters that affect the selected
/// format, pattern, or padding region must be explicit. Existing output is replaced
/// only after successful generation. Run without arguments to open the GUI.
///
/// Windows GUI executables may return control to the shell before they finish.
/// For automation, explicitly wait for the process and inspect its exit code.
#[derive(Debug, Parser)]
#[command(name = "gRAW", version, disable_help_subcommand = true)]
struct Cli {
    /// Exact destination path (relative to the caller's working directory).
    #[arg(long, required_unless_present = "dry_run")]
    output: Option<PathBuf>,
    #[arg(long, value_parser = integer::<u32>)]
    width: u32,
    #[arg(long, value_parser = integer::<u32>)]
    height: u32,
    #[arg(long, value_enum)]
    storage_format: StorageFormat,
    #[arg(long, value_parser = integer::<u8>)]
    bit_depth: u8,
    #[arg(long, value_enum)]
    cfa_pattern: CfaPattern,
    #[arg(long, value_enum)]
    test_pattern: TestPattern,
    #[arg(long, value_parser = integer::<u32>)]
    frame_count: u32,
    /// Row alignment in bytes, including an explicit 1 for no padding.
    #[arg(long, value_parser = integer::<u32>)]
    row_alignment: u32,
    /// Frame alignment in bytes, including an explicit 1 for no padding.
    #[arg(long, value_parser = integer::<u32>)]
    frame_alignment: u32,
    /// Leading byte count, including an explicit 0 for no offset.
    #[arg(long, value_parser = integer::<u64>)]
    file_offset: u64,

    /// Required only for unpacked16.
    #[arg(long, value_enum)]
    endianness: Option<Endianness>,
    /// Required only for unpacked16, including 16-bit samples.
    #[arg(long, value_enum)]
    bit_alignment: Option<BitAlignment>,
    /// Fixed-pattern sample for Mono CFA.
    #[arg(long, value_parser = integer::<u16>)]
    mono: Option<u16>,
    /// Fixed-pattern red sample for a color CFA.
    #[arg(long, value_parser = integer::<u16>)]
    r: Option<u16>,
    /// Fixed-pattern green/red-row sample for a color CFA.
    #[arg(long, value_parser = integer::<u16>)]
    gr: Option<u16>,
    /// Fixed-pattern green/blue-row sample for a color CFA.
    #[arg(long, value_parser = integer::<u16>)]
    gb: Option<u16>,
    /// Fixed-pattern blue sample for a color CFA.
    #[arg(long, value_parser = integer::<u16>)]
    b: Option<u16>,
    /// Required only for gray-steps (2..256).
    #[arg(long, value_parser = integer::<u16>)]
    gray_steps: Option<u16>,
    /// Required only for checkerboard (pixels per square).
    #[arg(long, value_parser = integer::<u32>)]
    checker_size: Option<u32>,
    /// Required only for random-noise.
    #[arg(long, value_parser = integer::<u64>)]
    noise_seed: Option<u64>,
    /// Required only when file-offset is nonzero (0..255 or 0x00..0xff).
    #[arg(long, value_parser = integer::<u8>)]
    offset_fill: Option<u8>,
    /// Required only when the calculated row padding is nonzero.
    #[arg(long, value_parser = integer::<u8>)]
    row_padding_fill: Option<u8>,
    /// Required only when the calculated frame padding is nonzero.
    #[arg(long, value_parser = integer::<u8>)]
    frame_padding_fill: Option<u8>,

    /// Validate and print the exact byte layout without writing a file.
    #[arg(long)]
    dry_run: bool,
    /// Suppress progress and success output; errors are still printed.
    #[arg(long)]
    quiet: bool,
}

fn integer<T: TryFrom<u64>>(value: &str) -> Result<T, String> {
    let number = if let Some(hex) = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
    {
        if hex.is_empty() || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("expected an unsigned decimal or 0x hexadecimal integer".into());
        }
        u64::from_str_radix(hex, 16)
    } else {
        if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err("expected an unsigned decimal or 0x hexadecimal integer".into());
        }
        value.parse::<u64>()
    }
    .map_err(|_| "integer exceeds the supported range".to_owned())?;
    T::try_from(number).map_err(|_| "integer exceeds the supported range".into())
}

impl Cli {
    fn configuration(&self) -> Result<(RawConfig, FrameLayout), String> {
        if self
            .output
            .as_ref()
            .is_some_and(|path| path.as_os_str().is_empty())
        {
            return Err("--output: path must not be empty".into());
        }
        // Only inactive fields receive neutral internal placeholders. Every
        // field that contributes to output is required below, before any I/O.
        let config = RawConfig {
            width: self.width,
            height: self.height,
            bit_depth: self.bit_depth,
            storage_format: self.storage_format,
            endianness: self.endianness.unwrap_or(Endianness::Little),
            bit_alignment: self.bit_alignment.unwrap_or(BitAlignment::Lsb),
            cfa_pattern: self.cfa_pattern,
            test_pattern: self.test_pattern,
            pixel_values: PixelValues {
                mono: self.mono.unwrap_or(0),
                r: self.r.unwrap_or(0),
                gr: self.gr.unwrap_or(0),
                gb: self.gb.unwrap_or(0),
                b: self.b.unwrap_or(0),
            },
            gray_steps: self.gray_steps.unwrap_or(2),
            checker_size: self.checker_size.unwrap_or(1),
            noise_seed: self.noise_seed.unwrap_or(0),
            row_alignment: self.row_alignment,
            frame_alignment: self.frame_alignment,
            file_offset: self.file_offset,
            offset_fill: self.offset_fill.unwrap_or(0),
            row_padding_fill: self.row_padding_fill.unwrap_or(0),
            frame_padding_fill: self.frame_padding_fill.unwrap_or(0),
            frame_count: self.frame_count,
        };

        // Shared validation checks ranges and combinations before layout-dependent
        // requirements. It never normalizes or clamps an explicit user value.
        let layout = config
            .validate_detailed()
            .map_err(|error| error.to_string())?;
        let unpacked16 = self.storage_format == StorageFormat::Unpacked16;
        let fixed = self.test_pattern == TestPattern::Fixed;
        let mono = self.cfa_pattern == CfaPattern::Mono;
        let mut errors = Vec::new();
        for (name, supplied, active, condition) in [
            (
                "--endianness",
                self.endianness.is_some(),
                unpacked16,
                "unpacked16",
            ),
            (
                "--bit-alignment",
                self.bit_alignment.is_some(),
                unpacked16,
                "unpacked16",
            ),
            (
                "--mono",
                self.mono.is_some(),
                fixed && mono,
                "fixed with Mono CFA",
            ),
            (
                "--r",
                self.r.is_some(),
                fixed && !mono,
                "fixed with a color CFA",
            ),
            (
                "--gr",
                self.gr.is_some(),
                fixed && !mono,
                "fixed with a color CFA",
            ),
            (
                "--gb",
                self.gb.is_some(),
                fixed && !mono,
                "fixed with a color CFA",
            ),
            (
                "--b",
                self.b.is_some(),
                fixed && !mono,
                "fixed with a color CFA",
            ),
            (
                "--gray-steps",
                self.gray_steps.is_some(),
                self.test_pattern == TestPattern::GraySteps,
                "gray-steps",
            ),
            (
                "--checker-size",
                self.checker_size.is_some(),
                self.test_pattern == TestPattern::Checkerboard,
                "checkerboard",
            ),
            (
                "--noise-seed",
                self.noise_seed.is_some(),
                self.test_pattern == TestPattern::RandomNoise,
                "random-noise",
            ),
            (
                "--offset-fill",
                self.offset_fill.is_some(),
                self.file_offset > 0,
                "a nonzero file-offset",
            ),
            (
                "--row-padding-fill",
                self.row_padding_fill.is_some(),
                layout.row_padding > 0,
                "nonzero row padding",
            ),
            (
                "--frame-padding-fill",
                self.frame_padding_fill.is_some(),
                layout.frame_padding > 0,
                "nonzero frame padding",
            ),
        ] {
            if active && !supplied {
                errors.push(format!("{name}: required for {condition}"));
            } else if !active && supplied {
                errors.push(format!(
                    "{name}: only applies to {condition}; remove this parameter"
                ));
            }
        }
        if errors.is_empty() {
            Ok((config, layout))
        } else {
            Err(errors.join("\n  "))
        }
    }
}

/// Run only the CLI; the Tauri builder and WebView are never initialized here.
pub fn run_cli() -> u8 {
    platform::prepare_console();
    execute(std::env::args_os())
}

fn execute(args: impl IntoIterator<Item = OsString>) -> u8 {
    let args = match Cli::try_parse_from(args) {
        Ok(args) => args,
        Err(error) => {
            let code = error.exit_code() as u8;
            return if error.print().is_ok() { code } else { 1 };
        }
    };
    let (config, layout) = match args.configuration() {
        Ok(value) => value,
        Err(error) => {
            let _ = writeln!(io::stderr().lock(), "error: {error}");
            return 2;
        }
    };
    if args.dry_run {
        if !args.quiet && write_layout(&layout).is_err() {
            return 1;
        }
        return 0;
    }

    // clap requires --output unless --dry-run is present.
    let Some(path) = args.output else { return 2 };
    CANCELLED.store(false, Ordering::Relaxed);
    let _handler = match platform::install_cancel_handler() {
        Ok(handler) => handler,
        Err(error) => {
            let _ = writeln!(
                io::stderr().lock(),
                "error: cannot install cancellation handler: {error}"
            );
            return 1;
        }
    };
    let show_progress = !args.quiet && io::stderr().is_terminal();
    let generated = generate_to_path(config, &path, &CANCELLED, |progress| {
        if show_progress {
            let percent = progress.bytes_written as f64 / progress.total_bytes as f64 * 100.0;
            let _ = write!(
                io::stderr().lock(),
                "\r{percent:6.2}%  {}/{} bytes  frame {}/{}",
                progress.bytes_written,
                progress.total_bytes,
                progress.current_frame,
                progress.frame_count
            );
        }
    });
    if show_progress {
        let _ = writeln!(io::stderr().lock());
    }
    match generated {
        Ok(result) => {
            if !args.quiet
                && writeln!(
                    io::stdout().lock(),
                    "Generated {} bytes in {} ms: {}",
                    result.total_bytes,
                    result.elapsed_ms,
                    result.output_path
                )
                .is_err()
            {
                return 1;
            }
            0
        }
        Err(GenerationError::Cancelled) => {
            let _ = writeln!(
                io::stderr().lock(),
                "error: generation cancelled; output was not replaced"
            );
            130
        }
        Err(GenerationError::InvalidConfig(error)) => {
            let _ = writeln!(io::stderr().lock(), "error: {error}");
            2
        }
        Err(GenerationError::Output(error)) => {
            let _ = writeln!(
                io::stderr().lock(),
                "error: --output {}: {error}",
                path.display()
            );
            3
        }
    }
}

fn write_layout(layout: &FrameLayout) -> io::Result<()> {
    writeln!(
        io::stdout().lock(),
        "row-payload: {}\nrow-stride: {}\nrow-padding: {}\nframe-data: {}\nframe-stride: {}\nframe-padding: {}\ntotal-size: {}",
        layout.row_payload,
        layout.row_stride,
        layout.row_padding,
        layout.frame_data,
        layout.frame_stride,
        layout.frame_padding,
        layout.total_size
    )
}

#[cfg(windows)]
mod platform {
    use super::CANCELLED;
    use std::{ffi::c_void, io, sync::atomic::Ordering};

    type Handle = *mut c_void;
    type Handler = unsafe extern "system" fn(u32) -> i32;

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn AttachConsole(process_id: u32) -> i32;
        fn GetStdHandle(which: u32) -> Handle;
        fn SetStdHandle(which: u32, handle: Handle) -> i32;
        fn GetFileType(handle: Handle) -> u32;
        fn GetConsoleCP() -> u32;
        fn SetConsoleCtrlHandler(handler: Option<Handler>, add: i32) -> i32;
    }

    pub fn prepare_console() {
        // SAFETY: borrowed process standard handles are neither closed nor owned.
        // Restore valid inherited handles after attaching so redirection (including
        // NUL) continues to work. No console is allocated when no parent has one.
        unsafe {
            if GetConsoleCP() != 0 {
                return;
            }
            let saved: Vec<_> = [-10i32, -11, -12]
                .into_iter()
                .filter_map(|id| {
                    let handle = GetStdHandle(id as u32);
                    (!handle.is_null() && handle as isize != -1 && GetFileType(handle) != 0)
                        .then_some((id as u32, handle))
                })
                .collect();
            AttachConsole(u32::MAX);
            for (id, handle) in saved {
                SetStdHandle(id, handle);
            }
        }
    }

    unsafe extern "system" fn cancel(event: u32) -> i32 {
        if event <= 1 {
            // CTRL_C_EVENT / CTRL_BREAK_EVENT
            CANCELLED.store(true, Ordering::Relaxed);
            1
        } else {
            0
        }
    }

    pub struct CancelHandler(bool);

    pub fn install_cancel_handler() -> io::Result<CancelHandler> {
        // SAFETY: the handler only writes a process-lifetime atomic flag.
        unsafe {
            if GetConsoleCP() == 0 {
                return Ok(CancelHandler(false));
            }
            // Re-enable Ctrl+C if the parent or a new process group ignored it.
            if SetConsoleCtrlHandler(None, 0) == 0 {
                return Err(io::Error::last_os_error());
            }
            if SetConsoleCtrlHandler(Some(cancel), 1) == 0 {
                return Err(io::Error::last_os_error());
            }
        }
        Ok(CancelHandler(true))
    }

    impl Drop for CancelHandler {
        fn drop(&mut self) {
            if self.0 {
                // SAFETY: unregister the same static function registered above.
                unsafe {
                    SetConsoleCtrlHandler(Some(cancel), 0);
                }
            }
        }
    }
}

#[cfg(not(windows))]
mod platform {
    pub fn prepare_console() {}
    pub fn install_cancel_handler() -> std::io::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> Vec<OsString> {
        [
            "gRAW",
            "--dry-run",
            "--width",
            "4",
            "--height",
            "2",
            "--storage-format",
            "mipi10",
            "--bit-depth",
            "10",
            "--cfa-pattern",
            "mono",
            "--test-pattern",
            "white",
            "--frame-count",
            "1",
            "--row-alignment",
            "1",
            "--frame-alignment",
            "1",
            "--file-offset",
            "0",
        ]
        .into_iter()
        .map(OsString::from)
        .collect()
    }

    #[test]
    fn no_generation_defaults_and_inactive_options() {
        for flag in [
            "--width",
            "--height",
            "--storage-format",
            "--bit-depth",
            "--cfa-pattern",
            "--test-pattern",
            "--frame-count",
            "--row-alignment",
            "--frame-alignment",
            "--file-offset",
        ] {
            let mut args = base();
            let at = args.iter().position(|arg| arg == flag).unwrap();
            args.drain(at..at + 2);
            assert!(Cli::try_parse_from(args).is_err(), "{flag}");
        }
        let mut args = base();
        args.extend(["--noise-seed", "0"].map(OsString::from));
        assert!(
            Cli::try_parse_from(args)
                .unwrap()
                .configuration()
                .unwrap_err()
                .contains("--noise-seed")
        );
    }

    #[test]
    fn checks_conditional_fills_after_calculating_layout() {
        let mut args = base();
        let at = args
            .iter()
            .position(|arg| arg == "--row-alignment")
            .unwrap();
        args[at + 1] = "8".into();
        let error = Cli::try_parse_from(args.clone())
            .unwrap()
            .configuration()
            .unwrap_err();
        assert!(error.contains("--row-padding-fill"));
        args.extend(["--row-padding-fill", "0xcc"].map(OsString::from));
        let (_, layout) = Cli::try_parse_from(args).unwrap().configuration().unwrap();
        assert_eq!(layout.row_padding, 3);
        assert_eq!(layout.total_size, 16);
    }

    #[test]
    fn invalid_combinations_name_parameters_before_conditional_requirements() {
        let mut args = base();
        let at = args.iter().position(|arg| arg == "--bit-depth").unwrap();
        args[at + 1] = "12".into();
        let error = Cli::try_parse_from(args)
            .unwrap()
            .configuration()
            .unwrap_err();
        assert!(error.contains("--bit-depth"));
        assert!(error.contains("--storage-format"));
    }

    #[test]
    fn cli_enum_spelling_does_not_change_gui_serialization() {
        use clap::ValueEnum;
        assert_eq!(
            CfaPattern::QuadRggb.to_possible_value().unwrap().get_name(),
            "quad-rggb"
        );
        assert_eq!(
            serde_json::to_string(&CfaPattern::QuadRggb).unwrap(),
            r#""quadRggb""#
        );
        assert_eq!(
            TestPattern::HorizontalGradient
                .to_possible_value()
                .unwrap()
                .get_name(),
            "horizontal-gradient"
        );
        assert_eq!(
            serde_json::to_string(&TestPattern::HorizontalGradient).unwrap(),
            r#""horizontalGradient""#
        );
    }

    #[test]
    fn integer_parser_rejects_signs_overflow_and_non_integers() {
        assert_eq!(integer::<u16>("0xAbCd").unwrap(), 43981);
        assert_eq!(integer::<u64>("0Xffffffffffffffff").unwrap(), u64::MAX);
        for value in [
            "-1",
            "+1",
            " 1",
            "1.5",
            "0x",
            "0xgg",
            "18446744073709551616",
        ] {
            assert!(integer::<u64>(value).is_err(), "{value}");
        }
        assert!(integer::<u8>("256").is_err());
    }
}
