# 推广计划

> 这份文档是给「想让人用上这个插件」的人看的：目标人群、投放渠道、可直接粘贴的文案、以及冷启动节奏。
> 文案都可以直接复制使用。

## 一句话定位

**Poly Runner**：在 VS Code 里点一下，把一条真实的 shell 命令敲进终端，由系统编译器/解释器把代码跑起来。
不是「插件自己偷偷 spawn 一个进程」，而是**你看得见、摸得着、能接着敲命令**。

## 为什么用户会换过来

现有工具（Code Runner 等）的问题，恰好是我们解决的点：

| 用户的痛点 | Poly Runner 的做法 |
| --- | --- |
| 想知道「到底执行了什么命令」 | 命令原样敲进终端，一眼可见，可以直接改 |
| 编译报错看不到 / 被吞掉 | 报错直接在终端里，跟手敲一样 |
| 程序要读 stdin 怎么办 | 程序就跑在终端里，直接打字回车 |
| 跑完想接着敲命令 | 同一个终端，还能继续敲 |
| 不同语言命令不一样，记不住 | 117 种语言内置，改一行配置就能加新语言 |

## 目标人群

1. **正在学编程的学生 / 自学者** —— 最容易转粉，一行 `python main.py` 就能跑起来。
2. **写脚本的人**（Python/Shell/Ruby/JS） —— 「跑一下看看」是高频动作。
3. **算法 / 刷题党** —— C++/Java 编译运行是日常。
4. **VS Code 深度用户** —— 已经在用 Code Runner 的人，会发现差别在「透明」。

## 冷启动动作清单

### 第 1 周：把摊子摆开

- [ ] 发布 VS Code Marketplace（见下方「发布到 Marketplace」）
- [ ] 写一篇带 GIF 的介绍文章（掘金 / 少数派 / V2EX / 知乎）
- [ ] Reddit：r/vscode、r/programming、r/learnprogramming、r/Python
- [ ] Hacker News：Show HN
- [ ] X / Twitter 发一条带演示 GIF 的 thread
- [ ] 建 Discussions，把第一条帖子置顶（Roadmap + 欢迎语）
- [ ] 准备一个「3 分钟上手」GIF：打开文件 → 按快捷键 → 命令出现在终端 → 程序输出

### 第 2-4 周：把社区养起来

- [ ] 每条 issue 都认真回，尤其是「加语言」类，当天给答复
- [ ] 把社区提的高频语言补进 `src/languages.ts`
- [ ] 给第一个外部贡献者的 PR 认真 review + merge + 致谢
- [ ] 把「加一种语言只要 5 分钟」做成固定栏目，每月发一次
- [ ] 在 README 里挂上贡献者头像墙（谁加了什么语言）
- [ ] Discord / 微信群（如果有）同步维护

### 关键增长钩子

1. **低门槛贡献**：加一种语言 = 5 分钟改一个文件 → 让人愿意提第一个 PR → PR 变成 star。
2. **透明可玩**：命令直接可见 → 用户会自己发现新用法并来分享。
3. **公开 Roadmap**：让人有理由回来围观进展。
4. **贡献者致谢**：让人有理由把你的仓库转给同事。

## 可直接使用的文案

### 中文 · 掘金 / 少数派 / 知乎

```markdown
写代码最烦的不是写，是「跑一下」。

VS Code 里我想要的是这样：按一下快捷键，终端里出现一行命令，
系统编译器把它编译、把它跑起来，报错直接怼在终端上，
程序要读输入就在终端里打字，跑完我还能接着敲命令。

所以我做了 Poly Runner（Beta）：
https://github.com/yoyo636/poly-runner

它不自己开进程搞那些黑魔法，而是老老实实把命令敲进你的终端：

    /usr/bin/g++ -std=c++17 -Wall main.cpp -o /tmp/build/main && /tmp/build/main
    python hello.py
    javac Main.java && java -cp . Main

内置 117 种语言（C/C++、Python、Java、Go、Rust、JS/TS、Shell、Ruby、PHP…），
还能一条配置加新语言。

现在是 Beta，欢迎试用，也欢迎来评论区提意见：
- 你最想加哪种语言？
- 现在的命令形式符合你的习惯吗？
- 有没有踩到奇怪的坑？

Issue 和 Discussion 都开着，吐槽最好使 :)
```

### English · Reddit (r/vscode)

```markdown
[Release] Poly Runner — a VS Code extension that types the real command into your terminal

Most "run this file" extensions spawn a process behind your back. I wanted the opposite:
press the shortcut, and you *see* the exact command typed into the integrated terminal,
and the system compiler/interpreter does the rest.

    /usr/bin/g++ -std=c++17 -Wall main.cpp -o /tmp/build/main && /tmp/build/main
    python hello.py
    javac Main.java && java -cp . Main

Why it matters:
- compile errors show up right in the terminal, where you already are
- programs that read stdin just work — type in the terminal
- you can keep using that terminal afterwards
- you can see (and edit!) the command before it runs

117 languages built in, and adding your own is a 5-line change.

Beta, so feedback is very welcome — especially "which language should I add next?".
GitHub: https://github.com/yoyo636/poly-runner
```

### English · Show HN

```markdown
Title: Poly Runner – VS Code extension that types real shell commands into your terminal

I built a VS Code extension for running code that stays honest about what it does:
it sends a real command line to the integrated terminal and lets your system
compiler/interpreter handle it, instead of spawning processes behind your back.

Try it: https://github.com/yoyo636/poly-runner
```

### X / Twitter thread

```text
1/ 我给 VS Code 写了个跑代码的插件：不自己偷偷 spawn 进程，而是把一条真实的命令敲进终端。
2/ 你看到的就是你执行的：g++ -std=c++17 -Wall main.cpp -o out && out
3/ 好处很直接：编译报错在终端里、程序能读 stdin、跑完还能接着敲命令。
4/ 内置 117 种语言，加一门新语言只要改 5 行配置。
5/ Beta 版，欢迎试用和吐槽：github.com/yoyo636/poly-runner
```

## 发布到 Marketplace

仓库本身不含 Marketplace 发布产物，需要本地打包并用你自己的 publisher 发布：

```bash
npm install
npx vsce package --pre-release
# 登录：npx vsce login <你的 publisher id>
npx vsce publish --pre-release
```

注意 `package.json` 里的 `publisher` 目前是占位值 `local-dev`，发布前改成你自己的 publisher id。

## 衡量指标

| 指标 | 目标（首个季度） |
| --- | --- |
| GitHub stars | 300 |
| Marketplace 安装量 | 2000 |
| 外部贡献者 | ≥ 10 |
| 新增语言（来自社区） | ≥ 15 |
| Issue 首条回复时间 | < 24 小时 |

## 一句话原则

**每一次互动都要让人能说一句「这个我也能用 / 我能加一门语言」。**
具体做法：回复用模板化的「我来加，两小时内 PR」+ 立刻把人加进贡献者列表。
