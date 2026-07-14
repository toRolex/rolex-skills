---
name: clean-branches
description: "清理本地和远程已合并的 Git 分支。扫描所有本地分支和远程 tracking branches，标记已合并入当前分支的分支，一次性列表让用户勾选确认后删除并验证结果。使用场景包括：分支太多要清理、合并后残留、worktree 未清理、远程 stale branches。当用户提到 清理分支/删分支/整理分支/clean branches/branch cleanup/prune branches/git clean 时务必使用。对于合并后残留的发布分支、废弃的功能分支、已修复的 bugfix 分支尤其适用。"
---

# Clean Branches

清理已合入的 Git 分支，联动删除本地和远程。

## 核心流程

### 1. 收集状态

并行执行以下命令：

```bash
# 当前分支 + 本地全部分支 + 跟踪关系
git branch -vv

# worktree 列表（防止误删正在使用的分支）
wt list 2>/dev/null || git worktree list

# 所有远程分支
git branch -r

# 已合并入当前分支的本地分支（排除当前分支和 main）
git branch --merged | grep -v '^*' | grep -v 'main$' | grep -v 'master$' | grep -v "$(git rev-parse --abbrev-ref HEAD)"

# 已合并入当前分支的远程 tracking branches（如有 origin）
git branch -r --merged origin/HEAD 2>/dev/null | grep -v 'origin/HEAD' | grep -v 'origin/main' | grep -v 'origin/master'
```

### 2. 分析并呈现

组装一张完整表格，包含：

| 类型 | 分支名 | 最新提交 | 已合并 | 关联 worktree | 建议 |
|---|---|---|---|---|---|
| local | feature/xxx | abc123 | 是 | 否 | 可删 |
| remote | origin/xxx | def456 | 是 | - | 可删 |

关键规则：
- **保护当前分支**和 `main`/`master`，绝不建议删除
- **有活跃 worktree 的分支**标记为"使用中"，需要用户明确确认才删
- **未合并的分支**标记为"未合并"，说明风险
- **远程有而本地无的分支**如果已合并，标记可删

### 3. 一次性确认

**不要逐个问。** 一次性呈现完整表格，让用户用编号或批量范围来选：

```
以下分支已合并入当前分支 (develop)，建议删除：

本地 (6):
  1. release/v0.2.0        [4963987] 可删
  2. feature/payment       [548ad1f] 可删
  3. feature/ui-taste      [4dfcf23] 可删
  ...

远程 (3):
  a. origin/feature/payment  可删
  b. origin/bugfix/login     可删
  ...

请选择要删除的分支（如 1,2,3,a,b 或 all）：
```

如果用户说"合并了的都删"或"all"，直接执行全部。

### 4. 执行删除

```bash
# 删除本地分支（安全删除，仅合并过的才会成功）
git branch -d <branch1> <branch2> ...

# 删除远程分支
git push origin --delete <branch1> <branch2> ...
```

### 5. 验证并报告

```bash
git branch -vv
git branch -r
```

输出最终状态，确认清理结果。如果有因未合并而删除失败的分支，单独列出说明。

## 安全防护

- **绝不**在删除前运行 `git fetch --prune` 或 `git remote prune` — 这会让用户丢失远程分支引用，应先让用户确认
- 使用 `git branch -d`（小写 d，安全模式），不是 `-D`（大写 D，强制删除）
- 如果用户要求强制删除未合并分支，必须先警告丢失提交的风险
- 如果当前 worktree 是 detached HEAD、rebase 中、merge 中，先警告不清理
