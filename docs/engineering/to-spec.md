快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/to-spec)

## 功能

`to-spec` 将当前对话和你的代码库理解转化为一份 spec（也可称为 PRD），然后发布到 issue tracker。

它**不会再次访谈你**。到这一步时对齐工作已经完成——`to-spec` 综合已知信息，而不是重新问一轮问题。

## 何时使用

手动敲 `/to-spec` 调用。

在变更已经讨论过、领域语言已确定，且你想在写代码之前把共享理解写下来时使用。如果还没对齐，先用 `/grill-with-docs` 访谈。需要把 spec 拆成 tickets 时用 `/to-tickets`。

## 前置条件

`to-spec` 发布到 issue tracker，所以需要先运行 `/setup-rolex-skills` 配置 tracker 和标签。它会自己应用 `ready-for-agent` 标签。

## Spec 包含的内容

- **问题陈述** — 什么坏了或缺失了，用项目自己的术语
- **解决方案** — 高层级的修复方案
- **用户故事** — 详尽的编号列表，每条独立可验证
- **实现决策** — 对话中已确定的方案选择
- **测试决策** — 测试的 seams 和完成标准
- **不在范围内** — 此变更不做什么
- **进一步备注** — 其他需要带上的信息

## Deep Module 检查

写 spec 前，`to-spec` 会勾勒测试的 **seams**，寻找 **深度模块** 机会——小接口背后隐藏大量功能。优先使用现有 seams，尽可能少，理想情况整个变更只有一个。

## 效果良好的标志

- 直接开始写 spec，而不是重新问你问题
- 写之前跟你确认 seams
- spec 用项目的领域语言写，不是泛泛的模板

## 在流程中的位置

```
grill-with-docs → to-spec → to-tickets → implement → code-review
```

在方案和术语确定之后、拆分实现 tickets 之前使用。前接 `/grill-with-docs`，后接 `/to-tickets`。不确定时问 `/ask-rolex`。
