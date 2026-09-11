# Issue #6 实施记录

## 权威与范围

- 权威：[GitHub Issue #6](https://github.com/toRolex/rolex-skills/issues/6)，已通过只读 `gh issue view 6` 读取完整正文及评论；本地批次 spec 仅作上下文，冲突以 Issue 为准。
- 用户最新授权仅修改 `skills/personal/afk-issue-loop/`，可基于其中已有未提交修改重构。实施代理未编辑其他目录、未切分支、提交或推送，未修改 GitHub、真实 worktree 或既有会话；分支及后续提交由主代理处理。
- 遵循 writing-for-agents/SKILL-MECHANICS：正常主流程内联，错误边界集中 reference，三个角色模板自加载。

## 实施决策

1. 主流程改为控制者直接读 GitHub → 固定最多四 Ticket → 并发 implement→review → allSettled → 批末唯一 Merger → 核对后刷新下一批。首批即真实 Implementer，批内不补位，无成功集合不派 Merger。
2. 删除独立 Planner、peer-messaging 通用握手和 watchdog；主流程无平台能力探测、强制 ACK、自动模型升级或失败重派。保留用户模型偏好及原生任务身份/最终通知去重。
3. `skipped` 是运行内单调失败集合，不等于退出。`writer` 独立记录；未知退出有限观察、冻结相关资源，只有隔离可证明时推进独立成功项。共享目标冲突、未知写者或未验收修改阻塞后续合并。
4. 三角色成果以独占结果文件寻址。Merger 逐 Ticket 先保存 SHA/测试/summary 证据，再关闭 Issue；控制者最终核对、持久化和确认退出后机械清理。交付、关闭、清理分别登记，清理失败不重做交付。
5. 使用内部 schema version=2，显式拒绝旧 recovering 记录被自动执行；旧材料只核对有关现场。沿用 `validate-plan.sh` / `dispatched-count.sh` 路径，计数改为当前固定批次成员数，不等于进程数或可补位额度。
6. 保留 roots、唯一性、PR 排除、分页、开放 blocker 闭包、资格、SPEC 非执行节点、无环、初始关闭来源等正确性。校验器额外拒绝空/多文档 JSON 与非法分页响应。审计 `blocked_by` 累积历史，`live_blocked_by` 表示当前有效图，避免依赖变更使历史并集产生假循环。
7. 对 parent 仅明确 `No parent issue found` 才视无父，普通 404 不能区分权限/端点错误时保守阻塞。只读查询本仓 Issue #6 `/parent` 实际返回该明确 message 与 404；这只是响应事实，不是流水线运行验证。
8. 保留 `scripts/tests.sh` 中已有离线 schema/唯一性/闭包/完成来源断言，最小适配 v2、batch、writer 和 live 依赖夹具；退役旧恢复/槽位、Planner 示例、watchdog 及旧 API stub 部分。没有新增断言，也未运行测试；不声称现有保留部分覆盖新批次流水线。全删会损失仍有效的输入正确性检查，故未采用。
9. 按 `.agents/invocation.md` 明确使用 Skill 工具分别调用 `wt-switch-create`、`worktrunk`，显式 Herdr 时调用 `herdr`。另补充 CLOSED 关闭审计经历史交付账本核对后、满足资格与单写者边界才进入新尝试的转换，不扩充初始 live schema，不自动 reopen。

## 静态审查与未测试

- 已进行顾问只读静态复核；首轮发现单 JSON 输入、历史图/有效图混用、parent 404 三处边界，均已修正。
- Standards 轴发现具名 Skill 调用缺失，修正后复核无剩余阻塞；保留测试断言与 notes 已一并静态复核。
- Spec 轴提出 CLOSED 再次尝试入口疑点，补充账本重评转换后定点复核无剩余阻塞；这不是运行验证。
- 仅静态查看与限定目录 `git diff --check`；**未新增或运行测试**，未执行校验/计数脚本、隔离演练、业务流水线或端到端/跨 harness 验证。文档示例不是测试结果。
- 实际业务 Ticket 的实现测试、Reviewer 自改测试、Merger 目标验收职责保留；本次重构免测试不代表以后业务 Ticket 免验收。

## Deviations 与范围外待同步

- Issue #6 要求入口介绍、领域词汇和历史 ADR 同步；用户最新范围禁止编辑 skill 外。因此顶层 README、personal bucket README、ask-rolex router、CONTEXT.md 及相关 ADR/旧计划可能仍描述 Planner、无限恢复或逐 Ticket 流式合并，**本次没有同步**。后续由主代理在另行授权范围处理，ADR 应保留历史并注明被新决定取代的部分。
- 为遵循仅 skill 目录的修改范围，实施记录选择本目录 `IMPLEMENTATION-NOTES.md`，未写惯例位置 `docs/plans/`。
- schema 字段、控制者机械清理及审计/live 双图是内部实现选择，不宣称 Issue 已规定这些公共接口；旧状态需事实核对，非自动迁移。
- 当前编号图只覆盖本仓，跨仓 blocker 明确阻塞，不静默映射为同号本仓 Issue。权限拒绝不通过角色、载体或配置绕过。

## 审查导航

- 批次/首批并发/屏障/唯一 Merger：`SKILL.md` 步骤 2–4。
- skipped 与退出分离、有限观察、隔离证明、旧记录：`REFERENCE.md` 的状态、记录及有限停止章节。
- 交付/关闭/清理独立、Merger 部分成功：`reference/merger-prompt.md`、`REFERENCE.md` 的 Clean 与收尾。
- 输入与状态脚本：`scripts/validate-plan.sh`；固定批次计数：`scripts/dispatched-count.sh`；调度与失败示例：`EXAMPLES.md`。
