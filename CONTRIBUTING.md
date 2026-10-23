# 贡献指南

谢谢你愿意动手 🎉 无论是一行 typo 还是加一种语言，都算数。

## 加一种语言（最常见的需求，5 分钟搞定）

打开 [`src/languages.ts`](src/languages.ts)，在 `LANGUAGES` 数组里加一条：

```ts
{
    id: 'zig',
    label: 'Zig',
    extensions: ['.zig', '.zon'],
    command: 'zig run {{file}} {{args}}',
    requires: ['zig'],
    note: '用 zig run 直接运行源文件'
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | ✅ | VS Code 的 language id |
| `label` | ✅ | 界面显示名 |
| `extensions` | ✅ | 文件扩展名（小写、含点） |
| `command` | ✅ | 命令模板，占位符见 README |
| `compiled` | ❌ | 编译型语言设为 `true`（引擎会准备 `{{out}}`） |
| `requires` | ❌ | 需要的可执行文件，用于运行前的缺失检测 |
| `note` | ❌ | 快速选择框里的一句话说明 |

命令模板里**不要自己加引号**，路径类占位符由插件自动做 shell 转义。可用变量见 README 的「命令模板变量」一节。

加完跑一下测试确认没写坏：

```bash
npm install
npm test
```

测试会真的调用编译器、真的把命令丢给 shell 执行一遍。

## 其他改动

```bash
npm install
npm run compile      # tsc 类型检查
npm test             # 端到端测试
npx vsce package     # 打包
```

按 `F5` 可以启动扩展开发宿主调试。

## 提 PR 前

- [ ] `npm run compile` 无报错
- [ ] `npm test` 全绿
- [ ] 改动只涉及你打算改的东西
- [ ] commit message 说清「改了什么、为什么」

## 讨论

不确定要不要做？先来 [Discussions](https://github.com/yoyo636/poly-runner/discussions) 聊聊，不用先写代码。
