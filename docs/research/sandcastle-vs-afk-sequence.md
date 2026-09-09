# sandcastle vs afk-issue-loop：现行差异

固定基准：mattpocock/sandcastle commit `e99f832f26dc9d245c019a9ddd19fa5dee792427`，`src/templates/parallel-planner-with-review`。本次采用已核验源码事实，不重新联网。共享四角色、同 Ticket Implementer→Reviewer、自改审查和拓扑合并理念；下表区分模板、dogfood 调用层与本地增强。

| 维度 | sandcastle 基准 | 本地 AFK |
|---|---|---|
| 输入 | 模板只处理 open Issues | 显式输入或默认 open ready-for-agent；显式初始 CLOSED 标记来源，仅审计跳过 |
| 建图 | Planner 每轮输出当前 unblocked | 开头一次，原生 parent/sub-issue/blocked_by 递归 DAG |
| 合并边界 | Promise.allSettled 后过滤失败，合并成功部分；不是成功一个立即 merge，也不要求所有 Ticket 成功 | reviewed 即入队，唯一 Merger 单 Ticket 串行；完整验收即 done、释放槽、启动下游 |
| 并发 | 模板无固定四槽上限；dogfood 调用并发 4、最多 10 轮 | 执行/恢复/等 merge/授权等待共最多四个 Ticket 槽 |
| 载体 | sandbox/内部 worktree | 默认 subagent；显式 Herdr；Worktrunk 现场复用；默认不可用等待、不自动换 |
| 数量确认 | 无 >5 载体确认门 | 同样无该门 |
| BLOCKED | 无本地这套状态/原因分流协议 | 输入资格终止、现场修正重派、权限/决策等待、可重试执行失败恢复 |
| 恢复 | 本轮过滤失败；dogfood 有有界外层重跑 | 同现场同 stage、无限证据驱动恢复，受权限、四槽及单写者约束 |
| 模型 | 无同 stage Sonnet→Opus 升级协议 | 首次可重试失败升级，后续保持；实际接口支持才选择，不可用暂停 |
| 完成来源 | 无本地 done_source 契约 | initial_closed 与 merged 明确区分，关闭事实不等于合并证据 |
| 证据与清理 | 上游模板自己的合并流程 | 固定 reviewed/目标/result/test/summary SHA、逐单元恢复，仅清理本次该 Ticket |
| 校验 | 结构化输出校验 | bash+jq schema/来源/拓扑/槽位及初始 GitHub live 校验 |

流式合并、四槽硬上限、无限恢复、模型升级与精确恢复记录均是**本地增强**，不称严格对齐上游。历史 ADR/计划中的 barrier 与零重试描述只代表当时决策；现行权威为 [SKILL](../../skills/personal/afk-issue-loop/SKILL.md) 和 [REFERENCE](../../skills/personal/afk-issue-loop/REFERENCE.md)。
