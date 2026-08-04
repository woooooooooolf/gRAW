<div align="center">

# gRAW

**A portable Bayer RAW test image generator for Windows.**

**English** · [简体中文](./README.zh-CN.md)

[![CI](https://img.shields.io/badge/CI-configured-2088FF?style=flat-square&logo=githubactions&logoColor=white)](./.github/workflows/ci.yml)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D4?style=flat-square&logo=windows11&logoColor=white)
![Release](https://img.shields.io/badge/release-v0.0.9-20B2AA?style=flat-square)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-4C1?style=flat-square)](#license)
![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=111111)

</div>

gRAW generates deterministic, headerless RAW test images for sensor-pipeline development, decoder validation, image-quality experiments, and automated test fixtures. It combines exact byte-layout controls with a compact bilingual desktop interface.

> [!IMPORTANT]
> gRAW writes pixel payloads, alignment padding, and optional leading bytes exactly as configured. It does not add camera metadata, DNG/TIFF headers, or color-processing metadata.

## Highlights

- Mono, four standard 2×2 Bayer layouts, and four Quad Bayer layouts.
- Unpacked 8-bit, Unpacked 16-bit, MIPI RAW10, RAW12, and RAW14 output.
- 8–16-bit sample depths where supported by the selected storage format.
- Little-/big-endian Unpacked 16-bit output with LSB/MSB alignment controls.
- Configurable row alignment, frame alignment, file offset, fill bytes, and frame count.
- Monochrome and color test-pattern groups with CFA-aware filtering.
- Exact layout preview, estimated file size, validation feedback, progress, and cancellation.
- Chinese and English UI, six color themes, and three reading-size levels.
- Single-file portable Windows executable; no installer is required.

## Supported configurations

### CFA arrays

| Family | Options |
| --- | --- |
| Monochrome | `Mono` |
| Bayer 2×2 | `RGGB`, `GRBG`, `GBRG`, `BGGR` |
| Quad Bayer | `Quad RGGB`, `Quad GRBG`, `Quad GBRG`, `Quad BGGR` |

### Storage formats

| Format | Bit depth | Width constraint | Byte-order controls |
| --- | ---: | --- | --- |
| Unpacked 8 | 8 bit | None | Not applicable |
| Unpacked 16 | 8–16 bit | None | Little/big endian, LSB/MSB aligned |
| MIPI RAW10 | 10 bit | Multiple of 4 pixels | Defined by MIPI packing |
| MIPI RAW12 | 12 bit | Multiple of 2 pixels | Defined by MIPI packing |
| MIPI RAW14 | 14 bit | Multiple of 4 pixels | Defined by MIPI packing |

### Test patterns

| Menu group | Patterns | Availability |
| --- | --- | --- |
| Monochrome Test Patterns | Fixed Fill, Horizontal Gray Gradient, Vertical Gray Gradient, Gray Steps, Checkerboard, Random Noise, Black, White | Mono and all color CFAs |
| Color Test Patterns | Color Bars, Color Gradient, RGB Gradients | Bayer and Quad Bayer CFAs only |

When a color pattern is active and the CFA is changed to Mono, gRAW automatically selects Gray Steps as a compatible fallback. The same rule is enforced by both frontend and Rust backend validation.

## System requirements

### Running the portable app

- Windows 10 or Windows 11, x64.
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) installed on the target system.

### Development

- Node.js 22 or newer and npm.
- Stable Rust toolchain with `rustfmt`.
- Microsoft C++ Build Tools required by Tauri on Windows.
- WebView2 development/runtime components.

## Quick start

### Use a portable build

1. Obtain a file named `gRAW-V<version>-windows-x64.exe` from the project release artifacts.
2. Launch the executable directly; installation is not required.
3. Configure image dimensions and CFA layout.
4. Select a compatible test pattern and storage format.
5. Review the calculated layout and estimated output size.
6. Choose an output path and generate the RAW file.

### Run from source

```powershell
npm install
npm run licenses
npm run tauri dev
```

`npm run licenses` regenerates the third-party component list shown under **About → Open-source components** for the current Windows x64 dependency set.

## Build and quality checks

| Command | Purpose |
| --- | --- |
| `npm run build` | Type-check and build the React frontend |
| `npm run test:frontend` | Run input, viewport, typography, CFA, and interface regression tests |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Verify Rust formatting |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Run RAW layout, packing, pattern, and generator tests |
| `npm run tauri build -- --no-bundle` | Build the portable Windows executable |

The unbundled executable is written to `src-tauri/target/release/graw.exe`. Iteration artifacts use the naming convention `gRAW-V<version>-windows-x64.exe`.

## Continuous integration

The [GitHub Actions workflow](./.github/workflows/ci.yml) runs on pushes, pull requests, and manual dispatch. It installs Node.js and Rust, then verifies:

- Frontend tests and production build.
- Rust formatting.
- Rust unit and integration tests.

The badge above indicates that CI is configured. A repository-specific live status badge can replace it after a GitHub remote is assigned.

## Output model

For a valid configuration, gRAW calculates the file size as:

```text
total size = file offset + aligned frame stride × frame count
```

Rows and frames are padded to their configured alignments. Offset, row-padding, and frame-padding regions each have an independently configurable fill byte. Generation is written to a temporary file first and renamed into place only after successful completion; cancelled or failed runs remove the temporary output.

## Project layout

```text
gRAW/
├─ .github/workflows/   GitHub Actions CI
├─ scripts/             License-data generation
├─ src/                 React and TypeScript frontend
│  ├─ components/       UI components
│  └─ generated/        Generated third-party license data
├─ src-tauri/           Tauri and Rust backend
│  └─ src/raw/          Layout, patterns, packing, and file generation
├─ tests/               Frontend regression tests
└─ release/             Local portable release artifacts (Git-ignored)
```

## License

gRAW is dual-licensed under either of the following licenses, at your option:

- [Apache License, Version 2.0](./LICENSE-APACHE)
- [MIT License](./LICENSE-MIT)

The SPDX expression is `MIT OR Apache-2.0`. Third-party component licenses are generated from the dependency graph and remain available in the application's About dialog.
