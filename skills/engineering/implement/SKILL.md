---
name: implement
description: "根据 spec 或一组 tickets 实现一项工作。"
disable-model-invocation: true
---

# Implement（实现）

按照 spec 或 tickets 中描述的工作进行实现。

用户传入 ticket 引用时，先从 issue tracker 获取并通读完整内容，开始前报告其标题；引用有歧义时先询问用户。

在预先约定的 seam 上尽可能调用 Skill 工具并传入 "tdd" 进行实现。

定期运行 typechecking，定期运行单个测试文件，最后运行完整的 test suite。

完成后，调用 Skill 工具并传入 "code-review" 审查你的工作。

将你的工作提交到当前分支。
