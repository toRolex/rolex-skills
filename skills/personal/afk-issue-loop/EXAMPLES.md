# AFK Issue Loop 示例

## 启动、查看与停止

用户在目标项目调用 `/afk-issue-loop 3 4 5`；启动者把编号转为逗号分隔，使用已解析的 skill 绝对路径：

```sh
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3,4,5
node "<skill绝对路径>/scripts/afk.mjs" status --run "/absolute/project/.afk/logs/<返回的run>"
node "<skill绝对路径>/scripts/afk.mjs" stop --run "/absolute/project/.afk/logs/<返回的run>"
node "<skill绝对路径>/scripts/afk.mjs" dashboard --run "/absolute/project/.afk/logs/<返回的run>"
```

只有握手返回 `started` 才报告已启动，并给出实际 run、目标、日志、Dashboard 地址和控制命令。用户可以结束发起会话。启动失败则照实报告，不能说后台仍在工作；`stopping` 只代表停止请求，须确认 `stopped`，未知则保留现场。

`start` 返回值中的 `dashboard` 给出当前 run 专属的只读页面：`state`、`url`、`reopenCommand` 与 `completeness`。把 `url` 原样报告给用户即可；浏览器自动打开失败不影响 run。忘记地址时用 `status` 的 `dashboard` 字段，或直接运行上面的 `dashboard --run` 重建并复用同一只读地址。页面只读、关闭后不影响 run，重新打开恢复全部历史并定位最新输出。

指定执行 CLI 时加 `--provider codex` 或 `--provider pi`；默认 claude 与宿主无关。Claude/Codex 省略 `--model`/`--effort` 使用各自 CLI 本机配置；Pi 默认及简称解析见下文。角色默认权限见 [默认角色权限](SKILL.md#默认角色权限)，不改变外层权限边界。`--spec 1 --issues 2,3` 只实施 Tickets。无项目优先级约定时省略 `--priority-labels`，全部同级按编号；若项目明确规定高到低为 critical、high、low，才传 `--priority-labels critical,high,low`，这不是本仓库现有映射。

新运行发现旧 `afk/issue-3` 时，先按 liveness-first 确认是否有活跃写者：只有 writer ownership channel 明确响应才使该票等待；stale socket、历史 PID 与不完整事件不阻止开工。`--reuse 3` 仅保留显式归属兼容信息，不是接管条件。同次运行自己的失败进度则正常复用。

## 按角色指定 harness 与模型

顶层 `--provider` / `--model` / `--effort` 是 Run 默认值；`--<role>-provider` / `--<role>-model` / `--<role>-effort`（role 为 `implementer` / `reviewer` / `merger`）为该角色覆盖对应字段，其余字段逐字段继承顶层。

```sh
# 三角色混 harness：实现放在便宜的模型，Gate 判断交给更强的模型，
# 不可逆的合并/关票留在已验收过的 Claude 上
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3,4,5 \
  --implementer-provider pi --implementer-model cliproxy/deepseek-v4.1-flash --implementer-effort high \
  --reviewer-provider claude --reviewer-model opus --reviewer-effort high \
  --merger-provider claude --merger-model sonnet --merger-effort max

# 同一 harness 内做成本分层：只写要覆盖的字段，其余继承顶层
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3 \
  --provider claude --model sonnet --effort medium --reviewer-model opus

# 只给某个角色换 provider，模型/effort 走该 harness 的 CLI 本机配置
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3 \
  --reviewer-provider pi

# 先只读预览每一格的最终配置与来源，再决定是否启动
node "<skill绝对路径>/scripts/afk.mjs" resolve-selection --repo "/absolute/project" \
  --reviewer-model opus --merger-effort max
```

- **逐字段继承**：`--reviewer-model opus` 只换 Reviewer 的模型，它的 provider 与 effort 仍跟随顶层。
- **缺省角色只跟随顶层默认**，不跟随其他已指定角色。只指定 Implementer 时 Reviewer 不会被拉到同源模型——否则 Reviewer 会系统性认可同源输出的盲区，而 Gate 完全依赖它的判读。
- **完全不写角色前缀**时三角色完全相同，与升级前行为一致。
- **effort 交集**：公共承诺 `low` / `high` / `max`。各家还有更多档位（Claude 五档、Pi 七档、Codex 五档），按该 harness 实际支持面校验；不支持就在启动期失败并列出合法值。
- **Pi 的档位按模型不同**，不能按 harness 记：`cliproxy/deepseek-v4.1-flash` 仅支持 `low` / `high` / `max`；`cliproxy/gpt-5.6-luna` 支持 `low` / `medium` / `high` / `xhigh` / `max`。Pi 遇到模型不支持的档位会**静默降级且不报错**，所以显式 Pi 模型同样按声明式元数据做能力校验，不做自动验证时也会显式标注未验证。
- **Codex 档位表**以本机 `codex debug models` 的 `supported_reasoning_levels` 为准：`low` / `medium` / `high` / `xhigh` / `max`。`none` / `minimal` 不被 CLI 支持，会被拒绝。
- `start` 与 `resolve-selection` 都**逐角色**列出 harness / 模型 / effort / 来源 / 能力是否已验证；`start` 返回的 `roles` 字段可直接展示给用户。
- 启动期检查本次 Run 用到的**全部** harness 可执行文件（去重后）；缺任一 CLI 都启动即失败，不拖到该角色启动才暴露。
- 每个角色的最终配置在 `start` 时解析一次并冻结进 `selection.json`；daemon 崩溃恢复后仍用同一份，不重新解析。

## Pi 默认、覆盖与模型简称

```sh
# 只读预览默认 luna + max 的声明式解析；不运行 Pi CLI、不验证认证
node "<skill绝对路径>/scripts/afk.mjs" resolve-selection --repo "/absolute/project" --provider pi
# start 重新查当前目录，不固定为预览时的 model；默认 CLI 仍 claude
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3 --provider pi
# 只覆盖 effort，仍使用默认 Luna
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3 --provider pi --effort high
# 显式选择不经自动发现验证；其他完整模型省略 effort 不补 max
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3 --provider pi --model "<API-provider/准确模型ID>"
# 模型与 effort 都可显式覆盖
node "<skill绝对路径>/scripts/afk.mjs" start --repo "/absolute/project" --issues 3 --provider pi --model "<API-provider/准确模型ID>" --effort low
```

以下是 [模型选择](SKILL.md#模型选择) 的预期路由示例，不是自然语言执行实测：

- `/afk-issue-loop 3 pi luna max`：用 `resolve-selection --provider pi --effort max` 预览。若返回 `current/gpt-5.7-luna`，展示它；start 传 `--provider pi --effort max`，保留默认意图重新解析，不手动复制完整模型当显式覆盖。
- `/afk-issue-loop 3 luna max`：只有证据足以确定 CLI=Pi 才作上述路由；不能把 Luna 固定绑定某个 API provider。多个 provider 或同 provider 的多个 Luna 均歧义；另一个 CLI 也匹配时询问。
- `pi luna max --effort low`：准确 effort 优先，使用 low；`--provider codex luna max` 只查 Codex，不能转 Pi，未找到兼容且唯一的模型/effort 就询问。
- 注册目录没有 Luna、配置读取失败、max 能力未知/不支持，或存在扩展/包动态来源：脚本自动选择失败，询问准确显式选择，不静默换模型或跳过动态来源。仅说 `pi` 仍走同一默认解析。
- 声明式列表从 `current/gpt-5.7-luna` 改为唯一 `newprovider/gpt-5.8-luna`：下一次 start 采用新准确值；新增第二个 Luna 则失败；本次已经启动的三个角色仍用保存的旧值。
- 显式 `--model cliproxy/gpt-5.6-luna` 未给 effort：保留旧覆盖语义，补 max；显式其他模型不补。显式完整选择标记未自动验证，可在动态来源存在时使用，但不是认证或后端能力成功的承诺。
- 自动路径因动态来源 fail-closed 时，显式 per-Role 指定仍可开工：自动选择的失败不得丢掉用户写下的按角色配置。
- Ticket 正文是「修复 luna max 文案」但启动时没有模型选择：正文原样留给角色，执行 CLI 仍默认 Claude。

启动前展示例如「CLI=pi；API provider=current；model=gpt-5.7-luna；effort=max；声明式注册唯一、认证未验证；Pi 不加权限 flag」。有角色前缀时逐角色展示，例如「Implementer: harness=pi / model=cliproxy/deepseek-v4.1-flash / effort=high / 来源=显式指定（认证未验证）；Reviewer: harness=claude / model=sonnet / effort=medium / 来源=继承顶层默认」。`resolve-selection` 的 `display` 字段与 `start` 返回的 `roles` 字段就是这份逐角色视图；机器可读的原始枚举值在 `roles`。最终以 start 返回值为准；`selection.json` 保存每个角色自己的选择及来源，顶层扁平三字段与 `default` 键是同一份 Run 默认值。`null` 表示沿用 CLI 本机配置，不代表已探测该配置的最终模型。

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
