快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/productivity/writing-for-agents)

## 功能

`writing-for-agents` 是任何 agent 消费的文档的写作参考——一个 skill、一份 `AGENTS.md` / `CLAUDE.md`、一个被指针指向的文档。打包方式不同；写作方式相同：同样的杠杆让每一份都可预测。

核心概念：

- **上下文指针** — 引用上下文外材料并编码到达条件的措辞
- **两种负载** — 上下文负载（常驻材料花的 token）与认知负载（人类记住文档存在的成本）
- **信息层级** — 从文件内步骤到披露参考的阶梯
- **引导词** — 招募模型预训练先验的紧凑概念
- **修剪** — 单一真相来源、相关性、逐句 no-op 测试

当文档是 skill 时，读 `SKILL-MECHANICS.md` 了解 frontmatter、调用选择和 router skills。

## 何时使用

`writing-for-agents` 是 model-invoked——创建或编辑 skill、修改 AGENTS.md / CLAUDE.md 时自动触发。

## 在流程中的位置

随时可用的独立参考。编写和编辑 skill 的元 skill，与 `writing-great-skills` 互补。
