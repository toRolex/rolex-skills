# ADR 格式

ADR 存放在 `docs/adr/` 中，使用连续编号：`0001-slug.md`、`0002-slug.md` 等。

惰性创建 `docs/adr/` 目录：只在需要第一个 ADR 时。

## 模板

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

就这些。一个 ADR 可以是单个段落。价值在于记录*做出*了决策和*为什么*，不在于填满各个章节。

## 可选章节

只有在它们增加真正价值时才包含。大多数 ADR 不需要它们。

- **Status** frontmatter（`proposed | accepted | deprecated | superseded by ADR-NNNN`）：当决策被重新审视时有用
- **Considered Options**：只有当被拒绝的替代方案值得记住时
- **Consequences**：只有当不明显下游影响需要被指出时

## 编号

扫描 `docs/adr/` 找到现有最高编号并加一。

## 何时提供 ADR

以下三个条件都必须成立：

1. **难以逆转**：以后改变主意的成本是显著的
2. **没有 context 会让人惊讶**：未来的读者会看着代码想"他们到底为什么这样做？"
3. **是真正权衡的结果**：存在真正的替代方案，你因为特定原因选择了其中一个

如果决策容易逆转，跳过它：你只会再逆转回去。如果不会让人惊讶，没人会想知道为什么。如果没有真正的替代方案，除了"我们做了显而易见的事"之外没什么可记录的。

### 什么算数

- **architecture 形态。** "我们在用 monorepo。""写模型是 event-sourced 的，读模型被投影到 Postgres。"
- **context 之间的集成模式。** "Ordering 和 Billing 通过 domain events 通信，不是同步 HTTP。"
- **带有锁定效应的技术选择。** 数据库、message bus、auth provider、部署目标。不是每个库：只是那些换掉要花一个季度的。
- **Boundary 和范围决策。** "客户数据由 Customer context 拥有；其他 context 只通过 ID 引用它。" 明确的"不"和"是"同样有价值。
- **刻意偏离显而易见路径的偏差。** "我们用手写 SQL 而不是 ORM，因为 X。" 任何合理的读者会假设相反情况的东西。这些能阻止下一个工程师"修复"某个刻意的选择。
- **代码中看不到的约束。** "因为合规要求我们不能用 AWS。""因为 partner API 契约，响应时间必须在 200ms 以下。"
- **拒绝原因不明显的被拒绝替代方案。** 如果你考虑过 GraphQL 而因为微妙的原因选了 REST，记录下来；否则六个月后又会有人建议 GraphQL。
