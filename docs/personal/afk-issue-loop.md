快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/personal/afk-issue-loop)

## 功能

沿用 `/afk-issue-loop`，入口只解析输入并启动独立本地脚本，确认 started 后报告运行身份、目标、日志及停止方式，发起会话即可结束。编排器读取指定 GitHub Tickets；省略编号时首次分页读取 open `ready-for-agent` 形成固定范围。按原生 blocked-by 将当前全部未 blocked 且可执行的票一次选为固定批次，无数量上限、不补位，通过本机 CLI 并行 Implementer，逐票接独立 Reviewer 直接修正；全批 settled 后，单 Merger 顺序合并与验证，完成本批一个 summary，再关闭对应 Tickets，刷新下一批。

失败结束本次执行，保留分支成果；受管写者确认结束后 clean 任务 worktree 可移除但保留分支，dirty 现场保留；I→R 之间和目标 Merger 现场不清理。仍 open 的票可在下批沿同分支继续，不升级模型、不取消无关票。持续到范围内 Tickets 全部交付关闭或遇到真实需用户处理的阻塞；范围外前置开头报告，独立票继续、受影响票等待，不自动扩范围。无在途或可推进交付且剩余全部 blocked 时报告并结束，不再挑内部依赖最弱票强行推进。未完成合并由 Merger 续做，仅待关闭走 close-only，不重复验证或 summary。

本机前置：macOS/Linux、Node >=22、Git、Worktrunk、GitHub CLI、已登录且获授权的执行 CLI。脚本随 skill 提供，仅用 Node 内置模块，不下载 Sandcastle 或其他运行依赖；缺项与 Worktrunk hooks 审批由用户完成，不自动批准 `--yes`、扩大权限或修改全局配置。worktree 隔离代码目录，不是系统安全沙箱。不自动关闭 parent SPEC，不 push、开 PR 或同步 origin。

## 启动与控制

从目标项目调用 skill，或使用公开入口（占位需换成实际绝对路径）：

```sh
node "<skill绝对路径>/scripts/afk.mjs" help
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3,4 --spec 1
node "<skill绝对路径>/scripts/afk.mjs" status --run "/absolute/project/.afk/logs/<返回的run>"
node "<skill绝对路径>/scripts/afk.mjs" stop --run "/absolute/project/.afk/logs/<返回的run>"
```

- `--target` 显式指定优先，省略选已有 develop、其次 main。`--provider` 可选 claude、codex、pi，默认 claude，与宿主无关；`--model`/`--effort` 省略使用对应 CLI 本机配置。`--verify` 可传项目验证命令。
- `--priority-labels` 必须来自项目约定，高到低排列；无约定全部同级按编号。本仓库目前没有现存优先级映射。
- `--reuse 3` 仅在用户明确确认旧 `afk/issue-3` 分支及现场归属、允许继续时使用，不自动接管同名现场。
- 原始 stdout 自动进入目标仓库 `.afk/logs/`；完成信号前每行重置 600 秒 idle，COMPLETE 后切为默认 60 秒 grace，后续真实 stdout 继续重置 grace，stderr/其他角色/心跳不续期。持续输出无总时限，正常退出不等满 grace；grace 主动收尾后需终止确认、有效结果和实际成果，不因自身信号退出码一律失败。
- 启动握手最多 120 秒，普通前置命令默认 30 秒，均非角色总时长。监管核对 POSIX 原进程组及继承 pipe，不承诺所有脱组且无 pipe 后代已退出；未确认则保留现场，不交接。
- `started` 仅是启动成功，不是交付成功。后续用 status 和运行日志查看全部交付、失败或用户待办。`stop` 返回 `stopping` 只是请求受理，确认最终 `stopped` 才复用现场；未知状态保留，不盲目按 PID 操作。无系统重启恢复。

三个真实 CLI 适配、后代终止及独立生命周期仍须按公开 start/status/stop 逐项验收；#7 的 [历史实施记录](../plans/afk-local-cli-orchestrator-implementation-notes.md) 不自动算 #8 验收通过，短时 fixture 也不能替代 600/60 真实时间长测。现行决定见 [ADR 0005](../adr/0005-afk-sandcastle-source-reuse.md)。

详见 [执行规范](../../skills/personal/afk-issue-loop/SKILL.md) 与 [上游差异](../research/sandcastle-vs-afk-sequence.md)。

维护运行提示时读 skill 内 [Implementer](../../skills/personal/afk-issue-loop/reference/implementer-prompt.md)、[Reviewer](../../skills/personal/afk-issue-loop/reference/reviewer-prompt.md)、[Merger](../../skills/personal/afk-issue-loop/reference/merger-prompt.md)。三 MD 按固定上游逐段翻译，仅必要微调，不再加载 common。启动前按安装位置读取；缺失、不可读或空白模板使启动失败。角色启动前，在绑定 cwd 自动预展开可信 Git 命令：实现者最近十条提交、审查者完整 diff/log；Ticket/评论/SPEC 参数命令与伪标记不二次执行，命令插参安全转义，预展开失败可见。结果短协议由引擎附加，不把复杂 schema 或角色职责塞回代码。核对函数来源、许可与依赖闭包时读 [源码来源研究](../research/afk-local-cli-source-provenance.md)，研究文件不参与运行。

按项目实际测试与类型检查验证；无自动测试时执行原项目约定的具体检查，不新增免测机制。交付核对普通 Git/GitHub 事实与最终结果，不增加 SHA/tree、目标快照、HEAD 钉死或 summary 标题计数证明。

## 何时使用

手动敲 `/afk-issue-loop [issue numbers]` 调用。

适合无人值守处理一个 SPEC 拆出的 Tickets，或批量清空已 triage 的 `ready-for-agent` 积压。

## 在流程中的位置

独立工具。通常接在 `/to-tickets` 或 triage 之后；不确定时问 `/ask-rolex`。
