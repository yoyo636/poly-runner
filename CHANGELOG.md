# Changelog

## 1.0.2

**大型工程版**：补齐 C++ / CMake 大型工程的运行能力。

### 新增

- **编译数据库支持**：自动查找 `compile_commands.json`（`build/`、`out/`、`cmake-build-*` 等常见位置），用里面**真实的编译参数**编译当前文件 —— 项目的 include 路径、宏定义、C++ 标准版本一个都不漏。
  - `link` 模式（默认）：自动收集同 target 的所有源文件一起编译链接，产出可执行文件并运行，产物放在项目内 `.poly-runner/bin/`。
  - `object` 模式：只把当前文件编译成 `.o`，做语法检查。
- **CMake 构建 → 跑产物**：识别 `CMakeLists.txt` 后自动「配置 → 构建 → 运行产物」串成一条命令；已配置过且已导出编译数据库时自动跳过重复 configure。
  构建产物位置按 CMake 生成器推断（多配置生成器会多一层 `Debug/`/`Release/`）。
- **多目标 / 多脚本选择**：CMake 有多个 `add_executable`、npm 有多个 script 时，弹窗让你选，不再盲猜第一个。
- **watch 模式**（`Cmd+Alt+W`）：保存文件后自动重新编译并运行；重跑前会先 Ctrl+C 停掉上一轮程序。
- 新增 `src/compileDb.ts`（编译数据库解析）与 `src/cmake.ts`（CMake 目标解析、产物定位）两个模块。

### 新增配置项

`polyRunner.useCompileDatabase`、`polyRunner.compileDatabaseMode`、`polyRunner.cmakeBuildDir`、`polyRunner.cmakeBuildType`、`polyRunner.cmakeParallelJobs`、`polyRunner.buildBeforeRun`、`polyRunner.watchMode`、`polyRunner.watchDebounceMs`、`polyRunner.projectOutputDir`

### 修复

- 解析编译数据库时正确处理 `-arch arm64` 这类「选项 + 独立参数」的写法（之前会把架构名当成待链接的文件）。
- 解析编译数据库时剔除编译器自身路径，避免被当成输入文件传给链接器。
- 编译数据库模式下补上「运行产物」，此前只链接不出可执行程序。

### 测试

端到端测试 18 → **22 条**，新增用例全部使用**真实 CMake 工程**（两个源文件 + 头文件）真机验证：配置、构建、多源文件链接、编译数据库编译并运行、多目标选择、watch 触发。

## 1.0.1

**扩面版**：语言覆盖 51 → **117 条**，扩展名 74 → **168 个**，并新增两个能力。

### 新增

- **项目级运行**（`Poly Runner: 运行当前项目`，`Cmd+Alt+P`）：从当前文件所在目录向上查找项目标志文件并运行整个项目。
  支持 `package.json`（自动挑 `start`/`dev`/`serve`/`build`/`test` 或第一个脚本）、`deno.json`、`Cargo.toml`、`go.mod`、`pom.xml`、`build.gradle`、`CMakeLists.txt`、`Makefile`、`justfile`、`Taskfile.yml`、`Rakefile`、`mix.exs`、`*.sln` / `*.csproj`。
- **stdin 管道模式**（`polyRunner.pipeFileToStdin`）：命令变成 `cat <文件> | <原命令>`；也可在自定义命令里用 `{{pipeFile}}` 精确控制。
- 新增 `src/projects.ts` 模块负责项目识别。
- 新增模板变量 `{{pipeFile}}`（共 15 个变量）。

### 语言扩充

新增 66 种语言，典型包括：

- 函数式：Clojure、Erlang、Racket、Scheme、Common Lisp、Emacs Lisp、Janet、Fennel、Hy、Standard ML、Prolog
- 脚本/方言：Fish、Nushell、ksh、csh、CoffeeScript、Raku、Zig 生态、Applescript、AutoHotkey、AutoIt、Vim script
- 编译型：Crystal、D、Odin、V、Fortran、Pascal、Ada、VHDL、Assembly、CUDA、Elm、Vala、Pony、Chapel、Ballerina、Idris、Agda、Nix、GLSL、WAT
- 模板/样式：Sass、Less、Stylus、Handlebars、EJS、Pug、Mustache、Liquid、Nunjucks、Twig、Jinja2、Mako、ERB、Haml、Slim、AsciiDoc
- 工程/杂项：Justfile、Taskfile、Rakefile、Terraform、CSV、Objective-C++

### 修复

- `appleScript` 的 language id 改为 VS Code 惯例的 `applescript`。
- D 语言的命令不再写死产物名（`./file` → `./{{basename}}`）。
- 解决扩展名冲突：`.mm` 归 Objective-C++、`.m` 归 Objective-C；`.v` 归 Verilog，V 语言保留手动选择入口。
- 去掉无扩展名可识别的 Mix 条目（mix 项目由项目级运行接管）。

## 1.0.0 (Beta)

首个 Beta 版本：**面向所有语言**的 VS Code 运行器。

核心思路不变：把一条**真实的 shell 命令**敲进集成终端，由系统 shell 调用系统编译器 / 解释器完成编译与运行。编译报错直接显示在终端里、程序能正常读 stdin、跑完还能在同一终端继续敲命令。

### 两种执行通道

- **集成终端**（默认）：命令敲进 `Poly Runner` 终端，可交互、可继续敲命令。
- **输出面板**：捕获 stdout/stderr，带超时保护和进程组终止，适合需要拿输出的场景。

### 多语言

- 内置 **117 种语言**的运行命令：C/C++、Python、Java、Kotlin、Scala、Groovy、JavaScript/TypeScript、Go、Rust、Swift、C#、F#、Objective-C、Dart、Haskell、Julia、Elixir、OCaml、Nim、Zig、Ruby、PHP、Perl、Lua、R、Shell、PowerShell、Batch、LaTeX、SQL、JSON、HTML、Vue、Svelte、Astro、Verilog……
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
