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
        extensions: ['.m', '.mm'],
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
    }
];
