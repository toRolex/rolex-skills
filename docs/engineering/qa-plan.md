快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/qa-plan)

## 功能

根据最近一批 commit 生成 step-by-step QA 测试计划，并保存为 GitHub issue。每个步骤包含测试环境、预期结果、测试步骤。

## 何时使用

手动敲 `/qa-plan` 调用。

发布前或大功能合并前，需要系统性的 QA 计划时。

## 在流程中的位置

独立工具。主流程末尾、发版前使用。不确定时问 `/ask-rolex`。
