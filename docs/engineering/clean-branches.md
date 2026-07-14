快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/clean-branches)

## 功能

扫描本地和远程已合并的分支。标记已合并入当前分支的分支，一次性列表让用户勾选确认后删除并验证结果。也清理残留的 worktree。

## 何时使用

分支太多、合并后残留、worktree 未清理、远程有 stale 分支时。调用方式：**模型自动调用**。
