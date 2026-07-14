---
name: afk-issue-loop
description: Loop through GitHub issues labeled ready-for-agent, dispatching each to a fresh-context subagent in an isolated git worktree. After all issues complete, remind the user to run code review or QA manually. Use when the user wants to run AFK agents against issues, mentions "Ralph loop", "夜班", "AFK 实现", "让 agent 自己跑 issue", "帮我逐个处理 issue", "批量实现 issue", or wants to loop through ready-for-agent issues.
disable-model-invocation: true
---

# AFK Issue Loop

Matt Pocock 的 Ralph loop 的轻量替代——不需要 Docker/Sandcastle，用 `wt` worktree + `Agent` 工具实现相同效果。

**前置条件**：项目已跑过 `/setup-matt-pocock-skills`，仓库有 `CONTEXT.md`。

## Quick start

```
用户：我已经 /to-issues 拆好了，让 agent 逐个实现这些 issue

1. 扫描：gh issue list --label ready-for-agent --state open
2. 解析依赖关系 → 无阻塞的 issue 并行分派
3. 每个 issue 完成后检查是否解锁新 issue → 继续分派
4. 全部完成后 → 提示用户进行 code review 或 QA
```

## Workflows

### 阶段 1：扫描与依赖解析

```bash
gh issue list --label ready-for-agent --state open --limit 20 --json number,title,body,labels
```

从每个 issue 的 body 中提取 `Blocked by` 字段，构建依赖图。

- 无未满足依赖的 issue → 可立即分派（可并行）
- 有未满足依赖的 issue → 等待依赖完成后分派

展示分组后的 issue 列表（可立即开始 / 等待依赖），让用户确认。

### 阶段 2：分派实现

对每个可立即开始的 issue（互不依赖的 issue 可并行分派）：

**选择模型**：按任务复杂度选择，详见 [REFERENCE.md](REFERENCE.md#模型选择)。简要规则：纯机械操作用 Haiku，常规实现用 Sonnet，架构决策或跨模块集成用 Opus。

**创建 worktree**（默认从 `develop` 分支，如项目用 `main` 则替换）。根据 issue label 选择分支前缀：

| Label | 前缀 | 用途 |
|---|---|---|
| `enhancement` | `feature/` | 新功能 |
| `bug` | `bugfix/` | 修 bug |
| `hotfix` | `hotfix/` | 紧急修复 |
| 其他（chore、refactor 等）或无 label | `chore/` | 日常维护 |

```bash
wt switch -c <prefix>/<issue-id>-<short-name> -b develop
```

**分派 agent**：用 `Agent` 工具（**不带 `isolation` 参数**——worktree 已由 `wt switch -c` 创建），按 `reference/implementer-prompt.md` 模板构造 prompt，必须注入：
- issue 完整文本（`gh issue view <id> --json title,body`）
- `CONTEXT.md` 内容（如存在）
- 相关 ADR（如存在）
- worktree 的绝对路径（`wt` 创建的 `<project>.feature-<id>-<name>` 目录）

agent 在该 worktree 中按 `/implement` 标准流程工作：TDD → typecheck → code-review → commit → `wt merge develop --no-ff --no-squash` → 关闭 issue。

**控制者只做编排**：扫描、分派、验证 commit。**绝不手动写任何实现代码，无论 issue 看起来多简单。** 子 agent 产出有问题时，分派修复 agent（可换更强模型），不在主会话里直接改代码。

子 agent 可能在开始实现前询问 seam 确认——直接回答，给出你的判断。这不算手动实现，这是编排的一部分。

**处理 agent 状态**：详见 [REFERENCE.md](REFERENCE.md#状态处理)。

**BLOCKED 或 NEEDS_CONTEXT 时**：保留 worktree，补信息后同一 worktree 重新分派。

**DONE 后**：子 agent 已自行 `wt merge develop --no-ff --no-squash` 到 develop 并清理 worktree。控制者验证两件事后检查依赖图：
- `gh issue view <id> --json state` 返回 CLOSED
- `wt list` 中不再出现该 worktree
- 验证通过后检查依赖图：是否有被此 issue 阻塞的 issue 现在可以开始。有则立即分派。

## Reference

- [REFERENCE.md](REFERENCE.md) — 状态处理表、模型选择、红线、收尾流程
- [EXAMPLES.md](EXAMPLES.md) — 完整使用示例
- [reference/implementer-prompt.md](reference/implementer-prompt.md) — 实现 agent 分派模板

全部 issue 完成后，提示用户：

> 所有 issue 已实现并合并。建议先进行 **code review**（审查代码正确性、风格、安全性），再执行 **QA 测试**（端到端行为、回归验证）。经典流程：code review 通过 → 部署到测试环境 → QA 测试。
