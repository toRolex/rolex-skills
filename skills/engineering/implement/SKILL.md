---
name: implement
description: "根据 spec 或一组 tickets 实现一项工作。"
disable-model-invocation: true
---

> **术语约定：** 以下关键术语保持固定译法，含英文源词以便对照：
>
> | English | 中文 |
> |---------|------|
> | spec | spec（保留英文） |
> | ticket(s) | ticket（保留英文） |
> | seam | seam（保留英文） |
> | tdd | tdd（保留英文） |
> | typechecking | 类型检查 |
> | test suite | 测试套件 |
> | code-review | code-review（保留英文） |

# Implement（实现）

按照 spec 或 tickets 中描述的工作进行实现。

尽可能在预先约定的 seam 上使用 `/tdd` 进行实现。

定期运行类型检查，定期运行单个测试文件，最后运行完整的测试套件。

完成后，使用 `/code-review` 审查你的工作。

将你的工作提交到当前分支。
