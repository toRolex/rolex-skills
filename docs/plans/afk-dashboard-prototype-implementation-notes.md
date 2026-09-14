# AFK 只读 Dashboard Prototype implementation notes

## 范围与问题

- 用户要验证：`/afk-issue-loop` 启动后，独立本地 Web dashboard 是否比外部 TUI 更适合观察当前 run 的 Implementer、Reviewer、Merger。
- 本次只做 throwaway prototype，不修改 `afk.mjs`、`engine.mjs`、`providers.mjs` 或活跃运行；不连接真实 `.afk` 数据，不停止任何 run。
- Prototype 放在 `skills/personal/afk-issue-loop/prototypes/dashboard-ui/`，明显隔离于正式脚本。

## 正式方案已确认约束（本 UI prototype 未实现 runtime）

- 每次只显示当前 run；监听 `127.0.0.1`，由 OS 分配空闲端口。
- 启动后尝试打开默认浏览器，同时输出地址；失败不影响模拟 run。
- 使用与控制凭据分离的只读 URL token。
- 浏览器通过 SSE 获取单向事件；断线显示 stale/unknown 并重连。
- 列出 Ticket、Role、Invocation、Attempt、State、Last observed、Gate、Delivery；Agent 详情逐行流式展示完整 provider 输出、tool-call/result 与 stdout/stderr，不摘要、不截断、不脱敏。
- 模拟 run 结束后导出自包含 `dashboard.html`；server 默认保留 24 小时。
- 初轮曾通过 `?variant=A|B|C` 比较三种信息结构；用户已选中 B 的 Ticket Kanban，此决策现由 `B1/B2/B3` output-monitor 变体取代。
- Ticket Kanban 是本轮唯一 base：每条工单保留 `Implementer → Reviewer → Merger / 交付`。
- 用户最终选中 B2 的左右分栏信息架构；`?variant=B` 与无参数地址映射到 `B2`。
- Dashboard 页面关闭不停止 run 或采集；重新打开时恢复全部历史并默认定位最新一行。正常关闭浏览器不重启 server，只有 Dashboard server 本身退出时才重新创建。
- Output Inspector 使用单一美化渲染视图，完整保留 provider 输出内容和顺序；不摘要、不截断、不提供 Raw 标签页，也不做脱敏。
- Provider text delta 实时更新当前未完成行，遇到换行后冻结为完整行；不等待整段完成，也不把每个 delta 拆成独立行。
- Recovery、process、stdout、stderr、tool-call/result、Self-report、Gate、Delivery 共用一个 run-level 单调 `seq`；Dashboard 重开、SSE 重连、去重与最终页面重放均以它排序。
- 同时显示全局 `Invocation` 与 per-Ticket/per-Role `Attempt`；共享 Merger 是一个 batch-level Invocation，由多个 Ticket lane 引用。
- 新 run 恢复旧 AFK 遗留 branch/worktree/commits 时，Dashboard 必须记录 Git site recovery 全过程；恢复的是 Git 现场，不是旧 agent session、旧 daemon 内存或旧 Reviewer verdict。
- Recovery、后续角色与全部监控记录统一归属新 run；恢复上下文关联新的 planned Role Attempt，实际进程安全启动后才产生 Invocation/PID。Ticket 和 Agent 均可作为 B2 Inspector 的选择对象，使用同一连续时间线。
- Writer recovery 采用 liveness-first：只有明确检测到负责该 worktree 的 AFK writer script 仍在运行时才进入 `waiting-writer`；否则默认没有 Implementer/Reviewer/Merger 在运行，立即接管 Git site 并开工。不保留 `unknown writer` 阻塞状态；stale/unreachable socket、历史 PID/PGID 或 EPERM 不单独阻止派发。恢复命令及 stdout/stderr 完整进入新 run 的监控记录。
- 所有 recovery 记录归属新的 run；恢复成功后作为新 Agent Invocation 的前置上下文写入同一连续时间线。旧 run ID、旧 Agent、旧 Attempt 一律不继承或猜测；事件 source 仍标明 `engine/recovery`，不冒充 Agent 自己输出。

## 实现决策

- 使用单个自包含 HTML，不引入依赖或生产框架；通过 `uv run python -m http.server` 本地预览，也可直接双击。
- 所有数据标记为 synthetic demo，避免与活跃 AFK 运行混淆。
- 状态区分 process/event 事实、角色自报、gate verdict、delivery；静默不直接标记为卡死。
- Prototype 没有 AFK mutation endpoint，也不提供 stop/retry/approve/resume。
- UI 明确分开 observed state、self-report、gate 与 delivery，避免 `passed`、进程存活或工具事件冒充业务完成。
- Agent output monitor 升为第一等界面：展示 selected identity、`live/final/stale`、输出序号/时间、source type、完整连续文本、完整 tool-call/result、stdout/stderr、最近输出、输出条数与 `FOLLOW-TAIL/PAUSED`。
- 三个变体只改变 output monitor 的布局和阅读路径：B1 底部 Dock、B2 右侧 Inspector、B3 宽屏 Workbench；Kanban 数据与选择行为共享。

## 进度

- 已完成 Sandcastle/AFK 观测链路调研和设计 grilling。
- 已读取 prototype UI、Impeccable craft floor 与现代 Web accessibility/layout/privacy 指南；本机 modern-web-guidance skill 版本落后，使用 latest CLI 查询，未修改用户全局 skill。
- 已实现 A `Dispatch Grid`、B `Ticket Lanes`、C `Signal Ledger` 三个结构差异明显的 variant；URL 参数、方向键、筛选、Agent 详情和模拟终态可操作。
- 已用本地 HTTP server 和 Playwright 验证 1440×1000、390×844；修复移动表格 caption、Ticket Lanes 页面级横向溢出和 favicon 404。搜索筛选、方向键切换通过，最终控制台 0 error/0 warning。
- Impeccable detector 降级为 regex 模式，发现装饰性栅格背景；已删除，不把生成式 UI 惯用纹理保留为产品语言。
- 独立审查首轮要求修复终态冻结、B 的筛选/计数/移动布局/ARIA、状态分层、对比度、320px 顶栏和 C 的空间利用；已一批修正。Verdict pass：视觉 `SHIP`，代码语义 6/6 resolved，无 partial/unresolved。
- 最终验证：inline JavaScript 语法通过、`git diff --check` 通过；Playwright 证明 320px 无 body 横向溢出、B 实际 5 lanes 与标题一致、终态 sequence 3 秒后不再变化、控制台 0 error/0 warning。
- 用户选中 B 的工单看板方向；页面已改为中文产品界面，同时保留 `Implementer`、`Reviewer`、`Merger`、`Gate`、`SSE`、`git diff`、工具名和命令等英文技术术语。复验 390×844 无页面级横向溢出，5 条工单流水线正常，控制台 0 error/0 warning。
- 本地化后独立审查发现筛选结果与详情选择可能脱节；已改为仅从当前筛选结果恢复选中项。Playwright 验证筛选 `Reviewer` 后详情切换为 `#17 · Reviewer`，且仅有一个可见选中项。
- 用户最终保留 Ticket Kanban，并要求以它为唯一 base 重新做 output-monitor 变体；已移除 A 调度表与 C 事件账本主体。
- 已实现 B1 `底部 Output Dock`、B2 `右侧 Output Inspector`、B3 `Output Workbench 聚焦模式`；用户选择 B2，旧 `?variant=B` 与无参数地址现映射 B2。
- Synthetic output 已覆盖多段 reasoning/text 摘要、Read、Bash、git diff、npm test/check、tool result、Gate、stdout 与 stderr/error；秘密、完整参数和绝对路径均使用占位脱敏。
- selected Agent、Role 筛选、搜索与 monitor 共用可见 Agent 集合；筛选后不会保留不可见 Agent 详情。
- Bounded Playwright 首轮验证 B1/B2/B3 的 1440×1000 与 390×844，并验证 B1 320×780：均无 body 横向溢出；Agent 点击后 identity、输出与唯一 selected 卡片同步；Role=`Reviewer` 会自动切换到可见 Reviewer；`FOLLOW-TAIL/PAUSED`、旧 `?variant=B`、约 20 秒 final 后 sequence 冻结均通过；console 0 error/0 warning。
- 交付复核发现 Role=`Merger` 时 tickets 曾排除 Merger，导致 monitor 有 selected Agent 但 Kanban 为 0 行；已改为从全部 visible Agent 推导 ticket。确认轮验证 B1/B2/B3 在 320/390/1440 均无 body 横向溢出，Merger Role 筛选与仅命中 Merger 的搜索均保留 #24 工单、唯一 selected 卡片和一致 identity；键盘 Enter 选择 Agent 通过，console 0 error/0 warning。
- 独立代码审查随后发现 synthetic tick 的全量重绘会丢失键盘焦点、全局方向键会劫持按钮、B1/B2 缺少 Self-report/Gate/Delivery、Agent 汇总硬编码错误及 follow-tail ARIA 语义冲突；已统一修复：保存/恢复聚焦控件与 paused scroll、`role=log` 关闭重复播报并用静态 live announcer 报新增行、交互控件不触发 variant 箭头快捷键、三变体共享九项 monitor facts、Agent 数量动态计算、follow-tail 使用固定 toggle 名称和正向 `aria-pressed`。
- 最终 Playwright 确认轮：三变体在 320/390/1440 均有九项 monitor facts 且无 body 横向溢出；synthetic tick 前后 follow-tail 按钮焦点保持，按钮上的 ArrowRight 不切换 variant，toggle 的 `aria-pressed` 与 `FOLLOW-TAIL/PAUSED` 一致，final stream 冻结，console 0 error/0 warning；桌面与移动截图复核无新布局缺陷。
- Inline JavaScript syntax 与目标文件 `git diff --check` 通过。Impeccable detector 因本机 HTML parser modules 缺失降级为 regex scan；移除 colored glow 后结果为空。
- 用户确认采用 B2 的左右分栏整体布局；当前视觉风格不升级为产品 design system。颜色、边框、状态 pill 数量和信息密度偏花乱，留待后续独立设计讨论收敛，本轮不继续视觉打磨。

## Deviations

- 这是隔离的 throwaway prototype，不建立仓库级 `PRODUCT.md`/`DESIGN.md`，避免把未经选择的 prototype 视觉方向升级为长期产品事实；产品事实直接取自已确认 brief 和现有 AFK skill。
- 原计划同时实现 localhost server/SSE/token/static export，但当前 skill guard 拒绝写入 runtime code。保守降级为 UI/state prototype：浏览器内模拟单向事件与最终状态；README 明确这不等于正式 server 能力。未绕过 guard。

## 生产实现（Issue #10 落地）

原型只提供信息架构证据；正式实现另建生产 runtime，prototype 目录保持 throwaway 状态不变。

- `scripts/observations.mjs`：best-effort append-only Observation journal。daemon 是运行期唯一 writer 与 `seq` 分配者；写失败后停止写入并把 `observation-state.json` 置为 `incomplete` + reason，绝不抛入 core 失败路径。核心 `events.jsonl` 保持原可靠/fatal 语义。
- `scripts/dashboard-server.mjs` + `scripts/dashboard-worker.mjs`：companion supervisor 管理生产 HTTP/SSE worker，只在 worker 自身异常退出时重建；worker 只读 journal，绑定 `127.0.0.1:0`，SSE event ID = `seq`，`after`/`Last-Event-ID` 只补发后续记录。终态后导出自包含 `dashboard.html` 并保留页面（默认 24h）。
- `scripts/afk.mjs`：`start`/`status` 返回 `dashboard: {state, url, reopenCommand, completeness}`；新增公开 `dashboard --run <绝对日志目录>`，重建时复用原 read token。`resolve-selection` 无任何 run/Dashboard/浏览器副作用；受控故障注入为公开 start 的 env adapter（`AFK_DASHBOARD_OPEN`、`AFK_DASHBOARD_JOURNAL_PATH`、`AFK_DASHBOARD_WORKER_FAULT`、`AFK_DASHBOARD_RETENTION_MS`）。
- `scripts/processes.mjs` / `scripts/engine.mjs`：raw provider payload 在 `parseLine()` 前入库；新增 Invocation 分配（spawn 成功后）、planned Attempt、Self-report、显式 Gate accepted/rejected、逐票 Delivery、Recovery command/writer-probe Observation。Invocation 只在实际 spawn 后公开。
- writer policy 改为 liveness-first：`verifyAbandonedWriter` 的阻塞语义删除，历史 PID/PGID、`EPERM`、不完整事件改为 `recovery-writer-probe` 观察事实；`waiting-writer` 期间 run 定期重新正向检测并自动恢复。ADR 0007 已同步记录该取舍。
- 验收：`scripts/afk-dashboard.test.mjs`（16 个黑盒 case）与既有 `afk-recovery.test.mjs`（17 个）共用公开 CLI seam，共 33 个测试通过。测试通过 `AFK_DASHBOARD_OPEN=0` 与 PATH 首位 fake opener 确保不打开真实浏览器。B2 信息架构另经生产 worker 页面在 1440/390/320 验收：左右分栏与窄屏堆叠、无页面级横向溢出、方向键与 Enter 选择后焦点保持、`aria-pressed` 表达选中态、payload 与未识别事件原样渲染。
