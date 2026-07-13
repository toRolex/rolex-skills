---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when the user wants to pin down domain terminology or a ubiquitous language, record an architectural decision, or when another skill needs to maintain the domain model.
---

# Domain Modeling（领域建模）

在设计过程中主动构建并打磨项目的领域模型。这是*主动的*纪律——挑战术语、发明边界场景、在词汇和决策刚固化时立即写下来。（仅仅*阅读* `CONTEXT.md` 来获取词汇不是此 skill——那是任何 skill 都能做的一行习惯。此 skill 适用于你在*更改*模型，而不仅仅是消费它的时候。）

## 文件结构

大多数仓库只有一个上下文：

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

如果根目录存在 `CONTEXT-MAP.md`，说明仓库有多个上下文。该地图指向每个上下文的位置：

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← 系统级决策
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← 上下文特有决策
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

惰性创建文件——只在有东西要写时。如果 `CONTEXT.md` 不存在，在第一个术语被解决时创建。如果 `docs/adr/` 不存在，在第一个 ADR 需要时创建。

## 会话期间

### 对照词汇质疑

当用户使用的术语与 `CONTEXT.md` 中已有的语言冲突时，立即指出来。"你的词汇表将'取消'定义为 X，但你似乎指的是 Y——是哪一个？"

### 锐化模糊语言

当用户使用模糊或过载的术语时，提出一个精确的规范术语。"你说的'账户'——是指客户还是用户？它们是不同的东西。"

### 讨论具体场景

当领域关系正在讨论时，用具体场景进行压力测试。发明探测边界情况的场景，迫使用户在概念之间的界限上变得精确。

### 与代码交叉引用

当用户陈述某事如何工作时，检查代码是否同意。如果发现矛盾，提出它："你的代码取消整个订单，但你刚刚说部分取消是可能的——哪个是正确的？"

### 就地更新 CONTEXT.md

当一个术语被解决时，立即更新 `CONTEXT.md`。不要批量做这些——在它们发生时捕获。使用 [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md) 中的格式。

`CONTEXT.md` 应完全不含实现细节。不要将 `CONTEXT.md` 当作 spec、草稿或实现决策的仓库。它只是一个词汇表，别的什么都不是。

### 谨慎提供 ADR

只有在三个条件都满足时才提供创建 ADR：

1. **难以逆转** —— 以后改变主意的成本是显著的
2. **没有上下文会让人惊讶** —— 未来的读者会想知道"他们为什么这样做？"
3. **是真正权衡的结果** —— 存在真正的替代方案，你因为特定原因选择了其中一个

如果三个中任何一个缺失，跳过 ADR。使用 [ADR-FORMAT.md](./ADR-FORMAT.md) 中的格式。
