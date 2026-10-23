import * as childProcess from 'child_process';
import * as vscode from 'vscode';

export interface ExecResult {
    code: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    durationMs: number;
}

/**
 * 输出面板执行器：把命令交给系统 shell 执行，捕获 stdout/stderr。
 *
 * 与终端模式的区别：终端模式是「敲进去、你自己看」；这里适合需要拿到输出、
 * 需要超时保护或需要在不打扰终端的情况下运行的场景。
 */
export class OutputExecutor {
    private child: childProcess.ChildProcess | undefined;

    constructor(private readonly output: vscode.OutputChannel) {}

    /** 当前是否有正在运行的进程。 */
    public get isRunning(): boolean {
        return this.child !== undefined && this.child.exitCode === null && !this.child.killed;
    }

    /** 执行一条命令。 */
    public run(command: string, cwd: string, timeoutMs: number): Promise<ExecResult> {
        this.stop();

        const started = Date.now();
        const shell = process.platform === 'win32' ? process.env['ComSpec'] || 'cmd.exe' : '/bin/bash';
        const shellArgs = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command];

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let settled = false;

            // POSIX 下用独立进程组，方便整组结束（编译器常常会派生子进程）
            const child = childProcess.spawn(shell, shellArgs, {
                cwd,
                env: process.env,
                detached: process.platform !== 'win32',
                shell: false
            });
            this.child = child;

            const timer =
                timeoutMs > 0
                    ? setTimeout(() => {
                          timedOut = true;
                          this.killTree(child);
                      }, timeoutMs)
                    : undefined;

            child.stdout?.on('data', (d) => (stdout += String(d)));
            child.stderr?.on('data', (d) => (stderr += String(d)));

            child.on('error', (err) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (timer) {
                    clearTimeout(timer);
                }
                this.child = undefined;
                resolve({ code: -1, stdout, stderr: stderr + String(err), timedOut, durationMs: Date.now() - started });
            });

            child.on('close', (code) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (timer) {
                    clearTimeout(timer);
                }
                this.child = undefined;
                resolve({
                    code: code ?? -1,
                    stdout,
                    stderr,
                    timedOut,
                    durationMs: Date.now() - started
                });
            });
        });
    }

    /** 结束正在运行的进程。 */
    public stop(): void {
        const child = this.child;
        if (!child) {
            return;
        }
        this.child = undefined;
        this.killTree(child);
    }

    private killTree(child: childProcess.ChildProcess): void {
        try {
            if (process.platform === 'win32') {
                child.kill('SIGTERM');
            } else if (child.pid) {
                // 结束整个进程组，避免残留的编译/运行子进程
                process.kill(-child.pid, 'SIGTERM');
            } else {
                child.kill('SIGTERM');
            }
        } catch {
            try {
                child.kill('SIGKILL');
            } catch {
                /* 进程可能已经退出 */
            }
        }
    }

    /** 写日志。 */
    public log(message: string): void {
        this.output.appendLine(message);
    }
}
