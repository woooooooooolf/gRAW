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
- `npm run tauri build -- --no-bundle`：构建实际 Windows Release EXE
- `npm run test:cli`：对 Release EXE 运行命令行端到端测试（可用 GRAW_EXE 指定其他构建路径）

## 发布流程

推送 `v*` 标签会自动触发 GitHub Actions 发布工作流：构建便携版、生成 SHA-256 校验文件并创建 GitHub Release。发布说明取自仓库根目录的 `RELEASE_NOTES.md`，发版前请更新其中的内容。

### 发布产物约束

- 文件名统一为 `名称-版本-平台-架构.后缀`，版本使用发布标签（如 `v0.8.1`）。当前 Windows x64 的示例为 `gRAW-v0.8.1-windows-x64.exe`。
- 直接发布可执行文件，不额外打包为 ZIP、7z、tar 等压缩包。
- 校验文件必须在完整产物文件名后追加 `.sha256`，例如 `gRAW-v0.8.1-windows-x64.exe.sha256`；内容为 SHA-256 值、两个空格及对应产物文件名。
- 每个平台和架构仅上传两个文件：程序文件及其对应的 `.sha256` 文件。后续增加平台时也必须遵循此约束，不上传安装包、调试符号或额外校验汇总文件。
- GitHub 自动提供的源码归档不属于工作流上传的构建产物。

### 发布说明约束

- 正文使用简体中文，关键名称及缩写（如 gRAW、Windows、RAW、CLI）保留英文，不提供其他语言版本。
- 不添加主标题、简介、下载章节或其他段落；GitHub Release 的名称仍由工作流设置为 `gRAW <版本>`。
- 仅按顺序使用 `## Changed`、`## Fixed`、`## Docs` 三个小标题，各节使用 Markdown 无序列表列出本次版本的修改点，不重复罗列全部既有功能。
- `Changed` 记录功能和行为变更，`Fixed` 记录问题修复，`Docs` 记录文档变更。某节没有修改时保留该节并写 `- 暂无。`。
- 发版前执行 `npm run release:check` 检查结构，并人工确认正文为简体中文、内容与待发布版本一致。CI 和发布工作流也会执行该检查；检查失败会阻止继续发布。

发布说明模板：

```markdown
## Changed

- 描述本次功能或行为变更。

## Fixed

- 描述本次问题修复；无修改时写“暂无。”。

## Docs

- 描述本次文档变更。
```

这些约束适用于后续发布；修改工作流不会追溯修改已发布的 Release 或其附件。迭代时请同步维护本指南、发布工作流和 `RELEASE_NOTES.md`。

## 代码约定

- 前端：TypeScript strict 模式，React 函数组件。
- 后端：Rust，RAW 相关逻辑集中在 `src-tauri/src/raw/`。
- 提交信息参考仓库既有风格（中文，带类型前缀，如 `功能：`、`修复：`、`文档：`、`构建：`）。

## 问题反馈

使用中遇到的问题可以提交 Issue，中文或英文均可。
