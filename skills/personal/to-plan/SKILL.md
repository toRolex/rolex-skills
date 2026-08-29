---
name: to-plan
description: 写一份供审阅的 implementation plan，最可能变的决策置顶，机械性工作沉底。
disable-model-invocation: true
---

写一份 **implementation plan** 供用户审阅：把我最可能调整的决策放在最前面（data model 变更、新的 type interface、UX flow、任何 user-facing，各附推荐方案和理由），机械性的重构放最后，那部分我信任你。用户读完 plan，提出不认同的部分，剩下的就是信任。

流程：

1. 从当前对话和前面的 artifact、prototype 收集输入，需要代码库事实时自己去查，使用项目的 domain glossary 词汇，并尊重你所触及区域内的任何 ADR。
2. 写出 plan，默认 HTML artifact；用户指定了别的形式就听用户的。
3. 停在 plan 上等审阅。用户对置顶的每条决策做出反应之后，plan 才算完成；被否掉的决策当场更新。
