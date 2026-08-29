# Rolex Skills

mattpocock/skills 的中文改编版：一套 agent skill 集合，按 bucket 组织在 `skills/` 下。

## Language

**Skill**:
一个 `SKILL.md` + 可选附属文件的目录，通过 frontmatter 的 `disable-model-invocation` 区分 user-invoked 与 model-invoked。

**Bucket**:
`skills/` 下的分组目录。已推广 bucket（`engineering/`、`productivity/`、`personal/`）必须出现在顶层 README 与 plugin.json；`misc/` 不推广。

### afk-issue-loop 编排

**控制者**:
运行 afk-issue-loop 的主 Claude 会话；只编排角色、Execution DAG、验证与恢复。
_Avoid_: 主 agent、orchestrator

**角色**:
Planner、Implementer、Reviewer、Merger 四种分派单元；对齐 sandcastle `parallel-planner-with-review`。

**载体**:
角色的运行方式：`subagent` 或 `herdr`。载体不改变角色语义。

**Worktree 管理**:
Worktrunk（`wt`）负责 Ticket worktree 的创建、复用、查询与清理；Git 负责 commit、diff 与 merge。
_Avoid_: 直接管理 git worktree

**SPEC Issue**:
GitHub 原生 parent issue，描述整体规格并挂载 sub-issues。它提供上下文，不属于 Execution DAG；全部 sub-issues 关闭后完成。
_Avoid_: PRD 节点、父 PRD

**Ticket Issue**:
AFK 的执行单元：用户显式给定的 Issue，或默认扫描得到的 open `ready-for-agent` Issue。显式输入中的 closed Ticket 表示续跑前已完成。
_Avoid_: PRD issue、DAG 外任务

**Execution DAG**:
初始 Ticket 加上全部开放 `blocked_by` 递归闭包。Planner 从 GitHub 原生 issue dependencies 读取并验证；closed blocker 视为已满足。
_Avoid_: SPEC DAG、分轮 plan、推断 DAG

**watchdog**:
分派时启动的 hang detector；盯 worktree 文件活性，无活动超时后通知控制者进入自动恢复。
_Avoid_: 一次性计时器、轮询

**runbook**:
Ticket 恢复档案 `docs/afk-failures/issue-{N}.md`，记录 branch、worktree、stage、attempts、commits 与最近失败。

**恢复**:
失败 Ticket 在同 branch、同 Worktrunk worktree、同 stage 自动重派；无次数上限，始终占原槽，成功后解锁下游。
_Avoid_: 人工恢复、重试上限、重新创建现场

**status**:
Plan 节点状态 `pending` / `dispatched` / `recovering` / `done`；失败沿 `dispatched → recovering → dispatched` 循环，Merger验证后进入 `done`。

**主窗口预算**:
控制者上下文窗口的预算约束：材料和事实留在角色或环境，只传地址与极简信号。

**寻址注入**:
分派 prompt 只给命令与路径，由角色自行获取 Ticket、SPEC 和领域材料。
_Avoid_: 全文注入、控制者代读

**模板自加载**:
分派 prompt 只传模板路径与参数，角色自行 Read 完整指令。

**极简汇报**:
角色只返回 completion signal、状态及必要的一行疑虑；测试与 commits 留在环境中。
