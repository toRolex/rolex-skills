---
name: afk-issue-loop
description: 处理指定 GitHub Ticket；未指定时批量处理 open `ready-for-agent` Tickets，按依赖实现、审查并流式合并。
disable-model-invocation: true
argument-hint: "[issue-number ...] [mode=subagent|herdr]"
---

# AFK Issue Loop

借鉴 sandcastle 四角色；本地增强为原生 Execution DAG、四槽流式调度与证据驱动恢复。Worktrunk 管理隔离 worktree。控制者只编排，不写实现代码。[上游事实与差异](../../../docs/research/sandcastle-vs-afk-sequence.md)。

## 角色

| 角色 | 顺序 | 完成边界 |
|---|---|---|
| Planner | 开头一次 | plan 通过结构与 GitHub live 校验 |
| Implementer | 每 Ticket | 全量测试通过、语义原子 commits、COMPLETE |
| Reviewer | 同 Ticket、Implementer 后 | 同现场一次性自改、全量测试通过、COMPLETE |
| Merger | reviewed Ticket 即时排队，串行处理 | 精确输入已合并、测试/summary/关闭/仅该 Ticket 清理均验证 |

角色默认 Sonnet；同一恢复单元同 stage 首次可重试失败升 Opus，详见[模型与证据](REFERENCE.md#模型与证据)。仅在实际分派接口支持时设置模型，不以 prompt 冒充模型选择。

## 0. 建立运行参数

1. 提取 issue numbers 与 mode；默认 `subagent`，数量超过 5 无额外确认。显式 `mode=herdr` 可用；默认载体无法复用现场时明确报告并等待，不自动改用 Herdr。
2. 按[运行时文件与 clean 边界](REFERENCE.md#运行时文件与-clean-边界)检查。新运行生成 `RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)-$$`；恢复按[分派记录](REFERENCE.md#现场所有权与分派记录)核对现场，沿用 run_id、mode、目标分支；仅 plan 已验收时跳过 Planner。
3. 新运行输入非空即 roots，否则 Planner 扫描全部 open `ready-for-agent`。恢复从已验收 plan 取 roots；Planner 未完成则从分派记录恢复初始输入。
4. 新运行本地或远程存在 develop 时用 develop，否则 main。检查 gh、jq、wt；角色按[领域上下文](REFERENCE.md#contextmd)读取材料。
5. 新运行在 Planner 前、恢复在重派前完成[载体选择](reference/workspace-binding.md#控制者选择载体)。Herdr 模式先检查 `HERDR_ENV=1`，调用 `Skill("herdr")`，再加载[跨 session 通信协议](reference/peer-messaging.md)：Herdr 管生命周期，ListAgents/SendMessage 管业务通信；需要布局再加载 herdr-instances。

**完成标准**：RUN_ID、ISSUE_NUMBERS、MODE、TARGET_BRANCH 已确定且载体可用、现场获授权；否则如实等待。

## 1. Planner 建图

所有分派遵守[现场绑定](reference/workspace-binding.md#控制者启动角色)。Planner 首次启动前，主仓库 clean 且旧写者退出，才检出 TARGET_BRANCH：本地已有则 switch；仅远端存在则建立 tracking 分支。失败保留现场报告，不抢占其他 worktree；恢复 dirty 现场先核对所有权。

```text
Read ~/.claude/skills/afk-issue-loop/reference/planner-prompt.md 获取完整指令并执行。
参数：RUN_ID=${RUN_ID}, ISSUE_NUMBERS={逗号分隔，可空}, TARGET_BRANCH=${TARGET_BRANCH}, REPO={主仓库绝对路径}
```

Planner 读取原生 parent/sub-issue 与 blocked_by：递归纳入 open blockers；每个 open 执行节点要求 ready-for-agent；parent SPEC 只供上下文。显式 CLOSED root 保留 `done/merge` 并标记 `done_source: initial_closed`，只审计跳过，不声称已合并。

任何 BLOCKED 先按[真实原因分流](REFERENCE.md#blocked-分流)：输入资格不合格终止且不执行旧 plan；现场身份错误修正后重派；权限等授权阻塞等待。

```bash
bash ~/.claude/skills/afk-issue-loop/scripts/validate-plan.sh \
  --expected-run-id "${RUN_ID}" --expected-roots "${ISSUE_NUMBERS}" \
  --live docs/afk-plan.json
```

**完成标准**：exit 0，roots 与 open blockers 闭包完整且唯一；登记 plan_accepted=true 后才执行 Tickets。

## 2. 流式调度

每个当前 attempt 通知验收后运行一次控制循环，按[进度快照](REFERENCE.md#进度快照)报告。调度规则以[状态与槽位](REFERENCE.md#状态与槽位)为准。

1. Read plan 和 dispatch，核对通知身份、旧写者退出及阶段门槛。
2. Implementer 完成推进同现场 Reviewer；Reviewer 完成固定 reviewed SHA 与 review base SHA，置 dispatched/merge 并立即入队。
3. Merger 空闲且主仓库可安全交接时，从已就绪队列取一个 Ticket 分派步骤 3；不等待其他 Implementer、Reviewer 或 recovering Ticket。
4. 运行 dispatched-count；从 pending 中选 blocked_by 全部 done 的 frontier，按 issue number 排序，用剩余 `4 - active` 槽即时补位。新 worktree 基于最近已验证目标提交；Merger 正在更新目标时，串行化 Worktrunk 元数据操作，待安全点创建，其他活动角色仍继续。
5. 没有可分派工作时等待通知：四槽已满如实等待（recovering/授权等待/等 merge 都占槽），不得开第五个。全 done 才收尾；无活动且 pending 无合法 frontier 则校验并报告状态违规。

### Worktrunk 与交接

控制者创建/复用 `afk/issue-{N}`，从 `wt switch` JSON 获取绝对路径。新 branch 用 `wt switch -c afk/issue-{N} -b TARGET_BRANCH --no-cd --format=json`；已有 branch 用不带 -c 的 switch。Git 管 commit/merge，Worktrunk 管生命周期。

分派前原子登记 Ticket、stage、attempt、模型、现场和 runbook；返回后补任务标识并挂 watchdog。交接确认旧角色及写入子进程已退出。Implementer 至少有相对其固定实现基线的 commit；Reviewer 完成后该 Ticket 仍占原槽。

### 恢复

失败按[自动恢复](REFERENCE.md#自动恢复)保留 branch、worktree、stage、槽位与证据。独立任务使用剩余槽继续，不设置恢复次数上限，也不将“无限恢复”解释为无证据忙重试或绕过权限。

**完成标准**：每个可推进事件均已处理；可用槽已分派或有具体等待原因。无需全体 reviewed 的 barrier。

## 3. 串行 Merger

按[Merger 契约](REFERENCE.md#merger)在主仓库 TARGET_BRANCH 分派唯一 Merger，传入单 Ticket 合并单元及其精确输入。恢复遵守[Merger 恢复](REFERENCE.md#merger-恢复)。主仓库始终单写者。

完成后控制者核对精确 reviewed SHA 的 ancestor、测试对应目标 SHA、summary SHA、GitHub CLOSED、该 Ticket worktree 已移除、主仓库 clean。全部通过且 Merger 退出后原子置 `done/merge, done_source: merged`，释放该槽，立刻回步骤 2 解锁下游。

**完成标准**：该合并单元完整验收；例如 A→C、B 独立，A done 后立刻启动 C，不等 B。A 清理未完成则仍占槽、不解锁 C。

## 4. 收尾

1. 对 plan 中每个 SPEC 分页读取全部原生 sub-issues；全部 CLOSED 且 SPEC OPEN 才关闭。
2. 全部节点 done；initial_closed 只核对关闭事实、计入跳过审计。仅本次实际执行 Ticket 要求 merge/测试/关闭/清理证据，且只清理其登记的 worktree；其他运行或活动 worktree 保持不动。
3. 按准确路径清单清理本次已完成用途的 plan、dispatch 与 runbooks；中断或未完成时保留恢复记录。
4. 分开报告本次完成数、初始 CLOSED 跳过数、merge/summary commits、关闭的 SPEC；提示 code review 与 QA。

**完成标准**：本次执行 Ticket 均完成；初始 CLOSED 不冒充本次合并；本次登记残留已处理，其他现场不受影响。

## 按需 Reference

- 关系、状态、恢复或 watchdog：[REFERENCE.md](REFERENCE.md)
- 具体场景演练：[EXAMPLES.md](EXAMPLES.md)
- 角色分派：[planner](reference/planner-prompt.md) / [implementer](reference/implementer-prompt.md) / [reviewer](reference/reviewer-prompt.md) / [merger](reference/merger-prompt.md)
- 校验与测试：[scripts/](scripts/)
