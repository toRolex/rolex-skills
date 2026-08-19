# Trunk-Based Development

Trunk-Based Development 强调短分支、快合入、主干持续稳定。它适合工程纪律较强、CI 反馈较快、发布自动化较成熟的团队。

> 主文件见 [`../SKILL.md`](../SKILL.md)。只有当用户明确要"换到 Trunk-Based"或讨论主干高频集成时才读这里。

```
short-lived branch -> main -> CI -> deploy
```

## 核心思想

团队尽量围绕一个主干分支协作，开发分支生命周期很短，避免长期分支积累大量冲突。

## 适合场景

- CI 快且稳定
- 测试覆盖较好
- 团队能接受频繁小变更
- 可以用 feature flag 控制未完成能力
- 服务端或 Web 产品可以高频发布

## 核心规则

- 分支生命周期短
- 尽快合入主干
- 主干必须随时可发布
- 大功能拆小步推进
- 未完成能力用 feature flag 隔离
- 出问题优先 revert

## 必备工程能力

主干开发依赖一组支撑能力，缺一不可：

- **小变更**：一次提交/PR 只做一件事，便于 Review 和回滚
- **快速 CI**：反馈循环 < 10 分钟，否则团队会绕过流程
- **代码所有权**：CODEOWNERS 或 owner 矩阵明确，谁改什么一查就清
- **Feature flag**：未完成能力用 flag 隔离，主干不会出现半成品
- **快速回滚**：revert + 部署自动化，出问题立即恢复

普通团队落地时，不要只追求"分支少"，要先把这些支撑能力建起来。

## 常见失败模式

### CI 太慢

主干开发依赖快速反馈。CI 如果经常排队几十分钟，团队会开始绕过流程，所有纪律都会塌方。

### 没有 feature flag

大功能无法一次完成时，需要用 feature flag 隔离未完成能力。否则主干会出现半成品功能，发布后被迫回滚。

### 分支仍然长期存在

如果 feature 分支存在几周，本质上已经偏离 trunk-based 的核心实践——长期分支积累冲突，主干纪律名存实亡。

### 没有快速回滚通道

主干高频合入意味着出问题的频率上升。没有"一键 revert + 一键回滚部署"的能力，主干会被一次事故拖垮。

## 与 GitHub Flow 的关键区别

| 维度 | GitHub Flow | Trunk-Based Development |
|------|-------------|------------------------|
| 合入机制 | 必须走 PR + Review + CI | 主干纪律强时可直接 push 或短分支直接合；CI 是必备门禁 |
| 分支寿命 | 短分支（天级） | 更短（小时到 1–2 天） |
| Review 形式 | PR 上的异步 Review | 偏向 pre-commit review 或结对编程，异步 PR 退化为轻量 |
| 未完成能力 | 可用 feature flag，但非强制 | feature flag 是核心前提，否则主干会出现半成品 |
| 团队规模 | 小到中等、Web 服务 | 工程纪律强的中大规模服务端团队 |
| 发布频率 | 高频（合入即可部署） | 极高频（一天多次），靠自动化部署 |
| 失败回滚 | 优先 revert | 优先 revert + feature flag 远程关闭 |

GitHub Flow 是 Trunk-Based 的入门版：先把分支保护 + PR Review + CI 跑稳，再考虑去掉 PR 强约束、压短分支寿命、引入 feature flag。

完整对比见 [`comparing-workflows.md`](comparing-workflows.md)。