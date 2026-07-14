快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/safe-pull)

## 功能

安全执行 git pull + rebase。自动检查远程变更、stash 本地修改、rebase、恢复 stash、处理冲突、推送。覆盖 main/develop 同步和功能分支 rebase。

## 何时使用

说"同步代码"、"拉取最新"、"rebase main"、"sync"、"pull latest"、"update branch"时。调用方式：**模型自动调用**。
