import * as fs from 'fs';
import * as path from 'path';

export interface ProjectKind {
    /** 项目类型 id，例如 npm / cargo / gomod。 */
    id: string;
    /** 展示名，例如 Node.js。 */
    label: string;
    /** 在项目根目录执行的命令。 */
    command: string;
    /** 项目根目录。 */
    root: string;
    /** 触发识别的标志文件。 */
    marker: string;
    /** 一句话说明。 */
    note: string;
}

/** npm / deno 这类需要从配置文件里挑一个脚本的项目。 */
interface ScriptProjectRule {
    id: string;
    label: string;
    markers: string[];
    /** 从配置文件里挑脚本的逻辑。 */
    pick?: (root: string) => string | undefined;
    /** 找不到脚本时的兜底命令。 */
    fallback: string;
    note: string;
}

/** npm 脚本的优先顺序。 */
const NPM_SCRIPT_PRIORITY = ['start', 'dev', 'serve', 'build', 'test'];

function readJson(file: string): any {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return undefined;
    }
}

/** 从 package.json 里挑一个最合适的脚本。 */
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

/** 从 deno.json 里挑一个 task。 */
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

/** 需要读取配置文件挑脚本的项目规则。 */
const SCRIPT_RULES: ScriptProjectRule[] = [
    {
        id: 'npm',
        label: 'Node.js',
        markers: ['package.json'],
        pick: pickNpmScript,
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

/** 按标志文件识别的项目规则。 */
interface FileRule {
    id: string;
    label: string;
    /** 可能的标志文件名，任一存在即命中。 */
    markers: string[];
    command: string | ((root: string) => string);
    note: string;
}

/** 顺序即优先级。 */
const FILE_RULES: FileRule[] = [
    { id: 'cargo', label: 'Rust', markers: ['Cargo.toml'], command: 'cargo run', note: '用 cargo run 运行项目' },
    { id: 'gomod', label: 'Go', markers: ['go.mod'], command: 'go run .', note: '用 go run . 运行项目' },
    {
        id: 'gradle',
        label: 'Gradle',
        markers: ['build.gradle', 'build.gradle.kts'],
        command: (root) => (fs.existsSync(path.join(root, 'gradlew')) ? './gradlew run' : 'gradle run'),
        note: '用 Gradle 运行项目'
    },
    { id: 'maven', label: 'Maven', markers: ['pom.xml'], command: 'mvn -q package', note: '用 Maven 构建项目' },
    { id: 'mix', label: 'Elixir Mix', markers: ['mix.exs'], command: 'mix run', note: '用 mix run 运行项目' },
    { id: 'sbt', label: 'Scala SBT', markers: ['build.sbt'], command: 'sbt run', note: '用 sbt 运行项目' },
    { id: 'make', label: 'Make', markers: ['Makefile', 'makefile', 'GNUmakefile'], command: 'make', note: '用 make 运行项目' },
    {
        id: 'cmake-project',
        label: 'CMake',
        markers: ['CMakeLists.txt'],
        command: 'cmake -S . -B build && cmake --build build',
        note: '用 CMake 配置并构建项目'
    },
    { id: 'just', label: 'just', markers: ['justfile', 'Justfile'], command: 'just', note: '用 just 运行项目' },
    { id: 'task', label: 'Task', markers: ['Taskfile.yml', 'Taskfile.yaml'], command: 'task', note: '用 task 运行项目' },
    { id: 'rake', label: 'Rake', markers: ['Rakefile'], command: 'rake', note: '用 rake 运行项目' },
    { id: 'bundle', label: 'Ruby Bundler', markers: ['Gemfile'], command: 'bundle exec rake', note: '用 bundler 运行项目' }
];

/** 在目录里查找 *.csproj / *.sln（.NET）。 */
function detectDotNet(root: string): ProjectKind | undefined {
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(root);
    } catch {
        return undefined;
    }
    const sln = entries.find((f) => f.toLowerCase().endsWith('.sln'));
    if (sln) {
        return {
            id: 'dotnet',
            label: '.NET',
            command: 'dotnet run',
            root,
            marker: sln,
            note: '用 dotnet run 运行项目'
        };
    }
    const csproj = entries.find((f) => f.toLowerCase().endsWith('.csproj'));
    if (csproj) {
        return {
            id: 'dotnet',
            label: '.NET',
            command: 'dotnet run',
            root,
            marker: csproj,
            note: '用 dotnet run 运行项目'
        };
    }
    return undefined;
}

/**
 * 从 startDir 向上查找项目根目录。
 * 优先向上找（子目录里的文件应归属最近的项目），最多向上 6 层。
 */
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

/** 目录里是否有任何项目标志文件。 */
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
    return detectDotNet(dir) !== undefined;
}

/**
 * 识别一个目录所属的项目。
 * 识别不到返回 undefined。
 */
export function detectProject(startDir: string): ProjectKind | undefined {
    const root = findProjectRoot(startDir);
    if (!root) {
        return undefined;
    }

    for (const rule of SCRIPT_RULES) {
        const marker = rule.markers.find((m) => fs.existsSync(path.join(root, m)));
        if (!marker) {
            continue;
        }
        const picked = rule.pick?.(root);
        return {
            id: rule.id,
            label: rule.label,
            command: picked ? `${rule.id === 'deno' ? 'deno task' : 'npm run'} ${picked}` : rule.fallback,
            root,
            marker,
            note: picked ? `${rule.note}（${picked}）` : rule.note
        };
    }

    for (const rule of FILE_RULES) {
        const marker = rule.markers.find((m) => fs.existsSync(path.join(root, m)));
        if (!marker) {
            continue;
        }
        const command = typeof rule.command === 'function' ? rule.command(root) : rule.command;
        return {
            id: rule.id,
            label: rule.label,
            command,
            root,
            marker,
            note: rule.note
        };
    }

    return detectDotNet(root);
}

/** 项目类型对应的可执行文件，用于运行前缺失检测。 */
export function projectRequires(project: ProjectKind): string[] {
    const map: Record<string, string> = {
        npm: 'npm',
        deno: 'deno',
        cargo: 'cargo',
        gomod: 'go',
        gradle: 'gradle',
        maven: 'mvn',
        mix: 'mix',
        sbt: 'sbt',
        make: 'make',
        'cmake-project': 'cmake',
        just: 'just',
        task: 'task',
        rake: 'rake',
        bundle: 'bundle',
        dotnet: 'dotnet'
    };
    const bin = map[project.id];
    return bin ? [bin] : [];
}
