# GitHub tracker 接线

只在用 GitHub Issues 作为 wayfinder map 的 tracker 时读这份资料。其他 tracker 见同名目录下的姊妹文件。

SKILL.md 要求先探测 tracker 暴露的原生关系能力。本文件只给**创建接线**用的规范——探测与故障兜底不重复。

## 创建 Sub-issue

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

## 创建 Blocked-by

```bash
gh api graphql -f query='
mutation($issueId: ID!, $blockingIssueId: ID!) {
  addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
    issue { number }
  }
}
' -f issueId="$BLOCKED_ID" -f blockingIssueId="$BLOCKER_ID"
```

**参数方向容易反**：`blockingIssueId` 是**阻塞者**（更早完成的 ticket），不是被阻塞的 ticket。Schema 写得清楚但容易记错。

## 取 GraphQL Node ID

两个 mutation 都要的是 GraphQL 全局 ID（`I_kwDO...` 形式），不是 issue 编号 `#363`。

```bash
gh issue view <number> --json id
```

## 不要做

- 不要用 `gh issue edit --add-blocked-by`——那是 gh CLI 的旧接口，行为与 GraphQL `addBlockedBy` 不一致；统一用上面的 GraphQL mutation。
- 不要在 shell heredoc 里写 issue body——反引号、`$()`、f-string 都会被 zsh 解释掉。改用脚本 + `--body-file`。