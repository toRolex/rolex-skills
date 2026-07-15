快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/wayfinder)

## 功能

`wayfinder` 将大到无法在一个 agent session 中完成的工作——路线还笼罩在迷雾中——绘制为 issue tracker 上的**共享地图**，逐个解决问题直到路线清晰。它**计划，不执行**：每个 ticket 解决一个决策，地图完成时没有需要决定的事了。

## 何时使用

手动敲 `/wayfinder` 调用。

当工作量**超过一个 session 能装下**且路线还模糊时使用。如果思路已经清楚，直接用 `/to-spec`；如果已有明确计划，用 `/to-tickets`。Wayfinder 在两者之上：迷雾太多无法直接 spec 时才用。

## 前置条件

地图和 tickets 存在 issue tracker 上，需要先运行 `/setup-rolex-skills` 配置 tracker。

## 地图是索引，迷雾是前沿

**地图**是一个 `wayfinder:map` issue，其 tickets 是子 issue——整个团队可以看的一个 URL。它是**索引，不是存储**：每个决策只存在一个地方（它的 ticket），地图只做摘要和链接。session 加载地图的低分辨率视图，按需放大 tickets。

活跃 tickets 之外是**战争迷雾**——可以判断即将到来但还无法确定的问题。判断一个东西是 ticket 还是迷雾的标准是：你现在能否*精确陈述问题*，不是能否回答它。解决一个 ticket 会清除前方的迷雾，将可明确的内容毕业为新 tickets。**前沿**是打开、未阻塞、未认领的 tickets——已知的边缘。

每个 ticket 是 **HITL**（人在循环）或 **AFK**（agent 单独处理）。HITL ticket 只能通过现场交流解决。

## 效果良好的标志

- 命名**目的地**是第一个动作——在任何 ticket 存在之前
- 一个地图是一个 issue；tickets 是子 issue，用**名称**引用
- 一个 session 最多解决一个 ticket
- 如果初始访谈没有发现迷雾，会停下来告诉你工作量不大，不需要地图

## 在流程中的位置

```
wayfinder → [迷雾清除] → to-spec → to-tickets → implement
```

wayfinder 是大项目的**匝道**：清除迷雾后汇入主构建流。依赖 `/grilling` 和 `/domain-modeling` 解决单个 ticket，依赖 `/prototype` 和 `/research` 处理需要它们的 ticket 类型。不确定时问 `/ask-rolex`。
