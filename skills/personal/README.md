# Personal

Rolex 原创的个人 skill——本仓库相比上游 mattpocock/skills 的差异化内容，覆盖 Git 运维到批量处理的完整链路。

## User-invoked

- **[afk-issue-loop](./afk-issue-loop/SKILL.md)** — 批量 AFK 处理 GitHub issues，遍历 `ready-for-agent` 标签逐个分发给独立 agent。
- **[ask-advisor](./ask-advisor/SKILL.md)** — 显式把当前决策点交给强模型顾问（strong-model-consultant），获取决策建议。
- **[qa-plan](./qa-plan/SKILL.md)** — 从最近 commit 生成 step-by-step QA 测试计划，保存为 GitHub issue。

## Model-invoked

- **[safe-pull](./safe-pull/SKILL.md)** — 安全 git pull + rebase：检查远程 → stash → rebase → 恢复 → 推送。
- **[clean-branches](./clean-branches/SKILL.md)** — 清理已合并 Git 分支（本地 + 远程 + 残留 worktree）。
- **[git-flow-conventions](./git-flow-conventions/SKILL.md)** — Git Flow 分支管理与提交规范参考。
- **[publish-release](./publish-release/SKILL.md)** — 从 develop 分支发版。
