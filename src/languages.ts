/**
 * 多语言运行命令注册表（纯数据文件，不依赖任何模块）。
 *
 * 用法：引擎按当前文件的 VS Code language id（其次是扩展名）在本表里查一条
 * LanguageDef，把 command 里的占位符替换成真实值之后，整条命令原样敲进集成终端，
 * 由系统 shell 自己编译、自己运行 —— 编译报错直接显示在终端里，程序也能正常读 stdin。
 *
 * 占位符替换规则（由引擎负责，模板里不要自己加引号）：
 * - 路径类占位符（{{file}}、{{fileNoExt}}、{{fileName}}、{{basename}}、{{dir}}、
 *   {{workspaceFolder}}、{{relativeFile}}、{{tmpFile}}、{{out}}、{{compiler}}）
 *   会先做 shell 转义再替换，因此模板里绝不能自己写引号。
 * - 原样替换的占位符（{{args}}、{{std}}、{{warnings}}、{{className}}）
 *   不加引号直接替换，替换结果可能是空串（例如 {{warnings}} 在关闭警告时为空）。
 *
 * 约定：
 * - 一条命令里的「编译 + 运行」用 && 串联，此时把 compiled 设为 true，
 *   引擎会额外准备 {{out}} 产物路径。
 * - requires 列出运行该语言真正需要的可执行文件，用于缺失检测；
 *   由引擎自己解析的二进制（{{compiler}}）不写在这里。
 */
export interface LanguageDef {
    /** VS Code language id，例如 'cpp'、'python'、'java' */
    id: string;
    /** 界面展示名，例如 'C++'、'Python' */
    label: string;
    /** 匹配的文件扩展名，小写、含点，例如 ['.cpp', '.cc'] */
    extensions: string[];
    /**
     * 运行命令模板。占位符由引擎在运行时替换。
     * 引擎负责对「路径类占位符」做 shell 转义后替换，所以模板里不要自己加引号。
     */
    command: string;
    /** 编译型语言为 true：引擎会额外准备 {{out}} 产物路径 */
    compiled?: boolean;
    /** 运行该语言需要的可执行文件/解释器，用于缺失检测，例如 ['g++']、['python3'] */
    requires?: string[];
    /** 一句话说明这个命令在做什么，显示在快速选择框的 description 里 */
    note?: string;
}

export const LANGUAGES: LanguageDef[] = [
    // ------------------------------------------------------------------
    // C / C++
    // ------------------------------------------------------------------
    {
        id: 'cpp',
        label: 'C++',
        extensions: ['.cpp', '.cc', '.cxx', '.c++', '.hpp', '.hh', '.hxx'],
        command: '{{compiler}} -std={{std}} {{warnings}} {{file}} -o {{out}} && {{out}}',
        compiled: true,
        note: '用所选 C++ 编译器编译，再运行生成的产物'
    },
    {
        id: 'c',
        label: 'C',
        extensions: ['.c', '.h'],
        command: 'gcc {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['gcc'],
        note: '用 gcc 编译 C 源文件，再运行生成的产物'
    },

    // ------------------------------------------------------------------
    // 脚本类
    // ------------------------------------------------------------------
    {
        id: 'python',
        label: 'Python',
        extensions: ['.py', '.pyw'],
        command: 'python {{file}} {{args}}',
        requires: ['python'],
        note: '用 python 解释器直接运行脚本'
    },
    {
        id: 'python3',
        label: 'Python 3',
        extensions: ['.py', '.pyw'],
        command: 'python3 {{file}} {{args}}',
        requires: ['python3'],
        note: '用 python3 解释器直接运行脚本'
    },
    {
        id: 'shellscript',
        label: 'Shell Script',
        extensions: ['.sh', '.bash', '.zsh'],
        command: 'bash {{file}} {{args}}',
        requires: ['bash'],
        note: '用 bash 执行 shell 脚本'
    },
    {
        id: 'powershell',
        label: 'PowerShell',
        extensions: ['.ps1', '.psm1'],
        command: 'pwsh -NoProfile -File {{file}} {{args}}',
        requires: ['pwsh'],
        note: '用 PowerShell 执行脚本'
    },
    {
        id: 'bat',
        label: 'Batch',
        extensions: ['.bat', '.cmd'],
        command: 'cmd /c {{file}} {{args}}',
        requires: ['cmd'],
        note: '用 cmd 执行批处理文件'
    },
    {
        id: 'perl',
        label: 'Perl',
        extensions: ['.pl', '.pm'],
        command: 'perl {{file}} {{args}}',
        requires: ['perl'],
        note: '用 perl 解释执行脚本'
    },
    {
        id: 'ruby',
        label: 'Ruby',
        extensions: ['.rb'],
        command: 'ruby {{file}} {{args}}',
        requires: ['ruby'],
        note: '用 ruby 解释执行脚本'
    },
    {
        id: 'php',
        label: 'PHP',
        extensions: ['.php'],
        command: 'php {{file}} {{args}}',
        requires: ['php'],
        note: '用 php 解释执行脚本'
    },
    {
        id: 'lua',
        label: 'Lua',
        extensions: ['.lua'],
        command: 'lua {{file}} {{args}}',
        requires: ['lua'],
        note: '用 lua 解释执行脚本'
    },
    {
        id: 'tcl',
        label: 'Tcl',
        extensions: ['.tcl'],
        command: 'tclsh {{file}} {{args}}',
        requires: ['tclsh'],
        note: '用 tclsh 解释执行脚本'
    },
    {
        id: 'awk',
        label: 'AWK',
        extensions: ['.awk'],
        command: 'awk -f {{file}} {{args}}',
        requires: ['awk'],
        note: '用 awk 执行脚本'
    },
    {
        id: 'r',
        label: 'R',
        extensions: ['.r'],
        command: 'Rscript {{file}} {{args}}',
        requires: ['Rscript'],
        note: '用 Rscript 执行脚本'
    },

    // ------------------------------------------------------------------
    // JVM 系
    // ------------------------------------------------------------------
    {
        id: 'java',
        label: 'Java',
        extensions: ['.java'],
        command: 'javac {{file}} && java -cp {{dir}} {{className}}',
        compiled: true,
        requires: ['javac', 'java'],
        note: '先用 javac 编译，再运行源文件里的 public 类'
    },
    {
        id: 'kotlin',
        label: 'Kotlin',
        extensions: ['.kt', '.kts'],
        command: 'kotlinc {{file}} -include-runtime -d {{out}} && java -jar {{out}}',
        compiled: true,
        requires: ['kotlinc', 'java'],
        note: '编译成带运行时的 jar，再执行它'
    },
    {
        id: 'scala',
        label: 'Scala',
        extensions: ['.scala', '.sc'],
        command: 'scala {{file}} {{args}}',
        requires: ['scala'],
        note: '用 scala 运行脚本'
    },
    {
        id: 'groovy',
        label: 'Groovy',
        extensions: ['.groovy'],
        command: 'groovy {{file}} {{args}}',
        requires: ['groovy'],
        note: '用 groovy 运行脚本'
    },

    // ------------------------------------------------------------------
    // JS / TS 系
    // ------------------------------------------------------------------
    {
        id: 'javascript',
        label: 'JavaScript',
        extensions: ['.js', '.mjs', '.cjs'],
        command: 'node {{file}} {{args}}',
        requires: ['node'],
        note: '用 node 直接运行脚本'
    },
    {
        id: 'javascriptreact',
        label: 'JavaScript React',
        extensions: ['.jsx'],
        command: 'npx tsx {{file}} {{args}}',
        requires: ['npx'],
        note: '用 tsx 转译 JSX 后运行'
    },
    {
        id: 'typescript',
        label: 'TypeScript',
        extensions: ['.ts'],
        command: 'npx tsx {{file}} {{args}}',
        requires: ['npx'],
        note: '用 tsx 转译 TypeScript 后运行'
    },
    {
        id: 'typescriptreact',
        label: 'TypeScript React',
        extensions: ['.tsx'],
        command: 'npx tsx {{file}} {{args}}',
        requires: ['npx'],
        note: '用 tsx 转译 TSX 后运行'
    },

    // ------------------------------------------------------------------
    // 系统 / 编译型
    // ------------------------------------------------------------------
    {
        id: 'go',
        label: 'Go',
        extensions: ['.go'],
        command: 'go run {{file}} {{args}}',
        requires: ['go'],
        note: '用 go run 直接编译并运行'
    },
    {
        id: 'rust',
        label: 'Rust',
        extensions: ['.rs'],
        command: 'rustc {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['rustc'],
        note: '用 rustc 编译，再运行生成的产物'
    },
    {
        id: 'swift',
        label: 'Swift',
        extensions: ['.swift'],
        command: 'swift {{file}} {{args}}',
        requires: ['swift'],
        note: '用 swift 解释执行源文件'
    },
    {
        id: 'csharp',
        label: 'C#',
        extensions: ['.cs'],
        command: 'dotnet-script {{file}} {{args}}',
        requires: ['dotnet-script'],
        note: '用 dotnet-script 运行脚本'
    },
    {
        id: 'fsharp',
        label: 'F#',
        extensions: ['.fs', '.fsx'],
        command: 'dotnet fsi {{file}} {{args}}',
        requires: ['dotnet'],
        note: '用 F# 交互式解释器执行脚本'
    },
    {
        id: 'objective-c',
        label: 'Objective-C',
        extensions: ['.m'],
        command: 'clang -framework Foundation {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['clang'],
        note: '用 clang 链接 Foundation 框架后运行'
    },
    {
        id: 'dart',
        label: 'Dart',
        extensions: ['.dart'],
        command: 'dart run {{file}}',
        requires: ['dart'],
        note: '用 dart run 执行脚本'
    },
    {
        id: 'haskell',
        label: 'Haskell',
        extensions: ['.hs', '.lhs'],
        command: 'runghc {{file}} {{args}}',
        requires: ['runghc'],
        note: '用 runghc 解释执行源文件'
    },
    {
        id: 'julia',
        label: 'Julia',
        extensions: ['.jl'],
        command: 'julia {{file}} {{args}}',
        requires: ['julia'],
        note: '用 julia 解释执行脚本'
    },
    {
        id: 'elixir',
        label: 'Elixir',
        extensions: ['.ex', '.exs'],
        command: 'elixir {{file}} {{args}}',
        requires: ['elixir'],
        note: '用 elixir 执行脚本'
    },
    {
        id: 'ocaml',
        label: 'OCaml',
        extensions: ['.ml'],
        command: 'ocaml {{file}}',
        requires: ['ocaml'],
        note: '用 ocaml 解释执行源文件'
    },
    {
        id: 'nim',
        label: 'Nim',
        extensions: ['.nim'],
        command: 'nim c -r {{file}}',
        requires: ['nim'],
        note: '编译并立即运行'
    },
    {
        id: 'zig',
        label: 'Zig',
        extensions: ['.zig'],
        command: 'zig run {{file}} {{args}}',
        requires: ['zig'],
        note: '用 zig run 直接运行'
    },

    // ------------------------------------------------------------------
    // 工程 / 标记类
    // ------------------------------------------------------------------
    {
        id: 'dockerfile',
        label: 'Dockerfile',
        extensions: ['.dockerfile'],
        command: 'docker build -f {{file}} -t cpp-runner:latest {{dir}}',
        requires: ['docker'],
        note: '以源文件所在目录为上下文构建镜像'
    },
    {
        id: 'makefile',
        label: 'Makefile',
        extensions: ['.mk'],
        command: 'make -f {{file}}',
        requires: ['make'],
        note: '执行指定的 Makefile 默认目标'
    },
    {
        id: 'graphql',
        label: 'GraphQL',
        extensions: ['.graphql'],
        command: 'npx graphql-schema-linter {{file}}',
        requires: ['npx'],
        note: '校验 GraphQL schema'
    },
    {
        id: 'cmake',
        label: 'CMake',
        extensions: ['.cmake'],
        command: 'cmake -S {{dir}} -B {{dir}}/build && cmake --build {{dir}}/build',
        requires: ['cmake'],
        note: '配置并构建 CMake 工程'
    },

    // ------------------------------------------------------------------
    // 数据 / 文档类
    // ------------------------------------------------------------------
    {
        id: 'json',
        label: 'JSON',
        extensions: ['.json'],
        command: 'jq . {{file}}',
        requires: ['jq'],
        note: '用 jq 美化并校验 JSON'
    },
    {
        id: 'yaml',
        label: 'YAML',
        extensions: ['.yaml', '.yml'],
        command: 'yq . {{file}}',
        requires: ['yq'],
        note: '用 yq 查看 YAML 内容'
    },
    {
        id: 'xml',
        label: 'XML',
        extensions: ['.xml'],
        command: 'xmllint --format {{file}}',
        requires: ['xmllint'],
        note: '格式化 XML 并检查合法性'
    },
    {
        id: 'html',
        label: 'HTML',
        extensions: ['.html', '.htm'],
        command: 'open {{file}}',
        requires: ['open'],
        note: '用默认浏览器打开'
    },
    {
        id: 'markdown',
        label: 'Markdown',
        extensions: ['.md'],
        command: 'open {{file}}',
        requires: ['open'],
        note: '用默认浏览器打开'
    },
    {
        id: 'latex',
        label: 'LaTeX',
        extensions: ['.tex'],
        command: 'pdflatex {{file}}',
        requires: ['pdflatex'],
        note: '编译 LaTeX 文档为 PDF'
    },
    {
        id: 'sql',
        label: 'SQL',
        extensions: ['.sql'],
        command: 'sqlite3 < {{file}}',
        requires: ['sqlite3'],
        note: '把脚本交给 sqlite3 执行'
    },

    // ------------------------------------------------------------------
    // 前端框架
    // ------------------------------------------------------------------
    {
        id: 'vue',
        label: 'Vue',
        extensions: ['.vue'],
        command: 'npx vite {{dir}}',
        requires: ['npx'],
        note: '启动 Vite 开发服务器预览工程'
    },
    {
        id: 'svelte',
        label: 'Svelte',
        extensions: ['.svelte'],
        command: 'npx vite {{dir}}',
        requires: ['npx'],
        note: '启动 Vite 开发服务器（工程需已安装 Svelte 插件）'
    },
    {
        id: 'astro',
        label: 'Astro',
        extensions: ['.astro'],
        command: 'npx astro dev --root {{dir}}',
        requires: ['npx'],
        note: '启动 Astro 开发服务器'
    },

    // ------------------------------------------------------------------
    // 其他
    // ------------------------------------------------------------------
    {
        id: 'verilog',
        label: 'Verilog',
        extensions: ['.v', '.sv'],
        command: 'iverilog -o {{out}} {{file}} && vvp {{out}}',
        compiled: true,
        requires: ['iverilog', 'vvp'],
        note: '编译 Verilog 后用 vvp 仿真'
    },
    {
        id: 'plaintext',
        label: 'Plain Text',
        extensions: ['.txt'],
        command: 'cat {{file}}',
        requires: ['cat'],
        note: '在终端输出文件内容'
    },

    // ------------------------------------------------------------------
    // 函数式 / 脚本类
    // ------------------------------------------------------------------
    {
        id: 'clojure',
        label: 'Clojure',
        extensions: ['.clj', '.cljs', '.cljc', '.edn'],
        command: 'clojure -M {{file}} {{args}}',
        requires: ['clojure'],
        note: '用 clojure -M 直接运行脚本'
    },
    {
        id: 'erlang',
        label: 'Erlang',
        extensions: ['.erl', '.hrl'],
        command: 'escript {{file}} {{args}}',
        requires: ['escript'],
        note: '用 escript 运行 Erlang 脚本'
    },
    {
        id: 'racket',
        label: 'Racket',
        extensions: ['.rkt'],
        command: 'racket {{file}} {{args}}',
        requires: ['racket'],
        note: '用 racket 运行脚本'
    },
    {
        id: 'scheme',
        label: 'Scheme',
        extensions: ['.scm', '.ss'],
        command: 'guile {{file}} {{args}}',
        requires: ['guile'],
        note: '用 guile 运行 Scheme 脚本'
    },
    {
        id: 'commonlisp',
        label: 'Common Lisp',
        extensions: ['.lisp', '.lsp', '.cl'],
        command: 'sbcl --script {{file}} {{args}}',
        requires: ['sbcl'],
        note: '用 sbcl 以脚本模式运行'
    },
    {
        id: 'emacslisp',
        label: 'Emacs Lisp',
        extensions: ['.el'],
        command: 'emacs --script {{file}} {{args}}',
        requires: ['emacs'],
        note: '用 emacs --script 求值脚本'
    },
    {
        id: 'janet',
        label: 'Janet',
        extensions: ['.janet'],
        command: 'janet {{file}} {{args}}',
        requires: ['janet'],
        note: '用 janet 运行脚本'
    },
    {
        id: 'fennel',
        label: 'Fennel',
        extensions: ['.fnl'],
        command: 'fnl {{file}} {{args}}',
        requires: ['fnl'],
        note: '用 fnl 运行脚本'
    },
    {
        id: 'hy',
        label: 'Hy',
        extensions: ['.hy'],
        command: 'hy {{file}} {{args}}',
        requires: ['hy'],
        note: '用 hy 运行脚本'
    },
    {
        id: 'nushell',
        label: 'Nushell',
        extensions: ['.nu'],
        command: 'nu {{file}} {{args}}',
        requires: ['nu'],
        note: '用 nu 运行脚本'
    },
    {
        id: 'fish',
        label: 'Fish',
        extensions: ['.fish'],
        command: 'fish {{file}} {{args}}',
        requires: ['fish'],
        note: '用 fish 执行脚本'
    },
    {
        id: 'csh',
        label: 'C Shell',
        extensions: ['.csh', '.tcsh'],
        command: 'tcsh {{file}} {{args}}',
        requires: ['tcsh'],
        note: '用 tcsh 执行 C Shell 脚本'
    },
    {
        id: 'ksh',
        label: 'Korn Shell',
        extensions: ['.ksh'],
        command: 'ksh {{file}} {{args}}',
        requires: ['ksh'],
        note: '用 ksh 执行脚本'
    },
    {
        id: 'escript',
        label: 'Erlang escript',
        extensions: ['.es'],
        command: 'escript {{file}} {{args}}',
        requires: ['escript'],
        note: '用 escript 运行脚本'
    },
    {
        id: 'coffeescript',
        label: 'CoffeeScript',
        extensions: ['.coffee', '.litcoffee'],
        command: 'coffee {{file}} {{args}}',
        requires: ['coffee'],
        note: '用 coffee 编译并运行脚本'
    },
    {
        id: 'raku',
        label: 'Raku',
        extensions: ['.raku', '.p6', '.pl6'],
        command: 'raku {{file}} {{args}}',
        requires: ['raku'],
        note: '用 raku 运行脚本'
    },
    {
        id: 'applescript',
        label: 'AppleScript',
        extensions: ['.applescript', '.scpt'],
        command: 'osascript {{file}} {{args}}',
        requires: ['osascript'],
        note: '用 osascript 执行 AppleScript'
    },
    {
        id: 'vimscript',
        label: 'Vim Script',
        extensions: ['.vim'],
        command: 'nvim -u NONE -S {{file}} {{args}}',
        requires: ['nvim'],
        note: '用 nvim 不加载配置地执行脚本'
    },
    {
        id: 'autohotkey',
        label: 'AutoHotkey',
        extensions: ['.ahk'],
        command: 'AutoHotkey {{file}} {{args}}',
        requires: ['AutoHotkey'],
        note: '用 AutoHotkey 执行脚本'
    },
    {
        id: 'autoit',
        label: 'AutoIt',
        extensions: ['.au3'],
        command: 'AutoIt3 {{file}} {{args}}',
        requires: ['AutoIt3'],
        note: '用 AutoIt3 执行脚本'
    },
    {
        id: 'prolog',
        label: 'Prolog',
        extensions: ['.pro'],
        command: 'swipl {{file}} {{args}}',
        requires: ['swipl'],
        note: '用 swipl 运行 Prolog 程序'
    },
    {
        id: 'standardml',
        label: 'Standard ML',
        extensions: ['.sml', '.sig'],
        command: 'mlton {{file}} {{args}}',
        requires: ['mlton'],
        note: '用 mlton 编译并运行'
    },
    {
        id: 'wolfram',
        label: 'Wolfram Language',
        extensions: ['.wl', '.wls'],
        command: 'wolframscript {{file}} {{args}}',
        requires: ['wolframscript'],
        note: '用 wolframscript 运行脚本'
    },
    {
        id: 'qml',
        label: 'QML',
        extensions: ['.qml'],
        command: 'qmlscene {{file}} {{args}}',
        requires: ['qmlscene'],
        note: '用 qmlscene 运行 QML 界面'
    },

    // ------------------------------------------------------------------
    // 编译型
    // ------------------------------------------------------------------
    {
        id: 'crystal',
        label: 'Crystal',
        extensions: ['.cr'],
        command: 'crystal {{file}} {{args}}',
        compiled: true,
        note: '用 crystal 编译并直接运行'
    },
    {
        id: 'dlang',
        label: 'D',
        extensions: ['.d'],
        command: 'dmd {{file}} -ofile && ./{{basename}}',
        compiled: true,
        requires: ['dmd'],
        note: '用 dmd 编译后运行生成的可执行文件'
    },
    {
        id: 'odin',
        label: 'Odin',
        extensions: ['.odin'],
        command: 'odin run {{file}} {{args}}',
        requires: ['odin'],
        note: '用 odin run 直接编译并运行'
    },
    {
        id: 'vlang',
        label: 'V',
        // .v 归 Verilog（更常用），V 只能通过「选择该文件的运行方式」手动指定
        extensions: [],
        command: 'v run {{file}} {{args}}',
        requires: ['v'],
        note: '用 v run 直接编译并运行'
    },
    {
        id: 'fortran',
        label: 'Fortran',
        extensions: ['.f90', '.f95', '.f03', '.f'],
        command: 'gfortran {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['gfortran'],
        note: '用 gfortran 编译，再运行生成的产物'
    },
    {
        id: 'pascal',
        label: 'Pascal',
        extensions: ['.pas', '.pp'],
        command: 'fpc {{file}} -o{{out}} && {{out}}',
        compiled: true,
        requires: ['fpc'],
        note: '用 fpc 编译，再运行生成的产物'
    },
    {
        id: 'ada',
        label: 'Ada',
        extensions: ['.adb', '.ads'],
        command: 'gnatmake {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['gnatmake'],
        note: '用 gnatmake 编译，再运行生成的产物'
    },
    {
        id: 'vhdl',
        label: 'VHDL',
        extensions: ['.vhd', '.vhdl'],
        command: 'ghdl -o {{out}} {{file}} && {{out}}',
        compiled: true,
        requires: ['ghdl'],
        note: '用 ghdl 分析并运行 VHDL 设计'
    },
    {
        id: 'assembly',
        label: 'Assembly',
        extensions: ['.asm', '.s'],
        command: 'nasm -f elf64 {{file}} -o {{out}}.o && ld {{out}}.o -o {{out}} && {{out}}',
        compiled: true,
        requires: ['nasm'],
        note: '用 nasm 汇编、ld 链接后运行'
    },
    {
        id: 'elm',
        label: 'Elm',
        extensions: ['.elm'],
        command: 'elm make {{file}} --output={{out}}.js && node {{out}}.js',
        compiled: true,
        requires: ['elm'],
        note: '用 elm make 编译成 JS，再交给 node 运行'
    },
    {
        id: 'vala',
        label: 'Vala',
        extensions: ['.vala'],
        command: 'valac {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['valac'],
        note: '用 valac 编译，再运行生成的产物'
    },
    {
        id: 'cuda',
        label: 'CUDA',
        extensions: ['.cu'],
        command: 'nvcc {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['nvcc'],
        note: '用 nvcc 编译 CUDA 源码，再运行生成的产物'
    },
    {
        id: 'pony',
        label: 'Pony',
        extensions: ['.pony'],
        command: 'ponyc {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['ponyc'],
        note: '用 ponyc 编译，再运行生成的产物'
    },
    {
        id: 'chapel',
        label: 'Chapel',
        extensions: ['.chpl'],
        command: 'chpl {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['chpl'],
        note: '用 chpl 编译，再运行生成的产物'
    },
    {
        id: 'ballerina',
        label: 'Ballerina',
        extensions: ['.bal'],
        command: 'bal run {{file}}',
        requires: ['bal'],
        note: '用 bal run 直接编译并运行'
    },
    {
        id: 'agda',
        label: 'Agda',
        extensions: ['.agda'],
        command: 'agda {{file}} {{args}}',
        requires: ['agda'],
        note: '用 agda 做类型检查并运行'
    },
    {
        id: 'idris',
        label: 'Idris',
        extensions: ['.idr'],
        command: 'idris {{file}} -o {{out}}',
        compiled: true,
        requires: ['idris'],
        note: '用 idris 编译成可执行文件'
    },
    {
        id: 'nix',
        label: 'Nix',
        extensions: ['.nix'],
        command: 'nix run {{file}} {{args}}',
        requires: ['nix'],
        note: '用 nix run 执行 Nix 文件'
    },
    {
        id: 'glsl',
        label: 'GLSL',
        extensions: ['.glsl', '.vert', '.frag'],
        command: 'glslangValidator {{file}}',
        requires: ['glslangValidator'],
        note: '用 glslangValidator 校验着色器语法'
    },
    {
        id: 'wat',
        label: 'WebAssembly Text',
        extensions: ['.wat'],
        command: 'wat2wasm {{file}} -o {{out}}.wasm',
        compiled: true,
        requires: ['wat2wasm'],
        note: '用 wat2wasm 编译成 wasm 字节码'
    },

    // ------------------------------------------------------------------
    // 模板 / 视图 / 样式类
    // ------------------------------------------------------------------
    {
        id: 'sass',
        label: 'Sass',
        extensions: ['.scss', '.sass'],
        command: 'sass {{file}} {{out}}.css',
        requires: ['sass'],
        note: '用 sass 编译成 CSS'
    },
    {
        id: 'less',
        label: 'Less',
        extensions: ['.less'],
        command: 'lessc {{file}} {{out}}.css',
        requires: ['lessc'],
        note: '用 lessc 编译成 CSS'
    },
    {
        id: 'stylus',
        label: 'Stylus',
        extensions: ['.styl'],
        command: 'stylus {{file}} {{out}}.css',
        requires: ['stylus'],
        note: '用 stylus 编译成 CSS'
    },
    {
        id: 'handlebars',
        label: 'Handlebars',
        extensions: ['.hbs', '.handlebars'],
        command: 'hbs {{file}}',
        requires: ['hbs'],
        note: '用 hbs 预编译 Handlebars 模板'
    },
    {
        id: 'ejs',
        label: 'EJS',
        extensions: ['.ejs'],
        command: 'ejs {{file}}',
        requires: ['ejs'],
        note: '用 ejs 渲染模板'
    },
    {
        id: 'pug',
        label: 'Pug',
        extensions: ['.pug', '.jade'],
        command: 'pug {{file}}',
        requires: ['pug'],
        note: '用 pug 渲染模板'
    },
    {
        id: 'mustache',
        label: 'Mustache',
        extensions: ['.mustache'],
        command: 'mustache {{file}}',
        requires: ['mustache'],
        note: '用 mustache 渲染模板'
    },
    {
        id: 'liquid',
        label: 'Liquid',
        extensions: ['.liquid'],
        command: 'liquid {{file}}',
        requires: ['liquid'],
        note: '用 liquid 渲染模板'
    },
    {
        id: 'nunjucks',
        label: 'Nunjucks',
        extensions: ['.njk'],
        command: 'nunjucks {{file}}',
        requires: ['nunjucks'],
        note: '用 nunjucks 渲染模板'
    },
    {
        id: 'twig',
        label: 'Twig',
        extensions: ['.twig'],
        command: 'twig {{file}}',
        requires: ['twig'],
        note: '用 twig 渲染模板'
    },
    {
        id: 'jinja2',
        label: 'Jinja2',
        extensions: ['.j2', '.jinja2'],
        command: 'jinja2 {{file}}',
        requires: ['jinja2'],
        note: '用 jinja2 渲染模板'
    },
    {
        id: 'mako',
        label: 'Mako',
        extensions: ['.mako'],
        command: 'mako {{file}}',
        requires: ['mako'],
        note: '用 mako 渲染模板'
    },
    {
        id: 'erb',
        label: 'ERB',
        extensions: ['.erb'],
        command: 'erb {{file}}',
        requires: ['erb'],
        note: '用 erb 渲染模板'
    },
    {
        id: 'haml',
        label: 'Haml',
        extensions: ['.haml'],
        command: 'haml {{file}}',
        requires: ['haml'],
        note: '用 haml 渲染模板'
    },
    {
        id: 'slim',
        label: 'Slim',
        extensions: ['.slim'],
        command: 'slim {{file}}',
        requires: ['slim'],
        note: '用 slim 渲染模板'
    },
    {
        id: 'asciidoc',
        label: 'AsciiDoc',
        extensions: ['.adoc'],
        command: 'asciidoctor {{file}}',
        requires: ['asciidoctor'],
        note: '用 asciidoctor 转换 AsciiDoc 文档'
    },

    // ------------------------------------------------------------------
    // 工程 / 杂项
    // ------------------------------------------------------------------
    {
        id: 'justfile',
        label: 'Justfile',
        extensions: ['.justfile'],
        command: 'just {{file}}',
        note: '用 just 执行指定的 Justfile'
    },
    {
        id: 'taskfile',
        label: 'Taskfile',
        extensions: ['.taskfile'],
        command: 'task {{file}}',
        note: '用 task 执行指定的 Taskfile'
    },
    {
        id: 'rakefile',
        label: 'Rakefile',
        extensions: ['.rakefile', '.rake'],
        command: 'rake {{file}}',
        note: '用 rake 执行指定的 Rakefile'
    },
    {
        id: 'terraform',
        label: 'Terraform',
        extensions: ['.tf', '.tfvars', '.hcl'],
        command: 'terraform fmt {{file}}',
        note: '用 terraform fmt 格式化配置'
    },
    {
        id: 'csv',
        label: 'CSV',
        extensions: ['.csv'],
        command: 'column -s, -t {{file}}',
        note: '用 column 把 CSV 排成对齐表格'
    },
    {
        id: 'objective-cpp',
        label: 'Objective-C++',
        extensions: ['.mm'],
        command: 'clang++ -framework Foundation {{file}} -o {{out}} && {{out}}',
        compiled: true,
        requires: ['clang++'],
        note: '用 clang++ 链接 Foundation 框架后运行'
    }
];
