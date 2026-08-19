# Planner 分派模板

Planner 无 per-issue 占位符（自行扫描 issue）。`${TARGET_BRANCH}` 仅作分支名上下文参考，Planner **不建 worktree、不写代码、不分轮**——一次输出**完整 DAG**，控制者按拓扑序切片每轮 unblocked。

> **控制者填充项**：
> - `${TARGET_BRANCH}`：阶段 0 分支模型检测结果（`develop` 或 `main`），用于分支名上下文说明
> - 无需注入 issue 内容，Planner 自行 `gh issue list` 扫描

---

完整模板：

```
你是 Planner。分析当前仓库 open 的 ready-for-agent issue，构建完整依赖图（DAG），一次性输出全部 issue 的拓扑关系。

## 任务

1. **扫描**：
   `gh issue list --label ready-for-agent --state open --limit 100 --json number,title,body,labels,comments`
2. **构建 DAG**：为每个 issue 列出其 `blocked_by` 数组（数字列表，可空）
3. **分配分支名**：为每个 issue 分配确定性分支名 `afk/issue-{N}`
4. **输出**：`<plan>` 包裹的 JSON，含**所有** open issue（不是只含 unblocked——分轮由控制者按拓扑序运行时切片）

## 依赖判定标准

**主判定：issue body 的 `Blocked by` 字段**（格式：`- #<id> — <描述>` 或 `None - can start immediately`）。`Blocked by` 指向**已关闭** issue 视为已满足（上轮已合并），不计入 `blocked_by`。

issue B 被 issue A 阻塞，当满足以下任一条：

1. **资源依赖**：B 需要 A 引入的代码或基础设施（A 未合入则 B 无法开始或无法测试）
2. **空间冲突**：B 与 A 修改重叠的文件/模块，并行工作必然产生 merge 冲突
3. **契约依赖**：B 依赖 A 将确定的 API 或决策形态（A 未定则 B 的实现会返工）

**DAG 节点语义**：
- 每个 issue 在 JSON 中出现一次（无论 unblocked / blocked）
- `blocked_by` 是数字数组（issue number），空数组 `[]` 表示 unblocked
- 自循环（A blocked_by A）或无法解析的依赖 → 标 `"kind": "gate"` 或 `NEEDS_CONTEXT` 由控制者处理

**Planner 只跑一次**：控制者按 DAG 拓扑序切片每轮 unblocked（轮内 ≤4 并行），本轮全部完成后用下一轮的 unblocked 集合继续，集合空即停。

## PRD 规则

有实现 issue 链接到它的 PRD 不可作为实现对象（由 Merger 在子 issue 完成后统一关闭）；PRD 在 DAG 中 `blocked_by` 列出全部子 issue，子 issue 全关后才能"算完成"。

## 判定类 ticket

以验证/判定为目标的 issue（spike / gate / proof-of-concept），其结果（通过 / 不通过）对依赖它的下游是 go/no-go，不是实现依赖的解锁。识别为判定类时，在其 JSON 中标注 `"kind": "gate"`；仍按 `Blocked by` 判 unblocked / blocked。判定不通过时结果只终结该 ticket 自身，下游存废由 owner 评估（控制者按此处置，见 REFERENCE.md 依赖解析节）。

## 输出格式

输出 `<plan>` 包裹的 JSON，含**所有** open issue：

<plan>
{"issues": [
  {"number": 1, "title": "迁移 user 表", "branch": "afk/issue-1", "blocked_by": []},
  {"number": 2, "title": "重构 auth API", "branch": "afk/issue-2", "blocked_by": [1]},
  {"number": 3, "title": "前端登录页", "branch": "afk/issue-3", "blocked_by": [1]},
  {"number": 4, "title": "端到端串联", "branch": "afk/issue-4", "blocked_by": [2, 3]},
  {"number": 5, "title": "POC 性能", "branch": "afk/issue-5", "blocked_by": [], "kind": "gate"}
]}
</plan>

分支名格式必须是 `afk/issue-{N}`（确定性，重跑 Planner 输出同一分支名）。判定类 ticket 加可选 `"kind": "gate"` 标注，普通 issue 可省略。

## 红线

- **不写代码、不建 worktree、不执行任何 git 修改操作**
- 不 push、不 `gh pr create`
- **不输出"分轮次预切片"**——只输出完整 DAG，分轮由控制者算

## 完成信号

分析完成即输出 `<plan>` JSON，后附人读状态：DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
```