快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/personal/afk-issue-loop)

## 功能

处理指定 GitHub Tickets；省略时扫描 open `ready-for-agent`。原生依赖 DAG、最多四条 Ticket 管线；reviewed 即排队交给唯一 Merger，完整合并/测试/关闭/清理验收后立即解锁下游，不等独立慢任务。初始 CLOSED 只审计跳过。默认 subagent，不可复用现场则明确等待；Herdr 仅显式使用。失败在原现场证据驱动恢复，同 stage 首次可重试失败 Sonnet 升 Opus；权限与四槽边界不被恢复绕过。

详见 [执行规范](../../skills/personal/afk-issue-loop/SKILL.md) 与 [上游差异](../research/sandcastle-vs-afk-sequence.md)。

## 何时使用

手动敲 `/afk-issue-loop [issue numbers] [mode=subagent|herdr]` 调用。

适合无人值守处理一个 SPEC 拆出的 Tickets，或批量清空已 triage 的 `ready-for-agent` 积压。

## 在流程中的位置

独立工具。通常接在 `/to-tickets` 或 triage 之后；不确定时问 `/ask-rolex`。
