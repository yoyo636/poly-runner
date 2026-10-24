import * as fs from 'fs';
import * as path from 'path';

import { splitShellLike } from './config';

/** compile_commands.json 里的一条记录。 */
export interface CompileEntry {
    /** 编译时的工作目录。 */
    directory: string;
    /** 源文件（可能是相对 directory 的相对路径）。 */
    file: string;
    /** 完整命令行（有的生成器给这个）。 */
    command?: string;
    /** 参数数组（有的生成器给这个）。 */
    arguments?: string[];
    /** 产物路径（.o 文件）。 */
    output?: string;
}

/** 编译数据库的常见位置（相对项目根）。 */
const COMMON_DB_PATHS = [
    'compile_commands.json',
    'build/compile_commands.json',
    'build-debug/compile_commands.json',
    'cmake-build-debug/compile_commands.json',
    'cmake-build-release/compile_commands.json',
    'out/build/compile_commands.json',
    'out/compile_commands.json'
];

/**
 * 从 startDir 向上找 compile_commands.json。
 * 先看每一层的「常见位置」，再看这一层目录本身。
 */
export function findCompileDatabase(startDir: string, maxDepth = 5): string | undefined {
    let current = path.resolve(startDir);
    for (let depth = 0; depth < maxDepth; depth++) {
        for (const rel of COMMON_DB_PATHS) {
            const candidate = path.join(current, rel);
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return candidate;
            }
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return undefined;
}

/** 读取并解析 compile_commands.json。 */
export function loadCompileDatabase(dbPath: string): CompileEntry[] {
    try {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((item) => item && typeof item === 'object' && typeof item.file === 'string')
            .map((item) => {
                const directory = typeof item.directory === 'string' ? item.directory : path.dirname(dbPath);
                const file = path.isAbsolute(item.file) ? item.file : path.resolve(directory, item.file);
                return {
                    directory,
                    file,
                    command: typeof item.command === 'string' ? item.command : undefined,
                    arguments: Array.isArray(item.arguments) ? item.arguments.map(String) : undefined,
                    output: typeof item.output === 'string' ? item.output : undefined
                } satisfies CompileEntry;
            });
        // eslint-disable-next-line no-useless-return
    } catch {
        return [];
    }
}

/** 把一条记录拆成参数数组。 */
export function entryArguments(entry: CompileEntry): string[] {
    if (entry.arguments && entry.arguments.length > 0) {
        return entry.arguments.slice();
    }
    if (entry.command) {
        return splitShellLike(entry.command);
    }
    return [];
}

/** 找到某个源文件对应的编译记录。 */
export function findEntryForFile(entries: CompileEntry[], file: string): CompileEntry | undefined {
    const target = path.resolve(file);
    return entries.find((e) => path.resolve(e.file) === target);
}

/**
 * 判断某条记录属于哪个 target。
 * CMake 的 Makefile/Ninja 生成器会把同一 target 的产物放在
 * `CMakeFiles/<target>.dir/` 下，据此可以分组。
 */
export function targetKey(entry: CompileEntry): string {
    if (entry.output) {
        const normalized = entry.output.replace(/\\/g, '/');
        const match = /CMakeFiles\/([^/]+)\.dir/.exec(normalized);
        if (match) {
            return match[1];
        }
        return path.dirname(entry.output);
    }
    return entry.directory;
}

/** 取出同 target 的所有源文件。 */
export function collectTargetSources(entries: CompileEntry[], entry: CompileEntry): string[] {
    const key = targetKey(entry);
    const sources = new Set<string>();
    for (const item of entries) {
        if (targetKey(item) === key) {
            sources.add(item.file);
        }
    }
    sources.add(entry.file);
    return Array.from(sources);
}

/** 编译命令里需要连同参数一起剔除的选项。 */
const DROP_WITH_ARG = new Set(['-o', '-MF', '-MT', '-MQ']);

/** 只剔除、不带参数的选项。 */
const DROP_FLAGS = new Set(['-c', '-C']);

/**
 * 这些选项的参数是独立一个 token 的（例如 `-arch arm64`、`-isystem /path`）。
 * 丢掉参数会破坏命令，所以要成对保留。
 */
const KEEP_WITH_ARG = new Set([
    '-arch', '-target', '-isysroot', '--sysroot', '-isystem', '-iquote', '-idirafter',
    '-include', '-imacros', '-iframework', '-F', '-framework', '-Xclang', '-B', '-L', '-l',
    '-mllvm', '-T', '-u', '-z', '-specs', '-wrapper', '--gcc-toolchain', '-gcc-toolchain',
    '-stdlib', '-aux-info', '-install_name', '-current_version', '-compatibility_version', '-x'
]);

/**
 * 从编译记录里提取「编译参数」（不含源文件、不含 -c、不含 -o）。
 * 这些参数里带着项目真实的 include 路径、宏定义和标准版本。
 *
 * @param knownSources 编译数据库里出现过的所有源文件，用来区分「位置参数里的源文件」
 *                     和「某个选项的独立参数」。
 */
export function extractFlags(entry: CompileEntry, knownSources: Set<string> = new Set()): string[] {
    const args = entryArguments(entry);
    const flags: string[] = [];
    // 编译器本身也是位置参数，要去掉，否则会被当成待链接的文件
    const compiler = extractCompiler(entry);
    const compilerPath = compiler ? path.resolve(entry.directory, compiler) : undefined;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (DROP_FLAGS.has(arg)) {
            continue;
        }
        if (DROP_WITH_ARG.has(arg)) {
            i++; // 连同下一个参数一起丢掉
            continue;
        }
        if (arg.startsWith('-o') && arg.length > 2) {
            continue; // -o<file> 连写形式
        }
        if (KEEP_WITH_ARG.has(arg)) {
            flags.push(arg);
            if (i + 1 < args.length) {
                flags.push(args[++i]);
            }
            continue;
        }
        if (arg.startsWith('-')) {
            flags.push(arg);
            continue;
        }
        // 位置参数：源文件本身、编译器要丢掉；其他（例如独立选项的参数）保留
        const resolved = path.isAbsolute(arg) ? arg : path.resolve(entry.directory, arg);
        if (
            resolved === path.resolve(entry.file) ||
            knownSources.has(resolved) ||
            (compilerPath !== undefined && resolved === compilerPath)
        ) {
            continue;
        }
        flags.push(arg);
    }
    return flags;
}

/** 从编译记录里取出真正的编译器（跳过 ccache / distcc / sccache 之类的前缀）。 */
export function extractCompiler(entry: CompileEntry): string | undefined {
    const args = entryArguments(entry);
    const wrappers = new Set(['ccache', 'distcc', 'sccache', 'icecc', 'time']);
    for (const arg of args) {
        if (arg.startsWith('-')) {
            continue;
        }
        const base = path.basename(arg);
        if (wrappers.has(base)) {
            continue;
        }
        return arg;
    }
    return undefined;
}

/** 生成「用编译数据库里的参数编译整个 target」的完整命令。 */
export interface CompiledTargetPlan {
    /** 完整命令。 */
    command: string;
    /** 参与链接的源文件。 */
    sources: string[];
    /** target 名。 */
    target: string;
    /** 使用的编译器。 */
    compiler: string;
    /** 提取到的编译参数。 */
    flags: string[];
}

export function planTargetCompilation(
    entries: CompileEntry[],
    entry: CompileEntry,
    outputBinary: string,
    compilerOverride?: string
): CompiledTargetPlan | undefined {
    const sources = collectTargetSources(entries, entry);
    const knownSources = new Set(entries.map((e) => path.resolve(e.file)));
    const flags = extractFlags(entry, knownSources);
    const compiler = compilerOverride || extractCompiler(entry);
    if (!compiler) {
        return undefined;
    }
    const target = targetKey(entry);
    const parts = [compiler, ...flags, ...sources.map((s) => shellQuotePath(s)), '-o', shellQuotePath(outputBinary)];
    return { command: parts.join(' '), sources, target, compiler, flags };
}

/** POSIX / Windows 通用的路径转义。 */
export function shellQuotePath(value: string): string {
    if (process.platform === 'win32') {
        return `"${value.replace(/"/g, '""')}"`;
    }
    if (value.length > 0 && /^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
        return value;
    }
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * 编译数据库里的记录通常带 `-o CMakeFiles/x.dir/foo.cpp.o`，是相对路径。
 * 判断某条记录是不是「这个 target 的主源文件」（通常也是可执行程序的入口）。
 */
export function isLikelyEntryPoint(entry: CompileEntry): boolean {
    const base = path.basename(entry.file).toLowerCase();
    return /(^main\.|[._-]main)\.(c|cc|cpp|cxx|c\+)$/.test(base);
}
