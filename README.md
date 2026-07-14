# Rolex Skills · AI 编程技能 · 中文增强版

[英文上游](https://github.com/mattpocock/skills) (mattpocock/skills) 的中文改编版——不 fork，独立建仓。

就像 [superpowers-zh](https://github.com/jnMetaCode/superpowers-zh) 之于 [superpowers](https://github.com/obra/superpowers)：在同等工作流方法的基础上，补充了中文开发者的实际需求。

## 🆚 与英文上游（mattpocock/skills）的区别

| 维度 | 英文上游 | 中文增强版 |
|---|---|---|
| 总技能数 | 23（已删掉 personal/deprecated） | 23 — 全部翻译 + 新增 uv-python |
| 语言 | 英文 | 所有 SKILL.md 正文翻译为中文 |
| 交互语言 | 英文 | 全部中文提示 |
| 命名 | `ask-matt`、`setup-matt-pocock-skills` | `ask-rolex`、`setup-rolex-skills` |
| Python | 无特殊处理 | 强制 UV（`uv-python` 技能） |
| 浏览器工具 | 无约束 | 每次会话首次使用前必须 `Skill("browser-tools")` |
| 强模型模式 | 无 | `strong-model-consultant` 分层协作模式 |
| 分发 | npm + Claude Code 插件 + git clone | git clone + `link-skills.sh` |
| 文档 | docs/ × 22 页 + CHANGELOG | 同上，全部翻译 |

**一句话：** 英文上游 = 方法论内核；中文增强版 = 方法论内核 + 全中文适配 + MacOS 中文开发环境 + UV Python 生态。

## 快速开始

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

然后在 agent 中运行 `/setup-rolex-skills`，它会：
- 询问你使用的 issue tracker（GitHub、GitLab 或本地文件）
- 询问 triage 时使用的标签
- 询问文档保存位置

## Skill 一览

### Engineering（工程技能）

**用户手动调用：**

- **`/ask-rolex`** — 路由器，问它就知道该用哪个 skill
- **`/grill-with-docs`** — 深入访谈 + 构建领域模型
- **`/setup-rolex-skills`** — 每个仓库首次使用前运行
- **`/to-spec`** — 对话转 spec
- **`/to-tickets`** — spec 拆 tickets
- **`/implement`** — 按 spec/tickets 构建
- **`/triage`** — issue 分类处理
- **`/wayfinder`** — 超大工作量探路
- **`/improve-codebase-architecture`** — 架构优化扫描

**模型自动调用：**

- **`/prototype`** — 一次性原型
- **`/diagnosing-bugs`** — 困难 bug 诊断
- **`/research`** — 一手资料调研
- **`/tdd`** — 测试驱动开发
- **`/domain-modeling`** — 领域模型打磨
- **`/codebase-design`** — 深度模块设计
- **`/code-review`** — 双轴代码审查
- **`/resolving-merge-conflicts`** — 解决合并冲突
- **`/uv-python`** — UV Python 管理

### Productivity（生产力工具）

**用户手动调用：**

- **`/grill-me`** — 无代码库的深度访谈
- **`/handoff`** — 会话压缩交接
- **`/teach`** — 多会话教学
- **`/writing-great-skills`** — 编写 skill 的参考

**模型自动调用：**

- **`/grilling`** — 深度访谈引擎

## 与上游的关系

本项目保持独立版本和独立发布节奏。上游有有价值的更新时，手动 cherry-pick 过来。

## 致谢

- [mattpocock/skills](https://github.com/mattpocock/skills) — 上游方法论内核，MIT 协议

## 协议

MIT License — 自由使用，商业或个人均可。
