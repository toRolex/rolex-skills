---
name: afk-issue-loop
description: 遍历标记为 ready-for-agent 的 GitHub issue，逐个分派到隔离 git worktree 的子 agent 批量实现，全部完成后提示手动 code review 或 QA。用户通过 /afk-issue-loop 调用。
disable-model-invocation: true
argument-hint: "[mode=subagent|herdr]"
---

# AFK Issue Loop

Matt Pocock 的 Ralph loop 的轻量替代——不需要 Docker/Sandcastle，用 `wt` worktree + `Agent` 工具实现相同效果。

**前置条件**：项目已跑过 `/setup-rolex-skills`，仓库有 `CONTEXT.md`。herdr 模式额外需要 herdr CLI 已安装。

## 模式选择

通过 `[mode=subagent|herdr]` 参数选择。无参数时默认 `subagent`。

| 模式 | 原理 | 适用场景 |
|------|------|----------|
| `subagent` | 当前会话中用 `Agent` 工具分派子 agent | 少量 issue（≤5）、需要实时看子 agent 进度 |
| `herdr` | 调用 `/herdr-instances` 开新 pane 启动独立 claude 实例 | 大量 issue、想并行跑满、不占当前会话上下文 |

herdr 模式下控制者只做扫描和验证，实现 agent 在独立 claude 窗口中运行。具体的 pane 创建、指令下发、等待、结果收集等操作，直接遵循 `/herdr-instances` skill 的核心工作流和布局规则（主编排 pane 不可上下分割，左右/上下分割各自不超过 3）。

## Quick start

```
用户：我已经 /to-issues 拆好了，让 agent 逐个实现这些 issue

1. 扫描：gh issue list --label ready-for-agent --state open
2. 解析依赖关系 → 无阻塞的 issue 并行分派
3. 每个 issue 完成后检查是否解锁新 issue → 继续分派
4. 全部完成后 → 提示用户进行 code review 或 QA
```

## Workflows

### 阶段 1：分支模型检测、扫描与依赖解析

**分支模型检测**（决定 `TARGET_BRANCH`，后续所有命令中的 `${TARGET_BRANCH}` 都指这个值）：

```bash
# 本地或远程有 develop 分支 → Git flow；只有 main → trunk-based
git branch -a | grep -Eq '(^|[[:space:]/])develop$' && TARGET_BRANCH=develop || TARGET_BRANCH=main
echo "TARGET_BRANCH=$TARGET_BRANCH"
```

- 有 `develop` 分支（本地或远程）→ **Git flow**：`TARGET_BRANCH=develop`，worktree 从 develop 创建，merge 到 develop
- 只有 `main` → **trunk-based**：`TARGET_BRANCH=main`，worktree 从 main 创建，merge 到 main。**绝不新建 `develop` 分支**——项目维护者只用 main 时，新建 develop 会扰乱他们的分支管理

```bash
gh issue list --label ready-for-agent --state open --limit 20 --json number,title,body,labels
```

从每个 issue 的 body 中提取 `Blocked by` 字段，构建依赖图。

- 无未满足依赖的 issue → 可立即分派（可并行）
- 有未满足依赖的 issue → 等待依赖完成后分派

展示分组后的 issue 列表（可立即开始 / 等待依赖），让用户确认。

### 阶段 2：分派实现

对每个可立即开始的 issue（互不依赖的 issue 可并行分派）。根据 `mode` 参数选择分派方式。

**选择模型**：按任务复杂度选择，详见 [REFERENCE.md](REFERENCE.md#模型选择)。简要规则：纯机械操作用 Haiku，常规实现用 Sonnet，架构决策或跨模块集成用 Opus。

**分支前缀**（两种模式共用），根据 issue label 选择：

| Label | 前缀 | 用途 |
|---|---|---|
| `enhancement` | `feature/` | 新功能 |
| `bug` | `bugfix/` | 修 bug |
| `hotfix` | `hotfix/` | 紧急修复 |
| 其他（chore、refactor 等）或无 label | `chore/` | 日常维护 |

---

#### subagent 模式（默认）

创建 worktree（从 `${TARGET_BRANCH}`——阶段 1 检测出的 `develop` 或 `main`）：

```bash
wt switch -c <prefix>/<issue-id>-<short-name> -b ${TARGET_BRANCH}
```

用 `Agent` 工具（**不带 `isolation` 参数**——worktree 已由 `wt switch -c` 创建），按 `reference/implementer-prompt.md` 模板构造 prompt，必须注入：
- issue 完整文本（`gh issue view <id> --json title,body`）
- `CONTEXT.md` 内容（如存在）
- 相关 ADR（如存在）
- worktree 的绝对路径（`wt` 创建的 `<project>.<prefix>-<id>-<name>` 目录）

agent 在该 worktree 中按 implementer-prompt 的**步骤链**执行（见 [reference/implementer-prompt.md](reference/implementer-prompt.md)）。

#### herdr 模式

流程与 subagent 模式完全一致（同一步骤链），区别只在于交付方式：

1. 按 `/herdr-instances` 布局规则在**当前 tab** 创建 pane
2. 启动 agent，按 implementer-prompt 模板构造 prompt（工作目录段替换为自行 `wt switch -c <前缀>/<id>-<名称> -b ${TARGET_BRANCH}` 的版本），通过 `herdr pane run` 或 `send-text + Enter` 下发
3. **发后验证**：下发后 10s 内检查 agent 是否真的开始工作（`agent list | grep <名称>` 确认 `agent_status=working` 且 title 变为实现标题）。未开始则重试。
4. **轮询协议**（关键）：agent 完成不会通知控制者。每 5 分钟（或预期完成时间后）执行轮询，见 REFERENCE.md#控制者轮询协议

**herdr 操作细节与踩坑**（agent start 三要素、指令发送方式、发后验证、轮询协议、`wait` 命令语法等）见 [REFERENCE.md](REFERENCE.md#herdr-模式注意事项)。

---

#### 两种模式后续共用

**红线（控制者遵守；完整清单见 [REFERENCE.md](REFERENCE.md#红线)）：**
- 每个 issue 通过 Agent 分派，控制者只做编排——扫描、分派、验证。
- 所有 merge 只发生在本地 `${TARGET_BRANCH}`，**绝不推送远程、绝不创建 PR**。本地 `${TARGET_BRANCH}` 与 `origin/${TARGET_BRANCH}` 分歧时保留分歧、不解决，不影响后续 worktree 创建。

**处理 agent 状态**：详见 [REFERENCE.md](REFERENCE.md#状态处理)。

**DONE 后**：验证三件事后检查依赖图：
- `gh issue view <id> --json state` 返回 CLOSED
- `wt list` 中不再出现该 worktree
- **确认 merge 是本地完成的**：`git log --oneline ${TARGET_BRANCH} -5` 应包含对应的 merge commit 或 squash commit（非 `origin/${TARGET_BRANCH}` 上的 commit）。如果 commit 来自 GitHub PR（含 `(#N)` 标记），该 issue 标记为流程错误，按"红线"规则回滚重做
- herdr 模式额外关闭 agent pane：`herdr pane close $WS:pX`
- 验证通过后检查依赖图：是否有被此 issue 阻塞的 issue 现在可以开始。有则立即分派。

## Reference

- [REFERENCE.md](REFERENCE.md) — 状态处理表、模型选择、红线、收尾流程
- [EXAMPLES.md](EXAMPLES.md) — 完整使用示例
- [reference/implementer-prompt.md](reference/implementer-prompt.md) — 实现 agent 分派模板

全部 issue 完成后，提示用户：

> 所有 issue 已实现并合并。建议先进行 **code review**（审查代码正确性、风格、安全性），再执行 **QA 测试**（端到端行为、回归验证）。经典流程：code review 通过 → 部署到测试环境 → QA 测试。
