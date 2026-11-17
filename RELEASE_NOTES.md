## Changed

- 同一个 Windows 便携版 EXE 整合 GUI 与完整 CLI，无参数启动桌面界面，有参数执行命令行任务。
- 支持 Mono、Bayer、Quad Bayer，Unpacked 8/16-bit 与 MIPI RAW10/12/14，以及多种确定性测试图案。
- 支持多帧、文件偏移、行/帧对齐和填充字节配置，输出不带文件头的 RAW 像素数据。
- CLI 要求显式提供影响输出的参数，支持 `--dry-run`、十进制/十六进制整数、安静模式及 Ctrl+C / Ctrl+Break 协作取消；退出码区分参数错误、输出错误和用户取消。
- 已有输出在临时文件写入成功后替换，普通错误或协作取消时保留旧文件。
- 增加实际 Release EXE 的 CLI 端到端测试，更新依赖与第三方组件清单。

## Fixed

- 暂无。

## Docs

- 补充 [CLI 使用指南](https://github.com/woooooooooolf/gRAW/blob/v0.8.0/docs/CLI.md)，包含完整参数及 PowerShell、CMD、Python 自动化调用示例。
- Windows 自动化调用需显式等待 EXE 进程结束，并检查退出码。
