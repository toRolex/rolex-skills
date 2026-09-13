# AFK 独立本地 CLI 编排实施记录

规格：https://github.com/toRolex/rolex-skills/issues/7

## 已执行

- 完整读取 issue 正文及评论（无评论），确认 OPEN、ready-for-agent、原无负责人；已通过 `gh issue edit --add-assignee @me` 认领。
- 检查当前 `fix/afk-direct-dispatch` 工作区：23 个 tracked 文件已有修改/删除，另有未跟踪研究和计划。未 reset、stash、提交或切换现场。
- 用户已有链接脚本、CLAUDE.md 链接说明、pre-implement 修改与本任务无关，保持原样；AFK 文档先审查既有差异，再迁移。
- 加载 pre-implement、writing-for-agents、browser-tools、worktrunk；查阅 Node detached/stdin/stdout/unref 及 Worktrunk 官方接口。
- 当前本机 Node v22.23.2，claude/codex/pi/wt/gh 均可定位；存在不代表登录、执行、取消和结果契约已验证。

## 实施方向（尚在核查）

- 保留 skill 名称和注册，替换执行架构；入口与运行时分离，角色由本地 CLI 进程承载。
- 优先提取指定上游版本的纯解析和输出机制；核对许可证与依赖闭包后确定分发。不依赖上游 checkout 或运行时下载。
- 候选运行环境为 Node 内置模块 ESM，避免编译和 npm 安装前置；公开入口提供 start/status/stop，调度状态仅在内存。
- 日志和最小进程控制信息位于目标仓库 `.afk/logs/`；不将日志控制文件演变成任务恢复账本。
- 公共 CLI seam 验收使用临时受控 fixture，不向仓库添加 runner test 脚本；不在未经授权的真实业务 issue 上做关票测试。

## 实现进展

- 已核对 Sandcastle 固定 commit `e99f832f26dc9d245c019a9ddd19fa5dee792427`，开发期源码参考位于系统临时目录，交付不依赖该目录。Provider 附来源说明及原版 MIT 许可证。
- 依赖闭包：不复制 Effect/Sandbox 服务容器；直接提取纯 JSON 错误解包、标签/fence 提取函数，保留 CLI 流事件解析结构；stdout 转发及 reset 顺序和批次控制流作本地适配，不声称完整 Orchestrator 原样搬入。
- `afk.mjs` 提供 start/status/stop；启动握手使用临时 IPC，ready 后断开并 unref，daemon 标准输入忽略、输出直接文件；Unix socket 持有运行身份用于停止，不按持久化 PID 盲目 kill。
- `processes.mjs` 使用独立 POSIX 进程组；原始 stdout 行同时驱动落盘、解析、600 秒 idle。COMPLETE 和最终快照只作数据，不建立 completion grace。角色结束需等 close 并确认同组后代结束。
- 顾问建议中采纳现场归属、启动前 dirty 检查、关闭状态刷新、终止确认；其“Reviewer 只读”“不等换行就续期”“精确 SHA 证明”等建议与已完整读取的 issue7 冲突，未采用：Reviewer 必须直接修复、计时源必须真实 stdout 行、不引入 SHA/tree 交接证明。
- 优先级缺少仓库既定映射；入口显式 `--priority-labels` 高到低，无约定则全部同级编号，不冒称 P0/P1 为现有约定。`--reuse` 为用户对旧任务现场归属的明确确认，不自动接管。

## 验证

Provider 开发期离线验证已报告：语法、原许可证对比、40 个断言、上游 Pi JSONL 回放通过；中文化后另 11 项断言通过。这些不代表真实 CLI 或公开入口已通过。

- 公开 `afk.mjs --help` 及新增模块语法检查通过；当前 `git diff --check` 通过。
- 生命周期审查发现并修复两项实际问题：主进程 exit 后继承管道的后代阻碍 close；握手前 IPC 断连导致未捕获错误。独立复测通过（持续输出后代、静默后代、提前断连、发送竞态、正常握手）。这部分为模块级故障复现，不替代公开入口验收。
- 终止未确认设置 `hasUnsafeWriters`，禁止新派发并保留未确认进程信息，供引擎保留现场锁；正常用户 stop 不等于终止失败。
- 公共入口受控 fixture 位于 `/tmp/afk-issue7-acceptance.clydzK/`，只操作临时 Git repo、独立 Worktrunk 配置及假 GitHub Issue 数据，不向仓库新增 runner test 脚本。
- 首轮真实计时长例（run `dce0464c-8f80-4703-a925-a00e743e9486`）：发起宿主组已退出；540 秒 stdout、605 秒仍存活、615 秒 Implementer 完成并接续 Reviewer 均有证据。但该轮启动时加载了引擎实施中的中间版本，Merger 入口残留 `targetOwned is not defined`，验收在720秒报失败。**仅 idle/接力部分通过，Merger/下一批及整体长例未通过**。不隐藏失败；已要求公开停止旧轮，冻结稳定运行时后新建615秒长例重跑。
- 真实 CLI 冒烟使用 `/tmp/afk-real-cli-smoke-QXPGAQ/`，仅 gh 为受控假数据、wt 使用临时配置；三个 AI CLI 均为本机真实程序，没有修改模型/身份/权限或删除 CLAUDECODE。
  - Claude 2.1.228：虽继承 CLAUDECODE，实际可以运行；首轮完成文件/测试/提交，但将输出包在 contract/context 中，严格结果校验拒绝。不能预设本次被嵌套检查阻碍。
  - Codex 0.151.0：真实 stderr 为 `patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings`。只读授权保留，公开 stop 验证最终 stopped；exit=0 未视为交付。
  - Pi 0.85.1：真实流返回 auth_unavailable/no auth available 及 DNS 错误，exit=0 仍判失败；公开 stop→角色 exit143→最终 stopped，约102ms。
  - 首轮尚无完整三角色真实交付通过。上述错误未掩饰为环境全部可用。
- 真实冒烟暴露并已修正：prompt 明确平铺结果、禁止回显 contract/context 输入包装；Codex 明确 stderr 权限拒绝优先于结果契约错误，即使 exit0 也 blocked；Pi auth_unavailable/no auth available 分类为用户待办而非重复实现。复测三者均已终止，最终结果见下节。
- 补充配置前检：调用 Provider 参数构建器只校验、不执行角色；非法 effort/model 参数形状在启动时失败，不进入无效重试循环。

### 公开入口阶段结果

- 18 项短场景通过，另 6 组强化关联断言通过；证据目录中的 `suite-initial-results.json`、`audit-results.json`、`extra-results.json` 分别保留初始与强化结果。
- 已覆盖：四票固定不补位、快实现即时接审查/慢实现并行、单 Merger barrier、summary 后关闭且 SPEC 保留；三种 Provider 受控输出；失败同运行重选及 dirty/commit 复用；仅补关闭；部分合并失败保留 dirty 且仅重派 Merger；初始范围冻结、PR/closed 排除、新 ready 票不吸入；原生依赖关票解锁与内部单票 fallback；未知/权限/外部阻碍隔离；dirty 目标保持用户文件和 HEAD、五票独立审查照常；启动失败、公开 stop、首行前静默及 stderr/其他角色不续 idle。
- 受控短 idle 仅通过临时 Node 预加载缩放计时，产品仍固定600秒。真实615秒长例单独验收，不拿缩时测试冒充真实时间。
- 非法 effort 通过公共 `start` 验证：退出1、最终failed、无角色派发。证据 `/var/folders/d9/_0gbv97x6332wsrqhr4fcyj80000gn/T/afk-invalid-config-9zsLcN`。
- 最终顾问另发现并已修：pending 批次在读取状态未知/权限拒绝后仍可进入 Merger；stderr 拒绝信息被后续64KB以上诊断挤出。新增 Merger 派发守卫和跨chunk粘性拒绝标记（不续idle）。最新10项回归全通过：pending merge/close ×403/unknown 均挡住该组Merger、第五票独立实现审查；三Provider分chunk拒绝+90KB诊断+exit0成功封套仍blocked；基础pipeline/close-only/partialmerge重跑completed。证据 `regression-results.json`。
- 稳定版短detached验收通过：独立发起宿主组SIGTERM并确认退出后，五票两个固定批次、Reviewer、两个串行Merger和假GitHub关闭全部completed。证据 `detached-short-result.json`。
- 公开EOF/COMPLETE两项通过：900ms时进程仍活，无Reviewer；测试idle1200ms后分别在1331/1330ms处理，最终idle而非成功；公开stop确认stopped。stdout EOF不会取消仍活进程计时，COMPLETE无提前grace。证据 `stdout-seam-results.json`。
- **稳定源码第二轮真实长例通过**（run `b9023d7e-7a3f-41e7-938b-bd98edd31caa`）：Implementer 实测615.502秒，540.002秒stdout续期，604.966秒公开status仍running；615.584秒接Reviewer，615.712/617.673秒分别启动两批唯一Merger。提前退出的发起宿主组已确认不存在；最终五张受控假Ticket关闭、假SPEC #7保持OPEN、公开status=completed、验收进程exit0。
  - 证据：`/tmp/afk-issue7-acceptance.clydzK/long-v2/{assertions.json,trace.jsonl,ten-minute-proof.json,host-exit-proof.json}`。
  - 完整自动日志：该目录 `repo/.afk/logs/b9023d7e-7a3f-41e7-938b-bd98edd31caa/`。
  - 源码快照仅存测试目录 `stable-source-snapshot/`，不是产品恢复数据。测试使用真实临时Git/Worktrunk及受控CLI/GitHub，不能冒充真实LLM交付。

### 真实三种 CLI 最终结果

| CLI | 公共入口终态 | 实际验证与边界 |
| --- | --- | --- |
| Claude 2.1.228 | completed | `--reuse 1` 保留首轮提交；真实Implementer→Reviewer→Merger、main clean、独立再次运行 `node verify.mjs` 通过，批次summary后关闭假票。模型多次漏顶层ticket被严格契约拒绝，累计8批/13次角色启动后完成，**不是一次顺利通过**。 |
| Codex 0.151.0 | waiting-user | 只读sandbox真实拒绝；修复后仅1次角色启动，blocked且不再派实现/审查，票保持open。早期公开stop/最终stopped已验证。完整成功交付仍受本机授权阻碍。 |
| Pi 0.85.1 | waiting-user | 认证/DNS真实阻碍；修复后仅1次角色启动，blocked且不再重试，exit0不算交付。早期公开stop→exit143→stopped已验证。完整成功交付仍受本机配置阻碍。 |

终态证据位于 `/tmp/afk-real-cli-smoke-QXPGAQ/` 的 `claude/recheck.final-status.json`、`codex-recheck/recheck.final-status.json`、`pi-recheck/recheck.final-status.json`。三种AI CLI均为真实本机程序，仅GitHub为假数据、Worktrunk为临时配置；未换身份/模型/权限。没有真实业务关票、push或PR。所有本次测试运行均已到终态，不遗留继续派发的测试编排。

## 交付状态

- 运行时、同名skill入口、角色参考、示例、路由与现行文档已迁移；历史ADR仅标记替代范围，并新增ADR0004。
- 新增五个Node内置ESM模块，附固定上游来源与原MIT许可证；未恢复已删除旧脚本，未新增仓库runner test脚本。
- 全部新增模块 `node --check`、`git diff --check` 通过；文档迁移检查102个本地链接有效。没有暂存、commit、push、PR或关闭真实issue #7。
- issue #7已认领；现有用户工作区修改保留。**实现已落地，受控验收和真实Claude完整链路通过；不能宣称三种真实CLI完整交付均已通过。**

## Deviations

- 未变更产品方向。选择 Node22内置ESM分发，明确macOS/Linux前提；不承诺Windows进程组语义。
- 不做自动clean worktree清理：保留全部任务分支/目录，避免额外删除与hooks授权。规格允许clean现场可清理，但不要求每次自动删除；dirty进度完整保留。
- 真实Codex只读授权及Pi认证/网络阻碍限制完整三角色成功验收；不改权限/身份/默认模型制造通过，分别记录实际失败、取消及自动waiting-user复验。
- 首轮长例误加载实施中版本导致整体失败，保留证据并以冻结稳定版重新验收；不将已通过的idle部分扩大为整轮通过。
