# AFK Git 现场恢复 implementation notes

## 目标

实现 GitHub issue #9：AFK 重启后依据当前 GitHub、Git、Worktrunk 与进程事实，安全继承既有 `afk/issue-N` 分支和 worktree；避免重复派发、破坏已有提交或未提交修改，并保持交付与合并恢复幂等。

## 决策与进度

- 以 issue #9 的 Problem Statement、Implementation Decisions 和 Testing Decisions 为交付 spec。
- 沿用公开 CLI `start`、`status`、`stop` 的隔离黑盒 fixture，不新增私有测试接口。
- 当前分支已有大量未提交及未跟踪改动；先判断其与 issue #9 的关系。实现期间不 reset、stash、删除或覆盖既有现场，最终只提交能够明确归属于本 issue 的改动。
- 恢复分类发生在固定 Issue 范围确定后、创建任何新现场前；标准身份保持 `afk/issue-N`。
- 现场恢复默认保守：唯一标准现场且无活跃写者才接管；dirty 任务现场视为待继承成果；歧义、活跃写者或无法确认进程身份时等待而非创建第二现场。

## 已实现

- 新增仓库内公开 CLI 黑盒 fixture `afk-recovery.test.mjs`，使用隔离临时 Git 仓库和假 GitHub、Worktrunk、Claude CLI；不访问真实 AFK run、业务 worktree 或进程。
- closed 显式 Ticket 记录 `skipped-closed` 并排除；唯一标准 worktree 默认原地恢复，只有分支时恢复同一分支 worktree，无现场时才创建。
- 恢复现场保留 commits、dirty 与原 cwd；不再把历史标准现场无条件标为本 run owned。I/R 后不在核心交付路径删除 worktree。
- writer socket 通过当前连接响应判断活跃写者；stale takeover 由 O_EXCL recovery guard 串行。daemon 异常退出时，从既有事件取得未结束角色的候选 PID/PGID，再用 signal 0 核实当前进程组；ESRCH 才接管，活跃／未知／EPERM 保守等待或 quarantine。历史 PID 只作当前事实候选，不直接 kill。
- 恢复分类及阻碍写入结构化事件与 `status`；最终 `result.json` 也保留 engine describe。
- clean 分支已成为目标祖先时分类为 `merged-unverified`，跳过重复 Implementer/merge，交 Merger 继续验证、summary 核实和关闭；dirty worktree 不走此捷径。
- 沿用当前工作区已完成的 issue #9 相关能力：空验证列表适用于确无检查的仓库；Reviewer 不得用空结果抹去前序 failed/not-run；目标 dirty 时 I/R 继续并保留合并队列，目标 clean 后不重跑 I/R。
- 新增 ADR 0007、domain glossary 与运行文档，替代旧的逐票 `--reuse` 常规门槛和“不支持重启恢复”声明。

## 验证

- RED：首个已有 worktree fixture 在旧行为上稳定失败，结果明确要求 `--reuse 9`；遗留 writer socket 与 already-merged 两个后续 slice 也先变红。
- GREEN：`node --test skills/personal/afk-issue-loop/scripts/*.test.mjs`：16 通过、0 失败。新增覆盖：未知 writer、只有 role-start 而无 PID／确认终止、daemon SIGKILL 后角色仍存活、stale recovery guard 幂等接管、依赖票恢复计划、已审查队列锁、目标验证失败保持 open，以及 merge 持久化后独立 close-only。
- 静态：全部 AFK `*.mjs` 执行 `node --check` 通过；`git diff --check` 通过。
- code-simplifier 已收敛 recovery 状态函数与 fixture 重复。双轴 review 首轮发现 writer 阻碍忙循环、target dirty 提前结束、未知 socket 误接管、队列锁提前释放、依赖票无分类和 close 时序；均已修复并增加回归测试。
- 验收限制：当前授权用户无法安全制造真实 `process.kill(..., 0)` 的 EPERM；实现明确将该路径归为 unsafe quarantine，并在 `status` 暴露 `quarantined`，但 EPERM 仅有代码路径审查，未做真实 OS fixture。
- 双轴 code review 最终复核：Standards 与 Spec 均无剩余 blocker。
- clean staged-patch：通过 Worktrunk 从 `fix/afk-direct-dispatch` HEAD 创建临时 worktree，仅应用 staged patch；16/16 测试和 `node --check` 通过，随后移除临时 worktree/branch。
- 提交边界：仅暂存本 issue 的 11 个文件／hunk；模型选择、默认权限、session hydration、link-skills、dashboard 等既有改动保持 unstaged。

## Deviations

- 当前分支含模型选择、默认权限、session hydration、link-skills、dashboard 等其他任务改动。未切换或清理用户现场；最终按文件／hunk 选择性暂存，并在独立 clean Worktrunk worktree 验证 staged patch，避免提交依赖未提交改动。
- `--reuse` 目前仅保留 CLI 兼容和显式归属信息；标准现场恢复不再需要它，且它不能绕过 writer、locked、quarantine 或非标准现场边界。
