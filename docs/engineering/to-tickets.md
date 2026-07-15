快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/to-tickets)

## 功能

`to-tickets` 将计划、spec 或当前对话分解为一组 **tickets**——每个都是 tracer-bullet 垂直切片——发布到配置好的 tracker，每个 ticket 声明阻塞它的 tickets。

每个 ticket 是一条 **tracer bullet**——贯穿所有集成层的薄垂直切片（schema、API、UI、测试），不是某一层的水平切片。完成后的切片本身可演示或可验证。

## 何时使用

手动敲 `/to-tickets` 调用。

当你有已达成一致的计划或已写好的 spec，想拆成 tickets 时使用。如果变更还没写成 spec，先用 `/to-spec`。

## 前置条件

`to-tickets` 发布到 issue tracker，需要先运行 `/setup-rolex-skills` 配置 tracker。

## 一份产物，两种读取方式

阻塞边是核心。根据 tracker 不同，同一组 tickets 有两种表现形式：

- **本地文件** → `.scratch/<feature>/issues/` 下每个 ticket 一个文件，按依赖关系编号。你手动按顺序处理。
- **真实 tracker（GitHub、Linear）** → 每个 ticket 一个 issue，阻塞边用原生链接。任何阻塞已清的 ticket 都在 **前沿** 上，可以被接取——多个 agent 可以并行。

## 垂直切片，不是水平切片

**水平切片**一次推一个层——所有 schema 或所有 API——在所有层都落地之前什么都不能工作。**垂直切片**（tracer bullet）一次穿透所有层，完成后即可演示。

拆切片前，`to-tickets` 会先找预重构机会（"让变更变容易，然后再做容易的变更"），并优先处理预重构。然后让你确认分解结果（粒度、阻塞边、合并或拆分），确认后才发布。

## 宽重构例外

**宽重构**— 一个机械性变更（重命名列、修改共享类型），其**爆炸半径**波及整个代码库——不适合 tracer bullet。`to-tickets` 按 **展开-收缩** 处理：先展开（旧形式旁加新形式），再分批迁移，最后收缩（删除旧形式）。

## 在流程中的位置

```
grill-with-docs → to-spec → to-tickets → implement → code-review
```

在 `/to-spec` 之后、`/implement` 之前。不确定时问 `/ask-rolex`。
