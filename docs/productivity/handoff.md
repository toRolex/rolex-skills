快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/productivity/handoff)

## 功能

`handoff` 将当前对话压缩为**交接文档**——一份新 agent 可以阅读并接手的总结。

它**不会**重述已写在别处的内容。spec、计划、ADR、issue、commit 或 diff 中的内容通过路径或 URL 引用，从不复制。文档只携带活跃线程——你在做什么、为什么、下一步是什么——保存到 OS 临时目录，不留在 workspace 中。

## 何时使用

手动敲 `/handoff` 调用。可以传一句描述下个会话的目标，文档会据此定制。

当对话已经很长、接近上下文限制、或故意将工作交给另一个 agent 时使用。

## 文档包含

- 活跃线程——正在进行的内容和原因
- 建议的技能——下个 agent 应该调用的 skill
- 引用而非复制——链接到 spec、计划、ADR、issue、diff
- 脱敏的秘密——API key、密码、PII 在写入前脱敏

## 在流程中的位置

随时可用的独立工具，位于两个会话之间的接缝处。不确定时问 `/ask-rolex`。
