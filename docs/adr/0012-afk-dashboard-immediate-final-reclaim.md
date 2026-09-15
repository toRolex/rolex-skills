# 终态立即回收 Dashboard live 面板，保留静态导出

Issue：任务断了以后不需要留着 live 面板——用户原话：「旧面板我已经杀了。以后任务断了以后也不需要留着了。」

## 背景

- 旧契约：run 终态（`result.json` 出现）后 companion 导出自包含 `dashboard.html`，并继续提供 live 页面 24 小时（`AFK_DASHBOARD_RETENTION_MS` 默认 86400000）。
- 实测危害：一个已终态 5.6 小时的 run，其 worker 空转烧掉 **419 分钟 CPU**——终态后 journal 不再增长，但 worker 仍每 100ms 全量解析 27MB observations。
- 抱怨针对的是「live 面板空转烧 CPU」，不是静态文件。

## 决策

- run 终态后**立即回收** live HTTP/SSE worker：companion 收到 worker 的 `final` 信号（`process.send({ final: true })`，信号本身不动）后，先标 `dashboard.json` 为 `state: 'final-export'`，留约 2 秒宽限让最终 SSE `event: final` 送达已连接浏览器，然后 `SIGTERM` worker 并 `process.exit(0)`，不再等待 24 小时。
- **保留静态导出 `dashboard.html`**（0600）：零 CPU 离线文件，不在抱怨范围；且冻结/导出测试与 `status.dashboard.finalExport` 是下游依赖契约，删掉属过度执行。
- 终态标记：`dashboard.json` `state: 'final-export'`；`status`/`dashboardPublic` 原 URL 失效时不再给 URL，如实报告"面板已回收，静态导出在 X 路径"。
- reopen 语义：终态后 `dashboard --run <logDir>`（`dashboardPublic`/`launchDashboard`/命令分支）**不拉起新 server**，直接返回 `state: 'final-export'` 与 `finalExport` 路径。再起 server 会违背需求、又添一个空转进程。
- 回滚逃生口：仍读 `AFK_DASHBOARD_RETENTION_MS`；默认 0（立即回收），显式设正值恢复旧保留期行为，供测试与回滚。注入点语义不变（`||` 改为 `undefined` 判定，传 `'0'` 不再被误判）。
- `run 现场被移除后 companion 自行退出` 的 liveness 检查保留不动。

## 被替代的旧契约

- 「终态后 companion 继续提供页面 24 小时」作废；SKILL.md Dashboard 段落改写为「终态立即回收 + 静态导出保留 + 终态后 reopen 返回导出路径」。
- 启动握手/工作现场文档中若有 24 小时措辞，一并视为被本 ADR 替代。

## Consequences

- `afk-dashboard.test.mjs` 中依赖 24 小时保留期的断言已改为立即回收语义，并新增「终态默认立即回收」与性能回归覆盖；逃生口正值仍可覆盖旧行为用于过渡测试。设置正值保留期时**不**标记 `final-export`，使 URL 在保留期内保持可用。
- `dashboard.json` 新增 `final-export` state 值是公开契约，下游读取方按"URL 失效、看 finalExport"处理。
