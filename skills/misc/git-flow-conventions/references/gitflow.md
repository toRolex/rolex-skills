# GitFlow

Vincent Driessen 的 A Successful Git Branching Model 完整内容。包含核心分支模型、操作命令、合并策略、关键红线。

> 主文件见 [`../SKILL.md`](../SKILL.md)。日常按 GitFlow 工作时只看主文件即可；本文件用于对比其它工作流时的基线参考。

## 工作流选型

进入任何一种工作流前，先看对比矩阵和选型决策表。

### 对比矩阵

| 维度 | GitFlow | GitHub Flow | Trunk-Based |
|------|---------|-------------|-------------|
| 分支角色数量 | 多（develop/release/hotfix） | 极少（main + 短分支） | 极少（main + 短分支） |
| 主干纪律 | 中（develop 为主） | 高（main 永远可发布） | 极高（main 必须随时可发布） |
| 合入机制 | merge，保留分支 | 必须 PR + Review + CI | 主干纪律强时可直 push 或短分支直合；CI 是必备门禁 |
| 分支寿命 | 长（feature 可跨版本） | 短（天级） | 更短（小时到 1–2 天） |
| Review 形式 | 异步 PR | 异步 PR Review | 偏向 pre-commit review 或结对编程，异步 PR 退化为轻量 |
| 未完成能力处理 | 等分支合完 | 可用 feature flag，非强制 | feature flag 是核心前提 |
| 发布频率 | 低到中（按版本） | 高（合入即可部署） | 极高（一天多次），靠自动化部署 |
| 失败回滚 | revert + hotfix 分支 | 优先 revert | 优先 revert + feature flag 远程关闭 |
| 适用团队 | 客户端、SDK、企业交付产品 | 小到中等、Web 服务 | 工程纪律强的中大规模服务端团队 |
| 关键支撑能力 | 分支纪律 | 分支保护 + CI | 极快 CI + feature flag + 快速回滚 + 代码所有权 |

### 选型决策表

| 团队特征 | 推荐工作流 |
|---------|-----------|
| 客户端、SDK、企业交付，需要稳定 release / hotfix 流程 | GitFlow |
| 小到中等 Web 服务，CI 完善，PR 协作文化成熟 | GitHub Flow |
| 工程纪律强、CI < 10 分钟、追求一天多次发布 | Trunk-Based Development |
| 已有 GitFlow 但 release / hotfix 流程跑得太重 | 收敛为 GitHub Flow 或 Trunk-Based |
| 已有 Trunk-Based 但缺少 feature flag 和快速回滚 | 先补工程能力，再谈主干高频集成 |

完整 GitHub Flow 见 [`github-flow.md`](github-flow.md)，Trunk-Based 见 [`trunk-based.md`](trunk-based.md)。

## 核心分支模型

```
master (production)    ●───●─────────●────────── ● ──●
                        \   /           \         /   /
release                  ●─●    v1.0     ●───●   /   /
                          \              /     \ /   /
develop  ●────●────●──────●────●───●────●───────●───●────
           \    \    \      /      \    \     /
feature     ●─┐  ●─┐  ●───●        ●─┐  ●───●
              │    │                  │    │
hotfix        │    │                  │    ●────────────●
              │    │                  │
```

## 分支类型与命名规范

| 分支类型 | 命名格式 | 来源 | 合并目标 | 说明 |
|---------|---------|------|---------|------|
| `master` | `master` / `main` | — | — | 生产环境代码，只接受合并 |
| `develop` | `develop` | `master` | — | 主开发分支 |
| `feature` | `feature/<功能简述>` | `develop` | `develop` | 新功能开发 |
| `release` | `release/<版本号>` | `develop` | `master` + `develop` | 发布准备 |
| `hotfix` | `hotfix/<版本号>` | `master` | `master` + `develop` | 线上紧急修复 |

### 命名示例

- `feature/user-auth` — 用户认证功能
- `feature/add-dashboard` — 新增仪表盘
- `release/1.2.0` — 1.2.0 版本发布
- `hotfix/1.1.1` — 修复 1.1.0 线上问题

**原则**：全小写，英文单词用连字符分隔，简洁描述目的。

## 关键红线

- **禁止** 直接在 `master`/`main` 上修改代码
- **禁止** 直接在 `develop` 上开发功能，必须走 feature 分支
- **禁止** 在 Release 分支打好后从 develop 合入新功能
- **必须** 使用 `--no-ff` 合并 feature/release/hotfix 到主分支
- **必须** 每次 Release/Hotfix 后在 master 上打 tag
- **必须** 删除已合并的 feature/release/hotfix 远程分支