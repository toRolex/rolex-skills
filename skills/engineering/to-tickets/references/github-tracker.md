# GitHub tracker 接线

当使用 GitHub Issues 发布 tickets 时，读取这份接线规范；适用于 `to-tickets` 和 Wayfinder。其他 tracker 见同名目录下的姊妹文件。

`to-tickets` 和 Wayfinder 都要求先探测 tracker 暴露的原生关系能力。本文件只给**创建接线**用的规范——探测与故障兜底不重复。

> 需要 gh ≥ 2.55 才支持 `--add-sub-issue` / `--add-blocked-by`。旧版本需要走 GraphQL `addSubIssue` / `addBlockedBy` mutation + `gh issue view <number> --json id` 取 Node ID。

## 将 ticket 设为来源 issue 的 Sub-issue

仅当 tickets 来源于一个既有 issue 时，对每张新 ticket 执行一次；这条 parent-child 关系与 ticket 之间的 blocking edges 相互独立。

```bash
gh issue edit <父号> --add-sub-issue <子号>
```

## 创建 Blocked-by

```bash
gh issue edit <被阻塞号> --add-blocked-by <阻塞者号>
```

**参数方向容易反**：第二个数是**阻塞者**（更早完成的 ticket），不是被阻塞的 ticket。

反向 `blocking` 边会自动建立。

## 不要做

- 不要在 shell heredoc 里写 issue body——反引号、`$()`、f-string 都会被 zsh 解释掉。改用脚本 + `--body-file`。