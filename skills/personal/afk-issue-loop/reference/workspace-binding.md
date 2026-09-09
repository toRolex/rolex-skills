# 现场绑定

Worktrunk 管理交付 worktree；载体复用该现场。`WORKTREE` 是执行地址，不是让隔离器另建 worktree 的参数。

## 控制者：选择载体

新运行默认 subagent，数量超过 5 无额外确认；显式 herdr 可用。Planner 前检查当前工具 schema、选用的 agent 定义及运行环境，记录 `requested_mode` 与实际 `mode`：

| 能力 | 选择 |
|---|---|
| subagent 可在既有授权范围使用指定现场，schema 与 agent 定义均允许不另建隔离 worktree | 使用 `subagent`；省略可选的 `isolation`，角色按绝对路径操作 |
| subagent 强制新建隔离 worktree，不能复用授权现场 | 默认或显式 subagent 均明确报告并等待；仅用户明确改用 herdr 且其可用时切换 |
| 请求 herdr，但不在 Herdr 内或 CLI 不可用 | 请用户在 Herdr pane 内启动本 skill；不控制外部会话 |
| 两种载体都不能复用现场 | 报告缺失能力及可执行的启动方式，不分派必然失败的角色 |

读取工具实际 schema；不虚构 `isolation: none` 或工具未提供的 `cwd` 参数。`isolation: worktree` 会另建现场，不能与外部 Worktrunk `WORKTREE` 搭配。单纯增加目录白名单、改变命令包装或禁用隔离不能修复现场身份冲突。

恢复沿用已登记载体。若需变更，先核对旧实例及写入子进程已退出，取得针对本次运行的切换授权，再原子更新 mode 与分派记录，保留 branch、worktree、stage、槽位及 runbook。已登记权限拒绝时仍须通过[权限门](../REFERENCE.md#权限门)，不自动切换载体。

**完成标准**：实际载体能复用角色目标现场，显式模式或恢复切换已获确认；选择发生在创建角色前。

## 控制者：启动角色

Planner / Merger 的 `EXPECTED_DIR=REPO`、`EXPECTED_BRANCH=TARGET_BRANCH`；Implementer / Reviewer 的 `EXPECTED_DIR=WORKTREE`、`EXPECTED_BRANCH=BRANCH`。模板与 runbook 传绝对路径。

先按[现场所有权与分派记录](../REFERENCE.md#现场所有权与分派记录)登记 attempt 与预期现场。subagent 使用上述兼容调用方式；herdr 调用 `Skill("herdr")`，按当前 CLI 契约执行：

1. 在目标绝对路径创建本次专用 pane，保持用户焦点：

   ```bash
   herdr pane split --current --direction right --cwd "$EXPECTED_DIR" --no-focus
   ```

   方向按当前 pane 布局选择；从返回 JSON 的 `.result.pane.pane_id` 读取 `PANE_ID`。不推测 ID，也不复用仍有旧角色的 pane。
2. 按[模型与证据](../REFERENCE.md#模型与证据)确定并核实 `ROLE_MODEL`；接口不支持所需 Opus 时暂停报告，不伪装升级。为本次 attempt 生成唯一合法名称 `ROLE_NAME`，在返回的 pane 启动角色：

   ```bash
   herdr agent start "$ROLE_NAME" --kind claude --pane "$PANE_ID" -- --model "$ROLE_MODEL"
   ```

   从该目录启动常规交互会话，保留正常权限及配置，不加 `--worktree`、`--background` 或跳过权限参数。启动成功不等于现场已通过验收。
3. 用 `herdr agent prompt "$ROLE_NAME" "$ROLE_PROMPT"` 提交模板路径与参数；登记 pane、agent 名称和可获取的 session 身份，挂 watchdog。用后台 `herdr agent wait` 等待生命周期事件；settled/idle 不等于完成，读取结果并按角色门槛验收。
4. 角色完成信号（Planner 的 `<plan>`，其余角色的 COMPLETE）通过验收后，确认其前台会话及写入子进程退出，再交接现场或推进下一阶段。Herdr 交互角色通常只是 idle，不会因输出完成信号自动退出；按 Herdr 操作契约退出本次角色并核实。只清理本次创建的 pane。

启动异常先核对是否已经产生实例；实例身份不明时不重复启动。运行记录补齐实际现场、branch、绑定结果及阻塞原因；仅当前 attempt 的事件可以推进状态。

## 角色：绑定检查

加载模板后、业务写入前执行。先核对载体声明的隔离目录：若它强制限定的 worktree 不等于 `EXPECTED_DIR`，返回 `BLOCKED — WORKTREE_MISMATCH`，报告两条路径，保持零业务写入，不尝试跨现场 Git。

用分别执行的简单命令核对目标：

```bash
git -C "$EXPECTED_DIR" rev-parse --show-toplevel
git -C "$EXPECTED_DIR" branch --show-current
```

将真实路径规范化后与预期目录比较；branch 必须等于 `EXPECTED_BRANCH`。同仓库或同 HEAD 不足以证明同现场。读取模板、目标领域文档及可选 runbook；失败时报告具体动作与路径。普通 Read 成功不证明 Git 或写入已授权，后续真实拒绝立即走权限门。

通过后把实际目录、branch 与 `binding: ready` 写入角色首次进度信号；控制者记入当前分派记录。文件工具始终使用目标绝对路径，Git 每次明确 `-C`；测试等 shell 命令在同一次调用中进入目标目录后执行。subagent 的一次 `cd` 不保证后续工具调用继承 cwd。

需要简化、审查等子委派时，只读分析可返回建议；业务写入、测试与 commit 由当前唯一写入角色执行。把写权限交给新的隔离子代理会重现同一冲突；新增写入者必须经过同现场绑定及旧写入者退出交接。

**完成标准**：角色确认现场身份和材料可读后才开始业务操作。身份不符报告 `WORKTREE_MISMATCH`；真实授权拒绝走权限门；其余执行失败走原角色恢复。身份不符不在相同配置下无限重派。
