import * as vscode from 'vscode';

import { shellQuote } from './template';

export { shellQuote };

/**
 * 集成终端管理器。
 *
 * 设计要点：不做伪终端、不自己 spawn 进程，而是把**真实的 shell 命令**
 * 敲进 VS Code 的集成终端里，让系统 shell 自己编译、自己运行。
 * 这样用户能在同一个终端里继续敲命令、给程序喂输入，和手动操作完全一致。
 */
export class ShellTerminalManager {
    private terminal: vscode.Terminal | undefined;
    private currentCwd: string | undefined;
    private disposed = false;

    constructor(private readonly name: string = 'Poly Runner') {}

    /**
     * 取得（必要时创建）终端，并把工作目录切到目标目录。
     * 返回实际发送到终端的命令行（可能是 cd 命令）。
     */
    public prepare(cwd: string): { terminal: vscode.Terminal; preamble: string } {
        if (this.disposed) {
            this.disposed = false;
        }

        if (!this.terminal) {
            this.terminal = vscode.window.createTerminal({ name: this.name, cwd });
            this.currentCwd = cwd;
            vscode.window.onDidCloseTerminal((closed) => {
                if (closed === this.terminal) {
                    this.terminal = undefined;
                    this.currentCwd = undefined;
                }
            });
            return { terminal: this.terminal, preamble: '' };
        }

        if (this.currentCwd === cwd) {
            return { terminal: this.terminal, preamble: '' };
        }

        // 复用同一个终端，先把目录切过去
        const preamble = `cd ${shellQuote(cwd)}`;
        this.currentCwd = cwd;
        return { terminal: this.terminal, preamble };
    }

    /** 把一条命令发送到终端并回车执行。 */
    public send(terminal: vscode.Terminal, command: string): void {
        terminal.sendText(command, true);
    }

    /** 清空终端。 */
    public clear(terminal: vscode.Terminal): void {
        // Windows 的 cmd 没有 clear，用 cls
        terminal.sendText(process.platform === 'win32' ? 'cls' : 'clear', true);
    }

    /** 显示终端并把焦点放进去。 */
    public reveal(terminal: vscode.Terminal, preserveFocus = false): void {
        terminal.show(preserveFocus);
    }

    /** 发送 Ctrl+C 中断当前运行的程序。 */
    public interrupt(terminal?: vscode.Terminal): void {
        const target = terminal ?? this.terminal;
        if (!target) {
            return;
        }
        // ETX 会被集成终端解释成 Ctrl+C
        target.sendText('\u0003');
    }

    public get activeTerminal(): vscode.Terminal | undefined {
        return this.terminal;
    }

    /** 关闭终端。 */
    public dispose(): void {
        this.disposed = true;
        this.terminal?.dispose();
        this.terminal = undefined;
        this.currentCwd = undefined;
    }
}
