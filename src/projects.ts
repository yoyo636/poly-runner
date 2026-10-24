import * as fs from 'fs';
import * as path from 'path';

import { executableTargets, parseCMakeTargets, shellQuote } from './cmake';

export interface ProjectKind {
    /** 项目类型 id，例如 npm / cargo / gomod / cmake。 */
    id: string;
    /** 展示名，例如 Node.js。 */
    label: string;
    /** 项目根目录。 */
    root: string;
    /** 触发识别的标志文件。 */
    marker: string;
    /** 一句话说明。 */
    note: string;
    /**
     * 构建命令模板。含 {target} / {root} 占位。
     * 有 build 就意味着这是「先构建、再运行产物」的项目。
     */
    build?: string;
    /** 运行命令模板（可执行产物路径）。 */
    run?: string;
    /** 可选的 target / 脚本列表，多个时需要用户选。 */
    targets?: string[];
    /** 需要外部提供的可执行文件。 */
    requires?: string[];
}

/** npm / deno 这类需要从配置文件里挑脚本的项目。 */
interface ScriptProjectRule {
    id: string;
    label: string;
    markers: string[];
    pick?: (root: string) => string | undefined;
    list?: (root: string) => string[];
    fallback: string;
    note: string;
}

const NPM_SCRIPT_PRIORITY = ['start', 'dev', 'serve', 'build', 'test'];

function readJson(file: string): any {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return undefined;
    }
}

function pickNpmScript(root: string): string | undefined {
    const pkg = readJson(path.join(root, 'package.json'));
    const scripts = pkg?.scripts;
    if (!scripts || typeof scripts !== 'object') {
        return undefined;
    }
    const names = Object.keys(scripts);
    for (const preferred of NPM_SCRIPT_PRIORITY) {
        if (names.includes(preferred)) {
            return preferred;
        }
    }
    return names[0];
}

function listNpmScripts(root: string): string[] {
    const pkg = readJson(path.join(root, 'package.json'));
    const scripts = pkg?.scripts;
    if (!scripts || typeof scripts !== 'object') {
        return [];
    }
    const names = Object.keys(scripts);
    // 常用脚本排前面，其余按字母序
    const priority = names.filter((n) => NPM_SCRIPT_PRIORITY.includes(n));
    const rest = names.filter((n) => !NPM_SCRIPT_PRIORITY.includes(n)).sort();
    return [...priority, ...rest];
}

function pickDenoTask(root: string): string | undefined {
    for (const file of ['deno.json', 'deno.jsonc']) {
        const cfg = readJson(path.join(root, file));
        const tasks = cfg?.tasks;
        if (tasks && typeof tasks === 'object') {
            const names = Object.keys(tasks);
            for (const preferred of NPM_SCRIPT_PRIORITY) {
                if (names.includes(preferred)) {
                    return preferred;
                }
            }
            return names[0];
        }
    }
    return undefined;
}

const SCRIPT_RULES: ScriptProjectRule[] = [
    {
        id: 'npm',
        label: 'Node.js',
        markers: ['package.json'],
        pick: pickNpmScript,
        list: listNpmScripts,
        fallback: 'npm start',
        note: '用 package.json 里的脚本运行'
    },
    {
        id: 'deno',
        label: 'Deno',
        markers: ['deno.json', 'deno.jsonc'],
        pick: pickDenoTask,
        fallback: 'deno task start',
        note: '用 deno.json 里的 task 运行'
    }
];

interface FileRule {
    id: string;
    label: string;
    markers: string[];
    command: string | ((root: string) => string);
    note: string;
    requires?: string[];
}

const FILE_RULES: FileRule[] = [
    { id: 'cargo', label: 'Rust', markers: ['Cargo.toml'], command: 'cargo run', note: '用 cargo run 运行项目', requires: ['cargo'] },
    { id: 'gomod', label: 'Go', markers: ['go.mod'], command: 'go run .', note: '用 go run . 运行项目', requires: ['go'] },
    {
        id: 'gradle',
        label: 'Gradle',
        markers: ['build.gradle', 'build.gradle.kts'],
        command: (root) => (fs.existsSync(path.join(root, 'gradlew')) ? './gradlew run' : 'gradle run'),
        note: '用 Gradle 运行项目',
        requires: ['gradle']
    },
    { id: 'maven', label: 'Maven', markers: ['pom.xml'], command: 'mvn -q package', note: '用 Maven 构建项目', requires: ['mvn'] },
    { id: 'mix', label: 'Elixir Mix', markers: ['mix.exs'], command: 'mix run', note: '用 mix run 运行项目', requires: ['mix'] },
    { id: 'sbt', label: 'Scala SBT', markers: ['build.sbt'], command: 'sbt run', note: '用 sbt 运行项目', requires: ['sbt'] },
    { id: 'make', label: 'Make', markers: ['Makefile', 'makefile', 'GNUmakefile'], command: 'make', note: '用 make 运行项目', requires: ['make'] },
    { id: 'just', label: 'just', markers: ['justfile', 'Justfile'], command: 'just', note: '用 just 运行项目', requires: ['just'] },
    { id: 'task', label: 'Task', markers: ['Taskfile.yml', 'Taskfile.yaml'], command: 'task', note: '用 task 运行项目', requires: ['task'] },
    { id: 'rake', label: 'Rake', markers: ['Rakefile'], command: 'rake', note: '用 rake 运行项目', requires: ['rake'] },
    { id: 'bundle', label: 'Ruby Bundler', markers: ['Gemfile'], command: 'bundle exec rake', note: '用 bundler 运行项目', requires: ['bundle'] },
    { id: 'nix', label: 'Nix', markers: ['flake.nix', 'default.nix'], command: 'nix run', note: '用 nix run 运行项目', requires: ['nix'] }
];

/** 解析 Makefile 里的目标名。 */
export function parseMakeTargets(root: string): string[] {
    const targets: string[] = [];
    for (const name of ['Makefile', 'makefile', 'GNUmakefile']) {
        const file = path.join(root, name);
        if (!fs.existsSync(file)) {
            continue;
        }
        let content = '';
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        const re = /^([A-Za-z0-9_.\-/%$(){}]+)\s*:(?!=)/gm;
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
            const target = match[1].trim();
            if (!target || target.startsWith('.') || target.includes('$')) {
                continue;
            }
            if (!targets.includes(target)) {
                targets.push(target);
            }
        }
        break;
    }
    return targets;
}

/** 从 Cargo.toml 里取二进制名。 */
export function parseCargoBinName(root: string): string | undefined {
    try {
        const content = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf8');
        const binMatch = /\[\[bin\]\][\s\S]*?name\s*=\s*"([^"]+)"/.exec(content);
        if (binMatch) {
            return binMatch[1];
        }
        const pkgMatch = /^\s*name\s*=\s*"([^"]+)"/m.exec(content);
        return pkgMatch?.[1];
    } catch {
        return undefined;
    }
}

/** 猜测 CMake 产物位置（多配置生成器会多一层目录）。 */
export function predictCMakeArtifact(root: string, buildDir: string, target: string, buildType: string): string {
    const buildPath = path.join(root, buildDir);
    const multiConfig = ['Visual Studio', 'Xcode', 'Ninja Multi-Config'].some((g) =>
        readCMakeCache(buildPath).includes(g)
    );
    const dir = multiConfig ? path.join(buildPath, buildType) : buildPath;
    const name = process.platform === 'win32' ? `${target}.exe` : target;
    return path.join(dir, name);
}

/** 读 CMakeCache.txt 里的生成器信息。 */
function readCMakeCache(buildPath: string): string {
    try {
        return fs.readFileSync(path.join(buildPath, 'CMakeCache.txt'), 'utf8');
    } catch {
        return '';
    }
}

/** 在目录里查找 *.csproj / *.sln（.NET）。 */
function detectDotNet(root: string): ProjectKind | undefined {
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(root);
    } catch {
        return undefined;
    }
    const sln = entries.find((f) => f.toLowerCase().endsWith('.sln'));
    const csproj = entries.find((f) => f.toLowerCase().endsWith('.csproj'));
    const marker = sln ?? csproj;
    if (!marker) {
        return undefined;
    }
    return {
        id: 'dotnet',
        label: '.NET',
        root,
        marker,
        note: '用 dotnet run 运行项目',
        requires: ['dotnet']
    };
}

function hasProjectMarker(dir: string): boolean {
    for (const rule of SCRIPT_RULES) {
        if (rule.markers.some((m) => fs.existsSync(path.join(dir, m)))) {
            return true;
        }
    }
    for (const rule of FILE_RULES) {
        if (rule.markers.some((m) => fs.existsSync(path.join(dir, m)))) {
            return true;
        }
    }
    if (fs.existsSync(path.join(dir, 'CMakeLists.txt'))) {
        return true;
    }
    return detectDotNet(dir) !== undefined;
}

function findProjectRoot(startDir: string): string | undefined {
    let current = path.resolve(startDir);
    for (let depth = 0; depth < 6; depth++) {
        if (hasProjectMarker(current)) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return undefined;
}

/**
 * 识别一个目录所属的项目。
 *
 * CMake / Cargo / Make 这类「构建 + 产物」项目会带上 build / run 两段命令，
 * 由上层拼成 `build && run` 一条命令敲进终端。
 */
export function detectProject(startDir: string, options?: { cmakeBuildDir?: string; cmakeBuildType?: string }): ProjectKind | undefined {
    const root = findProjectRoot(startDir);
    if (!root) {
        return undefined;
    }
    const buildDir = options?.cmakeBuildDir ?? 'build';
    const buildType = options?.cmakeBuildType ?? 'Debug';

    // CMake 优先（大型 C++ 工程的主力）
    const cmakeList = path.join(root, 'CMakeLists.txt');
    if (fs.existsSync(cmakeList)) {
        const targets = executableTargets(parseCMakeTargets(root)).map((t) => t.name);
        const buildPath = path.join(root, buildDir);
        const configure = `cmake -S ${shellQuote(root)} -B ${shellQuote(buildPath)} -DCMAKE_BUILD_TYPE=${buildType} -DCMAKE_EXPORT_COMPILE_COMMANDS=ON`;
        // 已经配置过且导出了编译数据库时就不再重复 configure
        const cacheCheck = `[ -f ${shellQuote(path.join(buildPath, 'CMakeCache.txt'))} ] && [ -f ${shellQuote(path.join(buildPath, 'compile_commands.json'))} ]`;
        const build = `cmake --build ${shellQuote(buildPath)} --target {target}`;
        return {
            id: 'cmake',
            label: 'CMake',
            root,
            marker: 'CMakeLists.txt',
            note: '配置 → 构建 → 运行 CMake 产物',
            build: `(${cacheCheck} || ${configure}) && ${build}`,
            run: '{artifact}',
            targets,
            requires: ['cmake']
        };
    }

    for (const rule of SCRIPT_RULES) {
        const marker = rule.markers.find((m) => fs.existsSync(path.join(root, m)));
        if (!marker) {
            continue;
        }
        const picked = rule.pick?.(root);
        const all = rule.list?.(root) ?? [];
        return {
            id: rule.id,
            label: rule.label,
            root,
            marker,
            note: picked ? `${rule.note}（${picked}）` : rule.note,
            build: picked ? `${rule.id === 'deno' ? 'deno task' : 'npm run'} {target}` : rule.fallback,
            targets: all,
            requires: [rule.id === 'deno' ? 'deno' : 'npm']
        };
    }

    // Cargo：先构建再跑产物，这样能拿到确定的二进制路径
    const cargoToml = path.join(root, 'Cargo.toml');
    if (fs.existsSync(cargoToml)) {
        const binName = parseCargoBinName(root);
        const artifact = binName
            ? path.join(root, 'target', 'debug', process.platform === 'win32' ? `${binName}.exe` : binName)
            : '';
        return {
            id: 'cargo',
            label: 'Rust',
            root,
            marker: 'Cargo.toml',
            note: 'cargo build 后运行产物',
            build: 'cargo build',
            run: artifact ? `{artifact}` : 'cargo run',
            requires: ['cargo']
        };
    }

    for (const rule of FILE_RULES) {
        const marker = rule.markers.find((m) => fs.existsSync(path.join(root, m)));
        if (!marker) {
            continue;
        }
        // Make：先 make 再跑第一个目标产物
        if (rule.id === 'make') {
            const targets = parseMakeTargets(root);
            const first = targets[0];
            return {
                id: 'make',
                label: 'Make',
                root,
                marker,
                note: 'make 后运行产物',
                build: 'make',
                run: first ? `{artifact}` : undefined,
                targets,
                requires: ['make']
            };
        }
        const command = typeof rule.command === 'function' ? rule.command(root) : rule.command;
        return {
            id: rule.id,
            label: rule.label,
            root,
            marker,
            note: rule.note,
            build: command,
            requires: rule.requires
        };
    }

    return detectDotNet(root);
}

/** 生成 CMake 构建命令（供上层直接使用）。 */
export function cmakeBuildSteps(root: string, buildDir: string, buildType: string, target: string, jobs: number): string[] {
    const buildPath = path.join(root, buildDir);
    const configure = `cmake -S ${shellQuote(root)} -B ${shellQuote(buildPath)} -DCMAKE_BUILD_TYPE=${buildType} -DCMAKE_EXPORT_COMPILE_COMMANDS=ON`;
    const jobPart = jobs > 0 ? ` -j ${jobs}` : '';
    return [configure, `cmake --build ${shellQuote(buildPath)} --target ${shellQuote(target)}${jobPart}`];
}
