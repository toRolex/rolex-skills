# 何时 Mock

只在**系统边界**（system boundaries）处 mock：

- 外部 API（支付、邮件等）
- 数据库（有时 —— 优先使用 test DB）
- 时间/随机性
- 文件系统（有时）

不要 mock：

- 你自己的类/模块
- 内部协作者
- 任何你掌控的东西

## 为可 mock 性而设计

在系统边界处，设计易于 mock 的接口：

**1. 使用依赖注入**

传入外部依赖，而不是在内部创建它们：

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. 优先使用 SDK 风格接口而非通用 fetcher**

为每个外部操作创建专门的函数，而不是用一个带条件逻辑的通用函数：

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK 方式意味着：

- 每个 mock 返回一个特定形状
- 测试设置中无需条件逻辑
- 更容易看出一个测试覆盖了哪些 endpoint
- 每个 endpoint 都有类型安全
