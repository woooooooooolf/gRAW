<div align="center">

# gRAW

**面向 Windows 的便携式 Bayer RAW 测试图像生成器。**

[English](./README.md) · **简体中文**

[![CI](https://img.shields.io/badge/CI-%E5%B7%B2%E9%85%8D%E7%BD%AE-2088FF?style=flat-square&logo=githubactions&logoColor=white)](./.github/workflows/ci.yml)
![平台](https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%20x64-0078D4?style=flat-square&logo=windows11&logoColor=white)
![版本](https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v0.0.9-20B2AA?style=flat-square)
[![许可证](https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF%E8%AF%81-MIT%20OR%20Apache--2.0-4C1?style=flat-square)](#许可证)
![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=111111)

</div>

gRAW 用于生成确定性的无文件头 RAW 测试图像，适合传感器图像链路开发、解码器验证、图像质量实验和自动化测试数据构造。它将精确的字节布局控制与紧凑的中英文桌面界面结合在一起。

> [!IMPORTANT]
> gRAW 会严格按照配置写入像素载荷、对齐填充和可选的文件起始字节，但不会添加相机元数据、DNG/TIFF 文件头或色彩处理元数据。

## 功能亮点

- 支持 Mono、四种标准 2×2 Bayer 阵列和四种 Quad Bayer 阵列。
- 支持 Unpacked 8-bit、Unpacked 16-bit、MIPI RAW10、RAW12 和 RAW14。
- 在存储格式允许的范围内支持 8–16 bit 采样位深。
- Unpacked 16-bit 支持大小端以及 LSB/MSB 有效位对齐。
- 支持行对齐、帧对齐、文件起始偏移、各区域填充值和多帧输出。
- 黑白与彩色测试图案分组，并根据 CFA 自动过滤不兼容选项。
- 提供精确布局预览、预计文件大小、参数校验、生成进度和取消操作。
- 提供中英文界面、六套配色主题和三档阅读字号。
- 生成单文件 Windows 便携版，无需安装。

## 支持范围

### CFA 阵列

| 类型 | 选项 |
| --- | --- |
| 黑白 | `Mono` |
| Bayer 2×2 | `RGGB`、`GRBG`、`GBRG`、`BGGR` |
| Quad Bayer | `Quad RGGB`、`Quad GRBG`、`Quad GBRG`、`Quad BGGR` |

### 存储格式

| 格式 | 位深 | 宽度要求 | 字节顺序控制 |
| --- | ---: | --- | --- |
| Unpacked 8 | 8 bit | 无 | 不适用 |
| Unpacked 16 | 8–16 bit | 无 | 大小端、LSB/MSB 对齐 |
| MIPI RAW10 | 10 bit | 4 像素的倍数 | 由 MIPI 打包方式规定 |
| MIPI RAW12 | 12 bit | 2 像素的倍数 | 由 MIPI 打包方式规定 |
| MIPI RAW14 | 14 bit | 4 像素的倍数 | 由 MIPI 打包方式规定 |

### 测试图案

| 菜单分组 | 图案 | 可用 CFA |
| --- | --- | --- |
| 黑白测试图案 | 固定值填充、水平灰度渐变、垂直灰度渐变、灰阶阶梯、棋盘格、随机噪声、全黑、全白 | Mono 及全部彩色 CFA |
| 彩色测试图案 | 彩条、彩色渐变、RGB 渐变 | Bayer 与 Quad Bayer CFA |

当正在使用彩色图案并将 CFA 切换为 Mono 时，gRAW 会自动回退到兼容的“灰阶阶梯”。前端校验与 Rust 后端会执行相同的限制规则。

## 系统要求

### 运行便携版

- Windows 10 或 Windows 11，x64。
- 目标系统已安装 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

### 开发环境

- Node.js 22 或更高版本及 npm。
- Stable Rust 工具链，并安装 `rustfmt`。
- Tauri 在 Windows 上所需的 Microsoft C++ Build Tools。
- WebView2 开发/运行时组件。

## 快速开始

### 使用便携版

1. 从项目发布产物中获取 `gRAW-V<版本>-windows-x64.exe`。
2. 直接运行该文件，无需安装。
3. 配置图像尺寸和 CFA 阵列。
4. 选择兼容的测试图案与存储格式。
5. 检查计算得到的布局和预计输出大小。
6. 选择输出路径并生成 RAW 文件。

### 从源码运行

```powershell
npm install
npm run licenses
npm run tauri dev
```

`npm run licenses` 会根据当前 Windows x64 依赖重新生成 **关于 → 开源组件** 中展示的第三方组件清单。

## 构建与质量检查

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 对 React 前端进行类型检查和生产构建 |
| `npm run test:frontend` | 执行输入、窗口缩放、字号、CFA 和界面回归测试 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 检查 Rust 代码格式 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 执行 RAW 布局、打包、图案和生成器测试 |
| `npm run tauri build -- --no-bundle` | 构建 Windows 便携版程序 |

未打包的可执行文件生成在 `src-tauri/target/release/graw.exe`。每轮迭代的便携版采用 `gRAW-V<版本>-windows-x64.exe` 命名。

## 持续集成

[GitHub Actions 工作流](./.github/workflows/ci.yml)会在推送、拉取请求和手动触发时运行，并安装 Node.js 与 Rust 后检查：

- 前端测试和生产构建。
- Rust 格式。
- Rust 单元测试与集成测试。

顶部徽章表示 CI 已完成配置。仓库绑定 GitHub 远端后，可以将其替换为对应仓库的实时工作流状态徽章。

## 输出模型

对于有效配置，gRAW 按以下关系计算文件大小：

```text
文件总大小 = 文件起始偏移 + 对齐后的帧跨度 × 帧数量
```

每行和每帧都会按照设定的对齐值进行填充。起始偏移、行末填充和帧末填充可以分别设置填充字节。生成过程先写入临时文件，仅在成功完成后将其重命名为目标文件；取消或失败时会删除临时输出。

## 项目结构

```text
gRAW/
├─ .github/workflows/   GitHub Actions 持续集成
├─ scripts/             第三方许可证数据生成脚本
├─ src/                 React 与 TypeScript 前端
│  ├─ components/       界面组件
│  └─ generated/        自动生成的第三方许可证数据
├─ src-tauri/           Tauri 与 Rust 后端
│  └─ src/raw/          布局、图案、打包和文件生成
├─ tests/               前端回归测试
└─ release/             本地便携版产物（Git 忽略）
```

## 许可证

gRAW 采用双许可证，使用者可以任选以下一种许可证：

- [Apache License, Version 2.0](./LICENSE-APACHE)
- [MIT License](./LICENSE-MIT)

对应的 SPDX 表达式为 `MIT OR Apache-2.0`。第三方组件许可证仍根据依赖关系生成，可在应用程序的“关于”对话框中查看。
