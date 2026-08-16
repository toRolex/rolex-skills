# AFK Issue Loop — Reference

> `${TARGET_BRANCH}` 由 SKILL.md 阶段 0 的分支模型检测决定（`develop` 或 `main`），是 worktree 创建与 Merger squash merge 的目标分支。

## 依赖解析

**主判定：issue body 的 `Blocked by` 字段**（格式：`- #<id> — <描述>` 或 `None - can start immediately`）。

**三条补充**（`Blocked by` 未列出但满足以下任一条也算被阻塞）——issue B 被 issue A 阻塞，当：

1. **资源依赖**：B 需要 A 引入的代码或基础设施（A 未合入则 B 无法开始或无法测试）
2. **空间冲突**：B 与 A 修改重叠的文件/模块，并行工作必然产生 merge 冲突
3. **契约依赖**：B 依赖 A 将确定的 API 或决策形态（A 未定则 B 的实现会返工）

**解析规则**：
1. 从每个 issue body 提取 `Blocked by` 列表
2. `None` 或只依赖已关闭 issue 的 → **unblocked**，可立即分派
3. 有未关闭依赖 issue 的 → **blocked**，本轮不派
4. 每轮 Merger 关 issue 后回到 Planner **重新 Plan**（依赖图可能变化）

**PRD 规则**：有实现 issue 链接的 PRD 不可作为实现对象（由 Merger 在子 issue 完成后统一关闭）。

**判定类 ticket（spike / gate / proof-of-concept）**：以验证/判定为目标，其结果（通过 / 不通过）对依赖它的下游是 go/no-go，不是实现依赖的解锁。

- 结果只终结该 ticket 自身：判定不通过 → **控制者直接** `gh issue close <N> --comment <结论>`（不经 Merger——判定终结是「关 issue 只在 Merger」的例外）
- **不级联关闭下游**：判定不通过不必然否掉所有下游（如不依赖其结果、可独立验证的 server 侧工作），下游存废由 owner 评估
- 因判定取消的下游保持 open、不改状态、不标 wontfix，收尾列入「待 owner triage」清单报告（见[收尾流程](#收尾流程)）

展示分组：

```
unblocked（可并行，≤4）：
  #90 M2M迁移 → afk/issue-90
  #82 ShortLink 模型 → afk/issue-82

blocked（本轮等待）：
  #91 报名合并支付 ← 等待 #90
  #92 支付页 ← 等待 #90
  #93 前端串联 ← 等待 #91, #92
```

## 协议机制

四角色之间的机器可读信号，控制者据此编排：

| 信号 | 生产者 | 格式 / 含义 |
|------|--------|-------------|
| `<plan>` | Planner | `<plan>{"issues":[{"number","title","branch"}]}</plan>`，只含当前 unblocked |
| `<promise>COMPLETE</promise>` | Implementer / Reviewer / Merger | 权威完成信号 |

- **确定性分支名**：`afk/issue-{N}`。同 issue 每轮重 Plan 恒得同名分支，进度自然保留（resume / 中断恢复依赖此特性）
- **`<promise>COMPLETE</promise>` 是权威完成信号**：Implementer 发出 = 分支可审查；Reviewer 发出 = 审查完成或跳过；Merger 发出 = 全部合并 + issue 已关。`DONE` 等自然语言只是人读摘要（见[状态处理](#状态处理)）
- **真正完成判定（关 issue）只在 Merger**（判定类 ticket 的关闭例外见[依赖解析](#依赖解析)）；Implementer / Reviewer 都不关 issue
- **Reviewer 反馈经 `SendMessage` 直连 impl-N，不经控制者中转**（反馈闭环细节见[状态处理](#状态处理)与[超时协议](#超时协议)）

控制者解析 `<plan>`：正则提取 `<plan>([\s\S]*?)</plan>`，`JSON.parse`，校验每项 `number/title/branch`。

## 模型选择

按任务复杂度信号选择，不纯按文件数：

| 信号 | 模型 | 典型 issue |
|---|---|---|
| 单文件、纯机械操作（删除文件、提取常量、重命名、import 更新） | Haiku | 清理临时文件、品牌 Logo 提取为 include |
| 需理解现有模式、1-3 文件、中等复杂度 | Sonnet | 新增模型字段+Admin、Django 模板修改 |
| 跨模块集成、架构决策、调试、>3 文件 | Opus | M2M 迁移、合并支付逻辑 |

**角色建议**：Planner / Merger 建议 Opus（依赖分析与冲突解决需要全局视野）；Reviewer 与 Implementer 同级或高一档；Implementer 按上表。

**AFK 场景下失败的代价高于交互式场景**——如果 Haiku 搞砸了，需要重新分派，浪费的不仅是 token 还有时间。不确定时向上取整（宁可用 Sonnet 不用 Haiku，宁可用 Opus 不用 Sonnet）。

## 红线

控制者的行为规则（角色 agent 的红线见 `reference/` 下各分派模板）：

**分派前**
- 只有 unblocked 的 issue 才分派；跨 issue 并行 ≤4（信号量）；同 issue 内 Implementer→Reviewer 严格串行
- 分派时注入 issue 完整文本（含 comments）与 `CONTEXT.md`（如存在），agent 不自己读 issue
- 分支名必须用 Planner 输出的确定性 `afk/issue-{N}`，不另造名称

**控制者角色**
- 控制者只做编排——分派、解析 `<plan>`、验证、异常处置，**不写实现代码**；发现产出 bug 时分派修复 agent（可换更强模型），主会话不直接改代码
- Seam 预确认：分派时预确认，agent 不等待
- Reviewer 只审查不自己改代码；问题经 `SendMessage` 直连对应 impl-N（subagent 同会话路由；herdr 需跨会话 messaging，见[reference/herdr-notes.md](reference/herdr-notes.md)）
- 反馈迭代上限 1 轮：复查不通过即升级，review-N 带诊断上报（区分「没理解反馈」/「能力不够」，控制者据此换强模型 / 拆分 / 上报）
- **绝不关闭或改 label 任何本流程未实现合入的 issue**（含判定失败的下游与父 PRD）——存废由 owner 决定；判定类 ticket 自身的关闭例外见[依赖解析](#依赖解析)

**本地 squash merge（不推送、不建 PR）**
- 唯一权威 merge 方式：主仓库（已检出 `${TARGET_BRANCH}`）内 `git merge --squash <分支>`；**不在 worktree 内执行**（git 禁止同一分支在两个 worktree 同时检出）；`wt` 的 merge 子命令不再作为权威
- `git push origin ${TARGET_BRANCH}` 在任何情况下都不执行；`gh pr create`、Web UI 合并或任何远程 merge 都是违规
- 本地 `${TARGET_BRANCH}` 与 `origin/${TARGET_BRANCH}` 分歧时保留分歧，不 merge origin、不解决冲突——分歧是预期状态，由项目维护者决定何时同步
- squash message 规范、冲突解决、删分支与 worktree 清理等 Merger 执行细则见 [reference/merger-prompt.md](reference/merger-prompt.md)；验证清单见 SKILL.md 阶段 3

**worktree 与 Agent 环境**
- 统一用 `wt switch -c afk/issue-{N} -b ${TARGET_BRANCH}` 创建 worktree（不用 `git worktree add`）
- 分派 Agent 时不带 `isolation` 参数——worktree 已由 `wt switch -c` 创建

## 状态处理

**`<promise>COMPLETE</promise>` 与状态的关系**：`<promise>` 是权威完成信号——角色发出即视为本轮求值完成；`DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED` 是自然语言状态摘要，供控制者做异常分类与处置。

| 状态 | 含义 | 控制者动作 |
|------|------|-----------|
| `DONE` + `<promise>COMPLETE</promise>` | Implementer 完成：TDD→全量测试→commit，分支可审 | 触发同分支 Reviewer |
| `FEEDBACK_SENT`（无 COMPLETE） | Reviewer 已把问题 `SendMessage` 反馈 impl-N，闭环进行中 | 启动闭环等待（见[超时协议](#超时协议)），等 impl-N 修复 + review-N 复查 |
| `DONE_WITH_CONCERNS` | Implementer：完成但有疑虑 / **Reviewer：复查不通过（1 轮已满），带诊断** | Implementer：阅读疑虑，正确性相关→分派修复 agent（不手动修）；Reviewer：读诊断（「没理解反馈」vs「能力不够」）→ 换强模型 / 拆分 / 上报 |
| `NEEDS_CONTEXT` | 缺少信息无法继续 | 保留 worktree，提供缺失信息后重新分派（同分支，进度保留） |
| `BLOCKED` | 无法完成，需要帮助 | 保留 worktree，评估原因后：补上下文 / 换强模型 / 拆分 issue / 上报。**绝不忽视** |
| 超时（无状态） | 后台计时器先于 `<promise>` 触发 | 见[超时协议](#超时协议) |

Merger 后验证三件事（CLOSED / 无残留 worktree / 1-parent squash commit）见 SKILL.md 阶段 3；若发现 GitHub PR merge，按[红线](#红线)回滚重做。

## 超时协议

**时间分级**（两载体统一，按复杂度预判）：

| 复杂度 | 时限 |
|--------|------|
| 简单（单文件、机械操作） | 2-3 分钟 |
| 中等（1-3 文件） | 5-10 分钟 |
| 复杂（跨模块、>3 文件） | 10-20 分钟 |

**subagent 模式**：
1. 分派时记录 deadline + 后台计时器：`Bash: sleep <分钟> && echo "<agent名> timeout"`（`run_in_background: true`）
2. 计时器先响（先于 `<promise>COMPLETE</promise>`）→ `TaskStop` 终止 agent
3. 查分支 commit：
   - **有** → 按部分完成处理，进 Reviewer 判断
   - **无** → 标记超时，下轮 Planner 重分析或重派

**herdr 模式**：沿用现有轮询协议（`herdr agent list` 查 `agent_status`），见[reference/herdr-notes.md](reference/herdr-notes.md)。agent 完成回到 idle 但不会通知控制者，必须主动轮询。

**闭环等待**（review-N 反馈 impl-N 后，subagent 模式）：
- review-N 第一轮结束（`FEEDBACK_SENT`）后，控制者启动闭环 deadline（沿用上表时限，按修复量取中值）
- deadline 内收到 review-N 最终 `COMPLETE` → 按复查结果处置（通过 → Merger；不通过 → 带诊断升级）
- deadline 到仍无最终结果 → `TaskStop` 终止 review-N / impl-N，查分支 commit 按部分完成处理

## 并行冲突处理

- 并发纪律（跨 issue ≤4 / 同 issue 内严格串行）见[红线](#红线)「分派前」
- 空间冲突的 issue 由 Planner 判为 blocked 避免并发；已并行的重叠分支由 Merger 统一合并时解决（冲突处理规则见 [reference/merger-prompt.md](reference/merger-prompt.md)）

## agent 中断恢复

- Agent 终止后 `name` 不可达，用 **agentId** resume（Agent 工具分派后记录的原始 agentId）
- 恢复前先查分支 commit 判断进度：有 commit → 从断点继续（同分支重派 Implementer 或直接进 Reviewer）；无 commit → 重派
- 中断不丢已提交进度——确定性分支名 `afk/issue-{N}` 保证 resume 落到同一分支

## CONTEXT.md 缺失策略

- 控制者基于 `CLAUDE.md` + `docs/adr/` 创建 `CONTEXT.md`
- 或用其替代注入：把 CLAUDE.md 核心内容 + 相关 ADR 拼成「领域上下文」段注入角色 prompt

## 收尾流程

所有 issue 实现完成后，报告统计（实现了几个 issue、生成几个 squash commit），并列出因判定类 ticket 失败而保持 open、需 owner triage 的下游 ticket；然后按 SKILL.md 末尾的提示语建议用户 code review 和 QA。如有新 issue，提示可再次运行 `/afk-issue-loop`。
