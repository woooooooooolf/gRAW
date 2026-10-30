# Command-line guide

The same Windows EXE opens the GUI without arguments and runs the CLI when given arguments. Examples call it `gRAW.exe`; substitute the versioned release filename if needed.

CLI execution does not create a Tauri window or initialize WebView. An actual generation requires `--output`. Relative paths use the caller's working directory, and no extension is appended. Existing output is replaced without prompting after successful generation. Ordinary failures and cooperative cancellation preserve the previous output.

## Explicit parameters

No GUI settings or generation defaults are read. Every active parameter must be explicit. Values are never clamped or silently corrected, and inactive conditional parameters are rejected.

Integers accept decimal and `0x`/`0X` hexadecimal notation. Signs, fractions, whitespace and unit suffixes are rejected.

| Always required | Values |
| --- | --- |
| `--width`, `--height` | 1..1,000,000; MIPI10/14 width must be divisible by 4, MIPI12 by 2 |
| `--storage-format` | unpacked8, unpacked16, mipi10, mipi12, mipi14 |
| `--bit-depth` | 8 for unpacked8, 8..16 for unpacked16, matching 10/12/14 for MIPI; always explicit |
| `--cfa-pattern` | mono, rggb, grbg, gbrg, bggr, quad-rggb, quad-grbg, quad-gbrg, quad-bggr |
| `--test-pattern` | fixed, horizontal-gradient, vertical-gradient, gray-steps, color-bars, color-gradient, rgb-gradient, checkerboard, random-noise, black, white |
| `--frame-count` | 1..1,000,000 |
| `--row-alignment` | 1..1,048,576 bytes; explicitly use 1 for no alignment padding |
| `--frame-alignment` | 1..1,073,741,824 bytes; explicitly use 1 for no alignment padding |
| `--file-offset` | 0..9,007,199,254,740,991 bytes; explicitly use 0 for no offset |

Mono rejects color-bars, color-gradient and rgb-gradient.

| Conditional parameters | Required only when |
| --- | --- |
| `--endianness little\|big`, `--bit-alignment lsb\|msb` | unpacked16, including 16-bit samples |
| `--mono` | fixed pattern with Mono |
| `--r`, `--gr`, `--gb`, `--b` | fixed pattern with a color CFA; all samples must fit the selected depth |
| `--gray-steps` | gray-steps pattern; 2..256 |
| `--checker-size` | checkerboard pattern; 1..4,294,967,295 pixels |
| `--noise-seed` | random-noise pattern; 0..9,007,199,254,740,991 |
| `--offset-fill` | nonzero file offset; 0..255 |
| `--row-padding-fill` | calculated row padding is nonzero; 0..255 |
| `--frame-padding-fill` | calculated frame padding is nonzero; 0..255 |

Validation checks syntax, types and missing base parameters first, then shared numeric and combination constraints, then conditional parameters including actual padding. Errors name affected parameters. Missing conditional parameters may be listed together.

## Dry-run and output

`--dry-run` validates the configuration and prints exact row payload/stride/padding, frame data/stride/padding, and total bytes. It does not access the output file, check directory permissions or free disk space, or require `--output`.

`--quiet` suppresses progress and success output (including dry-run layout), but preserves errors. Success output goes to stdout; errors and interactive progress go to stderr. Redirected stderr receives no dynamic progress.

## Waiting for the Windows GUI-subsystem process

The release EXE retains the GUI subsystem so ordinary GUI launch has no extra console window. **PowerShell can return immediately when directly invoking this EXE.** Console attachment cannot change the shell's waiting policy. Automation must wait for the child and inspect its actual exit code.

### PowerShell

Use `Start-Process -Wait -PassThru` and its returned `ExitCode`. Since `ArgumentList` is joined into a command line, preserve quotes around paths containing spaces.

```powershell
$cliArgs = @(
  '--output', '"D:\RAW output\test.raw"',
  '--width', '1920', '--height', '1080',
  '--storage-format', 'mipi10', '--bit-depth', '10',
  '--cfa-pattern', 'rggb', '--test-pattern', 'color-bars',
  '--frame-count', '1', '--row-alignment', '1',
  '--frame-alignment', '1', '--file-offset', '0'
)
$p = Start-Process -FilePath .\gRAW.exe -ArgumentList $cliArgs -NoNewWindow -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "gRAW failed: $($p.ExitCode)" }
```

Add `'--dry-run'` to the array to validate without writing; output and its path may then be omitted. Help can be displayed with:

```powershell
Start-Process -FilePath .\gRAW.exe -ArgumentList '--help' -NoNewWindow -Wait
```

Use `-RedirectStandardOutput result.txt -RedirectStandardError error.txt` to retain logs. If no parent console exists, no new console is allocated; the caller must capture or redirect output to receive logs.

### CMD / batch

```bat
@echo off
start "" /b /wait ".\gRAW.exe" --output ".\test.raw" --width 1920 --height 1080 --storage-format mipi10 --bit-depth 10 --cfa-pattern rggb --test-pattern color-bars --frame-count 1 --row-alignment 1 --frame-alignment 1 --file-offset 0
set "graw_result=%errorlevel%"
exit /b %graw_result%
```

### Python

```python
import subprocess

result = subprocess.run([
    r".\gRAW.exe", "--output", r"D:\RAW output\test.raw",
    "--width", "1920", "--height", "1080",
    "--storage-format", "mipi10", "--bit-depth", "10",
    "--cfa-pattern", "rggb", "--test-pattern", "color-bars",
    "--frame-count", "1", "--row-alignment", "1",
    "--frame-alignment", "1", "--file-offset", "0",
], capture_output=True, text=True, encoding="utf-8")
print(result.stdout, end="")
if result.returncode:
    raise RuntimeError(result.stderr)
```

## Exit codes and cancellation

| Code | Meaning |
| --- | --- |
| 0 | Successful generation, validation, help or version query |
| 1 | Internal execution, console-handler or log-output failure |
| 2 | Invalid, missing, conflicting or inactive parameter |
| 3 | Output path, disk-space or write failure |
| 130 | Cooperative user cancellation |

When attached to a console, Ctrl+C and Ctrl+Break set the generator's cancellation flag. Cleanup takes place at generator checkpoints. Forced termination, shutdown and power loss can leave temporary files. I/O failures can also occur during generation.

## Developer verification

```powershell
npm run tauri build -- --no-bundle
npm run test:cli
```

Tests default to `src-tauri/target/release/graw.exe`. Set `GRAW_EXE` to test a different executable. They explicitly wait for the process and cover exact bytes, CFA mapping, all patterns and formats, explicit parameters, errors, overwriting and paths.