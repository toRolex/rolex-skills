快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/personal/publish-release)

## 功能

自动检测仓库分支模型后发版：Git Flow 从 develop 分支，Trunk-based 从 main（trunk）分支。处理版本号 bump、changelog 更新、Git 标签、合并到 main、推送到远程。减少发版的重复操作。

## 何时使用

敲 `/publish-release` 或 agent 自动调用。

说"发版"、"发布"、"release"、"bump version"、"打 tag"时。

## 在流程中的位置

独立工具。主开发流完成后使用。不确定时问 `/ask-rolex`。
