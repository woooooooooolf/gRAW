# 开发与构建指南

本仓库是 gRAW 的源码。以下说明供需要自行构建、修改或本地使用本工具的人参考。

## 前置依赖

- Node.js 22 或更高版本，npm
- Stable Rust 工具链（含 `rustfmt`）
- Windows 10/11 x64，Microsoft C++ Build Tools（Tauri 构建需要）
- WebView2 运行时

## 本地开发

```powershell
npm ci
npm run licenses   # 重新生成第三方许可证数据
npm run tauri dev
```

## 质量检查

改动涉及代码时，请确保以下检查通过：

- `npm run licenses:check`：第三方组件清单与锁文件一致
- `npm run test:frontend`：前端回归测试
- `npm run build`：前端类型检查与生产构建
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：Rust 格式检查
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`：严格 Rust 代码检查
- `cargo test --manifest-path src-tauri/Cargo.toml`：Rust 测试

## 发布流程

推送 `v*` 标签会自动触发 GitHub Actions 发布工作流：构建便携版、生成 SHA-256 校验文件并创建 GitHub Release。发布说明取自仓库根目录的 `RELEASE_NOTES.md`，发版前请更新其中的内容。

## 代码约定

- 前端：TypeScript strict 模式，React 函数组件。
- 后端：Rust，RAW 相关逻辑集中在 `src-tauri/src/raw/`。
- 提交信息参考仓库既有风格（中文，带类型前缀，如 `功能：`、`修复：`、`文档：`、`构建：`）。

## 问题反馈

使用中遇到的问题可以提交 Issue，中文或英文均可。
