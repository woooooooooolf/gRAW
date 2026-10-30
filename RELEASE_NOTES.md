# gRAW V0.8.0

gRAW 是面向 Windows 的便携式 RAW 测试图像生成器，用于传感器图像链路开发、解码器验证及自动化测试数据构造。V0.8.0 将现有桌面工作台与完整命令行生成能力整合为同一个 EXE。

## 图像生成

- 支持 Mono、四种 Bayer 2×2 阵列及四种 Quad Bayer 阵列。
- 支持 Unpacked 8/16-bit、MIPI RAW10/12/14；Unpacked16 可设置大小端及 LSB/MSB 对齐。
- 支持固定像素值、灰度渐变、灰阶、棋盘格、确定性随机噪声及彩色测试图案。
- 可设置多帧、文件偏移、行/帧对齐及各区域填充字节；提供精确布局与文件大小计算。
- 输出为无文件头 RAW 像素数据，不包含 DNG/TIFF 文件头或相机元数据。

## GUI 与命令行

- 无参数启动桌面界面：中英文、六套主题、三档字号，支持进度、取消和输出定位。
- 有参数直接执行 CLI：所有影响当前输出的参数都需显式提供，按格式、CFA、图案及实际填充区域检查条件必填参数。
- 提供 --dry-run 仅检查、十进制/十六进制整数、安静模式及 Ctrl+C / Ctrl+Break 协作取消。
- 已有输出直接覆盖；临时文件写入成功后再替换目标，普通错误或协作取消时保留旧文件。
- 参数错误指出相关参数；退出码区分参数错误、输出错误和用户取消。
- 增加实际 Release EXE 端到端测试，并更新依赖与第三方组件清单。

**Windows 自动化调用请显式等待进程结束。** PowerShell 示例：

```powershell
Start-Process -FilePath .\gRAW-windows-x64-v0.8.0.exe -ArgumentList '--help' -NoNewWindow -Wait
```

完整参数和 PowerShell / CMD / Python 示例：
[中文指南](https://github.com/woooooooooolf/gRAW/blob/v0.8.0/docs/CLI.md) ·
[English guide](https://github.com/woooooooooolf/gRAW/blob/v0.8.0/docs/CLI.en.md)

## 下载与运行

- gRAW-windows-x64-v0.8.0.exe：Windows x64 便携版，无需安装。
- gRAW-windows-x64-v0.8.0.exe.sha256：SHA-256 校验文件。
- GUI 运行要求 Windows 10/11 x64 及 Microsoft Edge WebView2 Runtime；程序未进行代码签名。

## English

V0.8.0 combines the portable desktop workbench and a complete headless CLI in one Windows EXE. It supports Mono/Bayer/Quad Bayer, unpacked and MIPI storage, deterministic patterns, explicit byte layouts, and multi-frame output. The CLI requires every active generation parameter explicitly, supports dry-run and cooperative cancellation, and reports parameter-specific errors with distinct exit codes. Existing files are replaced after successful generation. Windows automation must explicitly wait for the process and inspect its exit code. See the English guide above for complete examples.
