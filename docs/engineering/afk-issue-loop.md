快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/afk-issue-loop)

## 功能

遍历 GitHub 上 `ready-for-agent` 标签的 issue，逐个分发给独立 agent 处理。每个 issue 在隔离的 git worktree 中执行，互不干扰。全部完成后提醒手动 code review 或 QA。

## 何时使用

适合批量处理积压的 issue——开启后不用管，agent 逐个解决。调用方式：**手动调用**。
