# afk-issue-loop 对齐 sandcastle —— implementation notes

Issue: https://github.com/toRolex/rolex-skills/issues/5
Plan: `docs/plans/afk-issue-loop-sandcastle-alignment.html`
ADR: 修订 ADR 0001 两条款，新增 ADR 0002 记录。

## 任务范围（四项改造）

1. watchdog 超时协议（删一次性计时器 + 复杂度分级表）
2. 零自动重试 + 恢复手册（`docs/afk-failures/issue-{N}.md`）
3. herdr 简化（删 `reference/herdr-notes.md`，轮询全删）
4. 3 个 bash+jq 脚本 + 纯 bash 断言测试 `scripts/tests.sh`

## 实施顺序（issue 指定）

CONTEXT.md → REFERENCE.md → SKILL.md → EXAMPLES.md → 脚本 + 删文件 + ADR 0002 → 一次 commit。

## 实施记录

- CONTEXT.md：删「原地重试」词条；新增 watchdog / 恢复手册 / 恢复 / status（含 failed 终态 + 自造词汇标注）四词条。
- REFERENCE.md：超时协议重写为 watchdog 契约（600s、死因一行、排除 completion grace、已知差距）；「失败重试行为」+「agent 中断恢复」合并为「恢复机制」（零自动重试、现场保全、恢复手册格式、单路径恢复、compact 重建并入）；主窗口预算第 4 条与红线禁轮询条改为「两载体统一、无例外」；状态处理表超时行指向恢复机制；新增 scripts 契约段；收尾流程加 afk-failures 清单交用户处置。
- SKILL.md：herdr 段压缩为一段（删 herdr-notes.md 引用）；编排循环图与失败处理 bullet 改「落盘 + failed + 不停调度」；阶段 1 验收改用 validate-plan.sh；阶段 2 加 dispatched-count.sh 信号量查询；阶段 2 第 3 步重写为 watchdog 挂/杀 + 失败判定三触发点 + 失败流程；删「重试分派」bullet；收尾循环加 afk-failures 清单；Reference 列表删 herdr-notes.md、加 scripts/。
- EXAMPLES.md：超时示例改 watchdog 挂/杀；跳过 Reviewer 场景改失败流程；载体差异表改两载体统一 watchdog（herdr 轮询行删除）；阶段 1 验收改 validate-plan.sh；新增「失败与恢复」完整示例（判死 → 手册 → 标 failed → 同分支重派）。

- scripts/：`validate-plan.sh`（schema + 分支名 + 引用存在 + Kahn 无环检测）、`watchdog.sh`（文件 mtime + reflog 取最新，sleep 10 静默循环，空目录兜底从启动时刻起算）、`dispatched-count.sh`（jq 计数）。TDD：先写 `tests.sh`（18 例）确认 red，再实现脚本转 green，最终 18/18 通过。
- 删 `reference/herdr-notes.md`；新增 `docs/adr/0002-afk-issue-loop-sandcastle-failure-timeout.md`（修订 ADR 0001 两条款 + 被否方案）。
- grep 复查：残留「轮询/重试/一次性计时器」字样均为历史性/否定性表述（ADR、Avoid 注释、已删说明），无违例。
- code-review 双轴：Standards 无硬性 violation（锚点全有效、bash 3.2 兼容、删除闭环）；采纳 1 个 judgement call（「bash+jq」表述改为「bash 脚本」）；Spec 轴确认逐条对应，无 Out of Scope 违例。
- 留待用户决策（spec 自身缺口，未擅自改 spec 语义）：① herdr 模式下 agent 正常完成后 worktree 600s 无活性，watchdog 会误报 `AgentIdleTimeoutError`——US5「不误报」在 herdr 载体下不成立，建议回灌 issue；② `dispatched-count.sh` 只数 `status=="dispatched"`，Reviewer 阶段节点是否仍标 dispatched 未定义，信号量计数存在语义歧义（US18）。
- writing-for-agents + writing-great-skills 双标准复审后修复：「不再验证 1-parent」删除线 ×4 全删；「验证两件事」编号矛盾修正；「全部不存在」陈列删除；重派指引句收敛为 REFERENCE runbook 模板唯一权威（CONTEXT/REFERENCE 恢复 bullet/EXAMPLES 重派 prompt 改指引式引用）；「不停调度」塌缩为 leading word「不传染下游」（定义在 REFERENCE 恢复机制）；「恢复手册」改名 runbook（招募先验）；「不反馈、不复查」收敛进「一次性自改」定义（REFERENCE 协议机制），其余只留 token；SKILL Reference 段 11 主题词枚举塌缩为「机制与红线细节索引」；CONTEXT watchdog 词条删契约细节；删「不误报」no-op 括号注。

## Deviations

- **status 词条保留「自造词汇，sandcastle 无对应物」标注**：writing-for-agents 审查判为 provenance 噪声建议删，但 issue US20 显式要求该标注——spec 优先于 review judgement call，保留。
- **四角色 prompt 模板中的旧词未清**：merger-prompt.md 的「1-parent」句、reviewer-prompt.md 的「不反馈、不复查（对齐 sandcastle 一次性自改）」残留——issue Out of Scope 明确「四角色 prompt 模板的任何改动」不做，模板改动需另行决策。

- **SKILL.md 阶段 1 / 阶段 2 加了脚本调用**：issue「文件改动」清单未列，但 user story 16/18 要求控制者用 `validate-plan.sh` / `dispatched-count.sh`，不加则脚本无调用点。选择最小注入（验收步骤一行、并行段一句）。
- **implementer-prompt.md 的「失败重试」段未动**：Out of Scope 明确「四角色 prompt 模板的任何改动」，且其内容（同分支重派、复用已 commit 进度、不 reset/amend/rebase）与恢复机制完全兼容——重派仍会发生，只是从自动改为用户驱动。
- **watchdog 空目录兜底**：无任何文件也无 reflog 时从脚本启动时刻起算 idle，避免分派瞬间误判；issue 契约未覆盖此 edge case，选保守（不误杀）方案。
