# AFK harness-neutral implementation notes

## 已完成：基线审查

- 已读项目 CLAUDE.md、writing-for-agents 正文与 SKILL-MECHANICS.md、pre-implement、AFK 全部文档及当前 git diff；在现有用户改动上增量编辑，不提交、不新建 worktree。
- 脚本检索：无模型名硬依赖；plan version=1、status/stage/done_source 与四槽存在校验依赖；watchdog 的 AgentIdleTimeoutError 有测试依赖，保留并解释为本地脚本信号。
- 仅 router 的 AFK 条目含固定模型升级；顶层与 bucket README 已中立，无需同步。

## 实现决策

- 薄能力契约放入既有 workspace-binding；记录本地实际操作绑定、验证证据与适用范围，不造统一工具 API，不把独立 session 发现强加普通 subagent。
- peer-messaging 收敛为所有载体的语义协议；默认 subagent 也要求运行中双向通信、持久化确认与恢复重绑定。
- 保留 plan schema、既有 dispatch 字段与日志；新增运行能力/模型策略记录，旧记录缺证据时安全暂停后补录，不猜模型或存活状态。
- 模型默认/升级来自解析后的显式配置；强弱关系须配置声明，可用性须验证。未配置升级只暂停受影响升级路径。

## Deviations

无。Herdr 只保留可选载体与布局边界，移除旧 herdr-instances 编排指针及缓存命令。

## 已完成：文档收敛

- 本地能力门覆盖异步实例、生命周期、现场/模型、双向消息和恢复控制权；独立 session 发现仅按载体需要。
- 统一所有角色通信指针与 durable ack；AFK 磁盘账本独立于 transport mailbox，恢复先核验控制权，地址重绑不是接管。
- 退出证据记录 runner/进程终态及覆盖范围，任意外部写入后代须另行核验。旧写者失联不补起写者。
- Herdr 缓存命令/agent kind、宿主工具信封与安装路径已移除；角色模板从实际 SKILL_ROOT 解析。仅 router 的 AFK 一行必要同步，其余 skill、README 与用户无关改动未触碰。

## 验收

- 现有 scripts/tests.sh：73 通过，0 失败（GitHub live 分支使用测试 stub，并非远程实测）。
- 四个脚本 bash -n 通过；git diff --check 通过；60 个文档相对链接及锚点全部有效。
- 未修改脚本或 plan schema；新增 dispatch 能力/模型策略的旧记录安全补录规则已写入 REFERENCE。
- 旧写者失联、durable ack 丢失、升级未配置已加入示例与验收矩阵；顾问只读静态复核通过，未发现重要可行动问题。
- 未运行真实 harness 多角色或 Herdr 集成测试，不把静态检查/既有脚本测试声称为双向通信或进程控制实测。
