import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { getConfig, updateGlobalSetting, updateWorkspaceSetting } from './config';
import { detectKind } from './compiler';
import { LANGUAGES } from './languages';
import { RunManager } from './runner';
import { detectLanguage } from './template';

let manager: RunManager | undefined;
let statusBar: vscode.StatusBarItem | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    manager = new RunManager(context);
    context.subscriptions.push(manager);

    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'polyRunner.selectLanguage';
    statusBar.tooltip = '点击为当前文件选择运行方式';
    context.subscriptions.push(statusBar);
    updateStatusBar();

    const register = (id: string, handler: (...args: any[]) => unknown) => {
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    };

    register('polyRunner.runFile', () => runCurrentFile('auto'));
    register('polyRunner.runSelection', () => runSelection());
    register('polyRunner.runInTerminal', () => runCurrentFile('terminal'));
    register('polyRunner.runInOutput', () => runCurrentFile('output'));
    register('polyRunner.stop', () => manager?.stop());
    register('polyRunner.openTerminal', () => openTerminal());
    register('polyRunner.selectLanguage', () => selectLanguage());
    register('polyRunner.editCommand', () => editCommand());
    register('polyRunner.copyCommand', () => copyCommand());
    register('polyRunner.showOutput', () => manager?.outputChannel.show(true));

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar()),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('polyRunner')) {
                updateStatusBar();
            }
        }),
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (!manager || document.uri.scheme !== 'file') {
                return;
            }
            if (!getConfig(document.uri).runOnSave) {
                return;
            }
            await execute(document, 'auto', { silent: true });
        })
    );
}

export function deactivate(): void {
    statusBar?.dispose();
    statusBar = undefined;
    manager?.dispose();
    manager = undefined;
}

// ----------------------------------------------------------------------
// 命令实现
// ----------------------------------------------------------------------

type RunMode = 'auto' | 'terminal' | 'output';

async function runCurrentFile(mode: RunMode): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('Poly Runner: 请先打开要运行的文件。');
        return;
    }
    if (editor.document.isDirty && getConfig(editor.document.uri).saveBeforeRun) {
        const saved = await editor.document.save();
        if (!saved && editor.document.isUntitled) {
            vscode.window.showWarningMessage('Poly Runner: 文件还没有保存到磁盘，先保存再运行。');
            return;
        }
    }
    await execute(editor.document, mode);
}

async function runSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('Poly Runner: 请先打开文件并选中要运行的代码。');
        return;
    }
    if (editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Poly Runner: 请先选中一段代码再运行。');
        return;
    }

    const config = getConfig(editor.document.uri);
    const sourcePath = editor.document.uri.fsPath;
    const code = editor.document.getText(editor.selection);

    let tempPath = sourcePath;
    if (config.useTempFileForSelection) {
        const tempDir = path.join(
            manager!.context.globalStorageUri.fsPath,
            'snippets',
            `${path.basename(sourcePath, path.extname(sourcePath))}-${Date.now()}`
        );
        try {
            fs.mkdirSync(tempDir, { recursive: true });
        } catch {
            vscode.window.showErrorMessage('Poly Runner: 无法创建临时目录。');
            return;
        }
        tempPath = path.join(tempDir, `${path.basename(sourcePath, path.extname(sourcePath))}.snippet${path.extname(sourcePath) || '.txt'}`);
        fs.writeFileSync(tempPath, code, 'utf8');
    }

    await execute(editor.document, 'auto', { tempFilePath: tempPath, originalPath: sourcePath });
}

async function openTerminal(): Promise<void> {
    if (!manager) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    const sourcePath = editor?.document.uri.fsPath;
    const cwd = sourcePath ? path.dirname(sourcePath) : process.cwd();
    manager.openTerminal(cwd);
}

async function selectLanguage(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('Poly Runner: 请先打开文件。');
        return;
    }
    const filePath = editor.document.uri.fsPath;
    const ext = path.extname(filePath).toLowerCase();

    const config = getConfig(editor.document.uri);
    const current = detectLanguage(editor.document.languageId, filePath, config.languageAliases);

    const items: vscode.QuickPickItem[] = LANGUAGES.map((lang) => ({
        label: `${current?.id === lang.id ? '$(check) ' : ''}$(file-code) ${lang.label}`,
        description: lang.id,
        detail: lang.extensions.slice(0, 6).join(' '),
        langId: lang.id
    })) as vscode.QuickPickItem[];

    items.unshift({
        label: '$(gear) 编辑自定义运行命令…',
        detail: '打开设置，修改 polyRunner.customCommands'
    });

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: current ? `当前识别为 ${current.id}，选择新的运行方式` : '选择该文件使用的运行方式',
        matchOnDescription: true,
        matchOnDetail: true
    });
    if (!picked) {
        return;
    }

    if ((picked as any).langId) {
        const langId = (picked as any).langId as string;
        const choice = await vscode.window.showQuickPick(
            [
                { label: '仅当前工作区生效', description: `写入 ${ext || editor.document.languageId}`, target: 'workspace' },
                { label: '全局生效', description: '所有工作区都使用这个绑定', target: 'global' }
            ],
            { placeHolder: '把这个绑定保存到哪里？' }
        );
        if (!choice) {
            return;
        }
        const key = ext || editor.document.languageId || '';
        if (!key) {
            vscode.window.showWarningMessage('Poly Runner: 无法确定绑定键（既没有扩展名也没有语言类型）。');
            return;
        }
        const aliases = { ...config.languageAliases, [key]: langId };
        if (choice.target === 'workspace') {
            await updateWorkspaceSetting('languageAliases', aliases);
        } else {
            await updateGlobalSetting('languageAliases', aliases);
        }
        vscode.window.showInformationMessage(`Poly Runner: ${key} → ${langId}`);
        updateStatusBar();
        return;
    }

    await vscode.commands.executeCommand('workbench.action.openSettings', 'polyRunner.customCommands');
}

async function editCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const config = getConfig(editor?.document.uri);
    const filePath = editor?.document.uri.fsPath;
    const match = filePath ? detectLanguage(editor!.document.languageId, filePath, config.languageAliases) : undefined;
    if (!match) {
        vscode.window.showWarningMessage('Poly Runner: 当前文件没有识别出语言，请先选择运行方式。');
        return;
    }
    await vscode.commands.executeCommand('workbench.action.openSettings', `polyRunner.customCommands.${match.id}`);
}

async function copyCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !manager) {
        vscode.window.showErrorMessage('Poly Runner: 请先打开文件。');
        return;
    }
    const plan = await manager.resolvePlan(editor.document.languageId, {
        originalPath: editor.document.uri.fsPath
    }, editor.document.uri);
    if (!plan) {
        vscode.window.showWarningMessage('Poly Runner: 没有识别出可用的运行命令。');
        return;
    }
    await vscode.env.clipboard.writeText(plan.command);
    vscode.window.showInformationMessage(`Poly Runner: 已复制命令 → ${plan.command}`);
}

// ----------------------------------------------------------------------
// 内部流程
// ----------------------------------------------------------------------

interface ExecuteOptions {
    /** 静默模式（不弹通知）。 */
    silent?: boolean;
    /** 选区运行时的临时文件。 */
    tempFilePath?: string;
    /** 原始文件路径。 */
    originalPath?: string;
}

async function execute(
    document: vscode.TextDocument,
    mode: RunMode,
    options: ExecuteOptions = {}
): Promise<void> {
    if (!manager) {
        return;
    }
    const uri = document.uri;
    const originalPath = options.originalPath ?? uri.fsPath;
    const config = getConfig(uri);

    // 文件必须真的在磁盘上（未命名文件 / 保存被取消）
    if (!fs.existsSync(originalPath)) {
        vscode.window.showErrorMessage(`Poly Runner: 文件不存在于磁盘（${originalPath}），先保存再运行。`);
        return;
    }

    let plan = await manager.resolvePlan(
        document.languageId,
        { originalPath, tempFilePath: options.tempFilePath },
        uri
    );

    // 识别不到语言：让用户现场选一个
    if (!plan) {
        const chosen = await pickLanguageManually(originalPath, document.languageId, uri);
        if (!chosen) {
            return;
        }
        plan = await manager.resolvePlan(
            document.languageId,
            { originalPath, tempFilePath: options.tempFilePath, forceLanguageId: chosen },
            uri
        );
        if (!plan) {
            return;
        }
    }

    const useTerminal = mode === 'terminal' || (mode === 'auto' && config.executeInTerminal);

    // 运行前依赖检查：编译器 / 解释器没装就提前说清楚，而不是让终端里飘一句 command not found
    if (plan.missing.length > 0) {
        const choice = await vscode.window.showWarningMessage(
            `Poly Runner: 缺少 ${plan.missing.join('、')}，这条命令可能会失败。`,
            '仍然运行',
            '选择编译器',
            '取消'
        );
        if (choice === '选择编译器') {
            await vscode.commands.executeCommand('polyRunner.selectCompiler');
            return;
        }
        if (choice !== '仍然运行') {
            return;
        }
    }

    if (useTerminal) {
        await manager.runInTerminal(plan, uri);
    } else {
        await manager.runInOutput(plan, uri);
    }
}

/** 语言识别失败时的兜底选择。 */
async function pickLanguageManually(
    filePath: string,
    languageId: string | undefined,
    uri: vscode.Uri
): Promise<string | undefined> {
    const config = getConfig(uri);
    const ext = path.extname(filePath).toLowerCase();

    const items = LANGUAGES.map((lang) => ({
        label: `$(file-code) ${lang.label}`,
        description: lang.id,
        detail: lang.extensions.slice(0, 6).join(' '),
        langId: lang.id
    })) as vscode.QuickPickItem[];

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: `没能识别 ${ext || languageId || '这个文件'} 的运行方式，请选择一种`,
        matchOnDescription: true,
        matchOnDetail: true
    });
    if (!picked) {
        return undefined;
    }
    const langId = (picked as any).langId as string;

    const choice = await vscode.window.showQuickPick(
        [
            { label: '记住这个选择（当前工作区）', target: 'workspace' },
            { label: '仅本次使用', target: 'once' }
        ],
        { placeHolder: '是否记住这个绑定？' }
    );
    if (choice?.target === 'workspace' && (ext || languageId)) {
        const key = ext || languageId!;
        await updateWorkspaceSetting('languageAliases', { ...config.languageAliases, [key]: langId });
    }
    return langId;
}

// ----------------------------------------------------------------------
// 状态栏
// ----------------------------------------------------------------------

async function updateStatusBar(): Promise<void> {
    const bar = statusBar;
    if (!bar || !manager) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    const label = await manager.describe(editor?.document.uri);
    bar.text = `$(run) ${label}`;
    bar.tooltip = `Poly Runner: 当前文件将按 ${label} 运行（点击可选择运行方式）`;
    bar.show();
}

export { detectKind };
