# EXAMPLES

## 场景：CLI 工具添加 `--verbose` 选项（四角色一轮完整示例）

项目 `my-cli`，已有 `CONTEXT.md`。用户刚完成 `/grill-with-docs` → `/to-prd` → `/to-issues`，产出 3 个 `ready-for-agent` 的 issue，形成串行依赖链。下文展示从 Planner 到 Merger 的完整一轮，以及依赖解锁后回到 Planner 的循环，直到 `<plan>` 为空。

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

### 阶段 1：Planner 依赖分析 → `<plan>`

控制者分派 Planner（subagent 用 `Agent` 工具，herdr 开独立 pane，prompt 相同）。prompt 关键片段：

```
你是 Planner。分析当前仓库 open 的 ready-for-agent issue，构建依赖图，输出当前可立即实现的 unblocked issue 列表。

1. 扫描：gh issue list --label ready-for-agent --state open --limit 100 --json number,title,body,labels,comments
2. 依赖分析：Blocked by 字段优先，其次资源 / 空间 / 契约三条补充
3. 分配分支名：afk/issue-{N}（确定性，重 Plan 恒得同名，进度自然保留）
4. 输出：<plan> 包裹的 JSON，只含当前 unblocked
```

Planner 输出：

```
<plan>
{"issues": [{"number": 42, "title": "Add --verbose flag to root command", "branch": "afk/issue-42"}]}
</plan>
DONE
```

控制者解析：正则提取 `<plan>...</plan>` → JSON.parse → 校验每项 `number/title/branch`。#43、#44 被阻塞，本轮不派。

> 多个 unblocked 时 plan 为多元素列表，控制者跨 issue ≤4 并行分派。分支名格式恒为 `afk/issue-{N}`（如 `afk/issue-42`、`afk/issue-43`）；空列表 `{"issues":[]}` 结束循环。本示例为串行依赖链，每轮单条。

### 阶段 2：Implementer + Reviewer（每 issue：worktree → 实现 → 审查）

**#42** 创建 worktree（确定性分支 `afk/issue-42`）：

```bash
wt switch -c afk/issue-42 -b ${TARGET_BRANCH}
```

分派 Implementer，prompt 注入占位符 → 实际值：

```
{{ISSUE_NUMBER}} = 42
{{ISSUE_TITLE}} = Add --verbose flag to root command
{{BRANCH}} = afk/issue-42
${TARGET_BRANCH} = develop
+ issue body 与 comments（gh issue view 42 --json title,body,comments）
+ CONTEXT.md 完整内容 + 相关 ADR
+ worktree 绝对路径（herdr 模式改为「自行 wt switch -c afk/issue-42 -b develop」）
```

prompt 红线片段（摘自 implementer-prompt.md）：

```
1. 绝不创建 GitHub PR：gh pr create 是违规操作
2. 绝不推送远程：git push 在任何情况下都不执行
3. 绝不 merge、绝不关闭 issue：merge 与关 issue 由 Merger 统一负责
4. 汇报前必须走完：全量测试通过 → commit（中文描述）→ <promise>COMPLETE</promise>

严格遵循 TDD：红 → 绿 → 循环 → 重构 → 全量测试（贴实际输出）→ commit（中文）
```

Implementer 输出：

```
全量测试：uv run pytest → 142 passed
commit：实现 --verbose 选项（修改 cli/args.py、cli/main.py 两个文件）
未 merge、未关闭 issue。
<promise>COMPLETE</promise>
DONE
```

控制者检查分支有 commit（`git log afk/issue-42` 非空）→ 触发同分支 Reviewer。

分派 Reviewer（同一 worktree / 分支 `afk/issue-42`），prompt 关键片段：

```
你正在审查分支 afk/issue-42 上对 issue #42：Add --verbose flag to root command 的改动。
读 git diff ${TARGET_BRANCH}..HEAD（本分支相对目标分支的全部改动）。
若本分支相对 ${TARGET_BRANCH} 无任何改动，直接输出 <promise>COMPLETE</promise>，不做任何动作。
发现可改进：SendMessage 直连 impl-42 反馈（只反馈，不自己改）→ impl-42 修复 → 复查。
```

Reviewer 发现 flag 解析分支可简化 → SendMessage(impl-42) 反馈 → impl-42 修复并 commit → 复查通过 → 输出：

```
已反馈 impl-42：简化 flag 解析分支（cli/args.py）。
impl-42 已修复并 commit。复查通过。
<promise>COMPLETE</promise>
DONE
```

> **跳过 Reviewer 的场景**：若 Implementer 完全结束后分支无任何 commit（`commits.length === 0`，如超时 / 失败），
> 控制者跳过 Reviewer（无 diff 可审），标记后交下轮 Planner 重分析。

### 阶段 3：Merger（统一 squash merge + 关 issue）

本轮全部 Implementer / Reviewer 结束后，分派 Merger（`{{BRANCHES}}` = `afk/issue-42`）。先在主仓库 `git checkout ${TARGET_BRANCH}` 确认处于 develop（git 禁止同一分支在两个 worktree 同时检出，**不在 worktree 内 merge**）：

```bash
git merge --squash afk/issue-42          # 分支全部改动暂存为单条，未提交
# 冲突读两侧解决，禁 -X theirs/ours（本示例无冲突）
uv run pytest                             # 每分支合完跑全量测试 → 142 passed
git commit -m "feat: Add --verbose flag to root command（#42）"
wt remove afk/issue-42 -D --foreground    # squash 后删分支 + 清理 worktree
gh issue close 42                         # 统一关 issue；若父 PRD 已全部完成一并关闭
```

Merger 输出：

```
合并 afk/issue-42 → develop，squash commit 生成，测试 142 passed
gh issue close 42 → CLOSED
<promise>COMPLETE</promise>
DONE
```

控制者验证三件事：

```bash
gh issue view 42 --json state           # → CLOSED
wt list | grep afk/issue-42             # → 无匹配（worktree 已清理）
git cat-file -p HEAD | grep "^parent"   # → 只 1 行（1-parent squash commit，非 origin 上 commit）
gh pr list | grep 42                    # → 无匹配（本地 squash，无 PR）
```

squash message 里的 `（#42）` 是 agent 自写，不算 GitHub PR merge——只有匹配 `Merge pull request #N` 才是。

### 循环：回到 Planner（依赖解锁）

Merger 完成后回到阶段 1 **重新 Plan**（每轮重 Plan，依赖图可能变化）。此时 #43 已解锁（#42 已合入并关闭）：

```
<plan>
{"issues": [{"number": 43, "title": "Wire verbose flag into logger middleware", "branch": "afk/issue-43"}]}
</plan>
DONE
```

#43 走同样的阶段 2 → 阶段 3：`wt switch -c afk/issue-43 -b ${TARGET_BRANCH}` → Implementer → Reviewer → Merger `git merge --squash afk/issue-43` → commit `feat: Wire verbose flag into logger middleware（#43）` → `gh issue close 43`。#44 同理。直到：

```
<plan>
{"issues": []}
</plan>
DONE
```

→ 循环结束，提示用户进行 code review / QA。

### 载体差异：subagent vs herdr

| 环节 | subagent（默认） | herdr |
|------|------|------|
| 角色运行 | 当前会话 `Agent` 工具 | 独立 pane（新 claude 实例） |
| worktree 创建 | 控制者预创建 `wt switch -c ...` | agent 自行创建（同一命令） |
| 完成通知 | agent 返回即知 | 需主动轮询 `herdr agent list` |
| 适用场景 | ≤5 个 issue、想实时看进度 | 大量 issue、并行跑满、省主会话上下文 |

四角色的 prompt 语义（依赖分析、`<plan>`、`<promise>COMPLETE</promise>`、确定性分支名 `afk/issue-{N}`、squash merge）两载体完全一致，区别只在「谁来跑」。

### 控制者验证要点汇总

1. **1-parent squash commit**：`git cat-file -p HEAD | grep "^parent"` 只输出 1 行；非 `origin/${TARGET_BRANCH}` 上的 commit
2. **无残留 worktree**：`wt list` 中不再出现 `afk/issue-{N}`
3. **无 PR / 无 push**：`gh pr list` 无匹配；本地 merge 不推送。PR 误判修正——只有 `Merge pull request #N` 才是 GitHub PR merge
4. **issue 已关闭**：`gh issue view <id> --json state` → CLOSED；父 PRD 在子 issue 全部关闭后一并关闭
5. **分支已删、worktree 已清理**：squash 后 `wt remove afk/issue-{N} -D --foreground`
