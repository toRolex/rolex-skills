快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/pr)

## 功能

`pr` 按 **Summary / Evidence / Merge Danger** 三段模板撰写 PR body：

- **Summary**：用能讲清关键点的最小视图展示改动——pseudocode、call tree、component tree、file tree、Mermaid 或 diff，让可视化的形态与主题匹配。
- **Evidence**：证明改动有效的 before/after 证据。截图是 S-tier；基于执行的测试结果、console 输出是 A-tier。
- **Merge Danger**：判断这是 one-way door 还是 two-way door（回滚成本），并给出 blast radius（波及范围）。

跳过所有 preamble，行文简短，使用 `GLOSSARY.md` 中项目的领域语言。它是 model-invoked 的，所以 agent 每次写 PR 时都会自动伸手去够它。

## 何时使用

不用手动敲——agent 写 PR body 时自动调用；也可以直接 `/pr`。

改编自 Humanlayer 的 show-me skill（作者 Dex Horthy），credits 见源码 frontmatter。

## 在流程中的位置

```
grill-with-docs → to-spec → to-tickets → implement 或 implement-spec → code-review → pr → retro
```

它在 `/code-review` 之后、PR 发出之前接入主链路。不确定时问 `/ask-rolex`。
