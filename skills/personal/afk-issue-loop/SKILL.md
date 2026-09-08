---
name: afk-issue-loop
description: 处理指定 GitHub Ticket；未指定时批量处理 open `ready-for-agent` Tickets，按依赖实现、审查并合并。
disable-model-invocation: true
argument-hint: "[issue-number ...] [mode=subagent|herdr]"
---

# AFK Issue Loop

以 sandcastle `parallel-planner-with-review` 为基准，用 Worktrunk 管理隔离 worktree：Planner 一次建图，Ticket 管线并行执行，Merger 按批次拓扑合并。控制者只编排，不写实现代码。

## 角色

| 角色 | 顺序 | 完成边界 |
|---|---|---|
| Planner | 开头一次 | `docs/afk-plan.json` 已通过结构与 GitHub live 校验 |
| Implementer | 每 Ticket | 全量测试通过、语义原子 commits 已写入分支、输出 `<promise>COMPLETE</promise>` |
| Reviewer | 同 Ticket、Implementer 后 | 一次性自改完成、全量测试通过、输出 `<promise>COMPLETE</promise>` |
| Merger | 每批 barrier 后 | 各分支已拓扑合并、测试通过、summary commit 已写、Ticket 已关闭、worktree 已清理 |

四角色统一使用 `model: "sonnet"`。角色 prompt 只传模板路径和参数；角色自行读取 Ticket、父 SPEC、领域文档与仓库规范。

## 0. 建立运行参数

1. 从参数提取 issue numbers 与 `mode`；`mode` 默认 `subagent`。
2. 按 [运行时文件与 clean 边界](REFERENCE.md#运行时文件与-clean-边界) 检查主仓库与既有运行文件。新运行生成 `RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)-$$`；恢复会话按 [现场所有权与分派记录](REFERENCE.md#现场所有权与分派记录) 重建当前批次，沿用 `run_id`、mode 和目标分支，跳过 Planner。
3. 仅新运行：issue numbers 非空时作为初始 Tickets；为空时由 Planner 扫描全部 open `ready-for-agent` Tickets。恢复时 roots 来自已有 plan。
4. 仅新运行：本地或远程存在 `develop` 时使用 `develop`，否则使用 `main`。
5. 检查 `gh`、`jq`、`wt` 可用，并按 [REFERENCE.md：CONTEXT.md](REFERENCE.md#contextmd) 处理领域上下文。
6. `mode=herdr` 时调用 `Skill("herdr")` 获取操作契约；需要布局时再调用 `Skill("herdr-instances")`。两种载体使用同一角色 prompt 与 watchdog。
7. 未显式指定 mode 且初始 Tickets 多于 5 个时，向用户确认载体。

**完成标准**：`RUN_ID`、`ISSUE_NUMBERS`、`MODE`、`TARGET_BRANCH` 均已确定，所需 CLI 可用。

## 1. Planner 建立 Execution DAG

按载体分派 Planner；prompt 只包含：

```text
Read ~/.claude/skills/afk-issue-loop/reference/planner-prompt.md 获取完整指令并执行。
参数：RUN_ID=${RUN_ID}, ISSUE_NUMBERS={逗号分隔，可空}, TARGET_BRANCH=${TARGET_BRANCH}
```

Planner 从 GitHub 原生 parent/sub-issue 与 `blocked_by` 关系构图：

- open blocker 递归纳入；closed blocker 视为已满足；
- 每个 open Ticket 必须带 `ready-for-agent`；
- 父 SPEC 只进入 `specs` 上下文，不进入 `issues` 执行节点；
- 显式输入中的 closed Ticket 以 `status: "done"` 记录，支持中断后续跑。

Planner 输出 `BLOCKED` 时，控制者立即终止本次运行并报告缺少标签的 blocker；本次不读取或执行磁盘上的 plan。

控制者验收：

```bash
bash ~/.claude/skills/afk-issue-loop/scripts/validate-plan.sh \
  --expected-run-id "${RUN_ID}" --expected-roots "${ISSUE_NUMBERS}" \
  --live docs/afk-plan.json
```

Plan schema、原生关系与状态机见 [REFERENCE.md：Execution DAG](REFERENCE.md#execution-dag)。

**完成标准**：校验 exit 0；`docs/afk-plan.json` 包含全部初始 Tickets 与开放 blocker 递归闭包，每个执行节点恰好一次。

## 2. 执行 Ticket 批次

重复以下控制循环；建批、进入 barrier 等待、发生恢复/权限阻塞或用户询问时，按[进度快照](REFERENCE.md#进度快照)汇报：

1. Read `docs/afk-plan.json`。
2. 运行 `dispatched-count.sh docs/afk-plan.json`；`dispatched + recovering ≤ 4`。
3. 若当前批次已有节点，等待这些节点全部到达 `stage: "merge"`；期间由通知驱动推进各 Ticket 的 Implementer → Reviewer 管线。
4. 若当前批次为空，从 `pending` 中选择所有 `blocked_by` 均为 `done` 的 frontier，按 issue number 稳定排序，最多分派 4 个。
5. frontier 为空时：
   - 存在 `dispatched` / `recovering` → 等通知；
   - 所有节点 `done` → 进入收尾；
   - 仍有 `pending` → plan 状态违规，重新运行校验并报告。

### 准备 Worktrunk worktree

控制者始终负责创建或复用 worktree，并从 JSON 输出取得绝对路径：

```bash
if git show-ref --verify --quiet refs/heads/afk/issue-{N}; then
  wt switch afk/issue-{N} --no-cd --format=json
else
  wt switch -c afk/issue-{N} -b ${TARGET_BRANCH} --no-cd --format=json
fi
```

Git 负责 commit 与 merge；Worktrunk 负责 worktree 创建、复用、查询与清理。

### 分派管线

- 将节点置为 `status: "dispatched", stage: "implement"`，分派 [Implementer](reference/implementer-prompt.md)。
- Implementer 完成且分支相对 `${TARGET_BRANCH}` 有 commit 后，将 `stage` 改为 `review`，在同 worktree 同 branch 分派 [Reviewer](reference/reviewer-prompt.md)。
- Reviewer 完成后，将 `stage` 改为 `merge`；该 Ticket 继续占用本批次槽位，等待 barrier Merger。
- 每次分派按 [现场所有权与分派记录](REFERENCE.md#现场所有权与分派记录) 登记当前实例并挂 [watchdog](REFERENCE.md#watchdog)，随后停手等通知；阶段交接以旧写入者退出为前提。

### 自动恢复

授权受阻时先走[权限门](REFERENCE.md#权限门)。角色抛错、watchdog 超时核实后确认停滞、缺少完成信号或 Implementer 空产出时，按[自动恢复](REFERENCE.md#自动恢复)选择原角色的恢复路径；Ticket 保持原槽位与依赖阻塞，批内其他管线继续。

**完成标准**：当前批次每个节点均为 `status: "dispatched", stage: "merge"`，且其 branch 已通过 Implementer 与 Reviewer 的完成门槛。

## 3. Barrier Merger

当前批次全部到达 `stage: "merge"` 后，在主仓库检出 `${TARGET_BRANCH}`，分派 [Merger](reference/merger-prompt.md)，传入 `RUN_ID`、批次分支、Ticket numbers、主仓库绝对路径与目标分支。

Merger 失败时按 [Merger 批次恢复](REFERENCE.md#merger-批次恢复)继续；控制者保持编排职责。

Merger 完成后，控制者逐项验证：

1. 每个 Ticket：`gh issue view <N> --json state --jq .state` 为 `CLOSED`；
2. 每个 Ticket worktree 不再出现在 `wt list --format=json`；
3. 每个节点置为 `status: "done", stage: "merge"`。

**完成标准**：本批次全部节点为 `done`；随后返回步骤 2 计算下一批 frontier。

## 4. 收尾

1. 对 plan 中每个 SPEC 查询全部原生 sub-issues；全部 CLOSED 且 SPEC 仍 OPEN 时关闭 SPEC。
2. 验证全部执行节点 `done`、全部 Ticket CLOSED、全部 `afk/issue-{N}` worktree 已清理。
3. 按 [运行时文件与 clean 边界](REFERENCE.md#运行时文件与-clean-边界) 清理本次 plan、分派记录与已处理 runbooks。
4. 报告 Ticket 数、merge commits、summary commits 与关闭的 SPEC。
5. 提示用户进行 code review 与 QA。

**完成标准**：每个 Ticket 已合并并关闭；满足关闭条件的 SPEC 已关闭；无 AFK worktree 或运行时文件残留。

## 按需 Reference

- **关系、状态、恢复或 watchdog 分支**：[REFERENCE.md](REFERENCE.md)
- **需要完整运行示例时**：[EXAMPLES.md](EXAMPLES.md)
- **分派角色时**：[planner](reference/planner-prompt.md) / [implementer](reference/implementer-prompt.md) / [reviewer](reference/reviewer-prompt.md) / [merger](reference/merger-prompt.md)
- **验收 plan、槽位或 watchdog 时**：[scripts/](scripts/)
