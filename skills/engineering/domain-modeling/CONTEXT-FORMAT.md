# CONTEXT.md 格式

## 结构

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

## 规则

- **要有主见。** 当同一个概念存在多个词时，选出最好的一个，把其他的列在 `_Avoid_` 下面。
- **定义保持精炼。** 最多一两句话。定义它是什么，不是它做什么。
- **只包含对这个项目 context 特有的术语。** 通用的编程概念（timeouts、error types、utility patterns）不属于这里，即使项目大量使用它们。在添加术语之前问一问：这是这个 context 独有的概念，还是一个通用编程概念？只有前者才属于这里。
- **当自然聚类出现时，把术语归组到子标题下。** 如果所有术语都属于一个内聚的领域，扁平列表也没问题。

## 单 context 与多 context 仓库

**单 context（大多数仓库）：** 在仓库根目录放一个 `CONTEXT.md`。

**多 context：** 根目录的 `CONTEXT-MAP.md` 列出所有 context、它们的位置以及它们之间的关系：

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md) — generates invoices and processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md) — manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

这个 skill 会推断应用哪种结构：

- 如果 `CONTEXT-MAP.md` 存在，读它来找到 context
- 如果只有根目录的 `CONTEXT.md` 存在，就是单 context
- 如果两者都不存在，在第一个术语被解决时惰性创建根目录的 `CONTEXT.md`

当存在多个 context 时，推断当前主题与哪个相关。如果不清楚，就问。
