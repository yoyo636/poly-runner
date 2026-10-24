/**
 * 端到端集成测试（无头）。
 *
 * 插件的核心行为是：把一条真实的 shell 命令敲进集成终端。
 * 所以这里验证两件事：
 *   1. 发出去的命令行长什么样（是不是人手敲得出来的那种）；
 *   2. 这条命令丢给真正的 shell 之后，能不能真的编译并跑起来。
 *
 * 覆盖 C++/Python/Java/Ruby/Bash 等多种语言，验证「全语言」这件事不是口号。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const { install, state, Uri } = require('./vscode-stub');

install();

const extension = require('../out/extension.js');

const SAMPLE = path.resolve(__dirname, '..', 'samples', 'main.cpp');

/** 造一个假的编辑器。 */
function fakeEditor(filePath, { text = '', selection = null, languageId = 'plaintext' } = {}) {
    return {
        document: {
            uri: Uri.file(filePath),
            fileName: filePath,
            languageId,
            isDirty: false,
            isUntitled: false,
            getText(range) {
                return range ? text : fs.readFileSync(filePath, 'utf8');
            },
            save() {
                return Promise.resolve(true);
            }
        },
        selection: {
            isEmpty: !selection,
            start: 0,
            end: text.length
        }
    };
}

/** 造一个假的扩展上下文。 */
function fakeContext() {
    const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-runner-test-'));
    return {
        subscriptions: [],
        globalStorageUri: Uri.file(storage),
        extensionPath: path.resolve(__dirname, '..')
    };
}

/** 取终端收到的最后一条命令。 */
function lastCommand() {
    const terminal = state.lastTerminal;
    assert.ok(terminal, '没有创建集成终端');
    assert.ok(terminal.commands.length > 0, '终端里没有收到任何命令');
    return terminal.commands[terminal.commands.length - 1].trim();
}

/** 轮询等待条件成立，超时返回 false。 */
async function waitFor(predicate, timeoutMs = 30000, intervalMs = 50) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) {
            return true;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
}

/** 把命令丢给真正的 shell 执行，验证它确实能跑起来。 */
function runInShell(command, cwd, input = '') {
    const result = spawnSync('/bin/bash', ['-c', `cd ${JSON.stringify(cwd)} && ${command}`], {
        encoding: 'utf8',
        input,
        timeout: 60000
    });
    return {
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || ''
    };
}

/** 写入临时源文件。 */
function makeTempFile(dir, name, content) {
    const target = path.join(dir, name);
    fs.writeFileSync(target, content, 'utf8');
    return target;
}

// ----------------------------------------------------------------------
// 命令注册
// ----------------------------------------------------------------------

test('激活后注册了全部命令', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const expected = [
        'polyRunner.runFile',
        'polyRunner.runSelection',
        'polyRunner.runInTerminal',
        'polyRunner.runInOutput',
        'polyRunner.stop',
        'polyRunner.openTerminal',
        'polyRunner.selectLanguage',
        'polyRunner.editCommand',
        'polyRunner.copyCommand',
        'polyRunner.showOutput'
    ];
    for (const id of expected) {
        assert.ok(state.commands.has(id), `缺少命令: ${id}`);
    }

    await extension.deactivate();
});

// ----------------------------------------------------------------------
// 各语言：命令生成 + 真 shell 执行
// ----------------------------------------------------------------------

test('C++：敲进终端的是 g++ 编译并运行的命令', async () => {
    const context = fakeContext();
    await extension.activate(context);

    state.activeTextEditor = fakeEditor(SAMPLE, { languageId: 'cpp' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[C++]', command);

    assert.match(command, /g\+\+|clang\+\+/, `命令里没有编译器: ${command}`);
    assert.match(command, /-std=c\+\+17/, `命令里没有指定 C++ 标准: ${command}`);
    assert.match(command, /main\.cpp/, `命令里没有源文件: ${command}`);
    assert.match(command, /-o\s+\S+/, `命令里没有输出文件: ${command}`);
    assert.ok(command.includes('&&'), `命令没有把编译和运行串起来: ${command}`);

    const result = runInShell(command, path.dirname(SAMPLE), '42\n');
    console.error('[C++ 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('成绩排名'), '程序没有正常运行');
    assert.ok(result.stdout.includes('1764'), 'stdin 没有被程序读到');

    await extension.deactivate();
});

test('Python：敲进终端的是 python 命令', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-py-'));
    const file = makeTempFile(dir, 'hello.py', 'import sys\nprint("py ok", sys.argv[1:])\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'python' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[Python]', command);

    assert.match(command, /python3?\s/, `命令不是 python: ${command}`);
    assert.ok(command.includes('hello.py'), `命令里没有源文件: ${command}`);

    const result = runInShell(command, dir);
    console.error('[Python 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('py ok'), '程序没有正常运行');

    await extension.deactivate();
});

test('Java：先 javac 再 java -cp 启动', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-java-'));
    const file = makeTempFile(
        dir,
        'Main.java',
        'public class Main {\n    public static void main(String[] args) {\n        System.out.println("java ok");\n    }\n}\n'
    );

    state.activeTextEditor = fakeEditor(file, { languageId: 'java' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[Java]', command);

    assert.match(command, /javac/, `命令里没有 javac: ${command}`);
    assert.ok(command.includes('Main'), `命令里没有类名: ${command}`);
    assert.ok(command.includes('&&'), `编译与运行没有串起来: ${command}`);

    const result = runInShell(command, dir);
    console.error('[Java 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('java ok'), '程序没有正常运行');

    await extension.deactivate();
});

test('Ruby：敲进终端的是 ruby 命令', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-rb-'));
    const file = makeTempFile(dir, 'hi.rb', 'puts "ruby ok"\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'ruby' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[Ruby]', command);

    const result = runInShell(command, dir);
    console.error('[Ruby 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('ruby ok'), '程序没有正常运行');

    await extension.deactivate();
});

test('Bash 脚本：敲进终端的是 bash 命令', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-sh-'));
    const file = makeTempFile(dir, 'run.sh', '#!/bin/bash\necho "bash ok"\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'shellscript' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[Bash]', command);

    const result = runInShell(command, dir);
    console.error('[Bash 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('bash ok'), '脚本没有正常运行');

    await extension.deactivate();
});

test('Rust：rustc 编译后运行', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-rs-'));
    const file = makeTempFile(dir, 'main.rs', 'fn main() { println!("rust ok"); }\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'rust' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[Rust]', command);

    assert.match(command, /rustc/, `命令里没有 rustc: ${command}`);
    assert.ok(command.includes('&&'), `编译与运行没有串起来: ${command}`);

    const result = runInShell(command, dir);
    console.error('[Rust 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('rust ok'), '程序没有正常运行');

    await extension.deactivate();
});

// ----------------------------------------------------------------------
// 行为
// ----------------------------------------------------------------------

test('运行选中的代码：写临时文件并执行', async () => {
    const context = fakeContext();
    await extension.activate(context);

    state.activeTextEditor = fakeEditor(SAMPLE, {
        languageId: 'cpp',
        text: '#include <iostream>\nint main(){ std::cout << "selected ok" << std::endl; return 0; }',
        selection: { start: 0, end: 95 }
    });

    await state.commands.get('polyRunner.runSelection')();

    const command = lastCommand();
    console.error('[选区]', command);

    assert.match(command, /\.snippet\.cpp|\.cpp/, `命令没有指向临时文件: ${command}`);

    const result = runInShell(command, path.dirname(SAMPLE));
    console.error('[选区 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('selected ok'), '选中的代码没有跑起来');

    await extension.deactivate();
});

test('输出面板模式：命令不敲进终端，输出进输出面板', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-out-'));
    const file = makeTempFile(dir, 'out.py', 'print("output panel ok")\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'python' });
    await state.commands.get('polyRunner.runInOutput')();

    const channel = state.outputChannels.filter((c) => c.name === 'Poly Runner').pop();
    const text = channel.lines.join('\n');
    console.error('[输出面板]', text.split('\n').slice(-4).join('\n'));
    assert.ok(text.includes('output panel ok'), `输出面板里没有程序输出:\n${text}`);
    assert.ok(text.includes('退出码 0'), `输出面板里没有退出码:\n${text}`);

    await extension.deactivate();
});

test('停止命令向终端发送 Ctrl+C', async () => {
    const context = fakeContext();
    await extension.activate(context);

    state.activeTextEditor = fakeEditor(SAMPLE, { languageId: 'cpp' });
    await state.commands.get('polyRunner.runFile')();

    state.commands.get('polyRunner.stop')();

    const terminal = state.lastTerminal;
    assert.ok(
        terminal.commands.some((c) => c.includes('\u0003')),
        `没有向终端发送 Ctrl+C: ${JSON.stringify(terminal.commands)}`
    );

    await extension.deactivate();
});

test('自定义命令覆盖内置命令', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-custom-'));
    const file = makeTempFile(dir, 'c.py', 'print("custom ok")\n');

    state.overrides['polyRunner.customCommands.python'] = 'python3 -u {{file}} {{args}}';
    state.overrides['polyRunner.runArguments'] = ['--flag', 'x'];

    state.activeTextEditor = fakeEditor(file, { languageId: 'python' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[自定义]', command);

    assert.ok(command.includes('python3 -u'), `自定义命令没生效: ${command}`);
    assert.ok(command.includes('--flag x'), `运行参数没拼上: ${command}`);

    const result = runInShell(command, dir);
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('custom ok'), '程序没有正常运行');

    delete state.overrides['polyRunner.customCommands.python'];
    delete state.overrides['polyRunner.runArguments'];

    await extension.deactivate();
});

test('扩展名绑定：自定义扩展名也能选到运行方式', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-alias-'));
    const file = makeTempFile(dir, 'script.foo', 'print("alias ok")\n');

    state.overrides['polyRunner.languageAliases'] = { '.foo': 'python' };

    state.activeTextEditor = fakeEditor(file, { languageId: 'plaintext' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[别名]', command);
    assert.match(command, /python3?\s/, `扩展名绑定没生效: ${command}`);

    const result = runInShell(command, dir);
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('alias ok'), '程序没有正常运行');

    delete state.overrides['polyRunner.languageAliases'];

    await extension.deactivate();
});

test('只打开终端：不执行任何命令', async () => {
    const context = fakeContext();
    await extension.activate(context);

    state.activeTextEditor = fakeEditor(SAMPLE, { languageId: 'cpp' });
    await state.commands.get('polyRunner.openTerminal')();

    const terminal = state.lastTerminal;
    assert.ok(terminal, '没有创建终端');
    assert.strictEqual(terminal.commands.length, 0, `打开终端不该发命令: ${JSON.stringify(terminal.commands)}`);
    assert.strictEqual(terminal.cwd, path.dirname(SAMPLE), '终端工作目录不对');

    await extension.deactivate();
});

// ----------------------------------------------------------------------
// v1.0.1 新增：项目级运行 / stdin 管道 / 更多语言
// ----------------------------------------------------------------------

test('项目级运行：识别 package.json 并跑对应脚本', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-npm-'));
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'demo', version: '1.0.0', scripts: { hello: 'echo "npm hello ok"' } }, null, 2)
    );
    const file = path.join(dir, 'index.js');
    fs.writeFileSync(file, 'console.log(1);\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'javascript' });
    await state.commands.get('polyRunner.runProject')();

    const command = lastCommand();
    console.error('[项目]', command);

    assert.match(command, /^npm run /, `不是 npm 命令: ${command}`);

    const result = runInShell(command, dir);
    console.error('[项目 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('npm hello ok'), '项目脚本没有跑起来');

    await extension.deactivate();
});

test('stdin 管道模式：命令前置 cat <file> |', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-pipe-'));
    const file = makeTempFile(dir, 'data.py', 'print("hi")\n');
    const size = fs.statSync(file).size;

    state.overrides['polyRunner.pipeFileToStdin'] = true;
    state.overrides['polyRunner.customCommands.python'] = '{{pipeFile}}wc -c';

    state.activeTextEditor = fakeEditor(file, { languageId: 'python' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[管道]', command);

    assert.match(command, /^cat /, `命令没有 cat 前缀: ${command}`);
    assert.ok(command.includes('| wc -c'), `命令没有管道: ${command}`);

    const result = runInShell(command, dir);
    console.error('[管道 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.trim() === String(size), `管道内容不对: ${result.stdout.trim()} != ${size}`);

    delete state.overrides['polyRunner.pipeFileToStdin'];
    delete state.overrides['polyRunner.customCommands.python'];

    await extension.deactivate();
});

test('AppleScript：osascript 运行脚本', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-apple-'));
    const file = makeTempFile(dir, 'hello.applescript', 'return "applescript ok"\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'applescript' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[AppleScript]', command);
    assert.match(command, /osascript/, `不是 osascript 命令: ${command}`);

    const result = runInShell(command, dir);
    console.error('[AppleScript 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('applescript ok'), 'AppleScript 没有跑起来');

    await extension.deactivate();
});

test('ERB：erb 渲染模板', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-erb-'));
    const file = makeTempFile(dir, 'hello.erb', 'erb ok <%= 1 + 1 %>\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'erb' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[ERB]', command);
    assert.match(command, /erb/, `不是 erb 命令: ${command}`);

    const result = runInShell(command, dir);
    console.error('[ERB 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('erb ok 2'), 'ERB 没有渲染出来');

    await extension.deactivate();
});

test('ksh：ksh 执行脚本', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-ksh-'));
    const file = makeTempFile(dir, 'hello.ksh', 'echo "ksh ok"\n');

    state.activeTextEditor = fakeEditor(file, { languageId: 'ksh' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[ksh]', command);
    assert.match(command, /ksh/, `不是 ksh 命令: ${command}`);

    const result = runInShell(command, dir);
    console.error('[ksh 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('ksh ok'), 'ksh 脚本没有跑起来');

    await extension.deactivate();
});

// ----------------------------------------------------------------------
// v1.0.2 新增：大型 C++/CMake 工程能力
// ----------------------------------------------------------------------

const { spawnSync: spawnSyncDirect } = require('node:child_process');

/** 造一个真实的 CMake 多文件工程。 */
function makeCMakeProject(dir, { extraTarget = false } = {}) {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'CMakeLists.txt'),
        [
            'cmake_minimum_required(VERSION 3.16)',
            'project(poly_demo CXX)',
            'set(CMAKE_CXX_STANDARD 17)',
            'add_executable(demo src/main.cpp src/util.cpp)',
            'target_include_directories(demo PRIVATE src)',
            ...(extraTarget ? ['add_executable(second src/main.cpp)'] : [])
        ].join('\n')
    );
    fs.writeFileSync(
        path.join(dir, 'src', 'util.h'),
        '#pragma once\n#include <string>\nstd::string greet(const std::string& who);\n'
    );
    fs.writeFileSync(
        path.join(dir, 'src', 'util.cpp'),
        '#include "util.h"\nstd::string greet(const std::string& who) { return "hello " + who; }\n'
    );
    fs.writeFileSync(
        path.join(dir, 'src', 'main.cpp'),
        [
            '#include <iostream>',
            '#include "util.h"',
            'int main() {',
            '    std::cout << greet("cmake world") << std::endl;',
            '    std::cout << "cmake project ok" << std::endl;',
            '    return 0;',
            '}'
        ].join('\n')
    );
    return path.join(dir, 'src', 'main.cpp');
}

test('CMake 项目：配置 → 构建 → 运行产物（多源文件真的链接了）', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-cmake-'));
    const file = makeCMakeProject(dir);

    state.activeTextEditor = fakeEditor(file, { languageId: 'cpp' });
    await state.commands.get('polyRunner.runProject')();

    const command = lastCommand();
    console.error('[CMake]', command);

    assert.match(command, /cmake -S/, `没有配置步骤: ${command}`);
    assert.match(command, /cmake --build/, `没有构建步骤: ${command}`);
    assert.match(command, /--target demo/, `没有指定 target: ${command}`);
    assert.ok(command.includes('&&'), `构建与运行没有串起来: ${command}`);

    // 真跑：cmake 必须真的能把两个源文件链接成可执行文件
    const result = runInShell(command, dir);
    console.error('[CMake 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('cmake project ok'), 'CMake 产物没有跑起来');
    assert.ok(result.stdout.includes('hello cmake world'), '多源文件没有正确链接（util.cpp 的符号缺失）');

    // 构建产物确实落在 build/ 下
    assert.ok(fs.existsSync(path.join(dir, 'build', 'demo')), '产物没有生成在 build/ 下');

    await extension.deactivate();
});

test('编译数据库：单文件运行会链接整个 target 的源文件', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-db-'));
    const file = makeCMakeProject(dir);

    // 先让 CMake 生成 compile_commands.json
    const configure = runInShell(
        `cmake -S ${dir} -B ${path.join(dir, 'build')} -DCMAKE_BUILD_TYPE=Debug -DCMAKE_EXPORT_COMPILE_COMMANDS=ON`,
        dir
    );
    assert.strictEqual(configure.status, 0, `cmake 配置失败:\n${configure.stderr}`);
    assert.ok(fs.existsSync(path.join(dir, 'build', 'compile_commands.json')), '没有生成 compile_commands.json');

    state.activeTextEditor = fakeEditor(file, { languageId: 'cpp' });
    await state.commands.get('polyRunner.runFile')();

    const command = lastCommand();
    console.error('[编译数据库]', command);

    assert.ok(command.includes('util.cpp'), `编译数据库模式没有带上同 target 的其他源文件: ${command}`);
    assert.ok(command.includes('-I'), `编译数据库模式没有带上 include 路径: ${command}`);
    assert.ok(!command.includes(' -c '), `编译数据库模式不该只编译单个文件: ${command}`);
    assert.ok(command.includes('.poly-runner'), `产物没有放到 .poly-runner 目录: ${command}`);

    const result = runInShell(command, dir);
    console.error('[编译数据库 输出]', result.stdout.trim());
    assert.strictEqual(result.status, 0, `命令执行失败:\n${result.stderr}`);
    assert.ok(result.stdout.includes('cmake project ok'), '编译数据库编译出来的程序没跑起来');
    assert.ok(result.stdout.includes('hello cmake world'), '多源文件没有正确链接');

    await extension.deactivate();
});

test('多目标：CMake 有多个可执行目标时让你选', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-multi-'));
    const file = makeCMakeProject(dir, { extraTarget: true });

    state.activeTextEditor = fakeEditor(file, { languageId: 'cpp' });
    // 模拟用户选了第二个目标
    state.quickPickResult = { label: 'second' };

    await state.commands.get('polyRunner.runProject')();

    const command = lastCommand();
    console.error('[多目标]', command);
    assert.match(command, /--target second/, `没有用选中的目标: ${command}`);

    state.quickPickResult = undefined;

    await extension.deactivate();
});

test('watch 模式：保存后自动重新编译并运行', async () => {
    const context = fakeContext();
    await extension.activate(context);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poly-watch-'));
    const file = makeCMakeProject(dir);

    state.overrides['polyRunner.watchDebounceMs'] = 30;

    state.activeTextEditor = fakeEditor(file, { languageId: 'cpp' });
    await state.commands.get('polyRunner.toggleWatch')();

    // 清掉上一轮测试留下的终端，只看 watch 自己新建的
    state.terminals.length = 0;
    state.lastTerminal = undefined;
    const before = state.terminals.length;

    // 模拟保存（只调用本次 activate 注册的那个 handler）
    const handler = state.onDidSaveTextDocumentHandlers[state.onDidSaveTextDocumentHandlers.length - 1];
    await handler({ uri: Uri.file(file), languageId: 'cpp', isDirty: false, getText: () => '', save: () => Promise.resolve(true) });

    // 轮询等待重跑发生（避免固定 sleep 带来的时序抖动）
    await waitFor(() => state.terminals.length > before, 10000, 50);

    const after = state.terminals.length;
    console.error('[watch] 触发前终端数', before, '触发后', after);
    assert.ok(after > before, '保存后没有自动重跑');
    assert.ok(state.lastTerminal.commands.length > 0, 'watch 重跑没有发出命令');

    delete state.overrides['polyRunner.watchDebounceMs'];

    await extension.deactivate();
});
