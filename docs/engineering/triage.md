快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/triage)

## 功能

`triage` 将项目 issue tracker 上的 issue 通过一个小型**状态机**进行 triage 流转——分类、验证声明、必要时 grilling 精炼、产出 ready-for-agent 的 brief。

它不会闭着眼睛打标签。每个 triage 后的 issue 携带一个**分类**角色（`bug` / `enhancement`）和一个**状态**角色（`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`）。它*推荐并等待*——告诉你分类和建议，你说"做"了才动手。在提升到 `ready-for-agent` 之前，先验证声明：bug 要复现，PR 要检出运行。

## 何时使用

手动敲 `/triage` 并用自然语言描述需求。例如"显示所有需要我关注的内容"、"我们来看 #42"、"把 #42 移到 ready-for-agent"。

当 issue tracker 上有未经处理的原始报告，想整理、验证、变为 agent 或人可以接取的工作时使用。

## 前置条件

`triage` 读写 issue tracker，需要先运行 `/setup-rolex-skills` 配置 tracker 和标签映射。

## PR 是带代码的 issue

当 tracker 将外部 PR 作为请求面处理时，`triage` 用*同一个*状态机处理 PR——相同的分类、状态、流转——只是状态读的是 diff 而非报告。

## 验证先于 brief

验证是将 `triage` 与随便打标签区分开的步骤。它按报告人的步骤复现 bug，或检出 PR 运行测试，然后报告：验证通过（带代码路径）、失败、或细节不足（这本身就是强 `needs-info` 信号）。同时还检查**冗余**（是否已实现？→ `wontfix`）和**历史拒绝**（`.out-of-scope/` 是否已有记录？）。

## 效果良好的标志

- 每个处理的条目恰好有一个分类角色和一个状态角色
- 给你推荐和理由后等待，而不是自己直接改标签
- bug 被复现、PR 被运行后才到 `ready-for-agent`
- 所有 tracker 评论以 AI 免责声明开头

## 在流程中的位置

`triage` 是 issue tracker 的**定期维护**——报告堆积时就跑一次。产出的 brief 后续由 `/implement` 接取。需要精炼时依赖 `/grilling` 和 `/domain-modeling`。不确定时问 `/ask-rolex`。
