快速开始：

```bash
git clone <本仓库>
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/rolex/skills/tree/main/skills/engineering/strong-model-consultant)

## 功能

强模型顾问 + 弱模型执行器的协作机制。顾问负责目标对齐、策略规划、质量门控与纠偏；执行器负责端到端落地执行。

## 何时使用

适合复杂、长链路、易跑偏、需要稳定质量控制的任务。调用方式：**模型自动调用**。

## 在流程中的位置

`/ask-rolex` → Rolex 专属补充 → `/strong-model-consultant`
