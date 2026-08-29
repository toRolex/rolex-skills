# EXAMPLES

## 场景：CLI 工具添加 `--verbose` 选项（四角色完整示例，改造后模型）

项目 `my-cli`，已有 `CONTEXT.md`。用户刚完成 `/grill-with-docs` → `/to-prd` → `/to-issues`，产出 3 个 `ready-for-agent` 的 issue，形成串行依赖链。下文展示从 Planner 一次性出 DAG → Implementer/Reviewer/Merger 循环，到本轮 unblocked 集合空的全过程。

### 输入

```bash
$ gh issue list --label ready-for-agent --state open
#42  Add --verbose flag to root command        ready-for-agent
#43  Wire verbose flag into logger middleware   ready-for-agent
#44  Show debug output in verbose mode          ready-for-agent
```

各 issue body 的 `Blocked by` 字段（依赖判定主依据）：

```markdown
#42 — Blocked by: None - can start immediately          → unblocked
#43 — Blocked by: - #42 — verbose flag 需先定义          → 被 #42 阻塞
#44 — Blocked by: - #43 — logger 需先接入 verbose        → 被 #43 阻塞
```

### 阶段 0：分支模型检测 → TARGET_BRANCH

```bash
# 直接查 ref 而非解析 git branch -a 文本（* develop 前缀/缩进/remotes/ 前缀易致正则误判）
if git rev-parse --verify --quiet refs/heads/develop >/dev/null 2>&1 || git rev-parse --verify --quiet refs/remotes/origin/develop >/dev/null 2>&1; then
  TARGET_BRANCH=develop
else
  TARGET_BRANCH=main
fi
echo "TARGET_BRANCH=$TARGET_BRANCH"    # 本示例仓库有 develop 分支 → develop（Git flow）
# 若只有 main → main（trunk-based，绝不新建 develop）
```

同时检查 `CONTEXT.md` 存在（缺失时按 [REFERENCE.md](REFERENCE.md#contextmd-缺失策略) 处理）。后续所有 `${TARGET_BRANCH}` 都指这里的值。

### 阶段 1：Planner 一次性出 DAG

控制者分派 Planner（subagent 用 `Agent` 工具，herdr 开独立 pane）。**模板自加载**——prompt 只有两行，不复制模板全文：

```
Read ~/.claude/skills/afk-issue-loop/reference/planner-prompt.md 获取完整指令并执行。
参数：TARGET_BRANCH=develop
```

Planner 自行扫描 issue、构建 DAG，把结果写入目标项目 `docs/afk-plan.json`，并输出：

```
<plan>
{"issues": [
  {"number": 42, "title": "Add --verbose flag to root command", "branch": "afk/issue-42", "blocked_by": []},
  {"number": 43, "title": "Wire verbose flag into logger middleware", "branch": "afk/issue-43", "blocked_by": [42]},
  {"number": 44, "title": "Show debug output in verbose mode", "branch": "afk/issue-44", "blocked_by": [43]}
]}
</plan>
DONE
```

控制者验收：跑 `bash ~/.claude/skills/afk-issue-loop/scripts/validate-plan.sh docs/afk-plan.json` → exit 0 通过后给每节点补 `status: "pending"`（逐轮用 Edit 维护）。**状态在文件里，不在会话记忆里**——compact / `--resume` 后重读即可重建。

> Planner 只在开头跑一次。之后每轮由控制者按 DAG 拓扑序切本轮 unblocked：本轮全部 issue 完成（Implementer + Reviewer）后，从"已完成节点"出发算下一轮——`blocked_by` 已全部完成的节点即为下一轮 unblocked。本示例为串行依赖链，每轮单条。

### 阶段 2（第 1 轮）：#42 Implementer + Reviewer

控制者切本轮 unblocked = `{#42}`（`blocked_by: []`）。

**#42** 创建 worktree（确定性分支 `afk/issue-42`）：

```bash
wt switch -c afk/issue-42 -b ${TARGET_BRANCH}
```

分派 Implementer（模板自加载 + 寻址注入，prompt 只有两行）：

```
Read ~/.claude/skills/afk-issue-loop/reference/implementer-prompt.md 获取完整指令并执行。
参数：ISSUE_NUMBER=42, BRANCH=afk/issue-42, TARGET_BRANCH=develop, WORKTREE=/path/to/worktree
```

（herdr 模式省略 `WORKTREE`，agent 按模板自行 `wt switch -c afk/issue-42 -b develop`。issue 全文、CONTEXT.md、ADR、编码规范全由 agent 自取，控制者不代读。）

分派后控制者挂 watchdog 即**立即停手等通知**（禁轮询）：

```bash
bash ~/.claude/skills/afk-issue-loop/scripts/watchdog.sh /path/to/worktree 600   # run_in_background: true，运行期间零输出
```

prompt 红线片段（摘自 implementer-prompt.md）：

```
1. 绝不创建 GitHub PR：gh pr create 是违规操作
2. 绝不推送远程：git push 在任何情况下都不执行
3. 绝不 merge、绝不关闭 issue：merge 与关 issue 由 Merger 统一负责
4. 汇报前必须走完：全量测试通过 → commit（中文描述、语义原子粒度）→ <promise>COMPLETE</promise>

Commit 粒度：一个 commit 只表达一个完整意图；若一次改 20 个文件先审 diff 再拆 commit。
失败重试：你可能因为上次超时被同 worktree 同 branch 重新分派，直接继续，复用已 commit 的进度。
```

Implementer 输出（**极简汇报**——无摘要、无测试输出、无文件清单）：

```
<promise>COMPLETE</promise>
DONE
```

系统完成通知到达 → 控制者杀掉 #42 的 watchdog，然后需要事实时自查 git（几十字节，不占 agent 汇报）：

```bash
git log --oneline develop..afk/issue-42    # → 2 个 commit（args 解析 + main 调用，语义原子）
```

控制者检查分支有 commit（`git log afk/issue-42` 非空）→ 触发同 worktree 同 branch 的 Reviewer（严格串行）。

分派 Reviewer（**沿用同一 worktree**，**不再开新 worktree**，模板自加载两行 prompt，参数同 Implementer），指令要点：

```
你正在审查并精炼分支 afk/issue-42 上对 issue #42 的改动。Implementer 已在该分支 commit 了实现代码——
你沿用同一 worktree 同一 branch 直接改代码 + 跑测试 + commit，不反馈给 Implementer，不复查。

读 git diff ${TARGET_BRANCH}..HEAD（本分支相对目标分支的全部改动）。
若本分支相对 ${TARGET_BRANCH} 无任何改动，直接输出 <promise>COMPLETE</promise>，不做任何动作。
发现改进点：直接改代码 → 跑测试 → refine: commit（不通过控制者、不通过 SendMessage）。
```

Reviewer 输出（一次性自改 + 极简汇报）：

```
<promise>COMPLETE</promise>
DONE
```

（改进点细节在 `refine:` commit message 里，不进汇报。）

分支 `afk/issue-42` 上的 commit 序列（线性叠加，Implementer 在前 Reviewer 在后）：

```
refine: 精简 flag 解析分支（Reviewer）
feat: 接入 --verbose 到 main（Implementer, commit 2）
feat: 实现 --verbose 选项解析（Implementer, commit 1）
```

> **跳过 Reviewer 的场景**：若 Implementer 完全结束后分支无任何 commit（`commits.length === 0`，如超时 / 失败），
> 控制者跳过 Reviewer（无 diff 可审），进**失败流程**——现场保全 + 落盘 runbook + 标 `failed`，零自动重试，不传染下游（完整示例见下文「失败与恢复」）。

### 阶段 3（第 1 轮）：Merger 拓扑合并 #42

本轮 Implementer / Reviewer 全部结束后，分派 Merger（`{{BRANCHES}}` = `afk/issue-42`）。先在主仓库 `git checkout ${TARGET_BRANCH}` 确认处于 develop（git 禁止同一分支在两个 worktree 同时检出，**不在 worktree 内 merge**）：

```bash
git merge afk/issue-42 --no-edit        # 拓扑合并，产生 merge commit（默认 message：Merge branch 'afk/issue-42'）
# 冲突读两侧解决，禁 -X theirs/ours（本示例无冲突）
uv run pytest                           # 每分支合完跑全量测试 → 142 passed
wt remove afk/issue-42 -D --foreground  # 拓扑合入后删分支 + 清理 worktree
gh issue close 42                       # 统一关 issue；若父 PRD 已全部完成一并关闭
```

Merger 输出（极简汇报；合并细节留在 git 历史）：

```
<promise>COMPLETE</promise>
DONE
```

控制者验证：

```bash
gh issue view 42 --json state           # → CLOSED
wt list | grep afk/issue-42             # → 无匹配（worktree 已清理）
gh pr list | grep 42                    # → 无匹配（本地 merge，无 PR）
```

### 循环：回到控制者切片下一轮（依赖解锁）

Merger 完成后，控制者按 DAG 拓扑序切下一轮 unblocked：#43 的 `blocked_by: [42]`，#42 已合并 → #43 解锁。#44 仍被 #43 阻塞。

```
本轮 unblocked = {#43}

#43 走同样的阶段 2 → 阶段 3：
wt switch -c afk/issue-43 -b ${TARGET_BRANCH}
→ Implementer → Reviewer（直接自改 refine: commit）
→ Merger git merge afk/issue-43 --no-edit → 末尾 summarizing commit
→ wt remove afk/issue-43 -D --foreground → gh issue close 43
```

第 3 轮：#44 的 `blocked_by: [43]` 已解锁 → 派 #44。

```
本轮 unblocked = {#44}
（同上流程，合并后清理 + 关 issue）
```

控制者切下一轮 unblocked = `{}` → 循环结束，提示用户进行 code review / QA。

> **Planner 不再被重跑**——一次性 DAG 已经把所有依赖关系编码好了；本轮 unblocked 集合空即停（无需 `MAX_ITERATIONS` 上限，无需"每轮重 Plan"）。

### 失败与恢复（watchdog 判死 → runbook → 同分支重派）

假设第 2 轮 #43 的 Implementer 挂死（长时间无任何落盘）。全过程：

**1. watchdog 退出通知到达**（分派时挂的后台脚本退出即唤醒控制者，一行死因）：

```
AgentIdleTimeoutError: worktree /path/to/wt-issue-43 idle 612s（>= 600s 阈值）
```

**2. 控制者判死 + 现场保全**：`TaskStop` 终止 agent；worktree 不删、branch 不动、永不 `reset --hard`。

**3. 落盘 runbook** `docs/afk-failures/issue-43.md`：

```
branch:   afk/issue-43
worktree: /path/to/wt-issue-43
commits:  a1b2c3d feat: logger 接入 verbose 开关（前次进度，自动保留）
error:    AgentIdleTimeoutError
失败摘要: watchdog 判死——worktree 612s 无文件活性与 reflog 变动

## 恢复
重新分派，prompt 末尾附：
Read docs/afk-failures/issue-43.md 了解前次失败，同分支继续，复用已 commit 进度。
```

**4. 标 `failed` + 不传染下游**：`docs/afk-plan.json` 中 #43 节点 `status: "failed"`；其余 unblocked issue 照常分派。

**5. 收尾交用户处置**：全部完成后列出 `afk-failures/` 清单。用户决定恢复 #43 → 控制者**同分支同 worktree 重新分派**，prompt 只有两行 + runbook 指引句（不重注入任何材料）：

```
Read ~/.claude/skills/afk-issue-loop/reference/implementer-prompt.md 获取完整指令并执行。
参数：ISSUE_NUMBER=43, BRANCH=afk/issue-43, TARGET_BRANCH=develop, WORKTREE=/path/to/wt-issue-43
（第三行：runbook「## 恢复」段的指引句，照抄即可）
```

新 agent 读到前次 runbook（不以同样方式再死一次），且确定性分支名 + worktree 复用让已 commit 的 `a1b2c3d` 进度自动捡回。

### 载体差异：subagent vs herdr

| 环节 | subagent（默认） | herdr |
|------|------|------|
| 角色运行 | 当前会话 `Agent` 工具 | 独立 pane（新 claude 实例） |
| worktree 创建 | 控制者预创建 `wt switch -c ...` | agent 自行创建（同一命令） |
| 完成通知 | 系统完成通知自动 re-invoke（**禁轮询**） | agent 汇报承载完成信号（CLI 细节见 herdr skill） |
| 超时判死 | **两载体统一 watchdog**：分派挂 `watchdog.sh` 即停手，600s 无活性才退出 + 一行死因；完成通知先到则杀掉 watchdog | 同左（同一脚本、同一阈值、同一失败流程，**无轮询**） |
| 适用场景 | ≤5 个 issue、想实时看进度 | 大量 issue、并行跑满、省主会话上下文 |
| 反馈闭环 | 不存在（Reviewer 直接改不反馈） | 不存在（herdr 不再需要跨会话 messaging） |

四角色的 prompt 语义（DAG、`<plan>`、`<promise>COMPLETE</promise>`、确定性分支名 `afk/issue-{N}`、拓扑 merge）两载体完全一致，区别只在「谁来跑」。

### 控制者验证要点汇总

1. **无残留 worktree**：`wt list` 中不再出现 `afk/issue-{N}`
2. **无 PR / 无 push**：`gh pr list` 无匹配；本地 merge 不推送
3. **issue 已关闭**：`gh issue view <id> --json state` → CLOSED；父 PRD 在子 issue 全部关闭后一并关闭
4. **分支已删**：拓扑合并后 `wt remove afk/issue-{N} -D --foreground`
5. **summarizing commit 已生成**：Merger 末尾 make a single commit summarizing the merge（message 自定）