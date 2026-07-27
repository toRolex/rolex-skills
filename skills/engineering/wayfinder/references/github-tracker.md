# GitHub tracker 接线细节

只在用 GitHub Issues 作为 wayfinder map 的 tracker 时读这份资料。其他 tracker 见同名目录下的姊妹文件。

## 原生关系能力

GitHub 当前暴露两个原生 issue 关系：

| 关系 | GraphQL mutation | 查询字段 |
|------|------------------|----------|
| Sub-issue（子 issue） | `addSubIssue(input: { issueId, subIssueId })` | `Issue.subIssues` / `Issue.parent` |
| Blocked-by（被阻塞） | `addBlockedBy(input: { issueId, blockingIssueId })` | `Issue.blockedBy` / `Issue.blocking` |

注意：`addBlockedBy` 的 `blockingIssueId` 是**阻塞者**（更早完成的 ticket），不是被阻塞的 ticket——方向容易反。`Issue.blockedBy` 字段返回阻塞这个 issue 的那些 ticket 的列表。

## 探测 query

Charting 第一步用这个 query 确认 tracker 暴露的关系能力，避免走 body 文字降级：

```bash
gh api graphql -f query='
{ __type(name: "Issue") { fields { name } } }
' | jq '.data.__type.fields[].name' | grep -iE 'block|depend|track|sub'
```

期望看到至少 `subIssues`、`blockedBy`、`blocking`。如果字段缺失，说明 repo 没启用 issues relationships，停下来跟用户确认走降级方案。

## 接线脚本骨架

不要在 shell heredoc 里写 issue body——反引号、`$()`、f-string 都会被 zsh 解释掉。改用脚本 + 临时 body 文件。

### 创建 issue

```bash
gh issue create --title "$TITLE" --label "$LABEL" --body-file /tmp/body.md
```

### Sub-issue 接线

```bash
gh api graphql -f query='
mutation($issueId: ID!, $subIssueId: ID!) {
  addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) {
    issue { number }
    subIssue { number }
  }
}
' -f issueId="$PARENT_ID" -f subIssueId="$CHILD_ID"
```

### Blocked-by 接线

```bash
gh api graphql -f query='
mutation($issueId: ID!, $blockingIssueId: ID!) {
  addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
    issue { number }
  }
}
' -f issueId="$BLOCKED_ID" -f blockingIssueId="$BLOCKER_ID"
```

### 验前沿已就绪

Charting 完成时跑一次，验证接线真落地：

```bash
gh api graphql -f query='
query($mapNumber: Int!) {
  repository(owner: "$OWNER", name: "$REPO") {
    issue(number: $mapNumber) {
      subIssues(first: 50) {
        nodes {
          number
          blockedBy(first: 10) { totalCount nodes { number } }
        }
      }
    }
  }
}
' -f mapNumber=363
```

每个子 ticket 的 `blockedBy.totalCount` 应等于它在该 map 内的真阻塞数（open 同侪）。`totalCount > 0` 但其中 `state = CLOSED` 的不算真阻塞——manually 评估时把已关闭的 blocker 排除。

## 常见坑

- **`addBlockedBy` 参数名**：是 `blockingIssueId`，不是 `blockedById`。GraphQL schema 里写得很清楚，但容易记反。
- **Node ID 不是 issue 编号**：mutation 要 GraphQL 全局 ID（`I_kwDO...` 形式），不是 `#363`。先用 `gh issue view <n> --json id` 取。
- **已关闭 ticket 仍计入 `blockedBy`**：GitHub 的 blockedBy 关系是持久边，关闭 blocker 不会自动消解。判断 frontier 时手动过滤 `state = OPEN`。
- **Sub-issue 是单向关系**：用 `addSubIssue` 设的父子关系是 map 视角的，child issue 的 body 里不会出现"Parent: #363"字样——那是另外的 Projects 字段。需要双向视觉提示时，给子 issue body 末尾手动追加 `Parent map: #N`。
- **Body 转义陷阱**：`bash -c "$(cat <<'EOF' ... EOF)"` 嵌套 Python heredoc 在 zsh 下会因反引号和 `$()` 触发命令替换。统一改用脚本文件 + `--body-file`。

## 故障兜底

如果 `addBlockedBy` 返回 `Field 'addBlockedBy' doesn't exist on type 'Mutation'`：

1. 确认 repo 启用了 issues relationships（Settings → General → Features → Issues）。
2. 确认 gh CLI 版本 ≥ 2.50（旧版本 GraphQL schema 可能不全）。
3. 仍不行：跟用户确认是否走 body 文字降级，并在 map 的 Notes 段落记录"tracker 不支持原生 blocking，使用 body 约定"。

如果 sub-issue 接不上但 blocked-by 接上了：map 拓扑仍可读（GitHub 会把 child 渲染在 map 下），但需要给每个子 issue body 末尾加 `Parent map: #N` 让 Relations 视图双向可见。