# Out of scope 知识库

仓库中的 `.out-of-scope/` 目录保存被拒绝的功能请求的持久记录。它有两个目的：

1. **机构记忆（Institutional memory）**：一个功能为何被拒绝，这样当 issue 关闭时，推理不会被丢失
2. **去重（Deduplication）**：当新 issue 与之前的拒绝匹配时，skill 可以浮现之前的决策，而不是重新争论一遍

## 目录结构

```
.out-of-scope/
├── dark-mode.md
├── plugin-system.md
└── graphql-api.md
```

每个**概念**一个文件，而不是每个 issue 一个。多个请求同一事物的 issue 归入同一个文件。

## 文件格式

文件应以轻松、可读的风格编写，更像一份简短的设计文档，而不是数据库条目。使用段落、代码示例和实例，让推理对第一次遇到它的人清晰有用。

```markdown
# Dark Mode

This project does not support dark mode or user-facing theming.

## Why this is out of scope

The rendering pipeline assumes a single color palette defined in
`ThemeConfig`. Supporting multiple themes would require:

- A theme context provider wrapping the entire component tree
- Per-component theme-aware style resolution
- A persistence layer for user theme preferences

This is a significant architectural change that doesn't align with the
project's focus on content authoring. Theming is a concern for downstream
consumers who embed or redistribute the output.

```ts
// The current ThemeConfig interface is not designed for runtime switching:
interface ThemeConfig {
  colors: ColorPalette; // single palette, resolved at build time
  fonts: FontStack;
}
```

## Prior requests

- #42: "Add dark mode support"
- #87: "Night theme for accessibility"
- #134: "Dark theme option"
```

### 命名文件

为概念使用简短、描述性的 kebab-case 名称：`dark-mode.md`、`plugin-system.md`、`graphql-api.md`。名称应该足够易识别，让浏览目录的人不用打开文件就能明白被拒绝的是什么。

### 编写理由

理由应该实质：不是"我们不想要这个"，而是为什么。好的理由参考：

- 项目范围或理念（"本项目专注于 X；theming 是下游消费者关心的事"）
- 技术约束（"支持这个需要 Y，这与我们的 Z 架构冲突"）
- 战略决策（"我们选择用 A 而不是 B，因为……"）

理由应该持久。避免引用临时情况（"我们目前太忙了"）；那些不是真正的拒绝，而是推迟。

## 何时检查 `.out-of-scope/`

在 triage 期间（步骤 1：收集上下文），读取 `.out-of-scope/` 中的所有文件。在评估新 issue 时：

- 检查请求是否与现有的 out-of-scope 概念匹配
- 匹配依据概念相似性，而非关键词："night theme" 匹配 `dark-mode.md`
- 如果有匹配，把它浮现给 maintainer："这类似于 `.out-of-scope/dark-mode.md`。我们之前拒绝过，因为[理由]。你仍然这么认为吗？"

maintainer 可以：

- **确认**：新 issue 被添加到现有文件的 "Prior requests" 列表中，然后关闭
- **重新考虑**：out-of-scope 文件被删除或更新，issue 走正常 triage 流程
- **不同意**：这些 issue 相关但不同，走正常 triage 流程

## 何时写入 `.out-of-scope/`

仅当 **enhancement**（而非 bug）以 `wontfix` *拒绝*时。这同样适用于 enhancement PR 和 issue：被拒绝的 PR 在这里记录，这样相同的请求不会以全新代码的形式再次出现。

当某物因为**已经实现**而作为 `wontfix` 关闭时，**不要**写入这里。那是已构建的功能，而不是被拒绝的功能；记录它会用虚假的拒绝污染去重检查。相反，关闭评论应该指向功能已经存在的位置。

流程：

1. maintainer 判定功能请求 out of scope
2. 检查是否存在匹配的 `.out-of-scope/` 文件
3. 如果是：将新 issue 追加到 "Prior requests" 列表
4. 如果否：用概念名称、决策、理由和第一个 prior request 创建一个新文件
5. 在 issue 上发布评论，解释决策并提及 `.out-of-scope/` 文件
6. 用 `wontfix` 标签关闭 issue

## 更新或删除 out-of-scope 文件

如果 maintainer 改变了他们对先前拒绝的概念的看法：

- 删除 `.out-of-scope/` 文件
- skill 不需要重新打开旧 issue；它们是历史记录
- 触发重新考虑的新 issue 走正常 triage 流程
