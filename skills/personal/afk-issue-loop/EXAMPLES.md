# AFK Issue Loop 示例

具体演练；权威契约见 [REFERENCE.md](REFERENCE.md)。

## 原生关系与初始 CLOSED

运行 `/afk-issue-loop 42 44 45`。#42 初始 CLOSED，#44 blocked by #43，#43/#44/#45 open ready-for-agent，#45 独立。

```json
{
  "version": 1,
  "run_id": "20260829T120000Z-12345",
  "target_branch": "main",
  "roots": [42, 44, 45],
  "specs": [],
  "issues": [
    {"number": 42, "title": "Closed input", "branch": "afk/issue-42", "spec": null, "blocked_by": [], "status": "done", "stage": "merge", "done_source": "initial_closed"},
    {"number": 43, "title": "A", "branch": "afk/issue-43", "spec": null, "blocked_by": [], "status": "pending", "stage": "implement"},
    {"number": 44, "title": "C", "branch": "afk/issue-44", "spec": null, "blocked_by": [43], "status": "pending", "stage": "implement"},
    {"number": 45, "title": "B", "branch": "afk/issue-45", "spec": null, "blocked_by": [], "status": "pending", "stage": "implement"}
  ]
}
```

#42 只计入初始关闭跳过审计，不称已合并，不创建/清理其历史 worktree。仅作为 closed blocker 而非显式输入时不出现在 plan。

## A→C，B 独立：即时合并

1. #43(A)、#45(B) 占 2/4 槽。#44(C) 等 A done。
2. A Implementer 完成，退出后同现场 Reviewer；A reviewed 后固定 SHA，立即排队。B 可仍在实现或 recovering。
3. 唯一 Merger 在主仓库处理 A：核对精确 reviewed SHA/目标基线，拓扑 merge，全量测试，summary，关闭 A，持久化证据，仅清理 A。
4. 控制者完整验收且 Merger 退出，A 标记 done_source=merged、释放槽，**立即启动 C，不等 B**。A 若清理失败保持 merge/recovering，C 仍 blocked。
5. B reviewed 后排队；目标因 A 前进，B 合并前复核新的集成基线与完整验收，再全量测试。

四个 Ticket 均 recovering 或等 merge 时没有空槽；报告 4/4 等待，不能新开第五个。Merger 恢复占用主仓库期间，不再派第二 Merger；独立实现/审查使用剩余槽推进。

## 首次失败升 Opus

C Implementer watchdog 超时。先核实停滞、停止旧实例并确认写入子进程退出；文件没变但长测试有输出时只重挂 watchdog。

```text
branch: afk/issue-44
worktree: /path/to/afk-issue-44
stage: implement
retryable_failures: 1
requested_model: opus
actual_model: 待分派后核实
error: AgentIdleTimeoutError
summary: 已核实旧实例停滞并退出
commits: a1b2c3d 实现 debug 输出骨架
next_action: 保留已有骨架，从失败测试与日志继续
```

原 worktree、原 stage、原槽重派 Implementer；接口确实支持 Opus 才设置并登记 actual_model。失败再次发生追加证据与下一动作，保持 Opus、无次数上限；相同失败无新证据先诊断或等待。新 Reviewer stage 默认 Sonnet，自己的首次可重试失败才升 Opus。Opus 不可用则该角色暂停报告，独立任务仍可继续。

Merger 失败按单元保存 merge stage 计数和模型；即使 summary 已存在，也须核对精确 result/test/summary SHA 与关闭、清理状态，不能凭 message 跳过测试。

## 现场绑定与 BLOCKED

- 默认 subagent 强制另建隔离 worktree：明确缺失现场复用能力并等待，不自动 Herdr；超过五个 Ticket 也无载体确认门。
- 显式 mode=herdr：环境与接口可用才启动，保持正常权限；实际 model 从接口核实。
- 同 Ticket 交接：Implementer 退出后同路径 Reviewer；旧交互会话仅 idle 先退出核实；恢复保留 commits/runbook。
- 历史 #5 式拒绝：预期 Studio.afk-issue-5，实际 Studio/.claude/worktrees/agent-*，返回 WORKTREE_MISMATCH，零业务写入；现场修正并获必要授权才重派。Read 成功不能代替 Git/写入授权。
- 嵌套简化：子代理只读返回建议，当前唯一 Implementer 写入/测试/commit。
- Planner 报 open blocker #41 缺 ready-for-agent：INPUT_INELIGIBLE，终止且不覆盖/执行旧 plan。
- Planner 绑定错误：不是标签缺失，修正后原角色重派、不升模型。Planner 授权拒绝：等用户授权，不通过换载体绕过。

## 中断与收尾

合并后、关闭前中断：从受测 SHA 与 summary SHA 恢复关闭；关闭后、清理前中断：只验收并清理该单元；分支已删则用持久化精确 SHA 验证 ancestor。证据不足保留现场诊断。

所有实际执行 Ticket 完成后，分页查询 SPEC 的全部 sub-issues，全 CLOSED 才关闭 SPEC。只清理本次登记且用途完成的运行文件，其他活动 worktree 不动；分别报告执行完成与初始关闭跳过数，提示 review/QA。
