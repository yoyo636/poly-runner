# Poly Runner v1.0.2 (Beta)

> 面向所有语言的 VS Code 运行器 —— 把一条真实的 shell 命令敲进集成终端，由系统编译器 / 解释器完成编译与运行。

## 这是什么

点一下运行按钮，插件会在集成终端里输入一条完整的命令：

```bash
/usr/bin/g++ -std=c++17 -Wall main.cpp -o /tmp/poly-runner/build/main && /tmp/poly-runner/build/main
```

不是插件在后台偷偷 spawn 一个进程，而是**你看得见、摸得着、能接着敲命令**：

- 编译报错直接显示在终端里
- 程序要读 stdin 就在终端里打字
- 跑完同一个终端还能继续用

## 亮点

- **117 种语言**内置默认命令：编译型、脚本型、JVM、函数式、模板、标记型全覆盖
- **两种执行通道**：集成终端（可交互）/ 输出面板（捕获输出 + 超时保护）
- **命令模板机制**：14 个变量，任何语言都能自定义；路径自动 shell 转义
- **三层识别**：用户绑定 → 文件类型 → 扩展名 → shebang，认不出时问你
- **运行前依赖检测**：编译器没装提前提示，不让终端飘 `command not found`
- **运行选中的代码**：片段写临时文件，编译型语言自动带 `-I`
- **一键停止**：终端发 Ctrl+C，输出面板杀整个进程组

## 快速上手

1. 装上插件
2. 打开任意 `.py` / `.cpp` / `.java` 文件
3. 按 `Cmd+Alt+N`（Windows `Ctrl+Alt+N`）

命令就出现在终端里了。

## 加一种语言只要 5 分钟

```ts
// src/languages.ts
{
    id: 'zig',
    label: 'Zig',
    extensions: ['.zig'],
    command: 'zig run {{file}} {{args}}',
    requires: ['zig'],
    note: '用 zig run 直接运行源文件'
}
```

细节见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 参与

- 提 issue、提想法 → [Issues](https://github.com/yoyo636/poly-runner/issues) / [Discussions](https://github.com/yoyo636/poly-runner/discussions)
- 觉得好用 → 点个 ⭐️，这是对 Beta 阶段最大的支持
- 想帮忙 → 看看 [CONTRIBUTING.md](CONTRIBUTING.md)，加一门语言是最快的上手方式

## 已知限制

- Windows + MSVC 需要把默认终端设为开发者命令提示符
- TypeScript 默认走 `npx tsx`，需要本地装有 tsx / ts-node
- 输出面板模式没有 TTY，需要交互的程序请用终端模式

---

**Beta 意味着接口还会变。** 哪里不顺手，直接来评论区说 —— 这个阶段你的每条反馈都会直接变成下一个版本。
