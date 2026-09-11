# AFK Issue Loop 示例

以下是调度说明，**不是本次运行过的测试**。权威边界见 [REFERENCE.md](REFERENCE.md)。

## 原生关系与初始关闭

调用 `/afk-issue-loop 42 44 45`：#42 初始 CLOSED；#44 blocked by #43；#43/#44/#45 open ready-for-agent；#45 独立。

```json
{
  "version": 2,
  "run_id": "20260912T120000Z-12345",
  "target_branch": "main",
  "roots": [42, 44, 45],
  "specs": [],
  "batch": {"id": 0, "phase": "idle", "tickets": []},
  "issues": [
    {"number": 42, "title": "Closed input", "branch": "afk/issue-42", "spec": null, "blocked_by": [], "live_blocked_by": [], "status": "done", "stage": "merge", "writer": "none", "done_source": "initial_closed"},
    {"number": 43, "title": "A", "branch": "afk/issue-43", "spec": null, "blocked_by": [], "live_blocked_by": [], "status": "pending", "stage": "implement", "writer": "none"},
    {"number": 44, "title": "C", "branch": "afk/issue-44", "spec": null, "blocked_by": [43], "live_blocked_by": [43], "status": "pending", "stage": "implement", "writer": "none"},
    {"number": 45, "title": "B", "branch": "afk/issue-45", "spec": null, "blocked_by": [], "live_blocked_by": [], "status": "pending", "stage": "implement", "writer": "none"}
  ]
}
```

#42 只计关闭审计，不称本次交付、不创建或清理历史 worktree。父 SPEC 只入 specs。#43 缺资格、某页读取失败、文本 blocker 未录入原生关系、PR 输入或图有环，均报告具体输入错误，不空图成功。

## A→C，B 独立：固定批次

1. 批 1 固定 `[43,45]`，一起启动两个真实 Implementer；无探测。#44 等依赖。
2. A 实现验收、退出后立即 Reviewer；B 仍可实现。A 审查完成后等批末，不能先合并，也不能趁空位启动 C。
3. B 审查结束，整批 allSettled。A、B 均可验收，启动**一个** Merger，顺序合 A 再 B；B 在新目标上复核并测试。
4. 核对两项交付，关闭和清理各自登记。批 1 settled 后刷新原生依赖，A 已交付且关闭才解锁 C；批 2 才启动 C。
5. A 清理失败但交付/关闭已验证且现场安全：标待清理，不重做 A，不单因清理阻塞 C。

若五个独立 Tickets 就绪，批 1 只取前四个；其中任何项先结束也不补第五个。计数仍为固定四成员，直到批 1 settled；存活角色数单独报告。

## 局部失败与全失败

批 1 `[A,B]`：A Implementer 明确失败，记录 `skipped/implement`、原因、原始基线/成果地址和 `writer=exited`；B 正常审查。allSettled 后唯一 Merger 只合 B。下一批跳过 A，A 的下游依赖阻塞，无关就绪任务继续。上下文压缩后仍是同 run，不重新选 A。

A、B 全失败或全无可交付变化：成功集为空，不启动 Merger，结束本批再选择剩余就绪项。Reviewer 无新增 commit，但完整审查及测试通过，仍可进入成功集；Reviewer 失败则不能只合 Implementer commits。

下一次用户明确调用才重新评估 A；先核对旧进程、现场、原始实现基线和有效 commits，不能用当前 HEAD 掩盖既有实现范围。

## 未知退出与局部冻结

A 失败且停止仅返回“请求受理”：A 可 skipped，但 writer=unknown，现场仍占用。按宿主机制记录有限观察边界，到界不再延长。

- 有可信隔离证据证明 A 不影响 B、目标及相关共享元数据，B 可在批末合并；A 现场跨批冻结，不启动同现场替代写者。
- 只知道不同 worktree 路径，无法证明共享 refs/元数据隔离：不强合 B，保存成功成果后返回安全阻塞，不无限等退出。
- 宿主最终通知明确保证所有相关写者退出：接受该证据，正常交接，无额外 ACK/进程探针要求。
- 目标存在未解决冲突、未验收 commits 或未知 Merger 写者：冻结目标，停止后续合并，不以 skipped 释放主现场。

## 批次 Merger 部分成功

清单 `[A,B,C]`：A 已合并、复核测试及 summary 证据保存，关闭成功；B merge 后测试失败，目标留下未验收提交；C 尚未处理。

逐项记录 A delivered、B/C 本次 skipped，目标污染明确阻塞。不能用整批 FAILED 抹掉 A，也不能再次派 Merger 重试 B/C。A 的交付事实不意味着污染目标可以继续使用。

若仅 A 关闭失败：A 保留 delivered，记待关闭；目标安全时仍可处理 B/C。若最终通知丢失，控制者只读核对 RESULT_PATH 与真实 refs/GitHub，不盲重发合并或关闭副作用。证据先落盘，最终通知后控制者再清理，无需 Merger 中途等 durable ACK。

## 最终报告示意

```text
部分完成：批次 2；交付 3；初始关闭审计 1。
本次跳过：#43 implement 测试失败；下游 #44 依赖阻塞。
待关闭：#45（权限拒绝，保留原错误）；待清理：#46（现场移除失败）。
退出未知：#47，现场 /repo-wt/afk-47，已达有限观察边界。
证据：<运行记录绝对路径>；目标 SHA：<最后验收提交>。
未安全结束不计成功；下次明确调用再评估失败项。
```
