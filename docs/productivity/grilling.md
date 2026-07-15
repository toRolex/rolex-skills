快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/productivity/grilling)

## 功能

`grilling` 是 relentless 的访谈，在构建之前压力测试计划或设计。逐分支走设计树，逐个解决决策依赖关系，直到你和 agent 共享相同的理解。

**一次问一个问题**并等待你的回答。每个问题附带 agent 的推荐答案。在你确认达到共享理解之前，不会开始执行计划。

## 何时使用

敲 `/grilling` 或 agent 自动调用。

当计划或设计还有软肋，想在写代码之前暴露它们时使用。实践中通常通过两个 wrapper 调用：普通访谈用 `/grill-me`，同时写 ADR 和词汇表用 `/grill-with-docs`。

## 设计树

心智模型是一棵**设计树**：每个计划分叉为决策，决策互相依赖。`grilling` 一次一个节点地下树，让先前的答案重塑后续问题。

## 单独提取的原因

`grilling` 是访谈技巧的**单一真相来源**，作为 model-invoked **原语**拆分出来，这样每个需要访谈的 skill 都可以调用它而不是自己重写一个。不确定时问 `/ask-rolex`。

## 在流程中的位置

访谈**原语**，在 `/grill-with-docs` 底层运行。不确定时问 `/ask-rolex`。
