import * as vscode from 'vscode';

export interface RunnerConfig {
    /** 用户显式配置的编译器路径，空字符串表示自动探测。 */
    compilerSetting: string;
    /** C++ 标准版本，例如 c++17。 */
    cppStandard: string;
    /** 追加给编译器的原始参数。 */
    additionalCompilerArgs: string[];
    /** 全局附加运行参数。 */
    runArguments: string[];
    /** 编译产物输出目录，空字符串表示使用扩展全局存储目录。 */
    outputDirectory: string;
    /** 按 languageId 覆盖运行命令。 */
    customCommands: Record<string, string>;
    /** 按扩展名覆盖运行命令。 */
    customCommandsByExtension: Record<string, string>;
    /** 扩展名 / languageId → languageId 的用户绑定。 */
    languageAliases: Record<string, string>;
    /** true=在集成终端执行；false=在输出面板执行。 */
    executeInTerminal: boolean;
    /** 运行前保存未保存的修改。 */
    saveBeforeRun: boolean;
    /** 运行前清空终端。 */
    clearOutputBeforeRun: boolean;
    /** 在输出面板记录实际执行的命令。 */
    showCommandInOutput: boolean;
    /** 输出面板模式下的超时（毫秒）。 */
    timeoutMs: number;
    /** 无法识别语言时的兜底 languageId。 */
    defaultLanguage: string;
    /** 终端工作目录覆盖，空字符串表示用源文件所在目录。 */
    terminalCwd: string;
    /** 运行选中代码时是否写入临时文件。 */
    useTempFileForSelection: boolean;
    /** 保存时自动运行。 */
    runOnSave: boolean;
    /** 是否开启警告。 */
    showWarnings: boolean;
    /** 运行后是否聚焦终端。 */
    focusTerminalAfterRun: boolean;
    /** 是否把源文件内容通过 stdin 喂给程序（命令前置 cat <file> |）。 */
    pipeFileToStdin: boolean;
}

const SECTION = 'polyRunner';

/** 读取配置。scope 用于按文件/工作区解析，缺失项一律回落到默认值。 */
export function getConfig(scope?: vscode.Uri): RunnerConfig {
    const cfg = vscode.workspace.getConfiguration(SECTION, scope ?? null);
    return {
        compilerSetting: cfg.get<string>('compiler', '') ?? '',
        cppStandard: cfg.get<string>('cppStandard', 'c++17') ?? 'c++17',
        additionalCompilerArgs: cfg.get<string[]>('additionalCompilerArgs', []) ?? [],
        runArguments: cfg.get<string[]>('runArguments', []) ?? [],
        outputDirectory: cfg.get<string>('outputDirectory', '') ?? '',
        customCommands: cfg.get<Record<string, string>>('customCommands', {}) ?? {},
        customCommandsByExtension: cfg.get<Record<string, string>>('customCommandsByExtension', {}) ?? {},
        languageAliases: cfg.get<Record<string, string>>('languageAliases', {}) ?? {},
        executeInTerminal: cfg.get<boolean>('executeInTerminal', true) ?? true,
        saveBeforeRun: cfg.get<boolean>('saveBeforeRun', true) ?? true,
        clearOutputBeforeRun: cfg.get<boolean>('clearOutputBeforeRun', true) ?? true,
        showCommandInOutput: cfg.get<boolean>('showCommandInOutput', true) ?? true,
        timeoutMs: cfg.get<number>('timeoutMs', 30000) ?? 30000,
        defaultLanguage: cfg.get<string>('defaultLanguage', '') ?? '',
        terminalCwd: cfg.get<string>('terminalCwd', '') ?? '',
        useTempFileForSelection: cfg.get<boolean>('useTempFileForSelection', true) ?? true,
        runOnSave: cfg.get<boolean>('runOnSave', false) ?? false,
        showWarnings: cfg.get<boolean>('showWarnings', true) ?? true,
        focusTerminalAfterRun: cfg.get<boolean>('focusTerminalAfterRun', true) ?? true,
        pipeFileToStdin: cfg.get<boolean>('pipeFileToStdin', false) ?? false
    };
}

/** 写入用户级配置（Global）。 */
export async function updateGlobalSetting(key: string, value: unknown): Promise<void> {
    await vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);
}

/** 写入工作区级配置。 */
export async function updateWorkspaceSetting(key: string, value: unknown): Promise<void> {
    await vscode.workspace
        .getConfiguration(SECTION)
        .update(key, value, vscode.ConfigurationTarget.Workspace);
}

/** 把形如 ["a b", "c"] 的字符串数组安全地展开成参数数组。 */
export function splitArgs(raw: string[]): string[] {
    const out: string[] = [];
    for (const item of raw) {
        if (typeof item !== 'string') {
            continue;
        }
        const trimmed = item.trim();
        if (trimmed.length === 0) {
            continue;
        }
        out.push(...splitShellLike(trimmed));
    }
    return out;
}

/**
 * 极简的按空格切分：支持双引号包裹的参数，忽略引号内的空格。
 * 不做完整的 shell 解析（不处理管道/重定向），因为这些参数会被直接交给进程。
 */
export function splitShellLike(input: string): string[] {
    const result: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let hasContent = false;

    for (const ch of input) {
        if (quote) {
            if (ch === quote) {
                quote = null;
            } else {
                current += ch;
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            hasContent = true;
            continue;
        }
        if (/\s/.test(ch)) {
            if (current.length > 0 || hasContent) {
                result.push(current);
            }
            current = '';
            hasContent = false;
            continue;
        }
        current += ch;
    }
    if (current.length > 0 || hasContent) {
        result.push(current);
    }
    return result;
}
