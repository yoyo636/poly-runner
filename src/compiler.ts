import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type CompilerKind = 'gcc' | 'clang' | 'msvc';

export interface CompilerInfo {
    /** 唯一 id，便于在设置中记忆用户选择。 */
    id: string;
    /** 展示名称。 */
    label: string;
    /** 编译器可执行文件路径。 */
    path: string;
    /** 编译器类型，决定参数风格。 */
    kind: CompilerKind;
    /** 版本信息首行，探测失败时为空。 */
    version: string;
}

/** 在 PATH 中查找可执行文件，返回绝对路径；找不到返回 undefined。 */
export function findExecutable(command: string): string | undefined {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    try {
        const stdout = childProcess.execFileSync(finder, [command], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const first = stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)[0];
        return first || undefined;
    } catch {
        return undefined;
    }
}

/** 执行命令并捕获输出（不抛异常）。 */
export function capture(cmd: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        const child = childProcess.spawn(cmd, args, { cwd, shell: false });
        child.stdout?.on('data', (d) => (stdout += String(d)));
        child.stderr?.on('data', (d) => (stderr += String(d)));
        child.on('error', (err) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve({ code: -1, stdout, stderr: stderr + String(err) });
        });
        child.on('close', (code) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve({ code: code ?? -1, stdout, stderr });
        });
    });
}

/** 通过文件路径/命令名推断编译器类型。 */
export function detectKind(compilerPath: string): CompilerKind {
    const base = path.basename(compilerPath).toLowerCase();
    if (base === 'cl.exe' || base === 'cl' || base.startsWith('cl-')) {
        return 'msvc';
    }
    if (base.includes('clang')) {
        return 'clang';
    }
    return 'gcc';
}

/** 读取编译器版本首行。 */
async function readVersion(compilerPath: string, kind: CompilerKind): Promise<string> {
    const args = kind === 'msvc' ? [] : ['--version'];
    const res = await capture(compilerPath, args);
    if (res.code !== 0) {
        return '';
    }
    const text = (res.stdout || res.stderr).trim();
    return text.split(/\r?\n/)[0] ?? '';
}

/** 探测本机所有可用编译器。 */
export async function detectCompilers(): Promise<CompilerInfo[]> {
    const found: CompilerInfo[] = [];
    const push = (id: string, label: string, compilerPath: string, kind: CompilerKind) => {
        if (!found.some((c) => c.path === compilerPath)) {
            found.push({ id, label, path: compilerPath, kind, version: '' });
        }
    };

    const candidates: Array<{ id: string; label: string; cmd: string; kind: CompilerKind }> = [
        { id: 'g++', label: 'g++', cmd: 'g++', kind: 'gcc' },
        { id: 'clang++', label: 'clang++', cmd: 'clang++', kind: 'clang' },
        { id: 'c++', label: 'c++ (默认 C++ 编译器)', cmd: 'c++', kind: 'gcc' }
    ];

    // GNU 工具链的版本化二进制（如 g++-14）
    for (let major = 21; major >= 11; major--) {
        candidates.push({ id: `g++-${major}`, label: `g++-${major}`, cmd: `g++-${major}`, kind: 'gcc' });
    }
    for (let major = 19; major >= 11; major--) {
        candidates.push({ id: `clang++-${major}`, label: `clang++-${major}`, cmd: `clang++-${major}`, kind: 'clang' });
    }

    for (const candidate of candidates) {
        const resolved = findExecutable(candidate.cmd);
        if (resolved) {
            push(candidate.id, candidate.label, resolved, candidate.kind);
        }
    }

    const msvc = await detectMsvc();
    if (msvc) {
        found.push(msvc);
    }

    // 异步补版本信息
    await Promise.all(
        found.map(async (item) => {
            item.version = await readVersion(item.path, item.kind);
        })
    );

    return found;
}

/** 通过 vswhere 定位 MSVC 的 cl.exe。 */
async function detectMsvc(): Promise<CompilerInfo | undefined> {
    if (process.platform !== 'win32') {
        return undefined;
    }
    const programFiles = process.env['ProgramFiles(x86)'] || process.env['ProgramFiles'];
    if (!programFiles) {
        return undefined;
    }
    const vswhere = path.join(programFiles, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
    if (!fs.existsSync(vswhere)) {
        return undefined;
    }
    const res = await capture(vswhere, [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '-property',
        'installationPath'
    ]);
    const installPath = res.stdout.trim();
    if (!installPath) {
        return undefined;
    }
    const toolsRoot = path.join(installPath, 'VC', 'Tools', 'MSVC');
    if (!fs.existsSync(toolsRoot)) {
        return undefined;
    }
    const versions = fs
        .readdirSync(toolsRoot)
        .filter((d) => /^\d+\.\d+/.test(d))
        .sort((a, b) => compareVersion(b, a));
    for (const version of versions) {
        for (const host of ['x64', 'x86']) {
            const cl = path.join(toolsRoot, version, 'bin', `Host${host}`, host, 'cl.exe');
            if (fs.existsSync(cl)) {
                return {
                    id: `cl-${version}-${host}`,
                    label: `cl.exe (MSVC ${version})`,
                    path: cl,
                    kind: 'msvc',
                    version: `MSVC ${version}`
                };
            }
        }
    }
    return undefined;
}

/** 比较 "14.38.33130" 这种版本号，返回 >0 表示 a 更新。 */
export function compareVersion(a: string, b: string): number {
    const pa = a.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
    const pb = b.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const va = pa[i] ?? 0;
        const vb = pb[i] ?? 0;
        if (va !== vb) {
            return va - vb;
        }
    }
    return 0;
}

/**
 * 根据配置挑选编译器：
 * 1. 用户显式配置的路径优先；
 * 2. 否则按 g++ → clang++ → c++ → MSVC 顺序自动选择。
 */
export async function resolveCompiler(setting: string): Promise<CompilerInfo | undefined> {
    const trimmed = setting.trim();
    if (trimmed.length > 0) {
        const candidates = trimmed.includes('/') || trimmed.includes('\\')
            ? [trimmed]
            : [findExecutable(trimmed) ?? trimmed];
        for (const candidate of candidates) {
            if (candidate && (fs.existsSync(candidate) || !path.isAbsolute(candidate))) {
                const kind = detectKind(candidate);
                return {
                    id: kind,
                    label: path.basename(candidate),
                    path: candidate,
                    kind,
                    version: await readVersion(candidate, kind)
                };
            }
        }
    }
    const detected = await detectCompilers();
    return detected[0];
}

/** MSVC 没有 /std:c++11，统一升到 c++14。 */
function msvcStandard(std: string): string {
    switch (std) {
        case 'c++11':
            return 'c++14';
        case 'c++14':
            return 'c++14';
        case 'c++17':
            return 'c++17';
        case 'c++20':
            return 'c++20';
        case 'c++23':
            return 'latest';
        default:
            return 'c++17';
    }
}

/** 可执行文件名（Windows 需要 .exe）。 */
export function binaryName(base: string): string {
    return process.platform === 'win32' ? `${base}.exe` : base;
}

/**
 * 生成编译参数。
 * @param compiler 编译器
 * @param input 源文件路径
 * @param output 可执行文件路径
 * @param std C++ 标准
 * @param extra 额外参数
 * @param warnings 是否开启警告
 */
export function buildArgs(
    compiler: CompilerInfo,
    input: string,
    output: string,
    std: string,
    extra: string[],
    warnings: boolean
): string[] {
    if (compiler.kind === 'msvc') {
        const args: string[] = ['/nologo', '/EHsc', `/std:${msvcStandard(std)}`];
        if (warnings) {
            args.push('/W3');
        }
        args.push('/Fe', output);
        args.push(input);
        args.push(...extra);
        return args;
    }
    const args: string[] = [`-std=${std}`];
    if (warnings) {
        args.push('-Wall');
    }
    args.push(input, '-o', output);
    args.push(...extra);
    return args;
}

/** 生成人类可读的命令行，用于输出到终端/输出面板。 */
export function formatCommand(cmd: string, args: string[]): string {
    const quote = (s: string) => (/[\s"']/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
    return [cmd, ...args].map(quote).join(' ');
}

/** 默认的编译产物目录（扩展全局存储下的 build 子目录）。 */
export function defaultOutputDir(globalStoragePath: string): string {
    return path.join(globalStoragePath, 'build');
}

/** 系统临时目录下的独立子目录。 */
export function tempDir(prefix: string): string {
    return path.join(os.tmpdir(), 'cpp-runner-next', prefix);
}
