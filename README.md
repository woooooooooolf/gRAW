# gRAW

gRAW（RAW Generator）是一款面向 Bayer RAW 格式测试图像的便携式生成工具。

当前版本：V0.0.6

## 主要能力

- 支持 Mono、常见 2×2 Bayer CFA 与 Quad CFA。
- 支持 Unpacked8、Unpacked16、MIPI RAW10、RAW12、RAW14。
- 支持 8–16 bit；奇数位深限定为 Unpacked16。
- 支持大小端、有效位对齐、行/帧对齐、文件起始偏移和多帧输出。
- 支持固定值、渐变、灰阶、彩条、棋盘、随机噪声、黑场和白场测试图。
- 彩色 CFA 可分别设置 R、Gr、Gb、B 像素值，并可配置偏移、行填充和帧填充字节。
- 提供生成信息、精确文件大小、参数诊断、生成进度和取消操作。
- 提供中文/英文、三套深色主题、三套浅色主题和三档阅读字号。
- 采用紧凑单页布局，在推荐窗口尺寸内同时呈现全部参数和生成信息。

## 技术栈

- Tauri 2
- Rust
- React 19 + TypeScript
- Vite 7

## 开发命令

```powershell
npm install
npm run licenses
npm run tauri dev
```

`npm run licenses` 会根据当前 Windows x64 构建依赖重新生成“关于 → 开源组件”清单。

## 质量检查

```powershell
npm run build
npm run test:frontend
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
```

## 发布便携版

```powershell
npm run tauri build -- --no-bundle
```

发布产物位于 `src-tauri/target/release/graw.exe`。它是无需安装的单个便携 EXE，不生成安装包；目标 Windows 系统需要具备 Microsoft Edge WebView2 Runtime。

## 推荐开发环境

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
