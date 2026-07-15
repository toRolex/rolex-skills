快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/productivity/writing-great-skills)

## 功能

`writing-great-skills` 是你编写和编辑 skill 时对照的参考——共享词汇和原则，让 skill 变得可预测。

一个 skill 的职责是从随机系统中规整出确定性，所以目标不是每次运行产生相同*输出*，而是相同*过程*。**可预测性**是根本美德。

## 何时使用

手动敲 `/writing-great-skills` 调用。

当你编写新 skill 或编辑已有 skill，想让它每次都行为一致时使用：决定调用模式、写 description、选择什么放在 `SKILL.md` vs 链接文件、或诊断 skill 为什么出问题。

## 认知负载

整个参考围绕的概念是**认知负载**——以及它的对应物**上下文负载**。每个 skill 花费其中一种：

- **model-invoked** skill 保留 description 每轮在窗口中，花费**上下文负载**但能自行触发
- **user-invoked** skill 移除 description，零上下文负载，但现在*你*是必须记住它存在的索引——那是**认知负载**

## 其他杠杆

- **引领词** — 模型预训练中已存在的紧凑概念（`tight`、`red`、`tracer bullet`）
- **信息层次** — 从 in-skill 步骤到外部参考的阶梯
- **修剪** — 单一真相来源、相关性、逐句的 no-op 测试
- **失败模式** — 提前完成、重复、沉积、蔓延、no-op

## 在流程中的位置

随时可用的独立参考。构建其他 skill 时查阅的元 skill。不确定时问 `/ask-rolex`。
