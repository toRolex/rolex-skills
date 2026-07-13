# Rolex Skills

我的日常 agent skills，基于真实工程实践，适用于任何模型。

## 快速开始

```bash
git clone <this-repo>
cd rolex-skills
bash scripts/link-skills.sh
```

然后在 agent 中运行 `/setup-rolex-skills`，它会：
- 询问你使用的 issue tracker（GitHub、Linear 或本地文件）
- 询问 triage 时使用的标签
- 询问文档保存位置

## 参考

### Engineering

日常编码工作使用的 skill。

**User-invoked**

- **[ask-rolex](./skills/engineering/ask-rolex/SKILL.md)** — 询问哪个 skill 或流程适合当前场景。
- **[grill-with-docs](./skills/engineering/grill-with-docs/SKILL.md)** — 深入访谈 + 构建领域模型，更新 `CONTEXT.md` 和 ADR。
- **[setup-rolex-skills](./skills/engineering/setup-rolex-skills/SKILL.md)** — 配置本仓库的工程 skill。每个仓库首次使用前运行。
- **[to-spec](./skills/engineering/to-spec/SKILL.md)** — 将对话转化为 spec 发布到 issue tracker。
- **[to-tickets](./skills/engineering/to-tickets/SKILL.md)** — 将 spec 拆分为 tracer-bullet tickets。
- **[implement](./skills/engineering/implement/SKILL.md)** — 按 spec/tickets 构建，驱动 `/tdd`。
- **[triage](./skills/engineering/triage/SKILL.md)** — issue 状态机 triage。
- **[wayfinder](./skills/engineering/wayfinder/SKILL.md)** — 超大工作量的调研地图。
- **[improve-codebase-architecture](./skills/engineering/improve-codebase-architecture/SKILL.md)** — 代码库架构优化扫描。

**Model-invoked**

- **[prototype](./skills/engineering/prototype/SKILL.md)** — 一次性原型，回答设计问题。
- **[diagnosing-bugs](./skills/engineering/diagnosing-bugs/SKILL.md)** — 困难 bug 诊断循环。
- **[research](./skills/engineering/research/SKILL.md)** — 一手资料调研，产出引用文档。
- **[tdd](./skills/engineering/tdd/SKILL.md)** — 测试驱动开发，红-绿-重构。
- **[domain-modeling](./skills/engineering/domain-modeling/SKILL.md)** — 领域模型构建与打磨。
- **[codebase-design](./skills/engineering/codebase-design/SKILL.md)** — 深度模块设计词汇与原则。
- **[code-review](./skills/engineering/code-review/SKILL.md)** — 双轴 review：Standards + Spec。
- **[resolving-merge-conflicts](./skills/engineering/resolving-merge-conflicts/SKILL.md)** — 解决 merge/rebase 冲突。
- **[uv-python](./skills/engineering/uv-python/SKILL.md)** — UV Python 项目管理。

### Productivity

非编码的工作流工具。

**User-invoked**

- **[grill-me](./skills/productivity/grill-me/SKILL.md)** — 计划/设计的 relentless 访谈。
- **[handoff](./skills/productivity/handoff/SKILL.md)** — 对话压缩为 handoff 文档。
- **[teach](./skills/productivity/teach/SKILL.md)** — 多会话教学。
- **[writing-great-skills](./skills/productivity/writing-great-skills/SKILL.md)** — 编写 skill 的参考指南。

**Model-invoked**

- **[grilling](./skills/productivity/grilling/SKILL.md)** — 深入访谈的通用循环引擎。
