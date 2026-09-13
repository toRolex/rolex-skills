# Research OS Studio 真实 AFK 交付验收

## 目标与授权

用户要求在 `Research OS Studio` 新建真实 Claude Code session，通过 `/afk-issue-loop` 完成 #2–#36；#1 仅作 SPEC 上下文。中断后在 skill 仓库定位、修复，再新 session 续跑。仅允许 Claude Code harness，模型组合为 `opus low` 或 `sonnet max`，本次先用 `opus low`。既有用户修改、未知存活写者和旧 quarantine 均保留；不为成功删除保护环境变量、改全局配置或绕过外层 sandbox。

## 启动前已确认

- 目标仓库存在，当前 main 比 origin/main 领先 13 个提交。
- 已暂存 `skills/README.md`，未跟踪 `docs/afk-dispatch.json`；均非本次创建，不自动 stash/reset/提交或覆盖。
- 已安装 afk skill 经软链接指向当前仓库，SKILL.md、afk.mjs、providers.mjs 哈希一致。
- 动态 Pi 选择任务已停止写入，当前运行源码冻结。用户本次仅选 Claude，不依赖 Pi 默认解析成功。
- 本机 `claude --help` 确认支持新 session ID、print、model、effort 参数；未修改身份或启动配置。

## 进度

已新建真实 Claude Code session `2535e3d7-8509-4c6e-a356-02f87b800900`（opus low），调用 `/afk-issue-loop`；会话正常退出但明确报告未启动 AFK，不能将 CLI exit 0 当作交付通过。

会话证据目录：`/var/folders/d9/_0gbv97x6332wsrqhr4fcyj80000gn/T/afk-research-os-session-sU2eqt`。日志可能包含私人信息，仅投影必要脱敏信号。

阻碍与当前取证：
- 旧 `docs/afk-dispatch.json` 的第三次 Planner 写着 running，但没有独立活性/终止证据；旧 `.git/afk-runs` 不是新版 daemon，不能用新版 control 协议判断。
- 目标仓库 `.afk/logs` 尚不存在，未创建新版 AFK run。
- 关联会话明确确认当前仍在调度相同 #2–#36 业务：4 个原生 Implementer 正在写 #10–#13，后续仍计划 Reviewer/Merger；这是实际并发所有权冲突，不只是旧 running 记录。对方确认 #4/#7/#9 写作已结束但未合并。已请求安全交接完成通知，没有请求对方停止或替本会话执行权限动作。新版脚本不得重复派发这些票，也不能把另一会话原生调度成果当作新版脚本端到端验收。
- 实时 Worktrunk 列表含 afk/issue-3、4、5、6、7、9、10、11、12、13 及若干旧原生子代理 worktree，保留全部现场。
- 只读当前进程观察确认目标仓库仍有另一个 Claude 会话。cwd 列表不是完整写者证明，未发送任何信号。
- GitHub 实时只读核对：#2、#3、#5 已 CLOSED；其余 #2–#36 内 32 票 OPEN；#1 仍 OPEN。这些关闭不是本次交付，不重新开票或宣称为本次成果。
- main 两项原有变更仍保持，当前 Merger clean gate 会拒绝；暂存 skills/README.md 与旧任务分支还有同文件交叠，不能忽略 dirty gate。

尚未宣称任何票由本次运行交付。

## 验收边界

受控 fixture 不替代真实交付。需要记录启动 session、AFK run、实际模型、每批角色结果、目标分支合并与验证、Issue 状态。失败必须保留可定位证据；stop 请求受理不等于所有写者已结束。日志只引用脱敏字段，不复制 token、凭据或个人 Git 身份。

## 后续真实重试及最小修复

用户明确「旧会话不要管，重新开始」后，停止跨会话协调；新 session 直接调用公开 start，保留分支归属、writerLock 和 dirty gate，不传 reuse、不删除旧现场。

- Session `14f57fdd-ec1b-4780-b085-9351b3397f88` 真实调用产生 run `2375006b-4afd-46a2-8bec-4af70b565cf0`：120 秒启动握手超时，公开 status 确认 stopped。
- 用户要求在 Herdr 对应 workspace 新 tab 打开，使用 `w2G:tR` 接入该新 session；首次权限确认由用户手动完成。
- 用户认为可能确认晚，要求原样重试。随后直接在 `w2G:tS` 创建全新交互 session `267619c9-95d8-43cb-a3ae-6c6b9f35bc80`，确认 idle/已授权后提交相同 skill 请求。
- 新 run `b86b8887-b594-41df-b105-23795992f6d1` 仍在约 120 秒后被停止，终态 failed。新观测定位错误为 `wait-SIGTERM-group-probe` 的 kill EPERM，终止未确认；不标记 stopped、不清理此现场。发生于上下文读取阶段，尚无角色派发。
- 这两次实际失败及单票最小 fixture 证明：完整 refresh 原本在 createEngine 返回前，评论/依赖/父 SPEC 串行读取占用启动握手，不只是用户权限确认延迟。
- 最小修复：保留模板/前置检查及固定 scope 在握手前，将首次 refresh 移到 engine.run 开头，读取结束检查停止后再准备目标和派角色；新增 context-ready 表示首轮读取结束（非每票成功）。不提高 120 秒预算，不削弱未知上下文/写者/dirty保护。
- 临时公开 start/status/stop seam：`/tmp/afk-startup-hydration-9AR8th/check.mjs`。RED 为 case-1Dzwt0（1.5 秒握手断言，非120秒实钟）；GREEN 为 case-LkuXjJ（慢读中取消，0批）及 case-vj0wrK（释放后派角色）。后者 stub 还有 target-blocked/cleanup告警，不作为完整交付证据。
- 独立只读 CLI 审查输出 `/tmp/afk-startup-review-novFBR/result.json`：指定 engine diff 无阻塞；未独立重跑测试。模型使用 opus/low 参数。语法及 diff check 通过。真实 EPERM 尚未修复，后续复验须保持该区别。
- 用户要求及时关闭旧 tab：已确认本次创建的 w2G:tR 对应 run 停止、launcher idle 后关闭；其他原有 tab 未动。

## 修复后真实反馈

在 Herdr `w2G:tT` 新 session `9a231b4e-b415-460a-8373-c99827c16d0f` 通过新版 skill 创建 run `7fb47062-7ea2-472e-8603-c50c0cccde8e`。2026-09-13T04:47:35.975Z 记录 started，公开 status 实测 running、target main、scope 32个开放票、SPEC #1；batch 0，逐票上下文仍在读取。这确认本轮真实握手已通过，不代表I/R/M交付通过。先前tS启动器idle后已关闭，仅保留当前复验tab；原失败run日志不动。

## 首批真实角色及重复拒绝

- 首轮上下文读取于 04:51:20Z 结束；main dirty 被明确阻断。#4/#6/#7/#9–#13 已有分支且未授权 reuse，保留原现场；其余12票（#16–#24、#29、#31、#32）实际进入 Implementer。
- #17 的业务结果 blocked：缺实际用户确认后 repair 写入验收。#20/#21/#23/#29 的真实 Claude 结果有非空 permission_denials（Bash），Provider 保守阻断；未绕过拒绝。
- 多张 Reviewer 顶层 passed，但 tests 含 not-run。样本混合了不适用的旧runtime/类型检查与确实未执行的真实宿主/导出验收。passedTests 要求每项 passed，因此即使有可交付 commits 也触发 pipeline-failed，整套I/R重跑。不能通过忽略全部not-run把缺失验收算通过。
- 05:56:30Z，第二轮 #16/#18/#19/#22/#31/#32 再次 pipeline-failed；06:00:13Z 六票进入第三轮 Implementer，尚无本轮合并/关票证据。
- 为避免重复消耗，曾尝试通过当前run公开stop在所有角色结束边界暂停；该动作被会话权限机制拒绝（Interfere With Workloads）。**停止操作未执行**，没有换工具/跨会话/改代码绕过拒绝。已向用户请求明确暂停许可，尚未收到。现有监控仅只读。
- 用户允许轻量任务使用 sonnet max；当前run配置固定未改。按票/角色混合模型尚无实现，不宣称本轮已分流。

## 模型映射证据

本机显式 opus 别名实际通过 ANTHROPIC_DEFAULT_OPUS_MODEL 映射至 `gpt-6-astra[1M]`；sonnet 别名映射至 `gpt-5.6-luna[1M]`。上述 session 的 init.model 与前者一致。只读取模型字段，未读取凭据或修改映射。报告需区分「传入 opus low」与真实底层模型，不冒称原生 Anthropic Opus 推理。

## Deviations

当前只修复已复现的慢上下文握手阻塞；scope 基本信息初读仍受120秒握手期限，未承诺任意票数都不超时。取消 EPERM、已有任务分支复用、main 两项原有修改仍为独立未解决项。旧写者和 dirty 保护保持；真实完整交付目标仍未完成。
