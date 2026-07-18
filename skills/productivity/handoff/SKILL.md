---
name: handoff
description: 将当前对话压缩为 handoff 文档，供另一个 agent 接续。
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

> **术语约定：**
> | English | 中文 |
> |---|---|
> | handoff | handoff（不翻译） |
> | agent | agent（不翻译） |
> | session | session（不翻译） |
> | workspace | workspace（不翻译） |
> | artifact | artifact（不翻译） |
> | skill | skill（不翻译） |
> | argument | argument（不翻译） |

撰写一份 handoff 文档，总结当前对话，以便新 agent 可以继续工作。将文档保存到用户操作系统的临时目录，而不是当前 workspace。

在文档中包含"suggested skills"小节，推荐新 agent 应调用的 skill。

不要重复已在其他 artifact（spec、plan、ADR、issue、commit、diff）中记录的内容。改用路径或 URL 引用它们。

隐去敏感信息，如 API key、密码或个人身份信息。

如果用户传入了 arguments，将其视为下一 session 关注方向的描述，并据此调整文档内容。
