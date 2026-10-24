import * as fs from 'fs';
import * as path from 'path';

export interface CMakeTarget {
    /** target 名，例如 myapp。 */
    name: string;
    /** 定义它的 CMakeLists.txt 所在目录。 */
    dir: string;
    /** 是否是可执行程序（add_executable）。 */
    executable: boolean;
}

/** 扫描时跳过的目录。 */
const SKIP_DIRS = new Set(['build', 'out', 'node_modules', '.git', '.vscode', 'cmake-build-debug', 'cmake-build-release']);

/** 递归收集项目里的 CMakeLists.txt。 */
function collectCMakeLists(root: string, maxDepth = 4): string[] {
    const result: string[] = [];
    const walk = (dir: string, depth: number): void => {
        if (depth > maxDepth) {
            return;
        }
        let entries: fs.Dirent[] = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) {
                    continue;
                }
                walk(path.join(dir, entry.name), depth + 1);
                continue;
            }
            if (entry.isFile() && entry.name.toLowerCase() === 'cmakelists.txt') {
                result.push(path.join(dir, entry.name));
            }
        }
    };
    walk(root, 0);
    return result;
}

/**
 * 解析项目里的 add_executable / add_library，列出可选 target。
 * 只取名字里没有变量占位符的（带 ${} 的没法在命令行里直接用）。
 */
export function parseCMakeTargets(root: string): CMakeTarget[] {
    const targets: CMakeTarget[] = [];
    const seen = new Set<string>();

    for (const listFile of collectCMakeLists(root)) {
        let content = '';
        try {
            content = fs.readFileSync(listFile, 'utf8');
        } catch {
            continue;
        }
        // 去掉注释，避免把注释里的 add_executable 也认进来
        const cleaned = content.replace(/#[^\n]*/g, '');
        const dir = path.dirname(listFile);

        const execRe = /add_executable\s*\(\s*([A-Za-z0-9_\-.]+)/g;
        let match: RegExpExecArray | null;
        while ((match = execRe.exec(cleaned)) !== null) {
            const name = match[1];
            const key = `${dir}::${name}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            targets.push({ name, dir, executable: true });
        }

        const libRe = /add_library\s*\(\s*([A-Za-z0-9_\-.]+)/g;
        while ((match = libRe.exec(cleaned)) !== null) {
            const name = match[1];
            const key = `${dir}::${name}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            targets.push({ name, dir, executable: false });
        }
    }

    return targets;
}

/** 只返回可执行 target。 */
export function executableTargets(targets: CMakeTarget[]): CMakeTarget[] {
    return targets.filter((t) => t.executable);
}

/** CMake 配置命令（顺带导出 compile_commands.json）。 */
export function cmakeConfigureCommand(root: string, buildDir: string, buildType: string): string {
    const buildPath = path.join(root, buildDir);
    return (
        `cmake -S ${shellQuote(path.resolve(root))} -B ${shellQuote(buildPath)} ` +
        `-DCMAKE_BUILD_TYPE=${buildType} -DCMAKE_EXPORT_COMPILE_COMMANDS=ON`
    );
}

/** CMake 构建命令。 */
export function cmakeBuildCommand(root: string, buildDir: string, target?: string, parallel?: number): string {
    const buildPath = path.join(root, buildDir);
    const targetPart = target ? ` --target ${shellQuote(target)}` : '';
    const jobs = parallel && parallel > 0 ? ` -j ${parallel}` : '';
    return `cmake --build ${shellQuote(buildPath)}${targetPart}${jobs}`;
}

/**
 * 在构建目录里找产物。
 * 依次尝试：build/<target>、build/<Config>/<target>、build/<target>.exe 等。
 */
export function findCMakeArtifact(root: string, buildDir: string, target: string, buildType: string): string | undefined {
    const buildPath = path.join(root, buildDir);
    const names = process.platform === 'win32' ? [`${target}.exe`, target] : [target];
    const dirs = [buildPath, path.join(buildPath, buildType), path.join(buildPath, 'Debug'), path.join(buildPath, 'Release')];

    for (const dir of dirs) {
        for (const name of names) {
            const candidate = path.join(dir, name);
            if (fs.existsSync(candidate)) {
                try {
                    if (fs.statSync(candidate).isFile()) {
                        return candidate;
                    }
                } catch {
                    /* 忽略 */
                }
            }
        }
    }
    return undefined;
}

/** 找构建目录里的编译数据库。 */
export function findCompileDatabaseInBuild(root: string, buildDir: string): string | undefined {
    const candidate = path.join(root, buildDir, 'compile_commands.json');
    return fs.existsSync(candidate) ? candidate : undefined;
}

/** POSIX / Windows 通用的路径转义。 */
export function shellQuote(value: string): string {
    if (process.platform === 'win32') {
        return `"${value.replace(/"/g, '""')}"`;
    }
    if (value.length > 0 && /^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
        return value;
    }
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
