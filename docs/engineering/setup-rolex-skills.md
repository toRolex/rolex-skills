快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/setup-rolex-skills)

## 功能

`setup-rolex-skills` 告诉一个仓库工程技能应该如何在其中运行——issue 存在哪、triage 标签叫什么、领域文档放哪——并把答案记录为其他 skill 读取的**配置**。

它写配置，不硬编码行为。工程链假设 `docs/agents/` 下有三个文件存在；此 skill 是一次性 bootstrap 来产出它们的。

## 何时使用

手动敲 `/setup-rolex-skills` 调用。

**每个仓库一次，在首次使用其他工程 skill 之前**。如果 `/triage`、`/to-spec`、`/to-tickets` 开始猜你的 issue 在哪或应用不存在的标签，说明还没跑过它。只有切换 issue tracker 或从头开始时才需要重新运行。

## 三个决策

- **Issue tracker** — 问题在哪跟踪。GitHub、GitLab、本地 markdown、或其他
- **Triage 标签** — 仅在安装了 triage skill 时询问。默认用标准名称
- **领域文档** — 默认单上下文（一个 `CONTEXT.md` + `docs/adr/`），发现 monorepo 信号时提供多上下文选项

输出是 `docs/agents/` 下的一组文件，加上 `CLAUDE.md` 或 `AGENTS.md` 中的 `## Agent skills` 区块。

## 在流程中的位置

一次性设置，整个工程技能集的基础。在其之上运行 `/triage`、`/to-spec`、`/to-tickets`。不确定时问 `/ask-rolex`。
