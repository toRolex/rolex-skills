---
name: to-spec
description: Turn the current conversation into a spec and publish it to the project issue tracker — no interview, just synthesis of what you've already discussed.
disable-model-invocation: true
---

# To Spec（生成 Spec）

本 skill 获取当前对话上下文和代码库理解，产出 spec（你可能称之为 PRD）。**不要**访谈用户——只综合你已经知道的。

issue tracker 和 triage 标签词汇应该已经提供给你——如果没有，运行 `/setup-rolex-skills`。

## 流程

1. **浏览仓库**以了解代码库的当前状态，如果你还没做的话。在整个 spec 中使用项目的领域词汇，并尊重你正在接触区域的 ADR。

2. **草拟测试的 seams。** 勾勒出你将要测试功能的 seams。应优先使用已有的 seams 而非新 seams。使用尽可能高的 seam。如果需要新 seam，在你能够到的最高点提出。跨代码库的 seam 越少越好——理想数量是一个。

   与用户检查这些 seams 是否符合他们的预期。

3. **使用以下模板编写 spec**，然后发布到项目 issue tracker。应用 `ready-for-agent` triage 标签——不需要额外的 triage。

<spec-template>

## 问题陈述

用户面临的问题，从用户的角度来看。

## 解决方案

问题的解决方案，从用户的角度来看。

## 用户故事

一个长编号的用户故事列表。每个用户故事采用以下格式：

1. 作为 <角色>，我想要 <功能>，以便 <收益>

<用户故事示例>
1. 作为手机银行客户，我想查看我的账户余额，以便做出更明智的消费决策
</用户故事示例>

这个用户故事列表应该非常详尽，覆盖功能的所有方面。

## 实现决策

已做出的实现决策列表。可以包括：

- 将要构建/修改的模块
- 那些模块的接口
- 来自开发者的技术澄清
- 架构决策
- Schema 变更
- API 约定
- 特定交互

**不要**包含具体的文件路径或代码片段。它们可能很快过时。

例外：如果原型产生了比散文更精确地编码决策的片段（状态机、reducer、schema、类型形状），在相关决策内内联它并简要注明它来自原型。裁剪到决策丰富的部分——不是工作演示，只是重要的部分。

## 测试决策

已做出的测试决策列表。包括：

- 好测试的描述（只测试外部行为，不测试实现细节）
- 哪些模块将被测试
- 测试的先例（即代码库中类似类型的测试）

## 不在范围内

此 spec 范围之外的内容的描述。

## 进一步备注

关于功能的任何进一步备注。

</spec-template>
