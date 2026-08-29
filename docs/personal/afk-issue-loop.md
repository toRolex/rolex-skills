快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/personal/afk-issue-loop)

## 功能

处理用户指定的 GitHub Ticket numbers；未指定时扫描 open `ready-for-agent` Tickets。Planner 读取原生 parent/sub-issue 与 `blocked_by`，角色在 Worktrunk worktree 中实现和审查，Merger 拓扑合并并关闭 Tickets；失败会在原现场自动恢复。

## 何时使用

手动敲 `/afk-issue-loop [issue numbers] [mode=subagent|herdr]` 调用。

适合无人值守处理一个 SPEC 拆出的 Tickets，或批量清空已 triage 的 `ready-for-agent` 积压。

## 在流程中的位置

独立工具。通常接在 `/to-tickets` 或 triage 之后；不确定时问 `/ask-rolex`。
