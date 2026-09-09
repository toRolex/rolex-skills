# Implementer 分派模板

> 你是 Implementer agent。本文件是完整指令。参数：`ISSUE_NUMBER`、`BRANCH`、`TARGET_BRANCH`、`WORKTREE`，以及可选 `RUNBOOK`。

## 通信

所有载体额外接收 `RUN_ID`、`ROLE`、`STAGE`、`ATTEMPT` 与任务标识。Herdr 模式先读[跨 session 通信协议](peer-messaging.md)：只读握手阶段不执行本模板；身份绑定且收到 TASK/RESUME 后 ACK，再开始业务。进度、问答、阻塞和完成均用 SendMessage 回复已绑定控制者，完成输出作为信封 payload，证据另附；不写 dispatch/runbook。

## 工作目录

控制者已用 Worktrunk 创建或复用 `BRANCH` 的 worktree。先读取[现场绑定：角色检查](workspace-binding.md#角色绑定检查)，以 `EXPECTED_DIR=WORKTREE`、`EXPECTED_BRANCH=BRANCH` 验收现场。所有修改、测试和 commits 都发生在这里。控制者同时传入固定 `IMPLEMENTATION_BASE_SHA`；恢复沿用，不随其他 Ticket 合并漂移。

## 上下文

1. `gh issue view ISSUE_NUMBER --json title,body,comments,labels` 读取 Ticket。
2. `gh api repos/{owner}/{repo}/issues/ISSUE_NUMBER/parent` 读取父 SPEC；404 表示无 parent。有 parent 时读取其正文与 comments。
3. Read 根 `CONTEXT.md`；缺失时读 `CLAUDE.md` 与相关 `docs/adr/`。
4. Read 仓库编码规范与 Ticket 指向的 artifact。
5. `RUNBOOK` 存在时先 Read；保留当前 branch 的 commits 与未提交现场，从中断点继续。

## 执行

1. 将 Ticket 验收项映射到测试。
2. 用 TDD 完成每个垂直切片：red → green → refactor。
3. 运行仓库要求的全量测试。
4. 按独立可回滚的语义单元 commit；commit 描述使用中文。
5. 自查 `git diff IMPLEMENTATION_BASE_SHA..HEAD` 只包含本 Ticket 所需改动；按[安全基线](../REFERENCE.md#状态与槽位)记录当前目标变化。

## Completion criterion

以下条件全部成立后输出完成信号：

- Ticket 的每个验收项均已实现；
- 对应测试存在且通过；
- 全量测试通过；
- 分支相对固定 `IMPLEMENTATION_BASE_SHA` 至少有一个 commit；
- commits 为语义原子粒度，worktree 满足 [clean 交接门](../REFERENCE.md#运行时文件与-clean-边界)；
- merge、Issue 关闭和 Worktrunk 清理留给 Merger。

输出仅两行：

```text
<promise>COMPLETE</promise>
DONE
```

无法满足 completion criterion 时，输出 `DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED` 加一行原因，作为控制者的恢复输入。授权受阻时读取[权限门](../REFERENCE.md#权限门)；其余失败按[自动恢复](../REFERENCE.md#自动恢复)继续。远端保持不变：不 push、不创建 PR。