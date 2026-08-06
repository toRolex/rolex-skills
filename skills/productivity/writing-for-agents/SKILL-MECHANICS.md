# Skill 机制

[`writing-for-agents`](SKILL.md) 的 skill 特有分支：当文档是 skill 时什么会改变——frontmatter、调用选择，以及 router skills。关于写它的其他一切，都是 `SKILL.md` 中的通用参考。

## 调用

两个选择，权衡两种负载：

- **model-invoked** skill 保留 `description`，这样 agent 可以自主触发它——其他 skill 也能到达它。你仍然可以输入它的名字：model-invocation 总是_包含_用户可达性；description 只增加 agent 发现，绝不移除人的。description 是 skill 的顶层上下文指针，被迫始终保持加载——用常驻上下文负载换取可发现性。一个内容全是参考的 model-invoked skill 也是共享参考的一个家：另一个 skill 可以调用它，所以多个 skill 需要的参考住在一个地方。机制：省略 `disable-model-invocation`，写一个携带触发分支的 model-facing description（`SKILL.md` 中的指针写作规则完全适用）。
- **user-invoked** skill 把 description 从 agent 的可达性中剥离：只有输入它名字的人类能调用它，没有其他 skill 能。零上下文负载，但它花认知负载——你是必须记住它存在的索引。机制：设置 `disable-model-invocation: true`；`description` 变成 human-facing——一行摘要，去掉触发列表。

只有 agent 必须自己到达 skill、或另一个 skill 必须到达它时，才选择 model-invocation。如果它只通过手工触发，做成 user-invoked 且不付上下文负载。

两个 user-invoked skill 都需要的共享参考可以住在两者之外——没有 description，谁也不能触发另一个。把它推到一个 skill 系统之外的普通文件：任何 skill 都能指向的外部参考。

## 按调用拆分

拆分的调用切法（序列切法在 `SKILL.md` 中）：当你有一个应该单独触发它的独特引导词——一个你在提示中实际使用的触发词——或另一个 skill 必须到达它时，拆分出一个 model-invoked skill。你为新的常驻 description 付上下文负载，所以那个独立可达性必须值得。

## Router skills

当 user-invoked skills 多到你记不住时，堆积的认知负载由 **router skill** 治愈：一个命名其他 skill 及各自何时使用的 user-invoked skill，这样人只需记住一个 skill 而不是很多。它只能暗示，永远不能触发它们：user-invoked skills 没有 description，所以除了人以外没有东西能到达它们。
