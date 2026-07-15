快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/code-review)

## 功能

`code-review` 对 `HEAD` 与你提供的固定点之间的 diff 进行双轴审查：**Standards**（代码是否符合本仓库的编码规范？）和 **Spec**（代码是否实现了原始 issue 或 spec 的要求？）。它让每个轴作为独立 sub-agent 并行运行，并排报告。两个轴永不合并——这是关键，因为一个变更可能通过一个轴而失败在另一个上。

## 何时使用

敲 `/code-review` 或 agent 自动调用。

当有 diff 需要对照已知的好点进行评判，且你想让两个问题——*构建正确吗？* 和 *构建的是正确的东西吗？*——独立回答时使用。它运行在构建循环的末尾。对于测试先行写代码，用 `/tdd`；对于将整个 spec 构建为代码，用 `/implement`（它内部会跑 `/code-review`）。

## 前置条件

**Spec** 轴需要找到原始 spec——commit 消息中的 issue 引用、你传入的路径、或 `docs/`/`specs/` 下的 spec 文件。需要先运行 `/setup-rolex-skills` 配置 tracker。没有 spec 时 Spec 轴会跳过并说明。

## 双轴，永不合并

**Standards** 轴检查 diff 是否符合仓库的编码规范——`CODING_STANDARDS.md` 或 `CONTRIBUTING.md`，加上固定的 ~12 个 Fowler 代码坏味基线。**Spec** 轴问正交问题——代码是否做了 issue 或 spec 实际要求的事。

两者作为并行 sub-agent 运行，最终报告分别在 `## Standards` 和 `## Spec` 下呈现，各自有摘要。故意不跨轴选一个赢家。

## 效果良好的标志

- 先确认固定点，在坏 ref 或空 diff 上快速失败
- Standards 和 Spec 的发现以两个独立区块呈现
- 找不到 spec 时报告"无可用 spec"，而不是编造需求

## 在流程中的位置

```
grill-with-docs → to-spec → to-tickets → implement → code-review
```

它是主构建链末尾的审查步骤。前接 `/implement`，后者在提交前内部调用此 review。不确定时问 `/ask-rolex`。
