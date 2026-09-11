# AFK Issue Loop — Reference

执行顺序见 [SKILL.md](SKILL.md)。本文件定义输入、状态和安全边界；角色只加载自身模板。

## 输入闭包

- roots 为显式编号去重，或首次分页扫描的全部 open `ready-for-agent` Issues（过滤 `pull_request`）。显式 PR 是输入错误。
- 控制者逐个读取完整 Issue、labels、原生 parent 和 blocked-by；递归纳入所有 open blockers。每个开放执行节点必须有 `ready-for-agent`，缺资格报告具体节点，不能当成普通依赖等待。
- 数组端点用 `gh api --paginate --slurp` 取全页；检查响应结构、仓库归属和状态，失败/截断/非法 JSON 不当空数组。执行节点编号按当前仓库解析，跨仓依赖不受当前编号 schema 支持，明确报告而非误映射。

```text
GET /repos/{owner}/{repo}/issues?state=open&labels=ready-for-agent&per_page=100
GET /repos/{owner}/{repo}/issues/{number}/parent
GET /repos/{owner}/{repo}/issues/{number}/dependencies/blocked_by?per_page=100
GET /repos/{owner}/{repo}/issues/{number}/sub_issues?per_page=100
```

只有明确的无 parent 404 可解释为无父节点；其他读取错误报告。父 SPEC 去重进入 `specs`，不与执行节点重叠；显式 SPEC 或 SPEC blocker 不能作为代码 Ticket 执行。文本依赖缺少相应原生关系、关系自环/循环或缺节点时停止并报告，不猜测补图。

初始 CLOSED root 为 `done_source=initial_closed`，不递归其 blockers、不执行/清理历史现场，不计本次交付。closed blocker 通常已满足、不纳入初始边；**本次或相关历史中已知未验收成果优先于 CLOSED**，须核实交付，否则阻塞对应依赖，不用关闭事实冲掉责任。

每批前重新读取候选的资格和完整 live blockers，递归补齐新开放依赖并检查循环。原始 roots 和 `blocked_by` 保留为审计图，新发现边追加且去重；每个节点的 `live_blocked_by` 保存最新有效的开放依赖。初始两者相同，后续旧边删除只从 live 数组移除。审计边的历史并集可能成环，循环检测只针对 live 图；闭包归属通过审计图追溯。就绪依据最新 GitHub 关系与交付账本，不仅看旧图 `done`：重新 OPEN 的 blocker 不沿用旧 done；skipped 和已知未验收成果即使 CLOSED 也不能解锁。当前 live 图有环或新节点不合格则停止建批。默认 roots 本次固定，不每批吸入新的无关 Tickets。

## 状态与批次

运行记录分为图 `plan` 与薄的 `dispatch`；以下 schema 是本实现的内部约定，不是 spec 指定的公共 API。`version=2` 明确拒绝旧恢复状态，保留脚本路径以便调用。

```json
{
  "version": 2,
  "run_id": "20260912T120000Z-12345",
  "target_branch": "main",
  "roots": [42],
  "specs": [],
  "batch": {"id": 0, "phase": "idle", "tickets": []},
  "issues": [
    {"number": 42, "title": "Ticket", "branch": "afk/issue-42", "spec": null,
     "blocked_by": [], "live_blocked_by": [], "status": "pending", "stage": "implement", "writer": "none"}
  ]
}
```

| 字段 | 契约 |
|---|---|
| status | `pending` 未尝试（可依赖阻塞）；`dispatched` 当前批实现/审查/等合并；`skipped` 本次失败、不再派；`done` 已验收交付或初始关闭审计 |
| stage | `implement` / `review` / `merge`；pending 只 implement，done 只 merge |
| writer | `none` 未启动、`active` 写者活动、`unknown` 退出不明、`exited` 有覆盖写者的退出证据；失败和 writer 独立 |
| done_source | done 必填 `initial_closed` / `merged`，其他状态不允许；merged 仅证明交付，不要求清理完成 |
| failure | skipped 必填简短原因；阶段、成果、现场及退出证据在 dispatch 关联 |
| batch | id 单调递增；phase 为 `idle` / `pipelines` / `merging` / `settled`；tickets 为固定、唯一的最多四个编号 |

批次创建后成员不增不换；Implementer→Reviewer 串行，Ticket 间并发。所有管线都得到成功/失败结果才进入 merging；一个批次最多一次 Merger，dispatch 在启动前记录其 intent。settled 后才能建立下一批。skipped 在整个 RUN_ID 下单调累积；旧失败现场退出不明可以跨批保留，**不算下一批成员，但不是释放现场**。

计数脚本输出当前未 settled 批次成员数（含本批已失败/等合并项），不是存活进程数或可补位数。另外报告 active/unknown 写者及冻结资源；四是单批 Ticket 容量，不能据逻辑计数判断写入安全。

## 阶段验收

- Implementer：验收项实现、固定实现基线可核对、存在可交付变化和语义 commits、要求的测试通过、现场 clean。正常返回、COMPLETE 或单纯有 commit 均不够；无交付变化明确 skipped（原因 no-deliverable），不进入 Merger。
- Reviewer：完整实现 diff 已审查，正确性/安全/类型/回归/相邻接口问题已修正，要求的全量测试通过且对应 reviewed SHA/tree；记录 review base、reviewed SHA、审查结论及证据路径。Reviewer 无新增 commit 可以成功。
- Merger 入选：仅本批实现与审查都验收通过、写者已退出的精确分支；实现/审查失败不退回只合实现。目标基线变化由 Merger 复核完整 Ticket diff 和新集成结果，旧测试不能替代新目标验收。
- 交付：精确 reviewed SHA 在目标历史中，实际 result/summary 与受测 tree 一致、目标 clean，无未解决冲突；Issue 关闭及现场清理单独记录。

测试职责针对实际业务 Tickets；遵循用户针对具体 Ticket 的显式测试限制，未测试要如实记录、不能伪造通过或自动弱化其他验收门槛。权限拒绝原样报告动作和范围，不换角色、模型、载体或权限绕过。

## 记录与再次调用

控制者独占 plan/dispatch，原子写入。登记本次运行文件的准确绝对路径（例如 `REPO/docs/afk-RUN_ID/` 下 plan、dispatch 和各角色结果），不得暂存进业务 commits；路径已存在先读、不可覆盖用户或其他运行材料。角色只写其独占 `RESULT_PATH`，控制者核对后引用，完整代码日志留在角色或结果文件。

薄 dispatch 至少关联：RUN_ID、mode、repo/target、roots；批次成员及 Merger 是否已派；每个 Ticket 的任务身份、stage、模型偏好/实际已知模型、branch/worktree、固定实现基线、审查/交付 SHA、测试与结果地址、失败原因、writer/退出与隔离证据；`delivered`、`issue_closed`、`cleanup` 分别记录。cleanup 可为 pending/done/blocked，不影响 delivered。共享目标另记 writer、最后验收 SHA 及未验收修改。

分派前写 intent，启动后补宿主稳定 task ID。启动报错且副作用未知先只读核对，不重复派发。通知以 run+batch+Ticket（Merger 为批次）+stage+task ID 关联；该阶段已处理则重复/旧通知不再推进。无需新信封、双向消息总线或中途 ACK。正常路径使用宿主现有启动和通知；单顶层 workflow 必须包含完整批次循环。

同次续接保留所有 skipped、批次边界及任务 ID，查询既有任务，不重复发送工作。下一次明确调用才重新评估失败 Ticket：读 GitHub、refs、原始基线、成果和相关占用；活着的旧任务不接管、不复写。已有有效 commits 可在确认退出、所有权和新尝试基线后利用，不能把当前 HEAD 伪装为原始实现基线。dirty 不自动覆盖/清空。

旧 version=1/recovering/runbook 只供事实核对，不机械迁移成新任务，不修改正在运行的旧会话。仅冻结有关系的 branch/worktree/目标资源；无关历史不阻塞所有新工作。已证明 delivered 的成果不重新实现；待关闭、待清理只做必要安全收尾。已关闭未验收仍保留交付责任。

再次调用遇到 CLOSED 但账本已知未验收：首次 live 快照中的 `initial_closed` 只证明关闭事实，不能解锁依赖或计交付。先将该审计事实与旧证据保存在 dispatch；只读核对可证明已经交付则仅收尾。若仍需尝试，仅当 Ticket 属于本次明确输入/授权闭包、有 `ready-for-agent` 资格、原始基线与现场归属可核对、旧写者已退出且当前依赖满足时，控制者在运行中将其转为 `pending/implement`、移除 `done_source` 并沿用已核对成果，采用离线结构校验及 live 关系核对。缺任一条件则保留未验收责任并报告阻塞；不自动 reopen Issue，不把任意 CLOSED 输入都重新执行。同次调用已经 skipped 的项不适用此转换。

## 有限停止与隔离

明确失败立即 skipped；仍在正常尝试中的调试测试可继续，但失败后不再启动替代 Implementer、Reviewer 或 Merger，不自动升级模型。普通工具安全失败处理不等于重跑 Ticket，副作用未知先核对。

失败需停止时，使用宿主原生停止/状态机制；在开始观察时记录有限期限或有限观察次数及依据，按宿主可用终止机制选择，不反复延长。到界仍不明则 writer=unknown、保存现场和相关证据，返回可见阻塞；不把文件 mtime、idle、STOP 受理或业务 COMPLETE 当退出。

宿主明确保证覆盖相关写者及子进程的终态通知可作为退出证据，不强制额外握手/进程探针；保证不覆盖的外部写者需另核实。同现场交接/清理必须先确认旧写者退出。

allSettled 等管线分类，不无限等未知退出。仅在**已知隔离边界证明未知写者无法影响成功项、目标分支及相关共享 Git 元数据操作**时，才合并独立成功集并建下一批；不同 worktree 路径本身不证明隔离，因为 refs/元数据共享。无法证明则有限观察后结束并报告阻塞，保留全部受影响占用。目标存在冲突、未知写者或未验收修改时暂停后续合并；不 reset/abort 来掩盖失败，也不往污染现场叠加。

## Clean 与收尾

Clean 指除准确登记的运行文件外，无未提交/暂存差异、未跟踪交付物或未解决 merge；不豁免整个 docs/ 或所有 untracked。新目标现场 dirty 则报告，不擅自清空。Git 管 refs/commit/merge，Worktrunk 管 worktree 生命周期；操作时加载对应 skill，串行处理共享元数据。

Merger 将每项交付证据写到独占结果文件后再关闭对应 Issue，不关闭其他 Ticket。控制者最终通知后核对并持久化，确认写者退出才负责机械清理：只移除已交付、归属明确、tip 与记录一致、clean 的登记现场，保留其他运行/初始关闭历史现场。清理失败记录 blocked 并结束该项收尾，不重派业务。保留可寻址交付凭据，不能删除唯一证据后靠 summary message 猜测成功。

沿用不 push、不创建 PR、不自动同步 origin 的交付边界。SPEC 关闭由控制者按主流程单独核对。

## Scripts

- `validate-plan.sh [--expected-run-id ID] [--expected-roots N,N] [--live] PLAN`：内部 schema、批次、唯一性、闭包与无环；live 只校验首次 pending/initial_closed 快照。运行中 live 资格、文本关系冲突、隔离、SHA/测试真实性和跨快照状态单调性由控制者核对，静态校验不能证明业务验收。
- `dispatched-count.sh PLAN`：先离线校验，再输出当前未 settled 批次成员数；不授权补位或回收现场。

`tests.sh` 仅保留既有离线结构/闭包断言并适配夹具，旧协议部分退役；本次未新增或运行测试，不作新批次流程已验证的依据。
