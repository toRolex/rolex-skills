---
name: pre-implement
description: 在计划或讨论结束、开始实际交付多步骤任务时调用：新建并维护 implementation notes，逐步记录实现决策；偏离 plan、spec 时记录 Deviations。
---

新建并维护当前任务的 `.agents/notes/<task-slug>-implementation-notes.md`（若目录不存在则自动创建）。已有 notes 属于其他任务时，另起文件。

Implementation notes 属于记录“因果”（为何做此决策、舍弃了什么、踩了什么坑）的演进记录，专供下一次尝试或后续 Agent 学习，不得随意放入面向确定“事实”的 `docs/` 目录中。

文件在任务完成的过程中逐渐生长，不同于一次性生成在执行之前的 spec。在每一步执行后，记录实现过程中做出的决策，供下一次尝试学习。遇到 edge case 迫使你偏离计划时：选保守的那个选项，记录在 Deviations 下（偏离了什么、为什么、选了什么），然后继续实现。

用户没有给输入 implement 所需要的相关 artifact 时，派一个子代理先调研：spec 文件、prototype、grilling 结论等。
