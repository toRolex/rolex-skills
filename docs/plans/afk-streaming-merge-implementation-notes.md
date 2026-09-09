# AFK 流式合并 implementation notes

## 决策

- 仅在工具分配的隔离 worktree 交付，不提交、不 push；原目录只经 Read 读取。
- 已读取原目录 AFK 全部已知文件、README、ask-rolex，包括未跟踪 workspace-binding.md；以当前未提交内容为行为基线，保留现场绑定与 Planner 恢复边界。
- CLOSED root 使用 `done_source: initial_closed`；实际本次合并使用 `done_source: merged`。旧 done 缺来源须核实迁移，不把关闭等同合并。
- 单 Ticket 合并单元、四槽流式调度、单 Merger；恢复按 stage 持久化失败证据与实际模型。
- 上游固定基准 e99f832f26dc9d245c019a9ddd19fa5dee792427，流式合并/四槽/模型升级是本地增强。

## Deviations

- 一次 Ruby 批量同步被隔离验证器拒绝（无法静态判定命令范围）；未执行，改用绝对路径文件工具。不修改权限或共享目录。

## 验收

- Bash 黑盒测试：73 通过、0 失败（最终 exit 0）。覆盖来源、旧 done 迁移拒绝、live 初始快照、roots 缺失、非 pending 下游依赖门、四槽上限、三份文档 JSON、watchdog。
- 首轮 68 通过/2 失败：为遵守隔离约束将测试临时 Git 仓库放在隔离目录内，非 Git fixture 意外发现父仓库；增加 GIT_CEILING_DIRECTORIES 后通过。测试 Git 只作用隔离目录内临时仓库，未提交交付分支。
- 静态检查：README 40 个已推广 skill 的 invocation 分组与 SKILL.md 链接通过；AFK 相对文件链接通过；bash -n 与 git diff --check 通过。
- 顾问首轮指出 plan 所有权、下游违规状态、重审后旧 MERGE_HEAD 三处问题，均已修正：Planner 未验收阶段独占候选 plan，退出后控制者接管；校验非 pending blockers 全 done；重审记录旧/新 SHA 与 input revision，保留旧 merge 后拓扑合入新 SHA，废止旧测试/summary 验收。
- 调度是 agent 文档协议，不新增执行器；未实际创建 GitHub Tickets、启动 Herdr 或进行真实模型升级，运行时接口能力仍必须核实。

## 已实现决策补充

- 修复了旧 jq roots 检查的作用域错误（index 使用 root 显式变量）。
- 单 Ticket 合并单元不引入批次 barrier；四槽包括恢复/授权/等合并，主仓库唯一 Merger。
- 模型失败计数按 Ticket+stage；Planner 独立 plan 单元，Merger 按 merge 单元持久化。
- README 从实际已推广目录/frontmatter 生成两组，保留原目录的 Skills Manager 安装说明。未修改 CLAUDE.md、link-skills.sh、pre-implement。
- CONTEXT 收敛为 glossary；历史 ADR/上游调研加 superseded/事实范围标记，不改写历史决定。

## 纯文本中断演练

场景：A→C、B 独立；A reviewed SHA=a1，主仓库 target=t0，合并 A 冲突后发现 Ticket 业务修正需求。

1. 控制者记录 unit=A、revision=1、MERGE_HEAD=a1、target_before=t0、merge 失败计数与现场；A 保留原槽。Merger 退出，A recovering/review；主仓库冻结，Reviewer 仅写 A worktree，B 独立继续。
2. Reviewer 保留 a1 历史并提交 a2，完成测试并退出。控制者登记 previous_reviewed_sha=a1、reviewed_sha=a2、revision=2、review base、废止旧测试/summary 验收，A dispatched/merge；merge stage 原计数不清零。
3. 唯一 Merger 接管，核对 a1 是 a2 祖先、旧 MERGE_HEAD=a1。按两侧意图完成旧合并为 m1，再合入 a2 得 m2；完整安全复核/全量测试后建立 revision=2 summary=s2。此时尚不释放 A 槽或启动 C。
4. m1 后中断：恢复依据记录和 ancestor 确认旧 merge 已完成，继续合 a2；不得把 m1 当 revision=2 完成。m2 后测试前中断：重跑 m2 全量测试。s2 后关闭前中断：核对受测 tree/s2 后只补关闭。
5. 已 CLOSED、清理前中断：恢复只验收并清理 A，B 的活动 worktree 不动。清理后、控制者 done 前中断：用持久化 a2/m2/s2 验证 ancestor 与测试、CLOSED、wt list 缺 A，完整验收后 done_source=merged。
6. A done 释放槽，立即启动 C，不等 B。若 a2 不包含 a1、MERGE_HEAD 未登记、证据缺失、旧写者未退出或权限拒绝，保留槽与现场报告/等待，不启动 C、不重复另一个 Merger。

演练结论：上述中断点均有下一步与验收边界；这是文档状态推演，不是实际 GitHub/Herdr 端到端执行。

## 交付

改动保留在隔离 worktree，未 commit/push。主会话应审阅该目录相对共享当前文件的差异，仅应用交付文件，不直接覆盖其余未提交改动。新增 workspace-binding.md 与本 notes 需一并回传。
