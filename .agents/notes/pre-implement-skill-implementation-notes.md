# Implementation Notes

## 任务

收窄 `pre-implement` 的触发边界，并防止复用或覆盖其他任务的 implementation notes。

## 输入依据

- 当前对话中对误触发和历史 notes 覆盖的复盘
- `writing-for-agents` 的 context pointer、completion criteria、single source of truth 规范

## 计划

1. 收窄 model-invoked description。
2. 增加当前任务身份与 notes 归属门。
3. 改用任务专属文件名和逻辑里程碑记录。
4. 收窄无输入 artifact 时的调查要求。
5. 检查最终 diff。

## 决策

- 保持 `pre-implement` 为 model-invoked。
- 触发锚定为“已确定的多步骤交付任务”，而不是任意文件修改。
- notes 只有任务身份明确匹配时才复用；默认采用任务专属文件名。

## Deviations

- 无。

## 执行记录

- [x] 确认旧 description 与正文的误触发、覆盖风险。
- [x] 将 description 正面锚定为需要跨里程碑或会话保留决策的多里程碑交付任务。
- [x] 增加可检查的输入依据门、任务归属门、未占用路径生成规则和任务专属文件名。
- [x] 将逐步记录改为逻辑里程碑记录，并限定探索 agent 只用于超出当前上下文或适合并行检索的调查。
- [x] 依据 `writing-for-agents` 复核并修正 description、completion criteria、否定式和路径冲突处理。
