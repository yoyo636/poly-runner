# Poly Runner (Beta)

[![GitHub stars](https://img.shields.io/github/stars/yoyo636/poly-runner?style=social)](https://github.com/yoyo636/poly-runner/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/yoyo636/poly-runner?style=social)](https://github.com/yoyo636/poly-runner/network/members)
[![GitHub issues](https://img.shields.io/github/issues/yoyo636/poly-runner?style=flat)](https://github.com/yoyo636/poly-runner/issues)
[![Release](https://img.shields.io/badge/下载-v1.0.0%20Beta-blue?style=flat-square)](https://github.com/yoyo636/poly-runner/releases/tag/v1.0.0-beta)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Beta 版**：功能已经跑通，但接口和默认行为还可能调整，欢迎试用并反馈。

在 VS Code 里一键编译并运行**任意语言**的代码。

**核心思路：把命令敲进真实的集成终端。** 点一下运行，插件会在集成终端里输入一条完整的 shell 命令（和你手动敲的一模一样），由系统 shell 调用系统编译器 / 解释器去编译、去运行：

```bash
/usr/bin/g++ -std=c++17 -Wall /path/to/main.cpp -o /tmp/poly-runner/build/main && /tmp/poly-runner/build/main
```

```bash
python /path/to/hello.py
```

```bash
javac /path/to/Main.java && java -cp /path/to Main
```

所以：编译报错直接显示在终端里、程序可以正常读 stdin、运行完你还能在同一个终端继续敲命令——完全就是手动操作的手感，只是省了敲命令这一下。

## 能力

- **117 种语言**内置默认运行命令，覆盖 168 个文件扩展名：编译型、脚本型、函数式、模板、标记型全覆盖。
- **两种执行通道**：集成终端（可交互）/ 输出面板（捕获输出 + 超时保护）。
- **三层识别**：用户绑定 → VS Code 文件类型 → 扩展名 → 脚本 shebang，认不出来时现场问你。
- **命令模板机制**：`{{file}}` `{{out}}` `{{compiler}}` `{{args}}` 等 14 个变量，任何语言都能自定义命令。
- **项目级运行**：识别 CMake / package.json / Cargo.toml / go.mod / pom.xml 等，一键跑整个项目（`Cmd+Alt+P`）。
- **大型 C++ 工程**：自动用 `compile_commands.json` 里的真实参数编译（include 路径、宏定义、标准版本全带上），并自动链接同 target 的所有源文件。
- **CMake 构建 → 跑产物**：自动「配置 → 构建 → 运行」，多配置生成器也能定位到产物。
- **多目标选择**：项目有多个 target / script 时弹窗让你选。
- **watch 模式**：保存后自动重编译重跑（`Cmd+Alt+W`）。
- **运行前依赖检测**：编译器 / 解释器没装会提前提示，而不是让终端里飘一句 `command not found`。
- **运行选中的代码**：片段写成临时文件，编译型语言自动带上原目录的 `-I`。
- **一键停止**：终端发 Ctrl+C，输出面板模式杀整个进程组。
- **跨目录自动 `cd`**，Windows 用 `cls` 清屏。
- **状态栏**显示当前文件会用哪种方式运行，点击可切换。

## 内置语言

| 类别 | 语言 |
| --- | --- |
| 编译型 | C、C++、C#、F#、Objective-C、Objective-C++、Rust、Go、Swift、Kotlin、Scala、Groovy、Dart、Haskell、Julia、Elixir、OCaml、Nim、Zig、Verilog、VHDL、Fortran、Pascal、Ada、Assembly、CUDA、Elm、Vala、Pony、Chapel、Idris |
| 脚本型 | Python、JavaScript、TypeScript、CoffeeScript、Shell、Fish、Nushell、ksh、csh、PowerShell、Batch、Ruby、PHP、Perl、Raku、Lua、Tcl、Awk、R、V、Crystal |
| 函数式 | Clojure、Erlang、Racket、Scheme、Common Lisp、Emacs Lisp、Janet、Fennel、Hy、Standard ML、Prolog |
| JVM | Java、Kotlin、Scala、Groovy |
| 模板/样式 | Sass、Less、Stylus、Handlebars、EJS、Pug、Mustache、Liquid、Nunjucks、Twig、Jinja2、Mako、ERB、Haml、Slim、AsciiDoc |
| 标记型 | JSON、YAML、XML、HTML、Markdown、LaTeX、SQL、GraphQL、CSV |
| 工程 | Dockerfile、Makefile、CMake、Justfile、Taskfile、Rakefile、Terraform、Nix、Vue、Svelte、Astro |

共 **117 条语言条目、168 个文件扩展名**。完整清单见 `src/languages.ts`，随时可以加。

## 命令

| 命令 | 说明 | 快捷键 |
| --- | --- | --- |
| `Poly Runner: 运行当前文件` | 按配置执行（终端或输出面板） | `Cmd+Alt+N` / `Ctrl+Alt+N` |
| `Poly Runner: 运行选中的代码` | 只运行选中的片段 | `Cmd+Alt+M` / `Ctrl+Alt+M` |
| `Poly Runner: 在集成终端运行当前文件` | 强制终端模式 | — |
| `Poly Runner: 在输出面板运行当前文件` | 强制输出面板模式 | `Cmd+Alt+B` / `Ctrl+Alt+B` |
| `Poly Runner: 停止正在运行的程序` | Ctrl+C / 杀进程 | `Cmd+Alt+.` / `Ctrl+Alt+.` |
| `Poly Runner: 运行当前项目` | 识别 CMake / package.json / Cargo.toml 等并运行项目 | `Cmd+Alt+P` / `Ctrl+Alt+P` |
| `Poly Runner: 开启/关闭自动重编译重跑` | 保存文件后自动重编译重跑 | `Cmd+Alt+W` / `Ctrl+Alt+W` |
| `Poly Runner: 打开运行终端` | 只开终端 | `Cmd+Alt+O` / `Ctrl+Alt+O` |
| `Poly Runner: 选择该文件的运行方式` | 换一种运行方式并记住 | — |
| `Poly Runner: 编辑当前语言的运行命令` | 打开设置改命令 | — |
| `Poly Runner: 复制当前文件的运行命令` | 复制到剪贴板 | — |

编辑器右上角 ▶ 按钮、右键菜单、命令面板都能触发。

## 设置项

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `polyRunner.customCommands` | object | `{}` | 按 languageId 覆盖命令模板 |
| `polyRunner.customCommandsByExtension` | object | `{}` | 按扩展名覆盖命令模板 |
| `polyRunner.languageAliases` | object | `{}` | 把扩展名 / 语言 id 绑定到指定运行方式 |
| `polyRunner.compiler` | string | `""` | C/C++ 编译器路径，留空自动探测 |
| `polyRunner.cppStandard` | enum | `c++17` | C++ 标准（`{{std}}`） |
| `polyRunner.additionalCompilerArgs` | string[] | `[]` | 追加编译参数 |
| `polyRunner.runArguments` | string[] | `[]` | 运行参数（`{{args}}`） |
| `polyRunner.executeInTerminal` | boolean | `true` | true=终端执行，false=输出面板执行 |
| `polyRunner.saveBeforeRun` | boolean | `true` | 运行前自动保存 |
| `polyRunner.clearOutputBeforeRun` | boolean | `true` | 终端执行前清屏 |
| `polyRunner.focusTerminalAfterRun` | boolean | `true` | 运行后聚焦终端 |
| `polyRunner.showCommandInOutput` | boolean | `true` | 输出面板记录执行的命令 |
| `polyRunner.timeoutMs` | number | `30000` | 输出面板模式超时（毫秒） |
| `polyRunner.defaultLanguage` | string | `""` | 认不出语言时的兜底 languageId |
| `polyRunner.terminalCwd` | string | `""` | 执行工作目录，留空用源文件目录 |
| `polyRunner.outputDirectory` | string | `""` | 编译产物目录，留空用扩展存储目录 |
| `polyRunner.useTempFileForSelection` | boolean | `true` | 跑选区时写临时文件 |
| `polyRunner.runOnSave` | boolean | `false` | 保存即运行 |
| `polyRunner.showWarnings` | boolean | `true` | 开启 `-Wall` / `/W3` |
| `polyRunner.pipeFileToStdin` | boolean | `false` | 把源文件内容通过 stdin 喂给程序 |
| `polyRunner.useCompileDatabase` | boolean | `true` | 优先用 `compile_commands.json` 编译 |
| `polyRunner.compileDatabaseMode` | enum | `link` | `link`=链接整个 target；`object`=只做单文件语法检查 |
| `polyRunner.cmakeBuildDir` | string | `build` | CMake 构建目录 |
| `polyRunner.cmakeBuildType` | enum | `Debug` | CMake 构建类型 |
| `polyRunner.cmakeParallelJobs` | number | `0` | CMake 并行任务数，0 表示不指定 |
| `polyRunner.buildBeforeRun` | boolean | `true` | 项目级运行时先构建再运行产物 |
| `polyRunner.watchMode` | boolean | `false` | 保存后自动重编译重跑 |
| `polyRunner.watchDebounceMs` | number | `800` | watch 重跑的防抖时间 |
| `polyRunner.projectOutputDir` | string | `.poly-runner` | 编译数据库产物的存放目录 |

### 命令模板变量

| 变量 | 含义 |
| --- | --- |
| `{{file}}` | 源文件绝对路径（选区运行时是临时文件） |
| `{{fileNoExt}}` | 去掉扩展名的路径 |
| `{{fileName}}` / `{{basename}}` | 文件名 / 不含扩展名的文件名 |
| `{{dir}}` | 源文件所在目录 |
| `{{workspaceFolder}}` | 工作区根目录 |
| `{{relativeFile}}` | 相对工作区根的路径 |
| `{{tmpFile}}` | 选区运行时的临时文件路径 |
| `{{out}}` | 编译产物路径 |
| `{{compiler}}` | 所选 C/C++ 编译器路径 |
| `{{std}}` | C++ 标准，如 `c++17` |
| `{{warnings}}` | `-Wall` 或空串 |
| `{{args}}` | 附加运行参数 |
| `{{className}}` | 源码里解析出的类名（Java/Kotlin/Scala） |
| `{{pipeFile}}` | stdin 管道前缀：`cat <file> | `（需开启 `polyRunner.pipeFileToStdin`） |

路径类变量由插件自动做 shell 转义，**模板里不要自己加引号**。

### 例子

```json
{
  "polyRunner.customCommands": {
    "python": "python3 -u {{file}} {{args}}",
    "cpp": "{{compiler}} -std={{std}} {{warnings}} {{file}} -o {{out}} && {{out}}",
    "javascript": "node --experimental-strip-types {{file}} {{args}}"
  },
  "polyRunner.customCommandsByExtension": {
    ".m": "clang -framework Foundation {{file}} -o {{out}} && {{out}}"
  },
  "polyRunner.languageAliases": {
    ".foo": "python",
    "shellscript": "shellscript"
  }
}
```

## 大型 C++ / CMake 工程

单文件编译在大型工程里基本没用 —— 头文件路径、宏定义、其它源文件都在构建系统里。这个版本把这块补齐了。

### 编译数据库：按项目真实的参数编译

插件会自动找 `compile_commands.json`（`build/`、`out/`、`cmake-build-debug/` 等常见位置都会找），拿到**这个文件在项目里的真实编译命令**，因此：

- 项目里所有 `-I` include 路径都在
- `-D` 宏定义都在
- `-std=c++20` 这类标准版本是项目说了算，不是插件猜的
- 同 target 的**其它源文件会自动一起编译链接**，不会出现「链接时缺符号」

产物放在项目内 `.poly-runner/bin/`，不会污染源码目录（也可以用 `polyRunner.projectOutputDir` 改）。

命令长这样：

```bash
/usr/bin/c++ -I/your/project/include -DFOO=1 -std=c++17 src/main.cpp src/util.cpp -o .poly-runner/bin/demo && .poly-runner/bin/demo
```

想只做语法检查不链接，把 `polyRunner.compileDatabaseMode` 设成 `object`。

### CMake：配置 → 构建 → 运行产物

项目里有 `CMakeLists.txt` 时，`运行当前项目` 会自动串成一条命令：

```bash
( [ -f build/CMakeCache.txt ] && [ -f build/compile_commands.json ] || cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ) && cmake --build build --target demo && ./build/demo
```

- 已经配置过就跳过重复 configure
- `cmake --build` 走的是 CMake 自己的增量逻辑，只重编改过的文件
- 产物位置按生成器推断：单配置生成器在 `build/<target>`，多配置（Visual Studio / Xcode / Ninja Multi-Config）在 `build/<BuildType>/<target>`
- 构建失败时 `&&` 会短路，程序不会跑 —— 报错就在终端上

### 多个目标时让你选

CMake 里有多个 `add_executable`、或 `package.json` 里有多个 script 时，运行项目会弹窗让你选，而不是闷头跑第一个。

### watch：保存就重编译重跑

`Cmd+Alt+W` 开启后，保存文件会自动重新编译并运行；重跑前会先 Ctrl+C 停掉上一轮还在跑的程序。状态栏会显示 `watch`。

## 运行整个项目

有些代码不是单文件能跑通的。插件会从当前文件所在目录**向上查找**项目标志文件，识别出项目类型并给出对应命令：

| 标志文件 | 项目 | 执行的命令 |
| --- | --- | --- |
| `package.json` | Node.js | `npm run <脚本>`（自动挑 `start`/`dev`/`serve`/`build`/`test`，否则第一个脚本） |
| `deno.json` | Deno | `deno task <任务>` |
| `Cargo.toml` | Rust | `cargo run` |
| `go.mod` | Go | `go run .` |
| `pom.xml` | Maven | `mvn -q package` |
| `build.gradle` | Gradle | `./gradlew run`（有 wrapper 时） |
| `CMakeLists.txt` | CMake | `cmake -S . -B build && cmake --build build` |
| `Makefile` | Make | `make` |
| `justfile` | just | `just` |
| `Taskfile.yml` | Task | `task` |
| `Rakefile` | Rake | `rake` |
| `mix.exs` | Elixir Mix | `mix run` |
| `*.sln` / `*.csproj` | .NET | `dotnet run` |

命令会在**项目根目录**执行，所以 `npm run` 之类的相对路径行为和你在项目里手动敲完全一致。

## 把文件内容当 stdin 喂给程序

打开 `polyRunner.pipeFileToStdin`，命令会变成 `cat <文件> | <原命令>`；也可以在自定义命令里用 `{{pipeFile}}` 变量精确控制：

```json
{
  "polyRunner.customCommands": {
    "json": "{{pipeFile}}jq ."
  }
}
```

## 安装与开发

```bash
npm install          # 安装依赖
npm run compile      # 编译到 out/
npm test             # 端到端测试：校验命令生成，并把命令交给真实 shell 执行
npx vsce package --pre-release
code --install-extension poly-runner-1.0.0.vsix
```

按 `F5` 启动扩展开发宿主即可调试。

## 参与进来

这是 Beta，**你的每条反馈都会变成下一个版本**。

- ⭐️ **觉得好用就点个 star** —— Beta 阶段最大的支持，也是让更多人看到它的方式
- 💬 **聊聊想法** → [Discussions](https://github.com/yoyo636/poly-runner/discussions)
- 🐛 **报个 bug** → [Issues](https://github.com/yoyo636/poly-runner/issues)（有模板，照着填能省一轮来回）
- 💡 **加一种语言** → 只要 5 分钟，见 [CONTRIBUTING.md](CONTRIBUTING.md)
- 🔀 **提个 PR** → [CONTRIBUTING.md](CONTRIBUTING.md) 里有完整流程

最想听你回答的两个问题：

1. **你最想加哪种语言？**（或者哪种语言的默认命令不符合你的习惯）
2. **「把命令敲进终端」这个形式，对你来说是真的更好，还是只是换了个写法？**

推广文案模板、发布节奏这些也一并放在 [`docs/OUTREACH.md`](docs/OUTREACH.md)，欢迎一起完善。

## 常见问题

**程序要读输入？**
用终端模式，程序就在这个终端里跑，直接打字回车即可。输出面板模式没有 TTY。

**命令敲进去了但没反应？**
命令末尾用 `&&` 串联，编译失败时程序不会启动——先看终端上一行的红色报错。

**提示缺少编译器 / 解释器？**
先在终端里确认 `g++ -v`、`python3 -V` 能跑；自定义路径（Homebrew 的 `g++-14`、MSYS2 的 MinGW 等）用 `选择该文件的运行方式` 或设置 `polyRunner.compiler` 指定绝对路径。

**Windows 上用 MSVC？**
插件会通过 `vswhere` 找到 `cl.exe` 并生成 `/EHsc /std:c++17 ... /Fe:...` 命令，但 `cl.exe` 需要开发者命令提示符环境，请把默认终端设成「x64 Native Tools Command Prompt」。图省事就用 MinGW 的 `g++`。

**想用 Sanitizer？**
`polyRunner.additionalCompilerArgs` 里加 `["-fsanitize=address", "-g"]`（GCC/Clang）。编译和链接是同一条命令，链接参数会自动带上。

## 目录结构

```
src/
  extension.ts   命令注册、状态栏、保存即运行、缺失依赖提示
  runner.ts      语言识别 → 模板渲染 → 调度执行
  template.ts    占位符渲染、shell 转义、shebang/类名识别
  languages.ts   117 种语言的默认命令表
  projects.ts    项目级运行识别（CMake / package.json / Cargo.toml / go.mod …）
  compileDb.ts   compile_commands.json 解析、真实编译参数提取
  cmake.ts       CMake 目标解析、构建与产物定位
  compiler.ts    C/C++ 编译器探测与版本读取
  executor.ts    输出面板模式：捕获输出、超时、进程组终止
  terminal.ts    集成终端管理（sendText、cd、Ctrl+C）
  config.ts      配置读取与参数拆分
test/
  vscode-stub.js     vscode 模块桩
  extension.test.js  端到端测试：C++/Python/Java/Ruby/Bash/Rust 真机跑通
samples/
  main.cpp / hello.py / Main.java
```

## License

MIT
