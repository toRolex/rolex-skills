# 0014: Docs（事实）与 Implementation Notes（因果）垂直分离

## Context

在长程开发与多任务演进中，Agent 与人类开发者会产生两类截然不同的文本资产：
1. **面向使用者与维护者的系统说明**：描述系统当前如何工作、各模块契约与外部接口。
2. **面向下一次尝试与后续开发者的实现笔记**：记录为什么选择该方案、舍弃了什么替代方案、遇到哪些 edge case 以及如何偏离初版计划。

此���，`pre-implement` 将 implementation notes 散落在各个仓库自定义位置（例如本仓库曾存放在 `docs/plans/`），导致 `docs/` 目录职责被严重混淆。使用者查阅功能规格时容易被历史尝试、过程踩坑和过程决策淹没；同时 Agent 在启动新任务时也无法在确定位置检索既往经验与决策沉淀。

## Decision

将 `docs/` 与 `.agents/notes/` 确立为两条正交、互不替代的垂直轨道：

1. **`docs/` 描写“事实”**：
   - 目标读者：人类开发者、终端使用者及架构维护者。
   - 核心问题：“现在的系统到底怎样运转？”
   - 准则：记录关于当前代码库与系统的确定事实（架构、API 契约、ADR 决策结论等），严禁长篇累赘堆砌开发过程历史、废弃尝试与探索踩坑。

2. **`.agents/notes/` 记录“因果”**：
   - 目标读者：未来执行类似或后续任务的 Agent 与开发者。
   - 核心问题：“当初为什么这样做？舍弃了什么？踩了什么坑？”
   - 准则：记录技术选型权衡、执行决策、偏离计划的理由（Deviations），专供下一次尝试或后��迭代学习与复用。
   - 路径硬约定：统一存放在仓库根目录下的 `.agents/notes/<task-slug>-implementation-notes.md`，不存在则自动创建，不再使用模糊的既有约定回退探测。

3. **仓库脚手架（`setup-rolex-skills`）统一声明**：
   - 在 `CLAUDE.md` / `AGENTS.md` 的 `## Agent skills` 区块中显式声明 `### Implementation notes`，指明位置为 `.agents/notes/` 及其因果记录职责。

## Considered Options

- **Option A: 依然放在 `docs/plans/` 或 `docs/notes/`**：使系统事实文档与因果历程混合，检索确定事实被噪声干扰。否决。
- **Option B: 动态探测现有约定，无约定才回落 `.agents/notes/`**：导致不同仓库、甚至同一仓库不同阶段位置分裂，Agent 无法形成稳定的经验复用锚点。否决。
- **Option C: 硬默认 `.agents/notes/`，并全面建立事实与因果的垂直分离（采用）**：权责明确，物理隔离，便于未来工具和 Agent 专门索引。

## Consequences

- 存量所有 `docs/plans/*-implementation-notes.md` 全部迁移至 `.agents/notes/`，并修复全库反向链接。
- `pre-implement` 强制以 `.agents/notes/` 为唯一标准落盘路径。
- `setup-rolex-skills` 模板与输出新增 `### Implementation notes` 小节。
- `docs/` 目录恢复纯粹的事实契约属性。
