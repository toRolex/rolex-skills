快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/research)

## 功能

`research` 通过阅读拥有答案的原始资料来回答问题，留下带引用的 Markdown 文件。它只从**一手来源**获取信息——官方文档、源代码、规范、第一方 API——从不依赖二手解读，因此保存的内容可追溯到权威来源。

## 何时使用

敲 `/research` 或 agent 自动调用。

当下一步是"找出某件事"时使用——API 怎么用、spec 具体怎么说、某个主张是否成立。如果通过访谈而不是阅读来打磨计划，用 `/grilling`；如果用一次性代码探索要构建什么，用 `/prototype`。

## 委托的阅读工作

核心操作是阅读在**后台 agent** 中进行。你继续工作；它去追查每个声明的一手来源，然后放下一个带引用的 Markdown 文件。调研是你委托的阅读，不是外包的思考——你拿回来的是一个带有来源的文档。

## 在流程中的位置

随时可用的独立工具。产出的文件喂养后续的 grilling 或 spec 编写。不确定时问 `/ask-rolex`。
