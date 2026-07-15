快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/diagnosing-bugs)

## 功能

`diagnosing-bugs` 运行严谨的诊断循环处理困难 bug 和性能回归——构建复现、最小化、排序假设、插桩、修复并添加回归测试。

它拒绝在没有**紧反馈循环**之前进行假设——一个能在*这个* bug 上变红的可运行命令。在存在这样的命令之前读代码构建理论，正是此 skill 要防止的失败。

## 何时使用

敲 `/diagnosing-bugs` 或 agent 自动调用。

在困难 bug 上使用：一眼看不出原因、间歇性 flake、在两个已知正常状态之间悄悄出现的回归。如果是快速验证设计问题，用 `/prototype` 而不是这里。

## 紧循环是核心技能

一旦有信号，其他一切（二分查找、假设检验、插桩）都是机械的。此 skill 在阶段 1 投入不成比例的努力：构建一个通过/失败命令，驱动实际 bug 代码路径，断言用户的准确症状——然后**收紧**直到它快速、确定、可被 agent 运行。

## 效果良好的标志

- 在推测之前就构建并运行复现命令
- 循环断言你实际报告的症状
- 假设以排序的可证伪列表呈现
- 调试插桩有标签并在完成前清理

## 在流程中的位置

随时可用的独立工具。事后分析在发现没有好的 seam 锁定 bug 时，交接给 `/improve-codebase-architecture`。不确定时问 `/ask-rolex`。
