# gRAW

gRAW（RAW Generator）是一款面向 Bayer RAW 格式测试图像的便携式生成工具。

当前版本：V0.0.1

## 技术栈

- Tauri 2
- Rust
- React 19 + TypeScript
- Vite 7

## 开发命令

```powershell
npm install
npm run tauri dev
```

## 发布便携版

```powershell
npm run tauri build -- --no-bundle
```

发布产物位于 `src-tauri/target/release/graw.exe`。目标 Windows 系统需要具备 Microsoft Edge WebView2 Runtime。

## 推荐开发环境

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
