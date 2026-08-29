# AFK Issue Loop — Reference

> `${TARGET_BRANCH}` 由 SKILL.md 阶段 0 的分支模型检测决定（`develop` 或 `main`），是 worktree 创建与 Merger 拓扑 merge 的目标分支。

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
4. Planner 只在开头跑一次，输出**完整依赖图（DAG）**；每轮由控制者按拓扑序切片本轮 unblocked（unblocked 集合空即停）

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
| `<plan>` | Planner（**仅开头一次**） | `<plan>{"issues":[{"number","title","branch","blocked_by":[number,...]}]}</plan>`，完整 DAG；同时落盘目标项目 `docs/afk-plan.json`，控制者按拓扑序切片每轮 unblocked |
| `<promise>COMPLETE</promise>` | Implementer / Reviewer / Merger | 权威完成信号 |

- **确定性分支名**：`afk/issue-{N}`。重跑 Planner 输出同一分支名（虽只跑一次，确定性仍是契约）
- **`<promise>COMPLETE</promise>` 是权威完成信号**：Implementer 发出 = 分支可审查；Reviewer 发出 = 审查完成或跳过；Merger 发出 = 全部合并 + issue 已关。`DONE` 等自然语言只是人读摘要（见[状态处理](#状态处理)）
- **真正完成判定（关 issue）只在 Merger**（判定类 ticket 的关闭例外见[依赖解析](#依赖解析)）；Implementer / Reviewer 都不关 issue
- **Reviewer 一次性自改**：在 Implementer 的 worktree / branch 上直接改代码 + commit，不反馈、不复查；Implementer 与 Reviewer 在同一分支线性叠加 commit，Implementer 的 commit 在前、Reviewer 的 `refine:` commit 在后

控制者验收 `<plan>`：Read `docs/afk-plan.json`（Planner 已写入），校验每项 `number/title/branch`；DAG 模式下同时校验 `blocked_by`（数组，可空）。验收后给每节点补 `status` 字段并逐轮用 Edit 维护（`pending` / `dispatched` / `done` / `failed`）。

## 主窗口预算

控制者的上下文窗口是稀缺资源。四条硬规则：

1. **模板自加载**：分派 prompt 只传模板文件路径 + 参数（`ISSUE_NUMBER` / `BRANCH` / `TARGET_BRANCH` / `WORKTREE`），不复制模板全文；角色 agent 自行 Read 模板
2. **寻址注入**：prompt 只给命令与路径（`gh issue view N`、`Read CONTEXT.md`），材料由 agent 自取；控制者不代读、不粘贴全文
3. **极简汇报**：角色 agent 汇报 = `<promise>COMPLETE</promise>` + 状态行，CONCERNS/BLOCKED 附一句疑虑；测试输出、commit 与文件清单留在终端与 git 历史——控制者需要事实时自己跑 git 命令
4. **禁轮询**：通知驱动等待——分派后挂 watchdog（见[超时协议](#超时协议)）即停手，等系统完成通知或 watchdog 死因，两载体（subagent / herdr）统一，skill 里不存在任何轮询

## 模型

四角色统一显式 `sonnet`（分派时 `model: "sonnet"`）。不按复杂度选档、不继承主会话模型（主会话模型可任意切换，继承会让 subagent 行为不可预期）。

## 红线

控制者的行为规则（角色 agent 的红线见 `reference/` 下各分派模板）：

**分派前**
- 只有 unblocked 的 issue 才分派；跨 issue 并行 ≤4（信号量，Implementer 与 Reviewer 合计占坑）；同 issue 内 Implementer→Reviewer 严格串行；跨 issue 流水线——某 issue 的 Implementer 完成即触发其 Reviewer，不等本轮其他 issue
- **主窗口预算**：模板自加载 + 寻址注入（见[主窗口预算](#主窗口预算)），控制者不代读 issue / CONTEXT.md / 规范文件，不复制模板全文
- 分支名必须用 Planner 输出的确定性 `afk/issue-{N}`，不另造名称

**控制者角色**
- 控制者只做编排——分派、验收 `<plan>` 落盘、按 DAG 拓扑序切片每轮 unblocked、验证、异常处置，**不写实现代码**；发现产出 bug 时分派修复 agent，主会话不直接改代码
- **禁轮询**：通知驱动等待——分派后挂 watchdog 即停手（机制见[超时协议](#超时协议)），herdr 模式也不例外
- agent 直接进入 TDD，不做 seam 等待确认；无 Seam 预确认环节
- Reviewer 一次性自改：在 Implementer 的 worktree / branch 上直接改代码 + 跑测试 + commit，同 worktree 同 branch 线性叠加 commit
- **绝不关闭或改 label 任何本流程未实现合入的 issue**（含判定失败的下游与父 PRD）——存废由 owner 决定；判定类 ticket 自身的关闭例外见[依赖解析](#依赖解析)

**本地拓扑 merge（不推送、不建 PR）**
- 唯一权威 merge 方式：主仓库（已检出 `${TARGET_BRANCH}`）内 `git merge <branch> --no-edit`；**不在 worktree 内执行**（git 禁止同一分支在两个 worktree 同时检出）；`wt` 的 merge 子命令不再作为权威
- `git push origin ${TARGET_BRANCH}` 在任何情况下都不执行；`gh pr create`、Web UI 合并或任何远程 merge 都是违规
- 本地 `${TARGET_BRANCH}` 与 `origin/${TARGET_BRANCH}` 分歧时保留分歧，不 merge origin、不解决冲突——分歧是预期状态，由项目维护者决定何时同步
- merge 冲突解决、删分支与 worktree 清理等 Merger 执行细则见 [reference/merger-prompt.md](reference/merger-prompt.md)；验证清单见 SKILL.md 阶段 3

**worktree 与 Agent 环境**
- 统一用 `wt switch -c afk/issue-{N} -b ${TARGET_BRANCH}` 创建 worktree（不用 `git worktree add`）
- 分派 Agent 时不带 `isolation` 参数——worktree 已由 `wt switch -c` 创建

## 状态处理

`<promise>COMPLETE</promise>` 与 `DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED` 的关系（权威信号 vs 自然语言摘要）见[协议机制](#协议机制)。

| 状态 | 控制者动作 |
|------|-----------|
| `DONE` + `<promise>COMPLETE</promise>` | 触发下一阶段（Implementer→Reviewer；Reviewer→Merger；Merger→下一轮控制者切片） |
| `DONE_WITH_CONCERNS` | 阅读疑虑，正确性相关→分派修复 agent（不手动修）；能力相关→下轮换强模型 / 拆分 / 上报 |
| `NEEDS_CONTEXT` | 保留 worktree，提供缺失信息后重新分派（同分支，进度保留） |
| `BLOCKED` | 保留 worktree，评估原因后：补上下文 / 换强模型 / 拆分 issue / 上报。**绝不忽视** |
| 失败 / 超时判死 | 见[恢复机制](#恢复机制)——落盘 runbook + 标 `failed`，**零自动重试** |

Merger 后验证两件事（CLOSED / 无残留 worktree）见 SKILL.md 阶段 3。

## 超时协议

**watchdog（两载体统一，唯一超时机制）**：每次分派挂一个后台 watchdog 脚本盯 worktree 文件系统活性，600s 无活性才判死；取代一次性计时器与复杂度分级表（已删）。

契约（`scripts/watchdog.sh <worktree> [idle秒=600]`）：

- **信号源**：worktree 内文件 mtime + `.git` reflog 时间，取最新。已知差距——盯文件活性而非 stdout 行流（Agent 工具不暴露子代理流式输出），agent 长时间纯思考不落盘会误判，600s 阈值下概率低
- **阈值**：600s（抄 sandcastle `DEFAULT_IDLE_TIMEOUT_SECONDS = 10 * 60`）
- **生命周期**：分派时以 `run_in_background: true` 挂起，静默循环零输出；idle 超时 → exit 1 + 一行死因（哪个 worktree、idle 多久），后台任务退出即系统通知唤醒控制者
- **控制者配合**：分派后**立即停手**；agent 正常完成（系统完成通知先到）→ 杀掉对应 watchdog；watchdog 死因先到 → 判 `AgentIdleTimeoutError`，`TaskStop` 终止 agent 后进[恢复机制](#恢复机制)
- **职责边界**：watchdog 只防挂死；正常结束 / 报错由系统通知接管。herdr 模式同一套 watchdog（pane 无系统完成通知，但 watchdog 退出通知一样到控制者；完成信号由 herdr agent 汇报承载，详见 herdr skill）
- **显式排除 completion grace**：sandcastle ADR 0019 的 60s grace 场景是「signal 已发出但进程挂起不退」，本架构的完成终点是进程已退的系统通知，中间态不存在

**失败判定三触发点**：agent 抛错（`AgentError`）/ watchdog 判死（`AgentIdleTimeoutError`）/ 正常结束但分支 commit == 0（空产出，按 `AgentError` 处理）。错误词汇借 sandcastle 的错误类型名。

## 恢复机制

**零自动重试**（对齐 sandcastle fail-fast，修订 ADR 0001「原地重试」条款，见 ADR 0002）：失败即标 `failed`，**不自动重派、不无限重试**——AFK 场景下原地无限重试意味着用户回来时面对烧了数小时 token 的死循环。

- **现场保全**：worktree 不删、branch 不动、永不 `reset --hard`——含未提交改动全部原样保留，随时可人工接手
- **落盘 runbook** `docs/afk-failures/issue-{N}.md`：

  ```
  branch:   afk/issue-{N}
  worktree: <绝对路径>
  commits:  <git log --oneline 快照>
  error:    AgentIdleTimeoutError | AgentError
  失败摘要: <错误原文末尾摘录>

  ## 恢复
  重新分派，prompt 末尾附：
  Read docs/afk-failures/issue-{N}.md 了解前次失败，同分支继续，复用已 commit 进度。
  ```

- **不传染下游**：失败 issue 标 `failed` 后其余 unblocked issue 照常调度，DAG 上其它节点按原 `blocked_by` 推进——单点失败不阻塞整轮
- **恢复（单路径）**：同分支同 worktree 重新分派，prompt 末尾附 runbook「## 恢复」段的指引句。确定性分支名 `afk/issue-{N}` + worktree 复用让已 commit 进度自动捡回；重派 agent 读到前次 runbook，不以同样方式再死一次（被否方案与理由见 ADR 0002）
- **处置权在人**：收尾把 `afk-failures/` 完整清单交用户逐条决定恢复或放弃（见[收尾流程](#收尾流程)）
- 会话 compact / `--resume` 后：Read `docs/afk-plan.json` 重建 DAG 与各节点 `status`；分支名确定性 + `gh issue view <N> --json state` 可交叉复核真实进度，不依赖会话记忆

## scripts 契约

`skills/personal/afk-issue-loop/scripts/` 下 3 个 bash 脚本（plan 相关两个用 jq；`scripts/tests.sh` 为纯 bash 断言测试）：

| 脚本 | 用法 | 契约 |
|------|------|------|
| `validate-plan.sh` | `validate-plan.sh <plan.json>` | 校验 Planner 落盘的 DAG：schema（`number`/`title`/`branch`/`blocked_by`）、branch 匹配 `afk/issue-\d+`、`blocked_by` 引用存在、无环；exit 0 合法 / exit 1 + 错误行指明问题（有环时报出成环节点）。plan 验收不再靠 LLM 肉眼（compact 后尤其不可靠） |
| `watchdog.sh` | `watchdog.sh <worktree> [idle秒=600]` | 静默循环零输出；idle 超时 exit 1 + 一行死因。契约全文见[超时协议](#超时协议) |
| `dispatched-count.sh` | `dispatched-count.sh <plan.json>` | 输出 `status=="dispatched"` 节点数，控制者比对 ≤4 并行信号量 |

遵循「sandcastle 没有就不要」——拓扑切片、status 状态机、收尾验证、分派锁均不做（分派锁对齐的 ADR 0007 在 sandcastle main 分支未实现）。

## 并行冲突处理

- 并发纪律（跨 issue ≤4 流水线 / 同 issue 内严格串行）见[红线](#红线)「分派前」
- 空间冲突的 issue 由 Planner 判为 blocked 避免并发；已并行的重叠分支由 Merger 统一合并时解决（冲突处理规则见 [reference/merger-prompt.md](reference/merger-prompt.md)）

## CONTEXT.md 缺失策略

- 控制者基于 `CLAUDE.md` + `docs/adr/` 创建 `CONTEXT.md`
- 或跳过创建：模板已指引 agent 在 `CONTEXT.md` 缺失时改读 `CLAUDE.md` + `docs/adr/`（寻址注入，agent 自取，控制者不拼接内容）

## 收尾流程

所有 issue 实现完成后，报告统计（实现了几个 issue、生成几个 merge commit 与 summarizing commit），并列出因判定类 ticket 失败而保持 open、需 owner triage 的下游 ticket；**把 `docs/afk-failures/` 完整清单交用户逐条处置**（每条按手册恢复重派，或人工接手 / 放弃后清理 worktree），用户处置完毕前不删 `afk-failures/`；删除目标项目 `docs/afk-plan.json`（运行时临时文件，不 commit；`docs/` 若因此为空可一并删）；然后按 SKILL.md 末尾的提示语建议用户 code review 和 QA。如有新 issue，提示可再次运行 `/afk-issue-loop`。
