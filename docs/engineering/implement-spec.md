快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/implement-spec)

## 功能

`implement-spec` 把 `/to-spec` 和 `/to-tickets` 的产出在**一次运行**中实现为代码。它把 tickets 读成一张带 **blocking edges** 的 **task graph**，在就绪的 **frontier** 上并行跑 **implementer subagent**（各自在自己的 worktree、自己的分支上，内部驱动 `/tdd`），由 **merger subagent** 逐个 merge 到一条 **integration branch** 上，最后在整条分支上跑一次 `/code-review`。

与 subagent 之间的通信是稀疏的：通过 **context pointers**（指向 spec、tickets、research notes 和此前的 commits），不重复 pointer 已能获取的信息。

## 何时使用

手动敲 `/implement-spec` 调用。

当你更想编排整个构建、而不是亲自逐 ticket 驱动 `/implement` 时使用。tickets 还不存在时，先跑 `/to-spec` 和 `/to-tickets`。

## 在流程中的位置

```
grill-with-docs → to-spec → to-tickets → implement 或 implement-spec → code-review → pr → retro
```

它是主构建链构建步骤的编排版：与逐 ticket 的 `/implement` 二选一，收尾同样经过 `/code-review`。不确定时问 `/ask-rolex`。
