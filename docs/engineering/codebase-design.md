快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/codebase-design)

## 功能

`codebase-design` 给你一套共享、精确的词汇来设计**深度模块**——小接口后隐藏大量行为，放置在干净的 seam 上，通过接口可测试。

它是**语言，不是流程**。它不重构你的代码或给你重构计划——它固定词汇（module、interface、depth、seam、adapter、leverage、locality），让每个设计对话和每个触碰设计的 skill 说同一套话。

## 何时使用

敲 `/codebase-design` 或 agent 自动调用。

在设计或改进模块接口、寻找深化机会、决定 seam 位置、或让代码更可测试时使用。如果想打磨项目的*领域*术语而非模块设计，用 `/domain-modeling`。如果想对现有代码库做完整架构巡检，用 `/improve-codebase-architecture`。

## 深 vs 浅

模块在大量行为坐在小接口后面时是**深的**，在接口几乎和实现一样复杂时是**浅的**。深度作为**杠杆**衡量——调用者每个学习单位接口能执行多少行为。

两个检查做大部分工作：**删除测试**（删除模块，复杂性是消失还是重新出现在调用者中？）和**一个 adapter 是假设的 seam；两个 adapter 是真实的 seam**。

## 接口就是测试面

调用者和测试穿过同一个 seam。这就是为什么词汇坚持用 **seam**（Feathers 的术语——一个可以在不编辑的情况下改变行为的地方）代替过载的"boundary"。

## 在流程中的位置

随时可用的独立工具，工程 skill 的共享词汇层。与 `/domain-modeling` 并列。不确定时问 `/ask-rolex`。
