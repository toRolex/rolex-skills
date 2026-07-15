快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/grill-with-docs)

## 功能

`grill-with-docs` 对你的计划或设计进行无休止的追问，一次一个问题，直到你和 agent 达成共同理解——同时把你的术语和决策写下来。

普通访谈会随 session 结束而蒸发；这个 skill **留下文档痕迹**。每个术语在确定的瞬间就写入 `CONTEXT.md` 词汇表，难以逆转的决策记录为 ADR。对齐的成果不会只停留在你脑子里。

## 何时使用

手动敲 `/grill-with-docs` 调用。

在变更的最开始使用，当计划还很模糊、领域语言还没确定时。如果只需要访谈不需要文档，直接用 `/grilling`；如果计划已经明确只需要记录术语，用 `/domain-modeling`。如果变更太大一个 session 装不下，先走 `/wayfinder`。

## 前置条件

本 skill 会在你的仓库中写入文件：`CONTEXT.md`（术语表）和 `docs/adr/`（架构决策记录）。两者都是惰性创建的——只在有东西要写时才创建。

## 访谈机制

引擎是 **grill（拷问）**：一次一个问题地走设计树，解决决策间的依赖关系。每个问题附带推荐答案。代码库能回答的问题直接查代码，不问你。

与普通 grill 的区别在于答案的去向：模糊的语言被锐化为规范术语并写入词汇表；ADR 只在决策难以逆转、没有上下文会让人惊讶、且是真实权衡结果时才创建。

## 效果良好的标志

- 一次只问一个问题，而不是一次性抛问卷
- 术语在确定时就写入 `CONTEXT.md`
- 自己能查代码解决的问题不问你
- ADR 保持稀缺

## 在流程中的位置

```
grill-with-docs → to-spec → to-tickets → implement → code-review
```

它是主构建链的第一步。产生共享理解和确定的词汇后，[to-spec](./to-spec.md) 将其合成为 spec。不确定用哪个 skill 时问 `/ask-rolex`。
