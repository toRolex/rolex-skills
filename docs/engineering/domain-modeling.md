快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/domain-modeling)

## 功能

`domain-modeling` 在设计的过构建和打磨项目的**统一语言**——挑战模糊术语、用具体场景压力测试关系、在术语和决策刚固化时立即写下来。

这是**主动的**纪律，不是被动的。仅仅读 `CONTEXT.md` 借用词汇是任何 skill 都能做的一行习惯；此 skill 适用于你在*改变*模型的时候——创造规范术语、发现代码与你刚说的话之间的矛盾、记录难以逆转的决策。

## 何时使用

敲 `/domain-modeling` 或 agent 自动调用。

当*词语*是问题时使用：两个人对"取消"有不同的理解、"账户"在做三件事、或设计对话总卡在一个从未被精确定义的概念上。如果问题是模块的*形状*——seam 放哪、接口有多深——用 `/codebase-design` 代替。

## 词汇表 vs ADR

- **词汇表**（`CONTEXT.md`）捕获语言。每次模糊的术语被规范后，立即写下来
- **ADR** 捕获决策。门槛很高：只在决策**难以逆转**、**没有上下文会让人惊讶**、并且是**真实权衡结果**时才提供

## 在流程中的位置

随时可用的独立工具，是其他 skill 的共享词汇层。前接 `/grill-with-docs`，后供 `/to-spec` 使用。不确定时问 `/ask-rolex`。
