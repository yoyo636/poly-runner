import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { RunnerConfig, getConfig, splitArgs } from './config';
import { CompilerInfo, binaryName, defaultOutputDir, findExecutable, formatCommand, resolveCompiler } from './compiler';
import { OutputExecutor } from './executor';
import { ProjectKind, detectProject, predictCMakeArtifact } from './projects';
import {
    extractCompiler,
    extractFlags,
    findCompileDatabase,
    findEntryForFile,
    loadCompileDatabase,
    planTargetCompilation,
    targetKey
} from './compileDb';
import { LanguageDef } from './languages';
import { ShellTerminalManager } from './terminal';
import {
    TemplateContext,
    detectClassName,
    detectLanguage,
    joinArgs,
    renderTemplate,
    shellQuote
} from './template';

const OUTPUT_CHANNEL_NAME = 'Poly Runner';

export interface RunPlan {
    /** 运行类型：单文件 / 项目。 */
    kind: 'file' | 'project';
    /** 语言 id。 */
    languageId: string;
    /** 语言展示名。 */
    languageLabel: string;
    /** 渲染后的完整命令。 */
    command: string;
    /** 命令模板（未渲染）。 */
    template: string;
    /** 执行工作目录。 */
    cwd: string;
    /** 实际参与编译/运行的源文件。 */
    sourcePath: string;
    /** 编译产物路径。 */
    binaryPath: string;
    /** 语言识别依据。 */
    reason: string;
    /** 内置语言定义（自定义命令时可能为空）。 */
    def?: LanguageDef;
    /** 运行前检测到的缺失依赖（编译器 / 解释器）。 */
    missing: string[];
}

export interface PlanOptions {
    /** 运行选中的代码时使用临时文件路径。 */
    tempFilePath?: string;
    /** 原始源文件路径（选区模式下是用户编辑的文件）。 */
    originalPath: string;
    /** 强制使用某个语言 id。 */
    forceLanguageId?: string;
}

export class RunManager {
    private readonly output: vscode.OutputChannel;
    private readonly terminals: ShellTerminalManager;
    private readonly executor: OutputExecutor;
    private disposed = false;

    constructor(readonly context: vscode.ExtensionContext) {
        this.output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
        this.terminals = new ShellTerminalManager('Poly Runner');
        this.executor = new OutputExecutor(this.output);
    }

    public get outputChannel(): vscode.OutputChannel {
        return this.output;
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.executor.stop();
        this.terminals.dispose();
        this.output.dispose();
    }

    // ------------------------------------------------------------------
    // 命令解析
    // ------------------------------------------------------------------

    /** 解析出本次运行要执行的命令。识别不到语言时返回 undefined。 */
    public async resolvePlan(
        languageId: string | undefined,
        options: PlanOptions,
        scope?: vscode.Uri
    ): Promise<RunPlan | undefined> {
        const config = getConfig(scope);
        const originalPath = options.originalPath;
        const compilePath = options.tempFilePath ?? originalPath;

        // 1) 识别语言
        let match = options.forceLanguageId
            ? { id: options.forceLanguageId, def: undefined, reason: '手动指定' }
            : detectLanguage(languageId, originalPath, config.languageAliases);

        if (!match && config.defaultLanguage) {
            match = { id: config.defaultLanguage, def: undefined, reason: '默认语言' };
        }
        if (!match) {
            return undefined;
        }

        // 2) 取命令模板：用户自定义 > 内置
        const ext = path.extname(originalPath).toLowerCase();
        const template =
            config.customCommands[match.id] ??
            config.customCommandsByExtension[ext] ??
            match.def?.command ??
            '';

        if (!template.trim()) {
            this.output.appendLine(`[Poly Runner] 语言 ${match.id} 没有可用的运行命令。`);
            return undefined;
        }

        // 2.5) C/C++ 且用户没自定义命令时，优先用项目的编译数据库
        const isBuiltinTemplate =
            !config.customCommands[match.id] && !config.customCommandsByExtension[ext];
        if (isBuiltinTemplate && template.includes('{{compiler}}')) {
            const dbPlan = await this.tryCompileDatabasePlan(originalPath, scope);
            if (dbPlan) {
                return dbPlan;
            }
        }

        // 3) 准备模板变量
        const compiler = template.includes('{{compiler}}') ? await this.pickCompiler(config) : undefined;
        const outDir = this.resolveOutputDir(config, compilePath);
        const base = path.basename(originalPath, path.extname(originalPath)).replace(/[^A-Za-z0-9_\-]/g, '_');
        const binary = path.join(outDir, binaryName(base || 'main'));

        const compileDir = path.dirname(compilePath);
        const ctx: TemplateContext = {
            file: compilePath,
            fileNoExt: compilePath.slice(0, compilePath.length - path.extname(compilePath).length),
            fileName: path.basename(compilePath),
            basename: base,
            dir: compileDir,
            workspaceFolder: this.resolveWorkspaceFolder(originalPath),
            relativeFile: this.makeRelative(originalPath),
            tmpFile: options.tempFilePath ?? compilePath,
            out: binary,
            compiler: compiler?.path ?? '',
            std: config.cppStandard,
            warnings: config.showWarnings ? '-Wall' : '',
            args: joinArgs(splitArgs(config.runArguments)),
            className: detectClassName(compilePath, base),
            pipeFile: config.pipeFileToStdin ? `cat ${shellQuote(compilePath)} | ` : ''
        };

        let command = renderTemplate(template, ctx);

        // 选区运行且是 C/C++ 时，自动带上原目录的头文件搜索路径
        if (options.tempFilePath && template.includes('{{compiler}}')) {
            const includeDir = path.dirname(originalPath);
            const quotedSource = shellQuote(compilePath);
            if (!command.includes(`-I${includeDir}`)) {
                command = command.replace(
                    quotedSource,
                    `${quotedSource} -I${shellQuote(includeDir)}`
                );
            }
        }

        const cwd = this.resolveCwd(config, originalPath);

        // 运行前的依赖检测：编译器 / 解释器是否真的装了
        const missing: string[] = [];
        if (compiler) {
            if (!this.binaryExists(compiler.path)) {
                missing.push(compiler.path);
            }
        }
        for (const bin of match.def?.requires ?? []) {
            if (!this.binaryExists(bin)) {
                missing.push(bin);
            }
        }

        this.output.appendLine('');
        this.output.appendLine(`[Poly Runner] 语言: ${match.id}（${match.reason}）`);
        if (compiler) {
            this.output.appendLine(`[Poly Runner] 编译器: ${compiler.label} (${compiler.path})`);
            if (compiler.version) {
                this.output.appendLine(`[Poly Runner] 版本: ${compiler.version}`);
            }
        }
        this.output.appendLine(`[Poly Runner] 模板: ${template}`);
        this.output.appendLine(`[Poly Runner] 命令: ${command}`);
        this.output.appendLine(`[Poly Runner] 工作目录: ${cwd}`);
        if (missing.length > 0) {
            this.output.appendLine(`[Poly Runner] ⚠ 缺少依赖: ${missing.join(', ')}`);
        }

        return {
            kind: 'file',
            languageId: match.id,
            languageLabel: match.def?.label ?? match.id,
            command,
            template,
            cwd,
            sourcePath: compilePath,
            binaryPath: binary,
            reason: match.reason,
            def: match.def,
            missing
        };
    }

    /** 判断某个可执行文件是否存在（绝对路径直接查文件，命令名走 PATH）。 */
    private binaryExists(name: string): boolean {
        if (name.includes('/') || name.includes('\\')) {
            return fs.existsSync(name);
        }
        return findExecutable(name) !== undefined;
    }

    // ------------------------------------------------------------------
    // 执行
    // ------------------------------------------------------------------

    /**
     * 识别当前文件所属的项目（package.json / Cargo.toml / go.mod …），
     * 生成项目级运行命令。
     */
    public async prepareProject(startDir: string, target?: string, scope?: vscode.Uri): Promise<RunPlan | undefined> {
        const config = getConfig(scope);
        const project = detectProject(startDir, {
            cmakeBuildDir: config.cmakeBuildDir,
            cmakeBuildType: config.cmakeBuildType
        });
        if (!project) {
            this.output.appendLine('[Poly Runner] 没找到可识别的项目标志文件（package.json / Cargo.toml / go.mod / CMakeLists.txt …）。');
            return undefined;
        }

        const chosen = target ?? project.targets?.[0];
        let command = '';

        if (project.build && project.run) {
            const build = this.fillTemplate(project.build, project.root, chosen);
            const artifact = this.resolveArtifact(project, chosen);
            const run = this.fillTemplate(project.run, project.root, chosen, artifact);
            command = artifact ? `${build} && ${run}` : build;
        } else if (project.build) {
            command = this.fillTemplate(project.build, project.root, chosen);
        }

        if (!command.trim()) {
            this.output.appendLine(`[Poly Runner] 项目 ${project.label} 没有可用的运行命令。`);
            return undefined;
        }

        const missing = (project.requires ?? []).filter((bin) => !this.binaryExists(bin));

        this.output.appendLine('');
        this.output.appendLine(`[Poly Runner] 项目: ${project.label}（标志文件 ${project.marker}）`);
        this.output.appendLine(`[Poly Runner] 项目根目录: ${project.root}`);
        if (project.targets && project.targets.length > 0) {
            this.output.appendLine(`[Poly Runner] 可选目标: ${project.targets.join(', ')}（当前：${chosen ?? '无'}）`);
        }
        this.output.appendLine(`[Poly Runner] 命令: ${command}`);
        if (missing.length > 0) {
            this.output.appendLine(`[Poly Runner] ⚠ 缺少依赖: ${missing.join(', ')}`);
        }

        return {
            kind: 'project',
            languageId: project.id,
            languageLabel: project.label,
            command,
            template: command,
            cwd: project.root,
            sourcePath: path.join(project.root, project.marker),
            binaryPath: '',
            reason: project.note,
            def: undefined,
            missing
        };
    }

    /** 填充命令模板里的 {target} / {root} / {artifact}。 */
    private fillTemplate(template: string, root: string, target?: string, artifact?: string): string {
        return template
            .replace(/\{target\}/g, target ?? '')
            .replace(/\{root\}/g, root)
            .replace(/\{artifact\}/g, artifact ?? '');
    }

    /** 推测构建产物路径。 */
    private resolveArtifact(project: ProjectKind, target?: string): string | undefined {
        if (!target) {
            return undefined;
        }
        const config = getConfig();
        if (project.id === 'cmake') {
            return predictCMakeArtifact(project.root, config.cmakeBuildDir, target, config.cmakeBuildType);
        }
        if (project.id === 'cargo') {
            const name = process.platform === 'win32' ? `${target}.exe` : target;
            return path.join(project.root, 'target', 'debug', name);
        }
        if (project.id === 'make') {
            const name = process.platform === 'win32' ? `${target}.exe` : target;
            return path.join(project.root, name);
        }
        return undefined;
    }

    /** 有 compile_commands.json 时，用它编译单个文件（带齐项目真实的 include/宏定义）。 */
    private tryCompileDatabasePlan(sourcePath: string, scope?: vscode.Uri): RunPlan | undefined {
        const config = getConfig(scope);
        if (!config.useCompileDatabase) {
            return undefined;
        }
        const dbPath = findCompileDatabase(path.dirname(sourcePath));
        if (!dbPath) {
            return undefined;
        }
        const entries = loadCompileDatabase(dbPath);
        if (entries.length === 0) {
            return undefined;
        }
        const entry = findEntryForFile(entries, sourcePath);
        if (!entry) {
            return undefined;
        }

        const root = projectRootFromDb(dbPath);
        const target = targetKey(entry);
        const outDir = path.join(root, config.projectOutputDir, 'bin');
        try {
            fs.mkdirSync(outDir, { recursive: true });
        } catch {
            /* 忽略 */
        }

        const compilerOverride = config.compilerSetting.trim() ? config.compilerSetting.trim() : undefined;
        let command: string;
        let used: string;

        if (config.compileDatabaseMode === 'object') {
            const compiler = compilerOverride ?? extractCompiler(entry) ?? '';
            const flags = extractFlags(entry);
            const objPath = path.join(outDir, `${target}.o`);
            command = `${compiler} ${flags.join(' ')} -c ${shellQuote(sourcePath)} -o ${shellQuote(objPath)}`;
            used = 'object';
        } else {
            const plan = planTargetCompilation(entries, entry, path.join(outDir, target), compilerOverride);
            if (!plan) {
                return undefined;
            }
            // 链接出可执行文件后直接运行它
            command = `${plan.command} && ${shellQuote(path.join(outDir, target))}`;
            used = `${plan.sources.length} 个源文件`;
        }

        this.output.appendLine('');
        this.output.appendLine(`[Poly Runner] 使用编译数据库: ${dbPath}`);
        this.output.appendLine(`[Poly Runner] target: ${target}（${used}）`);
        this.output.appendLine(`[Poly Runner] 命令: ${command}`);

        return {
            kind: 'file',
            languageId: 'compile-db',
            languageLabel: 'C++（编译数据库）',
            command,
            template: command,
            cwd: root,
            sourcePath,
            binaryPath: path.join(outDir, target),
            reason: `编译数据库 ${path.basename(dbPath)}`,
            def: undefined,
            missing: []
        };
    }

    /** 在集成终端里执行命令。 */
    public async runInTerminal(plan: RunPlan, scope?: vscode.Uri): Promise<void> {
        const config = getConfig(scope);
        const { terminal, preamble } = this.terminals.prepare(plan.cwd);
        if (preamble) {
            this.terminals.send(terminal, preamble);
        }
        if (config.clearOutputBeforeRun) {
            this.terminals.clear(terminal);
        }
        this.terminals.send(terminal, plan.command);
        this.terminals.reveal(terminal, !config.focusTerminalAfterRun);
        if (config.showCommandInOutput) {
            this.output.appendLine(`[Poly Runner] 已在终端执行: ${plan.command}`);
        }
    }

    /** 在输出面板里执行命令并捕获输出。 */
    public async runInOutput(plan: RunPlan, scope?: vscode.Uri): Promise<void> {
        const config = getConfig(scope);
        this.output.appendLine('');
        this.output.appendLine(`[Poly Runner] ── 执行 ──`);
        this.output.appendLine(`$ ${plan.command}`);
        const result = await this.executor.run(plan.command, plan.cwd, config.timeoutMs);
        if (result.stdout) {
            this.output.appendLine(result.stdout.trimEnd());
        }
        if (result.stderr) {
            this.output.appendLine(result.stderr.trimEnd());
        }
        const summary = result.timedOut
            ? `超时（${config.timeoutMs} ms），已终止`
            : `退出码 ${result.code}`;
        this.output.appendLine(`[Poly Runner] ── ${summary}，耗时 ${result.durationMs} ms ──`);
        this.output.show(true);
    }

    /** 只停掉正在运行的程序（watch 重跑前用），不打印日志。 */
    public stopProgram(): void {
        if (this.executor.isRunning) {
            this.executor.stop();
        }
        if (this.terminals.activeTerminal) {
            this.terminals.interrupt();
        }
    }

    /** 停止：终端发 Ctrl+C，输出面板模式则杀进程。 */
    public stop(): void {
        let stopped = false;
        if (this.executor.isRunning) {
            this.executor.stop();
            stopped = true;
        }
        if (this.terminals.activeTerminal) {
            this.terminals.interrupt();
            stopped = true;
        }
        this.output.appendLine(stopped ? '[Poly Runner] 已请求停止。' : '[Poly Runner] 当前没有正在运行的程序。');
    }

    /** 只打开一个运行终端，不执行命令。 */
    public openTerminal(cwd: string): void {
        const { terminal } = this.terminals.prepare(cwd);
        this.terminals.reveal(terminal, false);
    }

    // ------------------------------------------------------------------
    // 辅助
    // ------------------------------------------------------------------

    private async pickCompiler(config: RunnerConfig): Promise<CompilerInfo | undefined> {
        return resolveCompiler(config.compilerSetting);
    }

    private resolveOutputDir(config: RunnerConfig, sourcePath: string): string {
        let dir = config.outputDirectory.trim();
        if (dir.length === 0) {
            dir = defaultOutputDir(this.context.globalStorageUri.fsPath);
        } else {
            dir = path.isAbsolute(dir) ? dir : path.join(path.dirname(sourcePath), dir);
        }
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch {
            /* 目录已存在或无权限 */
        }
        return dir;
    }

    private resolveCwd(config: RunnerConfig, sourcePath: string): string {
        const configured = config.terminalCwd.trim();
        if (configured.length > 0) {
            return path.isAbsolute(configured) ? configured : path.join(path.dirname(sourcePath), configured);
        }
        return path.dirname(sourcePath);
    }

    private resolveWorkspaceFolder(sourcePath: string): string {
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(sourcePath));
        return folder?.uri.fsPath ?? path.dirname(sourcePath);
    }

    private makeRelative(sourcePath: string): string {
        const root = this.resolveWorkspaceFolder(sourcePath);
        const rel = path.relative(root, sourcePath);
        return rel.startsWith('..') ? sourcePath : rel;
    }

    /** 供状态栏使用：获取当前文件的语言与命令预览。 */
    public async describe(scope?: vscode.Uri): Promise<string> {
        if (!scope) {
            return '未打开文件';
        }
        const config = getConfig(scope);
        const match = detectLanguage(undefined, scope.fsPath, config.languageAliases);
        return match ? (match.def?.label ?? match.id) : '未知语言';
    }

    /** 写一条日志到输出面板。 */
    public log(message: string): void {
        this.output.appendLine(message);
    }
}

export { formatCommand };


/** 从 compile_commands.json 的位置反推项目根目录。 */
function projectRootFromDb(dbPath: string): string {
    const dir = path.dirname(dbPath);
    const base = path.basename(dir).toLowerCase();
    const buildDirs = ['build', 'out', 'build-debug', 'cmake-build-debug', 'cmake-build-release'];
    if (buildDirs.includes(base)) {
        return path.dirname(dir);
    }
    return dir;
}
