<!--
═══════════════════════════════════════════════════════════════
  发布前请删除本区块（从 <!-- 到 下一个 --> 结束）
═══════════════════════════════════════════════════════════════

【标题备选 · 选一个】

  A. 我给 VS Code 写了个跑代码的插件：它不偷偷 spawn 进程，而是把命令敲进你的终端
  B. Poly Runner：把「运行代码」这件事，还给终端和系统编译器
  C. VS Code 跑 C++ / Python 时，编译报错去哪了？聊聊「透明执行」这个设计

【摘要（80 字内，填 CSDN 摘要栏）】

  写了个 VS Code 插件 Poly Runner：点一下运行，插件把一条真实的 shell 命令敲进集成终端，
  由系统编译器/解释器完成编译与运行。命令可见、可改，报错直达，stdin 天然通。
  内置 117 种语言，还能一键跑整个项目。欢迎提需求。

【标签】

  VSCode、插件开发、开源项目、效率工具、C++、Python、TypeScript

【封面图】

  建议用「终端里那行命令 + 下方程序输出」的截图，突出命令可见这一点。
  尺寸按 CSDN 封面比例（16:9，如 1280×720）。仓库 resources/icon.png 可作角标。

【配图占位（发布时替换成真实截图 / GIF）】

  图1  https://github.com/yoyo636/poly-runner/blob/main/docs/img/1-run-cpp.gif
  图2  https://github.com/yoyo636/poly-runner/blob/main/docs/img/2-terminal.png
  图3  https://github.com/yoyo636/poly-runner/blob/main/docs/img/3-languages.png
  （仓库里还没有 docs/img 目录，记得自己截一张补上）

【原创声明 / 首发】

  原创，首发 CSDN。文末注明项目地址与 MIT 协议。
  ⚠️ 如果同时发到掘金/博客园，CSDN 原创文章被判定重复会有降权风险，
     建议 CSDN 这篇作为「最完整版」，其他平台发删减版并调整开头。

═══════════════════════════════════════════════════════════════
-->

# 我给 VS Code 写了个跑代码的插件：它不偷偷 spawn 进程，而是把命令敲进你的终端

写代码最烦的往往不是写，是「跑一下」。

你改了个函数，想立刻看到结果。但各家 VS Code 插件的「运行」按钮背后，做的事情其实都挺魔法：插件在后台悄悄起了一个进程，把 stdout 截获到一个装饰过的面板里，编译错误被折叠成一堆红点，你想给程序喂个输入，得自己想办法。

我一开始也用这些插件，用久了总有点憋屈：**我明明是想「在终端里跑一下这段代码」，为什么非得接受一个不让碰的黑盒？**

于是我写了 **Poly Runner**（Beta）：https://github.com/yoyo636/poly-runner

它的全部哲学就一句话 —— **把一条真实的 shell 命令，敲进集成终端，让系统 shell 去调用系统编译器。**

---

## 一、它到底做了什么

打开任意一个 `.cpp`，按 `Cmd+Alt+N`（Windows 是 `Ctrl+Alt+N`），终端里会出现这样一行：

```bash
/usr/bin/g++ -std=c++17 -Wall /path/to/main.cpp -o /tmp/poly-runner/build/main && /tmp/poly-runner/build/main
```

然后编译输出、报错、程序输出，全部原原本本出现在终端里。

就这一行，没有任何隐藏逻辑。区别只在于：**这行命令是插件帮你敲进终端的，还是你自己敲的。**

![图1：运行后终端里的命令与输出](docs/img/1-run-cpp.gif)

换成别的语言也是一样：

```bash
python /path/to/hello.py
javac /path/to/Main.java && java -cp /path/to Main
rustc /path/to/main.rs -o /tmp/build/main && /tmp/build/main
go run /path/to/main.go
```

---

## 二、为什么「不偷 spawn」反而更好用

这不是为了标新立异，是几个具体痛点：

| 场景 | 黑盒 spawn 方案 | Poly Runner（终端里执行） |
| --- | --- | --- |
| 编译报错在哪 | 在插件面板里，红点要点开才看到 | 就在终端里，跟你手敲 `g++` 一模一样 |
| 程序要读 stdin | 常常没地方输入 | 程序就跑在这个终端里，直接打字回车 |
| 想知道到底执行了什么 | 看不懂插件内部实现 | 一行命令，明明白白摆在那儿 |
| 想临时改一下命令 | 做不到，只能去翻插件配置 | 直接在终端里改了再敲，或者复制出来自己跑 |
| 跑完之后 | 插件面板在那儿，终端是干净的 | 同一个终端，接着敲下一条命令 |
| 需要 TTY / 交互式程序 | 经常直接跑挂 | 终端就是 TTY，行为和手动完全一致 |

举个我自己的实际场景：写 Python 调试脚本时，我经常需要临时传个参数、或者把一段代码贴进去跑一下。用插件面板方案，我得先复制代码、想办法写临时文件、再想办法传参。用 Poly Runner，我甚至可以**先在终端里手动敲命令跑一遍**，确认思路对了，再点按钮让插件照着这个模式来。

**换句话说，它不是「替你操作」，而是「替你打字」。** 这个区别在日常使用里比听起来重要得多。

---

## 三、安装

目前是 Beta，走 GitHub Release 拿安装包：

```bash
# 1. 下载
gh release download v1.0.0-beta -R yoyo636/poly-runner

# 2. 安装
code --install-extension poly-runner-1.0.0.vsix
```

装好后打开任意代码文件，状态栏右下角会出现当前文件的运行方式，点它可以切换。

> Marketplace 正式版在推进中，上架前需要把自己的 publisher id 填进 `package.json`，所以先走 GitHub 通道。

---

## 四、上手

### 快捷键

| 快捷键 | 作用 |
| --- | --- |
| `Cmd+Alt+N` / `Ctrl+Alt+N` | 运行当前文件 |
| `Cmd+Alt+M` / `Ctrl+Alt+M` | 运行**选中的代码** |
| `Cmd+Alt+B` / `Ctrl+Alt+B` | 在输出面板运行（捕获输出，带超时保护） |
| `Cmd+Alt+.` / `Ctrl+Alt+.` | 停止正在运行的程序 |
| `Cmd+Alt+O` / `Ctrl+Alt+O` | 只打开运行终端 |

### 运行选中的代码

选中一段代码按 `Cmd+Alt+M`，插件会把它写成临时文件再编译运行。对编译型语言，会自动带上当前目录的 `-I`，所以选中那段代码照样能找到你项目里的头文件。

### 停止

终端模式下发送 `Ctrl+C`；输出面板模式下直接杀整个进程组（避免残留一堆编译出来的僵尸进程）。

---

## 五、内置 117 种语言

编译型、脚本型、JVM、标记型都覆盖了：

| 类别 | 语言 |
| --- | --- |
| 编译型 | C、C++、C#、F#、Objective-C、Objective-C++、Rust、Go、Swift、Kotlin、Scala、Groovy、Dart、Haskell、Julia、Elixir、OCaml、Nim、Zig、Verilog、VHDL、Fortran、Pascal、Ada、Assembly、CUDA、Elm、Vala、Pony、Chapel |
| 脚本型 | Python、JavaScript、TypeScript、CoffeeScript、Shell、Fish、Nushell、ksh、PowerShell、Batch、Ruby、PHP、Perl、Raku、Lua、Tcl、Awk、R、Crystal |
| 函数式 | Clojure、Erlang、Racket、Scheme、Common Lisp、Emacs Lisp、Janet、Fennel、Hy、Standard ML、Prolog |
| JVM | Java、Kotlin、Scala、Groovy |
| 模板/样式 | Sass、Less、Stylus、Handlebars、EJS、Pug、Mustache、Liquid、Nunjucks、Twig、Jinja2、Mako、ERB、Haml、Slim |
| 标记型 | JSON、YAML、XML、HTML、Markdown、LaTeX、SQL、GraphQL、CSV |
| 工程 | Dockerfile、Makefile、CMake、Justfile、Taskfile、Rakefile、Terraform、Nix、Vue、Svelte、Astro |

一共 **117 条语言条目、168 个文件扩展名**。

C/C++ 会自动探测 `g++`、`clang++`、`c++`、`g++-14` 这类版本化名字，Windows 上还会通过 `vswhere` 找到 MSVC 的 `cl.exe`，并自动切换成 `/EHsc /std:c++17 ... /Fe:...` 这套参数风格。

**运行前还会检查依赖**：如果 `python3` 根本没装，插件会提前告诉你，而不是让你在终端里对着 `command not found` 发呆。

---

## 六、不是只有单文件：项目级运行

很多代码不是单文件能跑通的。插件会从当前文件所在目录**向上查找**项目标志文件，认出项目类型，给出对应命令：

| 标志文件 | 项目 | 执行的命令 |
| --- | --- | --- |
| `package.json` | Node.js | `npm run <脚本>`（自动挑 `start`/`dev`/`serve`/`build`/`test`，否则第一个） |
| `deno.json` | Deno | `deno task <任务>` |
| `Cargo.toml` | Rust | `cargo run` |
| `go.mod` | Go | `go run .` |
| `pom.xml` | Maven | `mvn -q package` |
| `build.gradle` | Gradle | `./gradlew run`（有 wrapper 时） |
| `CMakeLists.txt` | CMake | `cmake -S . -B build && cmake --build build` |
| `Makefile` | Make | `make` |
| `justfile` / `Taskfile.yml` / `Rakefile` | just / Task / Rake | `just` / `task` / `rake` |
| `mix.exs` | Elixir Mix | `mix run` |
| `*.sln` / `*.csproj` | .NET | `dotnet run` |

命令在**项目根目录**执行，相对路径行为跟你手动进项目敲完全一致。

按 `Cmd+Alt+P` 就行。

## 七、把文件内容当 stdin 喂给程序

有些工具是从 stdin 读输入的（`jq`、`sort`、某些校验脚本）。打开 `polyRunner.pipeFileToStdin`，命令就会变成：

```bash
cat /path/to/data.json | jq .
```

也可以在自定义命令里用 `{{pipeFile}}` 精确控制要不要带这个前缀。

## 八、命令模板：任何语言都能加

这是我觉得最值得写一段的设计。

插件不把「运行某个语言」写成 if-else 硬编码，而是定义成一条**命令模板**：

```ts
{
    id: 'cpp',
    label: 'C++',
    extensions: ['.cpp', '.cc', '.cxx', '.c++'],
    command: '{{compiler}} -std={{std}} {{warnings}} {{file}} -o {{out}} && {{out}}',
    compiled: true,
    note: '用所选 C++ 编译器编译，再运行生成的产物'
}
```

运行时把占位符替换掉，再把这行命令敲进终端。内置 14 个变量：

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
| `{{className}}` | 从源码里解析出的类名（Java/Kotlin/Scala） |
| `{{pipeFile}}` | stdin 管道前缀 `cat <file> \| `（需开启 `polyRunner.pipeFileToStdin`） |

**路径类变量由插件自动做 shell 转义**，所以模板里不要自己加引号 —— 否则 Windows 下带空格路径、双引号嵌套都会出问题。

### 加一门语言只要 5 分钟

```ts
// src/languages.ts
{
    id: 'zig',
    label: 'Zig',
    extensions: ['.zig', '.zon'],
    command: 'zig run {{file}} {{args}}',
    requires: ['zig'],
    note: '用 zig run 直接运行源文件'
}
```

就这么几行。`requires` 写上需要的可执行文件，插件就能在运行前做依赖检查。

### 用户自己也能改

```jsonc
{
  "polyRunner.customCommands": {
    "python": "python3 -u {{file}} {{args}}",
    "cpp": "{{compiler}} -std={{std}} {{file}} -o {{out}} && {{out}}"
  },
  "polyRunner.customCommandsByExtension": {
    ".m": "clang -framework Foundation {{file}} -o {{out}} && {{out}}"
  },
  "polyRunner.languageAliases": {
    ".foo": "python"
  }
}
```

有了这三项，**理论上没有插件不支持的语言**。不认识的扩展名还能靠脚本首行的 shebang 兜底识别。

---

## 九、实现上的一些取舍

拆开看是这么几个文件，加起来 2100 行：

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `src/languages.ts` | 1000+ | 117 种语言的命令表（纯数据，不依赖任何模块） |
| `src/projects.ts` | 200 | 项目识别：package.json / Cargo.toml / go.mod … |
| `src/extension.ts` | 360 | 命令注册、状态栏、依赖缺失提示、保存即运行 |
| `src/runner.ts` | 327 | 语言识别 → 模板渲染 → 调度执行 |
| `src/template.ts` | 274 | 占位符渲染、shell 转义、shebang/类名识别 |
| `src/compiler.ts` | 300 | C/C++ 编译器探测与版本读取 |
| `src/executor.ts` | 127 | 输出面板模式：捕获输出、超时、进程组终止 |
| `src/terminal.ts` | 89 | 集成终端管理（sendText、cd、Ctrl+C） |
| `src/config.ts` | 138 | 配置读取与参数拆分 |

核心其实就几行：

```ts
// src/terminal.ts
public send(terminal: vscode.Terminal, command: string): void {
    terminal.sendText(command, true);
}
```

```ts
// src/runner.ts
const { terminal, preamble } = this.terminals.prepare(plan.cwd);
if (preamble) {
    this.terminals.send(terminal, preamble);   // 跨目录时先 cd
}
if (config.clearOutputBeforeRun) {
    this.terminals.clear(terminal);
}
this.terminals.send(terminal, plan.command);   // 真正的运行命令
```

有两个坑值得说一下：

**1. 跨目录运行。** 文件在 A 目录，跑完切到 B 目录再跑，如果复用同一个终端，cwd 就不对了。所以插件会记住当前目录，变了就先发一条 `cd`。

**2. 输出面板模式下怎么杀掉整个进程树。** `g++` 会派生子进程，直接 kill 父进程会留下一堆孤儿。这里用 `detached: true` 起进程，杀的时候 `process.kill(-pid)` 把整个进程组端掉。

---

## 十、它怎么保证自己没写错

这个项目的测试不是 mock 出来的假通过，而是**把插件生成的命令原样丢给系统 shell 真跑一遍**：

```bash
npm test
```

覆盖 C++、Python、Java、Ruby、Bash、Rust 六种语言，验证命令生成正确、程序真的跑起来、stdin 真的能读进去、Ctrl+C 真的能停。

```ts
const result = runInShell(command, path.dirname(SAMPLE), '42\n');
assert.strictEqual(result.status, 0);
assert.ok(result.stdout.includes('1764'));   // 42²，程序确实读到了 stdin
```

测试用的是真实的 `/bin/bash`，真实的 `g++`，真实的 `javac`。这样才敢让它去动别人的终端。

---

## 十一、已知限制

说在前面，免得你踩坑：

- **Windows + MSVC** 需要把默认终端设成「x64 Native Tools Command Prompt」，否则 `cl.exe` 找不到标准库。图省事建议用 MinGW 的 `g++`。
- **TypeScript** 默认走 `npx tsx`，需要本地有 tsx / ts-node。
- **输出面板模式没有 TTY**，需要交互式输入或带界面的程序请用终端模式。
- **V 语言**的 `.v` 扩展名和 Verilog 冲突（Verilog 更常用），V 需要用「选择该文件的运行方式」手动指定。
- 接口还在 Beta 阶段，配置项和默认行为都可能调整。

---

## 十二、一起参与

项目是 MIT 协议，核心代码约 2100 行，很好上手：

- 仓库：https://github.com/yoyo636/poly-runner
- 想加语言 / 提需求 → [Issues](https://github.com/yoyo636/poly-runner/issues)（有模板）
- 随便聊 → [Discussions](https://github.com/yoyo636/poly-runner/discussions)
- 想动手 → [CONTRIBUTING.md](https://github.com/yoyo636/poly-runner/blob/main/CONTRIBUTING.md)，加一门语言 5 分钟
- 装包 → [Release v1.0.0-beta](https://github.com/yoyo636/poly-runner/releases/tag/v1.0.0-beta)

最后想认真问你两个问题：

1. **你最想让它支持哪种语言？** 或者哪种语言的默认命令不符合你的习惯？
2. **「把命令敲进终端」这个形式，对你来说是真的更好，还是只是换了个说法？** 如果你觉得终端里那行命令碍事，我准备了「输出面板模式」可以切过去，但默认选终端是因为它更接近手动手感。

评论区见，我会逐条看，也会把你提的语言直接加进去。

---

*项目地址：https://github.com/yoyo636/poly-runner　·　MIT License　·　如果你觉得这个思路不错，点个 Star 也是支持 :)*
