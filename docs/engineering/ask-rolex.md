快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/ask-rolex)

## 功能

`ask-rolex` 是本仓库所有 skill 的路由器。你说出你遇到的情况，它告诉你哪个 skill 或流程适合，按什么顺序跑。

它**自己不干活**——不 grilling、不写 spec、不修任何东西——它只定位。它存在的意义是：user-invoked 技能需要你自己记住它们存在，而 `ask-rolex` 就是你卸载记忆负担的地方。

## 何时使用

手动敲 `/ask-rolex` 调用。

任何时候不确定当前场景该用哪个 skill 就敲它。如果已经知道要哪个 skill，跳过路由器直接调用。

## 流程，不只是技能

`ask-rolex` 给你的核心概念是**流程（flow）**——贯穿多个 skill 的路径。大部分工作沿着一条主流程走：grill-with-docs → to-spec → to-tickets → implement → code-review。两条匝道汇入（triage、wayfinder），其余是独立 skill。

## 在流程中的位置

`ask-rolex` 是**路由器**——覆盖整个集合的独立地图。它是每个 doc 页都链接回的节点，不站在任何链*中*，而指向每条链*的入口*。当路由器的内容过时了，源码是最新的。
