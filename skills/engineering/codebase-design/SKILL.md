---
name: codebase-design
description: Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find deepening opportunities, decide where a seam goes, make code more testable or AI-navigable, or when another skill needs the deep-module vocabulary.
---

# Codebase Design（代码库设计）

设计**深度模块**：小接口背后的大量行为，放置在干净的 seam 上，通过该接口可测试。在代码被设计或重构的任何地方使用此语言和原则。目标是调用者的 leverage、维护者的 locality、所有人的可测试性。

## 词汇

精确使用这些术语——不要用"component"、"service"、"API"或"boundary"代替。一致的语言就是全部意义所在。

**Module** —— 任何有接口和实现的东西。刻意保持规模无关：函数、类、包或跨越层级的切片。_避免_：unit、component、service。

**Interface** —— 调用者必须知道才能正确使用模块的一切：类型签名，但也包括不变量、排序约束、错误模式、所需配置和性能特性。_避免_：API、signature（太窄——它们只指类型层面的表面）。

**Implementation** —— 模块内部的东西，它的代码体。与 **Adapter** 不同：一个东西可以是小的 adapter 加上大的实现（一个 Postgres repo），或大的 adapter 加上小的实现（一个 in-memory fake）。当 seam 是主题时用"adapter"；否则用"implementation"。

**Depth** —— 接口处的杠杆：调用者（或测试）每学习一个单位接口所能执行的行为量。当一个**大量**行为坐在一个**小**接口后面时，模块是**深的**；当接口几乎和实现一样复杂时，模块是**浅的**。

**Seam**（Michael Feathers）—— 可以在不编辑该位置的情况下改变行为的地方；模块接口所在的*位置*。把 seam 放在哪里是一个独立的设计决策，与什么放在它后面不同。_避免_：boundary（与 DDD 的有界上下文过载）。

**Adapter** —— 在 seam 处满足接口的具体实现。描述*角色*（它填充什么槽位），不是本质（里面有什么）。

**Leverage** —— 调用者从深度获得的东西：每学习一个单位接口获得更多能力。一个实现在 N 个调用点和 M 个测试之间分摊回报。

**Locality** —— 维护者从深度获得的东西：变更、bug、知识和验证集中在一个地方，而不是散布在调用者之间。修复一次，到处都修复了。

## 深 vs 浅

**深度模块** = 小接口 + 大量实现：

```
┌─────────────────────┐
│    小接口            │  ← 少方法，简参数
├─────────────────────┤
│                     │
│  深层实现            │  ← 复杂逻辑隐藏在内
│                     │
└─────────────────────┘
```

**浅模块** = 大接口 + 少实现（避免）：

```
┌─────────────────────────────────┐
│       大接口                     │  ← 多方法，复杂参数
├─────────────────────────────────┤
│  薄实现                          │  ← 只是透传
└─────────────────────────────────┘
```

设计接口时，问：

- 可以减少方法数量吗？
- 可以简化参数吗？
- 可以在内部隐藏更多复杂性吗？

## 原则

- **深度是接口的属性，不是实现的属性。** 深度模块内部可以由小的、可 mock 的、可替换的部件组成——它们只是接口的一部分。模块可以有**内部 seams**（对其实现私有，由自己的测试使用）以及在其接口处的**外部 seam**。
- **删除测试。** 想象删除这个模块。如果复杂性消失了，它是透传。如果复杂性在 N 个调用者之间重新出现，它在发挥价值。
- **接口就是测试面。** 调用者和测试穿过同一个 seam。如果你想要*越过*接口进行测试，模块的形状可能不对。
- **一个 adapter 意味着假设的 seam。两个 adapter 意味着真实的 seam。** 除非有东西真正跨 seam 变化，否则不要引入 seam。

## 可测试性设计

好的接口使测试变得自然：

1. **接受依赖，不要创建它们。**

   ```typescript
   // 可测试
   function processOrder(order, paymentGateway) {}

   // 难以测试
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **返回结果，不要产生副作用。**

   ```typescript
   // 可测试
   function calculateDiscount(cart): Discount {}

   // 难以测试
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **小表面积。** 更少的方法 = 更少的测试。更少的参数 = 更简单的测试设置。

## 关系

- **Module** 有且仅有一个 **Interface**（它呈现给调用者和测试的表面）。
- **Depth** 是 **Module** 的属性，相对于其 **Interface** 衡量。
- **Seam** 是 **Module** 的 **Interface** 所在之处。
- **Adapter** 位于 **Seam** 处并满足 **Interface**。
- **Depth** 为调用者产生 **Leverage**，为维护者产生 **Locality**。

## 被拒绝的框架

- **Depth 作为实现行数与接口行数的比率**（Ousterhout）：奖励填充实现。我们改用 depth-as-leverage。
- **"Interface" 作为 TypeScript 的 `interface` 关键字或类的 public 方法**：太窄——此处的 interface 包括调用者必须知道的每一个事实。
- **"Boundary"**：与 DDD 的有界上下文过载。说 **seam** 或 **interface**。

## 深入了解更多

- **给定依赖的集群深化**——见 [DEEPENING.md](DEEPENING.md)：依赖类别、seam 纪律、和替换不分层测试。
- **探索替代接口**——见 [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md)：启动并行 sub-agent 几种截然不同的方式设计接口，然后在 depth、locality 和 seam 放置上进行比较。
