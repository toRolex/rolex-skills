# AFK Issue Loop 示例

## 启动、查看与停止

用户在目标项目调用 `/afk-issue-loop 3 4 5`；启动者把编号转为逗号分隔，使用已解析的 skill 绝对路径：

```sh
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3,4,5
node "<skill绝对路径>/scripts/afk.mjs" status --run "/absolute/project/.afk/logs/<返回的run>"
node "<skill绝对路径>/scripts/afk.mjs" stop --run "/absolute/project/.afk/logs/<返回的run>"
```

只有握手返回 `started` 才报告已启动，并给出实际 run、目标、日志和控制命令。用户可以结束发起会话。启动失败则照实报告，不能说后台仍在工作；`stopping` 只代表停止请求，须确认 `stopped`，未知则保留现场。

指定执行 CLI 时加 `--provider codex` 或 `--provider pi`；默认 claude 与宿主无关。省略 `--model`/`--effort` 使用所选 CLI 本机配置。`--spec 1 --issues 2,3` 只实施 Tickets。无项目优先级约定时省略 `--priority-labels`，全部同级按编号；若项目明确规定高到低为 critical、high、low，才传 `--priority-labels critical,high,low`，这不是本仓库现有映射。

新运行发现旧 `afk/issue-3` 时，先确认无旧写者及归属；只有用户明确允许继续该票旧现场才加 `--reuse 3`，不是同名自动接管。同次运行自己的失败进度则正常复用。

## 固定批次与接力

A 阻塞 C，B 独立。本批选 A、B，并发 Implementer。A 实现结束就接独立 Reviewer，B 继续实现；A 审查通过仍等批末。B 实现成功后同样接独立 Reviewer；全批实现/审查 pipeline settled 且写者结束后，一个 Merger 合并可交付分支，完成验证、写本批一个 summary，再关闭对应 Tickets。下一批刷新依赖才选择 C。

五票独立就绪时五票同属首批并发；第六票在批中解除 blocked，也要等下一批，不中途补位。一票就绪也可启动。

## 实时输出与等待

独立脚本按 [实时输出与 idle](reference/workspace-binding.md#实时输出与-idle)持有 CLI stdout；以下是应满足的行为，不代表所有 CLI 均已实测通过。

- A 在 00:00 实际启动，首行前截止点为 10:00；09:00 收到一行普通 stdout 调试输出，自动追加目标仓库 `.afk/logs/` 的 A 日志，截止点移到 19:00。无法解析的行也续期；B 的输出、stderr 和脚本心跳不影响 A。
- A 持续逐行输出超过十分钟仍运行，没有角色总时长。发起会话结束不影响脚本以后启动 Reviewer、Merger 和下一批。
- A 打印 `<promise>COMPLETE</promise>` 后切为默认 60 秒 completion grace；第 50 秒收到新 stdout，grace 从此再计 60 秒，未知行也续期；stderr 不续期。正常退出不等待满 grace。
- A stdout EOF 或打印完成文本，但进程仍运行：仍管理生命周期；grace 到期主动收尾，确认受管执行结束且结果和成果有效才决定接 Reviewer。自身 grace 终止不因信号退出码一律失败；外部异常信号、idle、权限拒绝或坏结果不冒成功。
- A 连续静默达到 600 秒，终止请求已发出但尚未确认结束：保留占用，不能接 Reviewer 或下批 Implementer。确认实际终止后按失败保留进度，独立票 B 继续。
- 自动日志或接流出错必须报告故障，不以禁用监控、退回宿主委派作为成功运行。

## 失败后保留进度重选

A 实现失败、B 审查通过：结束 A 当前执行，本批只合 B。A 的 clean worktree 可移除但 branch 和 commits 留着；dirty 目录保留。下一批读取 open 票，A 仍是候选，选中后新 Implementer 复用同名分支和已有进度。

全批失败时免去 Merger，下一批照常重新选票。复用 A 时即使本次没有新 commit，此前尚未交付的分支改动仍需独立审查；已有实现全部合格的 Reviewer 可以不增加 commit。

## 范围外依赖与内部僵局

用户给 A、B，A 的开放前置 X 不在范围：开头报告 X 和受影响的 A，B 继续。A 的下游同样等待，直到用户处理，不自动纳入 X。

范围内 A、B 互相 blocked，且无在途管线、可推进合并或待关闭交付：记录各自 blocker 并结束本次运行，不挑一票强行开工。若 A 的前置正在本批合并或关闭，则先完成在途交付再刷新，不能提前认定全阻塞停止。

## 父 SPEC 与无改动

用户说明 #1 是 SPEC，#2 是 Ticket，正文有 Parent #1。读 #1 作需求上下文，处理 #2，无需先补原生父子关联；#2 交付后 Merger 只关闭 #2。

实现者报告无分支改动及 commits，就说明原因，免去空跑 Reviewer 和 Merger。若代码尚未满足 Ticket，下批继续处理；已合并验证且 summary 完成、只剩关闭的情况见下一例。

## 合并后关闭失败

Merger 完成本批 A、B 合并及测试，再写一个 summary。随后关闭 A 成功，B 因临时服务错误关闭失败；返回两票实际结果。下一批 B 只交给 Merger 补关闭，免去重复实现、审查和 summary。若拒绝源于权限，则等待用户处理权限，调度者不会换身份代关。

## 合并尚未完成

A 合并通过，B 合并后测试失败，C 尚未合并：Merger 先修复 B 再继续 C。确实无法修好则保留目标现场，返回 B 的问题及 C 未处理情况。后续由 Merger 接着修目标，按 [合并未完成](REFERENCE.md#合并未完成)继续；目标验证通过、原批可处理分支合完后才写原批一个 summary，再关闭对应票。若目标被用户事项阻挡，独立票 D 的现场可用，D 仍可继续实现与审查；D 属于新固定批次，Merger 按原批分组串行交付，不能把 D 混入 A/B/C 的 summary。

## 读取与用户停止

读取某票 blocked-by 出现 EOF，按原授权方式重试。仍无法读取则说明依赖未知，该票及受影响下游等待，独立票继续。

用户停止或权限拒绝保持等待用户；失败票下批重选不等于重启被用户停止的执行。
