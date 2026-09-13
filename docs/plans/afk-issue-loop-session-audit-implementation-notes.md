# AFK Issue Loop 实际会话审计

## 目标

对照近期真实调用记录与现行 skill，修复可核验的流程缺口；不把旧版本行为或单次执行偏离直接堆成新规则。

## 进度与决策

- 已读取 writing-for-agents 的写作与 invocation 规范、主流程、恢复参考和执行角色模板。
- 已委派只读会话调查，抽样最近 3–5 个真实调用；历史日志保留原位，报告仅记录必要证据定位。
- 工作区已有其他任务改动；本任务仅修改 afk-issue-loop 与本笔记，不提交或推送。
- 顾问确认四项静态契约缺口：同现场重派缺少旧写入者退出门槛；通知无实例身份；compact 只恢复 plan 无载体身份；Merger clean 与未跟踪运行文件冲突。已集中修订 REFERENCE，主步骤用指针接入。
- 分派记录使用旁车 `docs/afk-dispatch.json`，保持现有 plan schema 与四角色/无限恢复策略不变；runbook 传绝对路径。
- watchdog 保留脚本信号及阈值，控制者先核实载体进展再决定恢复，避免把只读或测试阶段无文件写入直接视作死亡。
- Context7 已查询 Claude Code 官方文档，确认后台任务完成/失败/停止通知应按任务身份处理；未把 SDK 示例当作当前 harness 的工具接口。

## 实际会话证据

来源为本机 `~/.claude/projects/` 下对应 session 的 JSONL；行号指原始 JSONL 行。只记录最小定位，不复制会话正文。

- Research OS 日志目录：`~/.claude/projects/-Users-rolex-Documents-Codes-githubProject-MyProject-Research-OS/`。
- horse-meme 日志目录：`~/.claude/projects/-Users-rolex-Documents-Codes-githubProject-MyProject-horse-meme/`。
- 文件名均为下表的 `<session-id>.jsonl`。

| Session / 日期 / 项目 | 证据 | 判断与处置 |
|---|---|---|
| `d51c674b-9294-47e5-ace4-38f0c17299ea` / 2026-09-05–06 / Research OS | 行 7 正式调用；2953 用户指出额外代理；2972 控制者承认自定义修复角色；2962–2970、2987 停止并重派 Merger；2988、3003 权限阻塞；2994–2996 关闭 Ticket；3009、3013–3016 用户授权后恢复 | 现行版本真实角色漂移。明确失败 stage 唯一映射原角色；权限门等待授权，控制者不代做。 |
| `f5ce13ec-5f58-4d60-b7ec-e7a738827553` / 2026-09-04–05 / Research OS | history.jsonl 行 19105、19107 调用；session 行 1536 #27 等同批 #28/#30；1541 用户质疑并行；1650、1657 要求继续 | barrier 等待本身符合规范；没有足够证据重建每时刻槽位，不能断言调度违规。新增事件驱动的批次/槽位/stage/等待对象快照，保留 barrier。 |
| `f2f4597a-8438-4fec-9ffc-18d61ed394e0` / 2026-08-28–29 / horse-meme | history.jsonl 行 18531、18542、18545；session 行 2425、2447、2463、2490 多轮续跑 | 早于现行核心版本，且后续改用本地 tracker，超出现行 GitHub 契约；不据此添加新规则。 |

抽样扫描 history.jsonl 19,569 行与 projects 下约 4,974 个 JSON/JSONL 文件，筛出约 180 条相关历史项后聚焦上述 3 个真实调用。未完整审计所有 subagent 日志，无法证明全部测试门槛或槽位利用率。现行核心版本分界：`e4e7b85`，2026-08-30 00:59 +0800。

静态发现与会话实证分开：single-writer、通知身份、runbook 绝对路径、clean 冲突属于静态契约修补，未宣称在上述会话均已发生。

## 验证

- `bash skills/personal/afk-issue-loop/scripts/tests.sh`：55 通过，0 失败。
- 本地 Markdown 引用检查：21 个目标，0 个缺失（未验证标题锚点）。
- `git diff --check`：通过。
- 顾问复核后补齐：新运行与恢复的参数/clean 边界、分派前登记、通知只消费一次。
- 场景走读：分派前已登记 attempt 但任务 ID 缺失时先查载体；Merger 冲突中恢复保留本次 merge index；重复 COMPLETE 不再推进状态。
- 脚本审计发现 `--live` 比较初始 roots 与 open blockers 快照，不能直接校验运行中保留的历史边。本次明确其仅用于 Planner 初始验收，恢复使用离线校验与现场核验，不改变脚本行为。
- 测试局限：watchdog 的 fresh 测试仅等待 3 秒，而轮询间隔 10 秒，不能证明持续活动重置计时正确；本次未改脚本，55 项通过不等于该行为已充分验证。
- 未执行真实 GitHub Ticket 闭环、关闭 issue、merge 或 push。

## 写作标准收敛

用户授权按复核的五项缺口优化：

- 权限门指针接入三个执行角色的失败出口，控制者通用恢复入口先分流权限阻塞。
- 进度快照有独立锚点，主控制循环按事件触发读取，复用已有通知生成报告。
- 角色映射上移恢复总入口；Ticket 触发/runbook 降为子标题；主文件恢复步骤改为指针。
- Merger 执行算法集中角色模板，REFERENCE 仅维护控制者交接与恢复契约。
- Implementer/Reviewer 完成门加入 clean 交接；Merger 每次清理前复核，summary 已存在的恢复也走同一清理段。
- 未改 invocation、路由位置、脚本或四角色/批次策略，因此无注册与 router 变更。

本轮验证：`git diff --check` 通过；38 个本地链接及标题锚点无缺失；脚本测试 55 通过、0 失败。顾问按角色仅加载自身模板走读权限拒绝、dirty worktree 清理、summary 已存在恢复三个分支，文档验收通过，无阻断问题。未运行真实 Ticket 闭环；此前记录的 watchdog 测试覆盖局限仍在。

## Deviations

- 首次只读子代理误传了 `isolation: worktree`；后续不再使用此选项，不以原生 worktree 隔离执行修改。
