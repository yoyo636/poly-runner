import * as fs from 'fs';
import * as path from 'path';

import { LANGUAGES, LanguageDef } from './languages';

/** 模板渲染时可用的变量集合。 */
export interface TemplateContext {
    /** 源文件绝对路径（含扩展名）。 */
    file: string;
    /** 源文件绝对路径（去扩展名）。 */
    fileNoExt: string;
    /** 含扩展名的文件名。 */
    fileName: string;
    /** 不含扩展名的文件名。 */
    basename: string;
    /** 源文件所在目录。 */
    dir: string;
    /** 工作区根目录。 */
    workspaceFolder: string;
    /** 相对工作区根的路径。 */
    relativeFile: string;
    /** 运行选中代码时的临时文件路径（未使用临时文件时等于 file）。 */
    tmpFile: string;
    /** 编译产物路径。 */
    out: string;
    /** 所选编译器绝对路径（没有则为 ''）。 */
    compiler: string;
    /** C++ 标准，如 c++17。 */
    std: string;
    /** 警告开关：'-Wall' 或 ''。 */
    warnings: string;
    /** 额外运行参数。 */
    args: string;
    /** 源码里解析出的类名（Java/Kotlin/Scala）。 */
    className: string;
    /** stdin 管道前缀：开启时为 `cat <file> | `，否则为空串。 */
    pipeFile: string;
}

/** 需要做 shell 转义再替换的占位符。 */
const QUOTED_KEYS = new Set([
    'file',
    'fileNoExt',
    'fileName',
    'basename',
    'dir',
    'workspaceFolder',
    'relativeFile',
    'tmpFile',
    'out',
    'compiler'
]);

/** 原样替换的占位符。 */
const RAW_KEYS = new Set(['std', 'warnings', 'args', 'className', 'pipeFile']);

/**
 * POSIX / Windows 通用的 shell 路径转义。
 * - POSIX：单引号包裹，内部单引号用 '\'' 转义；
 * - Windows：双引号包裹。
 */
export function shellQuote(value: string): string {
    if (process.platform === 'win32') {
        return `"${value.replace(/"/g, '""')}"`;
    }
    if (value.length > 0 && /^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
        return value;
    }
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** 把模板里的 {{key}} 替换成实际值。 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
    return template.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (match, key: string) => {
        const raw = (ctx as unknown as Record<string, string>)[key];
        if (raw === undefined) {
            return match;
        }
        if (QUOTED_KEYS.has(key)) {
            return raw.length === 0 ? '' : shellQuote(raw);
        }
        if (RAW_KEYS.has(key)) {
            return raw;
        }
        return raw;
    });
}

/** 语言识别结果。 */
export interface LanguageMatch {
    /** VS Code language id。 */
    id: string;
    /** 定义（内置表里的条目；自定义命令时可能没有）。 */
    def?: LanguageDef;
    /** 识别依据，便于给用户解释。 */
    reason: string;
}

/** 常见的「语言 id 别名」→ 实际 language id。 */
const LANGUAGE_ALIASES: Record<string, string> = {
    'c++': 'cpp',
    cplusplus: 'cpp',
    'objective-c++': 'objective-cpp',
    'c#': 'csharp',
    cs: 'csharp',
    'shell-script': 'shellscript',
    bash: 'shellscript',
    sh: 'shellscript',
    zsh: 'shellscript',
    py: 'python',
    py3: 'python',
    python3: 'python',
    node: 'javascript',
    nodejs: 'javascript',
    ts: 'typescript',
    golang: 'go',
    rs: 'rust',
    kt: 'kotlin',
    rb: 'ruby',
    ps1: 'powershell',
    bat: 'bat',
    cmd: 'bat',
    yml: 'yaml',
    'plaintext': 'text'
};

/** 按 language id 找内置定义。 */
export function findById(id: string): LanguageDef | undefined {
    const normalized = LANGUAGE_ALIASES[id.toLowerCase()] ?? id;
    return LANGUAGES.find((l) => l.id === normalized || l.id === id);
}

/** 按文件扩展名找内置定义。 */
export function findByExtension(ext: string): LanguageDef | undefined {
    const normalized = ext.toLowerCase();
    return LANGUAGES.find((l) => l.extensions.includes(normalized));
}

/** shebang → 语言 id。 */
const SHEBANG_MAP: Record<string, string> = {
    python: 'python',
    python3: 'python',
    node: 'javascript',
    nodejs: 'javascript',
    bash: 'shellscript',
    sh: 'shellscript',
    zsh: 'shellscript',
    ruby: 'ruby',
    perl: 'perl',
    php: 'php',
    lua: 'lua',
    awk: 'awk',
    expect: 'expect',
    tclsh: 'tcl',
    julia: 'julia',
    rscript: 'r',
    groovy: 'groovy'
};

/** 读取文件首行，判断 shebang。 */
export function readShebang(filePath: string): string | undefined {
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size > 512 * 1024) {
            return undefined;
        }
        const fd = fs.openSync(filePath, 'r');
        try {
            const buffer = Buffer.alloc(256);
            const bytes = fs.readSync(fd, buffer, 0, 256, 0);
            const firstLine = buffer.subarray(0, bytes).toString('utf8').split(/\r?\n/)[0] ?? '';
            return firstLine.startsWith('#!') ? firstLine : undefined;
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return undefined;
    }
}

/** 从 shebang 推断语言 id。 */
export function languageFromShebang(filePath: string): string | undefined {
    const shebang = readShebang(filePath);
    if (!shebang) {
        return undefined;
    }
    const match = /#!\s*(?:.*\/)?([A-Za-z0-9_+-]+)/.exec(shebang);
    if (!match) {
        return undefined;
    }
    const interpreter = match[1].toLowerCase();
    if (SHEBANG_MAP[interpreter]) {
        return SHEBANG_MAP[interpreter];
    }
    if (interpreter === 'python3' || interpreter === 'python') {
        return 'python';
    }
    return undefined;
}

/**
 * 识别当前文件该用什么方式运行。
 * 顺序：显式别名 → VS Code languageId → 扩展名 → shebang。
 */
export function detectLanguage(
    languageId: string | undefined,
    filePath: string,
    aliases: Record<string, string> = {}
): LanguageMatch | undefined {
    // 1) 用户配置的扩展名 / languageId 绑定
    const ext = path.extname(filePath).toLowerCase();
    const byAlias = aliases[ext] ?? aliases[languageId ?? ''];
    if (byAlias) {
        return { id: byAlias, def: findById(byAlias), reason: `用户绑定（${ext || languageId}）` };
    }

    // 2) VS Code 的 languageId
    if (languageId) {
        const def = findById(languageId);
        if (def) {
            return { id: def.id, def, reason: `文件类型 ${languageId}` };
        }
    }

    // 3) 扩展名
    const byExt = findByExtension(ext);
    if (byExt) {
        return { id: byExt.id, def: byExt, reason: `文件扩展名 ${ext}` };
    }

    // 4) shebang
    const byShebang = languageFromShebang(filePath);
    if (byShebang) {
        const def = findById(byShebang);
        return { id: byShebang, def, reason: '脚本首行 (shebang)' };
    }

    return undefined;
}

/** 从源码里解析 public class / interface / enum 名，供 Java 系使用。 */
export function detectClassName(sourcePath: string, fallback: string): string {
    try {
        const stat = fs.statSync(sourcePath);
        if (!stat.isFile() || stat.size > 2 * 1024 * 1024) {
            return fallback;
        }
        const content = fs.readFileSync(sourcePath, 'utf8');
        const patterns = [
            /public\s+(?:final\s+|abstract\s+|sealed\s+)*class\s+([A-Za-z_$][\w$]*)/,
            /public\s+(?:final\s+|abstract\s+)*interface\s+([A-Za-z_$][\w$]*)/,
            /public\s+enum\s+([A-Za-z_$][\w$]*)/,
            /public\s+object\s+([A-Za-z_$][\w$]*)/,
            /class\s+([A-Za-z_$][\w$]*)/
        ];
        for (const pattern of patterns) {
            const matched = pattern.exec(content);
            if (matched) {
                return matched[1];
            }
        }
    } catch {
        /* 读不到就用兜底 */
    }
    return fallback;
}

/** 该语言是否需要先编译。 */
export function isCompiled(def: LanguageDef | undefined): boolean {
    return def?.compiled === true;
}

/** 把附加参数数组拼成一行。 */
export function joinArgs(args: string[]): string {
    return args.filter((a) => typeof a === 'string' && a.length > 0).join(' ');
}
