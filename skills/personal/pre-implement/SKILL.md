---
name: pre-implement
description: 在动手实现任何任务之前（包含写代码、办公、和任何执行层面而不是计划层面的工作）先调用此技能：建 implementation notes ，逐步记录实现过程中的决策，偏离 plan、spec 时额外标记 Deviations。
---

新建并维护一个 implementation-notes.md（或 .html），保存在仓库已有的此类笔记的位置；匹配现有约定，如果没有，放在合理的位置并说明。

文件在任务完成的过程中逐渐生长，不同于一次性生成在执行之前的 spec。在每一步执行后，记录实现过程中做出的决策，供下一次尝试学习。

遇到 edge case 迫使你偏离计划时：选保守的那个选项，记录在 Deviations 下（偏离了什么、为什么、选了什么），然后继续实现。

用户没有给输入 artifact 时，派一个子代理先调研：spec 文件、prototype、grilling 结论等。
