# 命令行使用指南

同一个 Windows EXE 提供 GUI 和 CLI。下文把文件名写作 `gRAW.exe`，也可以直接使用带版本号的发布文件名。

- 无参数：打开 GUI。
- 有参数：执行 CLI；不会创建 Tauri 窗口或初始化 WebView。
- `--help` / `--version`：输出帮助 / 版本并退出。
- 实际生成必须指定 `--output`；相对路径以调用进程的工作目录为准，使用准确文件名，不自动补扩展名。
- 已有文件直接覆盖，不询问。先写临时文件，成功后替换目标；普通错误或协作取消时保留旧文件。

## 参数规则

**所有影响当前输出的参数都必须显式提供。** 不读取 GUI 配置，不使用 GUI 默认值，不自动调整位深、钳制像素值或切换图案。不适用的条件参数也会报错，而不是被忽略。

整数支持十进制及 `0x` / `0X` 十六进制，不接受负数、小数、正号或单位后缀。

| 始终必填的生成参数 | 约束 |
| --- | --- |
| `--width`、`--height` | 1–1,000,000 像素；MIPI10/14 宽度是 4 的倍数，MIPI12 是 2 的倍数 |
| `--storage-format` | `unpacked8`、`unpacked16`、`mipi10`、`mipi12`、`mipi14` |
| `--bit-depth` | Unpacked8 为 8；Unpacked16 为 8–16；MIPI 为对应的 10/12/14；即使格式已经限定也必须填写 |
| `--cfa-pattern` | `mono`、`rggb`、`grbg`、`gbrg`、`bggr`、`quad-rggb`、`quad-grbg`、`quad-gbrg`、`quad-bggr` |
| `--test-pattern` | `fixed`、`horizontal-gradient`、`vertical-gradient`、`gray-steps`、`color-bars`、`color-gradient`、`rgb-gradient`、`checkerboard`、`random-noise`、`black`、`white` |
| `--frame-count` | 1–1,000,000 |
| `--row-alignment` | 1–1,048,576 字节；无行填充时也要明确填写 1 |
| `--frame-alignment` | 1–1,073,741,824 字节；无帧填充时也要明确填写 1 |
| `--file-offset` | 0–9,007,199,254,740,991 字节；无偏移时也要明确填写 0 |

Mono 不支持 `color-bars`、`color-gradient`、`rgb-gradient`。

| 条件参数 | 何时必填 |
| --- | --- |
| `--endianness little\|big`、`--bit-alignment lsb\|msb` | Unpacked16，包括 16-bit 采样 |
| `--mono` | fixed 图案 + Mono |
| `--r`、`--gr`、`--gb`、`--b` | fixed 图案 + 彩色 CFA；每个值在当前位深范围内 |
| `--gray-steps` | gray-steps 图案，2–256 |
| `--checker-size` | checkerboard 图案，1–4,294,967,295 像素 |
| `--noise-seed` | random-noise 图案，0–9,007,199,254,740,991 |
| `--offset-fill` | file-offset > 0，填充值 0–255 |
| `--row-padding-fill` | 计算得到的行末填充 > 0，填充值 0–255 |
| `--frame-padding-fill` | 计算得到的帧末填充 > 0，填充值 0–255 |

校验先处理参数语法、类型及基础参数缺失，再检查共享数值范围和组合约束，最后检查条件参数及实际填充区域。前置条件错误时停止，不继续产生依赖该条件的布局错误。错误至少指出一个相关参数；缺失的条件参数可一次列出多个。

## 仅检查

`--dry-run` 执行完整配置校验，输出行载荷、行跨度、行填充、帧数据、帧跨度、帧填充和总字节数，不创建或修改输出文件，可以省略 `--output`。它不检查输出目录是否存在、可写或磁盘空间是否足够。

`--quiet` 隐藏进度和成功输出（也包括 dry-run 布局），保留错误。正常成功摘要写 stdout，错误及交互式终端进度写 stderr；stderr 被重定向时不打印动态进度。

## Windows 调用与等待

发布程序保留 Windows GUI 子系统，以便无参数双击时不弹出额外控制台。**PowerShell 直接运行 GUI EXE 可能提前返回，不能把“命令提示符返回”当成生成完成，也不要立即读取旧的 $LASTEXITCODE。** 程序连接父控制台不能改变调用方的等待策略。

### PowerShell

使用 `Start-Process -Wait -PassThru`，读取返回进程对象的 `ExitCode`。`ArgumentList` 会组合成命令行，所以包含空格的参数需要保留引号。

```powershell
$cliArgs = @(
  '--output', '"D:\RAW 输出\test.raw"',
  '--width', '1920', '--height', '1080',
  '--storage-format', 'mipi10', '--bit-depth', '10',
  '--cfa-pattern', 'rggb', '--test-pattern', 'color-bars',
  '--frame-count', '1', '--row-alignment', '1',
  '--frame-alignment', '1', '--file-offset', '0'
)
$p = Start-Process -FilePath .\gRAW.exe -ArgumentList $cliArgs -NoNewWindow -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "gRAW failed: $($p.ExitCode)" }
```

检查同一配置：在 `$cliArgs` 中加入 `'--dry-run'`，也可移除 `--output` 及其路径。

获取帮助并等待显示完成：

```powershell
Start-Process -FilePath .\gRAW.exe -ArgumentList '--help' -NoNewWindow -Wait
```

如果需要留存日志，可加 `-RedirectStandardOutput result.txt -RedirectStandardError error.txt`。没有父控制台时程序不会新建控制台；调用方应捕获或重定向输出以取得日志。

### CMD / 批处理

使用显式等待；在批处理里必须紧接着保存退出码：

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
    r".\gRAW.exe", "--output", r"D:\RAW 输出\test.raw",
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

## 退出码和取消

| 退出码 | 含义 |
| --- | --- |
| 0 | 生成、检查、帮助或版本查询成功 |
| 1 | 内部执行、控制台处理或日志输出失败 |
| 2 | 参数语法、缺失、范围、组合或适用性错误 |
| 3 | 输出路径、磁盘空间或文件写入错误 |
| 130 | 用户协作取消 |

连接控制台时支持 Ctrl+C 和 Ctrl+Break，按生成器检查点停止并清理临时文件。强制结束进程、关机或断电不属于协作取消，可能留下临时文件。实际 I/O 错误也可能发生在生成途中。

## 开发验证

```powershell
npm run tauri build -- --no-bundle
npm run test:cli
```

测试默认使用 `src-tauri/target/release/graw.exe`；可通过环境变量 `GRAW_EXE` 指向其他 EXE。测试调用会显式等待进程结束，检查字节输出、CFA、所有图案与格式、条件参数、错误码、覆盖和路径行为。