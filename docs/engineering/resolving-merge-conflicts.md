快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/resolving-merge-conflicts)

## 功能

`resolving-merge-conflicts` 逐 hunk 解决进行中的 git merge 或 rebase 冲突，然后完成操作——解决、检查、提交。

它按**意图**解决，不是按文本。触碰 hunk 之前，它追查每一边的**一手来源**——commit 消息、PR、原始 issue——理解为什么做了这个变更，然后在兼容时保留双方意图。

## 何时使用

敲 `/resolving-merge-conflicts` 或 agent 自动调用。

在 merge 或 rebase 进行中、git 遇到无法自行解决的冲突时使用。如果 merge 已做完但有些东西坏了，用 `/diagnosing-bugs` 代替。

## 按意图解决

冲突的陷阱是把它当成文本问题——选"ours"或"theirs"让标记消失。此 skill 将其作为**意图**问题处理。每个 hunk 的两边都存在是因为有人想要什么；解决必须在可能时尊重双方意图。

## 效果良好的标志

- 每个解决的 hunk 保留双方行为，或注明不能保留的权衡
- 没有出现两边都不存在的新行为
- 项目自己的检查在提交前运行并通过
- merge 或 rebase 一直完成到提交，从不 abort

## 在流程中的位置

随时可用的独立工具。merge 卡住时调用。不确定时问 `/ask-rolex`。
