# AFK Sandcastle 源码复用实现记录（SPEC #8）

## 边界

- 规格：GitHub #8，固定上游 `e99f832f26dc9d245c019a9ddd19fa5dee792427`。
- 起始分支 `fix/afk-direct-dispatch`，工作树已有大量未提交实现、研究和无关修改；不整体暂存、不重置、不执行业务票。
- 主验收 seam 已由规格确认：公开 `start / status / stop`，临时真实 Git、Worktrunk 与受控 CLI/GitHub fixture；不新增仓库 runner test 脚本。
- 真实 CLI 与真实时间长测分别记录；认证受阻或未测不得写通过。

## 执行记录

### 规格与基线

- 已读取 #8 全文与当前 Git 状态、CONTEXT.md、既有源码审计。
- 按规格先核对必要源码依赖闭包，再修改；不把历史审计和旧验收作为本轮证据。
- 起始 AFK 文件副本及 tracked diff 保存至 `/tmp/afk-spec8-baseline.ORzZw9`，仅用于本轮差异对照，不是运行依赖。

### 源码闭包

- 本轮通过固定 commit 的 GitHub recursive tree 重新校验本地上游：256 个普通文件 Git blob 全部匹配；未使用 main/latest。
- 顾问建议采用函数切片：BoundedTail、三 Provider parser/输入、PromptResolver/Substitution/Preprocessor、结构结果；Orchestrator/no-sandbox 仅替换 Effect/环境接线并补实际取消，批次保留 I→R/finally/allSettled/单 Merger。整文件 Effect/Factory/session/UI 闭包不搬入，不制作 Effect 替身。
- 三条独立文件边界由子代理实现：prompt/三MD、Provider/进程、engine；主执行器负责入口异常、最终集成验收和来源说明。

### 公开入口切片

- 特殊路径：旧返回命令未引用脚本路径，公开 status 复制执行失败；改为对 Node 可执行文件、脚本、参数逐项 POSIX 单引号引用，green。
- 停止：将事件日志路径变为目录，旧公开 stop 无法终止角色；改为先启动受管停止，再尽力记事件；日志故障中止任务而非静默继续，终态保存/控制清理不被日志异常跳过，green。
- 启动握手：前置持续输出并挂起时旧 start 不返回；新增120秒握手边界，超时请求 daemon 停止并报告终态需核实。临时 preload 缩时验证 red→green；这不是角色总时长。

## Deviations

- prompt 子模块先写函数，再以旧接线公开 red→临时复制体 green 验证，并非严格实现前 test-first；已如实记录，不冒称完整 TDD。
- `/code-review` 的默认 `<fixed-point>...HEAD` 不包含当前未提交实现（起点 c5c9ba6 即 HEAD）。本轮明确改为 `git diff c5c9ba6 -- <任务路径>` 加未跟踪运行模块全文，避免空 diff 假通过；Standards/Spec 仍独立并行。

### 审查修复

- Standards：硬违规0、保留 smell 0；不把源码最小适配强行重构成另一框架。
- Spec 第一轮发现2个P1：没有provider最终事件时旧assistant封套仍可能兜底；Merger合法blocked在close阶段可能无限重派。均经公开红绿修复，原 Spec reviewer 已复核撤销，两轴目前无未解决的确定发现。新答复边界清除旧结果，保留正常 assistant-only 支持；合法blocked只阻未关闭票，不连坐已关闭票。
- 第一轮长测fixture把合法封套与COMPLETE拆成两个独立assistant答复，掩盖上述最后答复问题。证据保留为旧语义结果，不作为P1修复后通过；第二轮将用同一最后答复含封套与COMPLETE，重新运行真实时钟长测。

## 验收

入口证据：`/tmp/afk-issue7-acceptance.spec8-entry.MyLH8S` 下 special/stop-log/start-hang 的 red/green assertions.json。缩时与受控 CLI 测试，不是真实模型验收。

### 集成、默认时钟与真实 CLI

- engine 完整副本公开 suite **25/25通过，退出0**；最后新增Merger预展开尚未派发失败的红绿，并对该修复重验17项通过，共26种行为证据。日志 `/tmp/afk-spec8-engine.kJKOb5/{final-suite-console,postdispatch-console}.log`，报告 `/tmp/afk-spec8-engine-report.md`。覆盖全就绪/blocked/不补位、dirty与clean、临时准备与锁、归属复用、I/R误关、父SPEC及刷新、部分合并、坏结果核实、跨组close-only、合法blocked拒绝不重派和stop。三角色 common 文件按 #8 删除。
- process 封板公开回归 **32/32通过**，结果 `/tmp/afk-spec8-process.3hrAse/final-suite-results.json`，报告 `/tmp/afk-spec8-process-report.md`。覆盖三流回复/delta边界、终态与可恢复错误、权限来源、idle/grace、spawn、日志失败、stop与受管写者确认。先前30项结果保留，未冒称包含随后exit42修复。
- 7个运行模块 `node --check` 与相对 import 闭包检查通过，仅本地模块/Node built-ins；`git diff --check` 通过。
- **第一轮旧答复 fixture 的历史观察，非最终版本验收**：`/tmp/afk-spec8-long.lolalE/final/assertions.json`。0分钟/9分钟 stdout，实际615.009秒后仍存活，COMPLETE尾部80.010秒，后续两批最终completed；但该fixture将最后答复拆分，已由审查发现不符合修复后最后结果语义。因此保留数据，不计入最终通过。
- **第二轮最后答复语义长测通过**：`/tmp/afk-spec8-long.O4UZ81/final/assertions.json`。同一最后assistant答复包含合法封套及COMPLETE；默认时钟实测 **615.009秒**持续任务、**80.016秒**完成后stdout尾部，0.868秒后接Reviewer，随后Merger与依赖解锁的第二批I/R/M，最终completed。真实Git/Worktrunk、受控CLI/GitHub；Git身份继承断言通过。该快照后的审批分类、Merger未派发前失败边界及grace异常退出门禁另有定向回归，不冒称此长测覆盖这些后续失败分支。
- 安装验收：最终模块复制安装、链接安装、不同cwd均completed；缺失、空白、不可读模板均公开启动失败。证据 `/tmp/afk-issue7-acceptance.spec8-entry.MyLH8S/install-results-v3.json`。首轮错误仅是fixture要求中文错误文案，而上游保留英文读取错误；修正断言后重跑，不算产品缺陷。
- 真实30秒预展开：一个命令立即失败，另一命令持续输出并启动同组子进程；公开pipeline失败前确实等30秒受管截止、父子PID都退出，角色未派发。证据 `/tmp/afk-issue7-acceptance.spec8-entry.MyLH8S/preprocess-real30/assertions.json`。
- 真实 CLI 冒烟目录：`/tmp/afk-spec8-real-cli.ha7ju8`。继承现有模型、effort、授权环境和 Git 身份；GitHub 为受控假票，不操作真实业务 Issue。Codex 已观察到只读/EPERM，Pi 已观察到认证不可用/DNS失败，均 `waiting-user`，未绕过。Claude 完整交付未在8分钟验收预算内完成，测试通过公开 stop 请求结束时发生 `kill EPERM`，运行记录 `failed` 与禁止交接；原管理现场保留，只读诊断中。这是测试预算，不是生产角色总时限。
- 三种真实 CLI 单独公开停止：运行中 stop 均转 `stopped`，role-end 记录 `user-stop`、原组/继承管道终止确认，停止后无新派发；证据 `cancel-results.json`。此测试在CLI启动后发起停止，不冒称每种CLI均已经启动真实工具后代。
- **最终真实60秒主动grace通过**：`/tmp/afk-spec8-grace.XAVrj0/real60/assertions.json`。当前合法答复＋COMPLETE、末stdout后仅stderr持续活动，实际60.801秒后Reviewer开始；Implementer记录SIGTERM、grace=true、terminationConfirmed=true，后续整链completed。该副本已包含不同外部信号与exit42/143门禁修复。
- 入口最后追加故障归因红绿：并发第二角色存活时事件日志写失败，旧代码误标user-stop；现走 `halt(error,'event-log-error')`，failed且原因准确。`event-cause-green/assertions.json`及原特殊路径/显式stop/启动超时三项final复验均通过。
- 长测/真实CLI使用启动时完整 skill 副本，独立于开发目录。第二轮长测之后只追加明确审批来源、grace不同信号/任意非零退出门禁、Merger未派发预展开失败与事件日志归因，分别有公开定向回归；没有把先前快照自动当全部现版本通过。

## 交付结论与保留事项

- 代码与文档已实现；Standards/Spec及最后窄修复复核无未解决的确定发现。运行模块语法与本地依赖闭包通过，暂存文档115个本地链接闭包通过。本仓库没有为本运行时配置独立typechecker；不把 `node --check` 冒称类型检查。没有新增仓库runner测试脚本。
- 受控验收与真实时间测试通过；**三种真实CLI完整交付/工具后代终止验收未完成**。Codex只读、Pi认证/DNS为已观察阻碍；Claude长链kill EPERM真实发生但OS根因未知，不能直接归为纯环境问题，也不能说已修复。
- 原Claude测试run `d084a0bb-3903-4df7-9c4b-3f4dbd9e7fed` 现场保持隔离。只读观察曾见daemon PID55046，不证明全部后代退出；未发额外kill探针、未提权、未绕过权限。新代码补managed PID/阶段/原错误观测供后续授权复验。
- 提交仅白名单AFK实现、现行文档与必要引用闭包：纳入既有#7历史实施记录、源码审计及ADR0004，历史结论不改（源码审计仅清理末尾多余空行）；不把这些历史材料当本轮验收。README只暂存AFK条目；链接配置、CLAUDE.md、pre-implement、其他计划/研究/浏览器快照与旧notes删除等用户改动保持未提交。
- 用户已授权在当前 `fix/afk-direct-dispatch` 提交；不push/PR，不关闭SPEC #8或其他真实Issue。
