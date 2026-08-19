# GitHub Flow

GitHub Flow 是 Gitflow 之上的轻量替代，保留 PR 协作模型，砍掉 develop / release / hotfix 角色，让 `main` 永远是唯一主干。

> 主文件见 [`../SKILL.md`](../SKILL.md)。日常按 GitFlow 工作时不需要这份；只有当用户明确要"换到 GitHub Flow"或讨论 PR 协作模型时才读这里。

```
main -> branch -> pull request -> review -> CI -> merge -> deploy
```

## 核心规则

- `main` 始终保持可发布
- 每个变更创建短分支
- 每个分支通过 PR 合入 `main`
- 合入前至少完成 Review 和 CI
- 合入后尽快部署
- 出问题优先 revert

## 分支生命周期

GitHub Flow 不鼓励长期存在的 feature 分支。如果一个功能需要开发很久，建议拆小：

- 先合入无行为变化的准备性重构
- 再合入后端能力
- 再合入前端入口
- 未完成能力用 feature flag 控制

## 主干最小保护配置

main 没有保护时，GitHub Flow 会变成混乱的集中式提交。最小配置至少包含：

- Require pull request
- Required status checks
- Required review

推荐配置（团队规模上来后）：

- `main` 启用分支保护
- 所有变更走 PR
- CODEOWNERS 覆盖关键目录
- CI 配成 required status checks
- 安全扫描前移到 PR 或 push 阶段
- PR 高并发后启用 Merge Queue
- 合入后能追踪 tag、release 和部署状态

## 常见误区

1. **main 没有保护**：所有人能直 push，PR 流程立即失效。
2. **PR 太大**：Review 流于形式，bug 上线概率上升。GitHub Flow 依赖快速 Review。
3. **没有发布和回滚机制**：高频发布前提是发布和回滚足够稳，否则一次小变更就能把主干搞瘫。

## 与其他工作流的位置

GitHub Flow 是 Trunk-Based 的入门版：先把分支保护 + PR Review + CI 跑稳，再考虑去掉 PR 强约束、压短分支寿命、引入 feature flag。

完整对比见 [`comparing-workflows.md`](comparing-workflows.md)。