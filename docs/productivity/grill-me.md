快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/productivity/grill-me)

## 功能

`grill-me` 对计划或设计进行 relentless 的访谈，走遍设计树的每个分支，直到你和 agent 达成**共享理解**。

**一次问一个问题**并等待。从不一次性倒一堆问题。每个问题附带 agent 自己的推荐答案，所以你不是面对空白提示框，而是对一个提议做反应。

## 何时使用

手动敲 `/grill-me` 调用。

在构建之前，当计划大致对但感觉其中有未解决的决策时使用。如果希望同样的访谈还留下 ADR 和词汇表的文档痕迹，用 `/grill-with-docs`。如果工作量太大一个 session 装不下，先走 `/wayfinder`。

## 设计树

会话将计划作为决策树来遍历，逐个解决依赖关系。目的不是快速达成一致，而是让每个隐含的决策显式化。结束后，计划的每个分支都已走过。

`grill-me` 是**无状态的**——不写任何文件，不留 workspace。产出只有对话中磨锐的理解。

## 在流程中的位置

随时可用的独立工具。是 `/grilling` 原语的无状态、user-invoked 前端。不确定时问 `/ask-rolex`。
