# AFK daemon liveness 修复 implementation notes

## 问题

- 2026-09-14 实测存在 69 个 `afk.mjs _daemon` 常驻进程，合计约 2.5 GiB RSS。
- 泄漏进程的 cwd 与 `daemon.log` 均指向已删除的 `afk-dashboard-*` fixture 现场；父进程已变为 PID 1。
- 当前 Dashboard companion 已监测 `logDir` 消失，但 AFK daemon 本体没有同类 liveness 边界。若测试宿主／启动者异常退出并删除 fixture，而角色处于静默等待，daemon 不再产生事件，因此不会触发日志故障停止路径。

## 计划

1. 在公开 `afk.mjs start` 黑盒 seam 上新增回归测试：删除仍在运行的 fixture 现场后，daemon 与受管角色进程组均自行退出。
2. 在 daemon 内加入低频现场 liveness 检查；`repo` 或 `logDir` 消失时，以基础设施故障原因走 `Processes.halt()`，不冒充用户 stop。
3. 补第二层回归：termination 未确认且现场存在时继续持有 writer locks；现场连续缺失后等待 engine finished，再幂等释放本 engine 的 locks，让 daemon 退出。
4. 运行目标测试与两套 AFK 全量测试，并核对测试前后 AFK 进程差值为零。

## 决策记录

- 不改变 `detached: true`：daemon 脱离发起会话是 AFK 的核心设计。
- 不用定期按年龄清道夫：年龄不能证明 run 已失主，可能误杀长任务。
- 不直接 `process.exit()`：必须先终止受管角色进程组，避免把 daemon 泄漏变成角色进程泄漏。
- 现场消失归类为基础设施故障，而非用户停止；使用 `halt(error, 'run-site-missing')` 保留真实原因。
- termination 未确认时，正常终态仍保留 writer ownership server；只有 run 现场连续缺失，且 engine 已结束，才释放本 daemon 持有的 locks。
- 连续缺失一经确认即锁存为 abandoned；随后整批释放，不在逐锁关闭之间重新解释同路径的重建，避免只释放部分 ownership locks。
- abandonment 释放仅作用于本 engine 的 ownership locks，不把脱组进程仍存活解释为终止成功；这是“原现场已被外部销毁”后的退出边界，不改变确认 abandoned 前现场存在时的禁止交接规则。
- writer lock release 缓存同一次 `server.close()`，避免并发或重试重复关闭同一 server。

## 验证进展

- 回归测试先红：`run 现场被移除后 daemon 终止受管角色并自行退出` 在现实现等待 10 秒后失败，错误为 `run 现场消失后 daemon 未退出`。
- 修复后同一测试通过，约 5.2 秒完成；daemon 先走 `Processes.halt()` 终止受管角色，再关闭自身控制 server。
- 第二层回归通过：公开 stop 无法确认脱组写者终止后，现场存在期间 daemon 与 writer lock 均保留；删除现场后 lock 释放、daemon 退出，脱组写者仍由测试清理。
- liveness timer 使用 `unref()`；正常 run 或已安全释放 locks 时清除。termination 未确认时有意保留，等待现场连续缺失后的 abandonment cleanup。
- `afk-recovery.test.mjs` 19 项与另一套 AFK 测试 21 项全绿；测试前后未新增 daemon。
- 历史残留核实为 72 个 PID 1 下的 `_daemon`，全部 cwd 指向已删除的 `afk-dashboard-*`／`afk-recovery-*` fixture，无生产现场；清理后回收约 2.5 GiB RSS，最终 daemon 数为 0。
- 独立强模型竞态复核：无置信度 ≥80% 的阻塞问题；abandonment cleanup 与正常 release 并发时复用幂等 release promise。
- 双轴 code review：Spec 无发现；Standards 指出正常收尾与 abandonment cleanup 重复遍历锁。已统一复用 `releaseOwnedLocks()`，仅通过失败回调区分“记录后继续”与“聚合抛错重试”。

## Deviations

- 原计划同时检查 `repo` 与 `logDir`；实现只检查 `logDir`。它是更精确的 run ownership 现场，且位于 repo 内，repo 消失必然使其消失；避免为同一故障制造重复条件。
