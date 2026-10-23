/**
 * 极简 `vscode` 模块桩。
 *
 * 目的：在没有 GUI 会话的环境里，对扩展做端到端验证——
 * 真的调用编译器、真的把可执行文件跑起来、真的把 stdin 转发给子进程。
 * 只需要覆盖扩展用到的 API 表面。
 */

const path = require('path');

class EventEmitter {
    constructor() {
        this._listeners = [];
        this.event = (cb) => {
            this._listeners.push(cb);
            return { dispose: () => {} };
        };
    }
    fire(value) {
        for (const cb of this._listeners.slice()) {
            cb(value);
        }
    }
    dispose() {
        this._listeners = [];
    }
}

class Uri {
    constructor(fsPath) {
        this.fsPath = fsPath;
        this.path = fsPath;
        this.scheme = 'file';
    }
    static file(p) {
        return new Uri(p);
    }
    toString() {
        return `file://${this.fsPath}`;
    }
}

class ThemeColor {
    constructor(id) {
        this.id = id;
    }
}

const DEFAULTS = {
    compiler: '',
    cppStandard: 'c++17',
    additionalCompilerArgs: [],
    runArguments: [],
    outputDirectory: '',
    customCommands: {},
    customCommandsByExtension: {},
    languageAliases: {},
    executeInTerminal: true,
    saveBeforeRun: true,
    clearOutputBeforeRun: true,
    showCommandInOutput: true,
    timeoutMs: 30000,
    defaultLanguage: '',
    terminalCwd: '',
    useTempFileForSelection: true,
    runOnSave: false,
    showWarnings: true,
    focusTerminalAfterRun: true
};

const state = {
    overrides: {},
    workspaceFolder: undefined,
    activeTextEditor: undefined,
    lastTerminal: undefined,
    terminals: [],
    outputChannels: [],
    messages: [],
    commands: new Map(),
    quickPickResult: undefined,
    inputBoxResult: undefined,
    onDidCloseTerminalHandlers: [],
    onDidChangeActiveTextEditorHandlers: [],
    onDidChangeConfigurationHandlers: [],
    onDidSaveTextDocumentHandlers: []
};

function createOutputChannel(name) {
    const channel = {
        name,
        lines: [],
        appendLine(line) {
            this.lines.push(line);
        },
        append(text) {
            this.lines.push(text);
        },
        show() {},
        hide() {},
        clear() {
            this.lines = [];
        },
        dispose() {}
    };
    state.outputChannels.push(channel);
    return channel;
}

function createTerminal(options) {
    const terminal = {
        name: options && options.name,
        cwd: options && options.cwd,
        pty: options && options.pty,
        output: [],
        /** 记录通过 sendText 发送的所有命令。 */
        commands: [],
        shown: false,
        show() {
            this.shown = true;
        },
        hide() {},
        sendText(text, addNewLine) {
            this.commands.push(addNewLine ? `${text}\n` : text);
            this.output.push(text);
        },
        dispose() {
            state.onDidCloseTerminalHandlers.forEach((cb) => cb(terminal));
        }
    };
    if (terminal.pty && typeof terminal.pty.onDidWrite === 'function') {
        terminal.pty.onDidWrite((text) => terminal.output.push(text));
    }
    state.terminals.push(terminal);
    state.lastTerminal = terminal;
    return terminal;
}

const vscode = {
    EventEmitter,
    Uri,
    ThemeColor,
    ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
    ProgressLocation: { Window: 10, Notification: 15, SourceControl: 1 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    commands: {
        registerCommand(id, handler) {
            state.commands.set(id, handler);
            return { dispose: () => state.commands.delete(id) };
        },
        executeCommand(id, ...args) {
            const handler = state.commands.get(id);
            if (!handler) {
                return Promise.reject(new Error(`command not found: ${id}`));
            }
            return Promise.resolve(handler(...args));
        }
    },
    window: {
        createOutputChannel,
        createTerminal,
        get activeTextEditor() {
            return state.activeTextEditor;
        },
        createStatusBarItem() {
            return {
                text: '',
                tooltip: '',
                command: undefined,
                backgroundColor: undefined,
                show() {},
                hide() {},
                dispose() {}
            };
        },
        showErrorMessage(message, ...items) {
            state.messages.push({ level: 'error', message, items });
            return Promise.resolve(undefined);
        },
        showWarningMessage(message, ...items) {
            state.messages.push({ level: 'warning', message, items });
            return Promise.resolve(undefined);
        },
        showInformationMessage(message, ...items) {
            state.messages.push({ level: 'info', message, items });
            return Promise.resolve(undefined);
        },
        showQuickPick() {
            return Promise.resolve(state.quickPickResult);
        },
        showInputBox() {
            return Promise.resolve(state.inputBoxResult);
        },
        withProgress(options, task) {
            return Promise.resolve(task({ report() {} }, { isCancellationRequested: false }));
        },
        onDidCloseTerminal(handler) {
            state.onDidCloseTerminalHandlers.push(handler);
            return { dispose: () => {} };
        },
        onDidChangeActiveTextEditor(handler) {
            state.onDidChangeActiveTextEditorHandlers.push(handler);
            return { dispose: () => {} };
        }
    },
    workspace: {
        getWorkspaceFolder(uri) {
            return state.workspaceFolder;
        },
        getConfiguration(section) {
            return {
                get(key, fallback) {
                    const full = section ? `${section}.${key}` : key;
                    if (Object.prototype.hasOwnProperty.call(state.overrides, full)) {
                        return state.overrides[full];
                    }
                    // 支持 polyRunner.customCommands.python 这种嵌套覆盖
                    const prefix = `${full}.`;
                    const nested = Object.keys(state.overrides).filter((k) => k.startsWith(prefix));
                    if (nested.length > 0) {
                        const base =
                            section === 'polyRunner' && Object.prototype.hasOwnProperty.call(DEFAULTS, key)
                                ? DEFAULTS[key]
                                : fallback;
                        const merged = typeof base === 'object' && base !== null ? { ...base } : {};
                        for (const k of nested) {
                            merged[k.slice(prefix.length)] = state.overrides[k];
                        }
                        return merged;
                    }
                    if (section === 'polyRunner' && Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
                        return DEFAULTS[key];
                    }
                    return fallback;
                },
                update(key, value, target) {
                    const full = section ? `${section}.${key}` : key;
                    state.overrides[full] = value;
                    return Promise.resolve();
                }
            };
        },
        onDidChangeConfiguration(handler) {
            state.onDidChangeConfigurationHandlers.push(handler);
            return { dispose: () => {} };
        },
        onDidSaveTextDocument(handler) {
            state.onDidSaveTextDocumentHandlers.push(handler);
            return { dispose: () => {} };
        },
        fs: {
            readFile: () => Promise.resolve(Buffer.from(''))
        }
    }
};

/** 让 require('vscode') 命中这个桩。 */
function install() {
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        if (request === 'vscode') {
            return vscode;
        }
        return originalLoad.apply(this, arguments);
    };
    return vscode;
}

module.exports = { install, state, vscode, Uri, EventEmitter, path };
