快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/personal/ask-advisor)

> 依赖 `strong-model-consultant` agent。仓库在 `agents/strong-model-consultant.md` 提供了副本，把它复制或软链到 `~/.claude/agents/` 即可（`link-skills.sh` 只链接 skill，不链接 agent）。skill 以未限定名 `strong-model-consultant` 调度。

## 功能

把当前决策点交给强模型顾问（Opus），拿到决策建议。主线程（执行器）负责工具调用与后续执行。

## 何时使用

手动敲 `/ask-advisor` 调用。

主线程遇到瓶颈、需要强模型把关一个决策点时：目标不清、高影响多路径决策、模糊错误根因、高影响不可逆动作、陌生领域低置信、交付前验收复核。

## 在流程中的位置

独立工具。主线程即执行器，顾问是被动咨询方；单任务咨询不超过 3 次（见全局 CLAUDE.md 顾问调用规范）。
