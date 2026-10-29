---
name: to-goal
description: 当用户要求生成目标执行 prompt 时使用，明确终态、证明、不变量与 turn 上限。
---

只生成 prompt，不执行目标任务。

调用 Skill 工具，传入 `writing-for-agents`。

读取 [`template.md`](template.md)，根据用户输入和当前对话填写。保留已确认的范围与约束。缺失或冲突的信息写为 `[待确认：具体问题]`；turn 上限须为用户指定的正整数。

用一个 Markdown 代码块输出填写后的完整 prompt。
