快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/productivity/wait-what)

## 功能

`wait-what` 是**上一条消息没落地时的纠正**。用在对话中间、任何其他 skill 内部，agent 会用你缺失的上下文、用浅白的语言、用 `CONTEXT.md` 的词汇重新讲一遍它刚说的话。

## 何时使用

手动敲 `/wait-what` 调用。

当 agent 上一句没讲清楚、你接不上时。它是事后生效的；`/grill-with-docs` 是事先的治愈——共享语言一开始就约定好，行话就不会出现。

## 在流程中的位置

独立工具，随时可插入任何会话。不站在任何链中。
