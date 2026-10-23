# Changelog

## 1.0.0 (Beta)

首个 Beta 版本：**面向所有语言**的 VS Code 运行器。

核心思路不变：把一条**真实的 shell 命令**敲进集成终端，由系统 shell 调用系统编译器 / 解释器完成编译与运行。编译报错直接显示在终端里、程序能正常读 stdin、跑完还能在同一终端继续敲命令。

### 两种执行通道

- **集成终端**（默认）：命令敲进 `Poly Runner` 终端，可交互、可继续敲命令。
- **输出面板**：捕获 stdout/stderr，带超时保护和进程组终止，适合需要拿输出的场景。

### 多语言

- 内置 **51 种语言**的运行命令：C/C++、Python、Java、Kotlin、Scala、Groovy、JavaScript/TypeScript、Go、Rust、Swift、C#、F#、Objective-C、Dart、Haskell、Julia、Elixir、OCaml、Nim、Zig、Ruby、PHP、Perl、Lua、R、Shell、PowerShell、Batch、LaTeX、SQL、JSON、HTML、Vue、Svelte、Astro、Verilog……
- 识别顺序：用户绑定 → VS Code 文件类型 → 扩展名 → 脚本首行 shebang。
- 识别不出来时会弹窗让你现场选一种，并可记住绑定。
- C/C++ 自动探测 `g++` / `clang++` / `c++` / 版本化名字 / Windows MSVC `cl.exe`。

### 命令模板

- 变量：`{{file}}` `{{fileNoExt}}` `{{fileName}}` `{{basename}}` `{{dir}}` `{{workspaceFolder}}` `{{relativeFile}}` `{{tmpFile}}` `{{out}}` `{{compiler}}` `{{std}}` `{{warnings}}` `{{args}}` `{{className}}`。
- 路径类变量由插件自动做 shell 转义，模板里不用自己加引号。
- `polyRunner.customCommands` / `customCommandsByExtension` 覆盖内置命令；`polyRunner.languageAliases` 给任意扩展名绑定运行方式。

### 健壮性

- 运行前检查编译器 / 解释器是否真的存在，缺失时提前提示，而不是让终端里飘一句 `command not found`。
- 未保存的新文件会先保存；保存被取消则中止并提示。
- 跨目录运行时自动先发一条 `cd`；Windows 下用 `cls` 清屏。
- 输出面板模式超时后终止整个进程组，不留残余编译进程。
- 停止命令同时处理终端（Ctrl+C）和输出面板（杀进程）。

### 命令

`运行当前文件` `运行选中的代码` `在集成终端运行` `在输出面板运行` `停止正在运行的程序` `打开运行终端` `选择该文件的运行方式` `编辑当前语言的运行命令` `复制当前文件的运行命令` `显示运行输出`

### 已知限制

- Windows 下使用 MSVC 需要把默认终端设为开发者命令提示符，否则找不到标准库。
- TypeScript 默认走 `npx tsx`，需要本地装有 tsx/ts-node。
- 依赖 GUI 的程序（需要 TTY、图形界面）建议用终端模式，输出面板模式没有 TTY。
