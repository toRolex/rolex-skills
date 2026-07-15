快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/productivity/teach)

## 功能

`teach` 将当前目录变为一个持久教学 workspace，在一个主题上跨多个会话进行教学——设计简短、精美、互动的课程，紧扣*为什么*你想学。

它**不**从模型自己的记忆中教学。参数化知识被视为不可信；在教学之前，它会收集高质量资源并将每个主张锚定在引用中。

## 何时使用

手动敲 `/teach` 调用。

当你想花时间*学习*一个主题——语言、框架、瑜伽、理论物理——并希望 session 能积累而不是蒸发时使用。不是为了一次性解释。

## 教学 workspace

`teach` 会写入以下文件：

- `MISSION.md` — 学习原因，所有教学以此为根基
- `RESOURCES.md` — 经过验证的高质量资源
- `./lessons/*.html` — 编号的自包含课程
- `./reference/*.html` — 压缩的速查表、算法、词汇表
- `./learning-records/*.md` — 所学内容，ADR 风格
- `./assets/*` — 可复用组件
- `NOTES.md` — 教学偏好

## 在流程中的位置

随时可用的独立工具。跨 session 的长期学习项目。不确定时问 `/ask-rolex`。
