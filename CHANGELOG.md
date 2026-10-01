# rolex-skills

## 2.0.0

### Major Changes

- [#18](https://github.com/toRolex/rolex-skills/pull/18) [`2557b7f`](https://github.com/toRolex/rolex-skills/commit/2557b7f64b9662aeb26cf96b482bcad701a4313c) Thanks [@toRolex](https://github.com/toRolex)! - 发布 v2.0.0 技能合集大版本，由 Changesets 统一生成版本提交与 tag，替代手工修改 package.json；Claude plugin 版本同步到包版本。

  - 新增 Thariq bucket：unknowns、blind-spot-pass、brainstorm、to-plan、quiz-me、to-pitch、pre-implement 七个 skill。
  - 新增 afk-issue-loop 无人值守批量交付：四角色编排、Ticket Kanban Dashboard、崩溃与 Git 现场恢复，支持 Git Flow / Trunk-based。
  - 新增 implement-spec、pr、retro、browser-tools、vertical-slice-review、ask-advisor、github-api-rate-limits 和 setup-rolex-skills；补充 skill 使用地图，更新 ask-rolex 路由。
  - 同步上游 mattpocock/skills 至 885e2ca，更新 25 个 skill；重写 README 定位，implementation notes 统一到 .agents/notes/。
  - 修复 skill-guard session key、afk-issue-loop Dashboard 与恢复相关问题，修正翻译及术语。

  迁移注意：teach 重命名为 teach-me，需更新 /teach 引用；删除 resolving-merge-conflicts；低频 personal skills 移至 skills/misc/，直接引用旧路径的配置需同步更新。

## 1.2.0

### Minor Changes

- fix: 校对 engineering skill 翻译，修复错译与漏译，补译全部附属文档
  - 修复 diagnosing-bugs 日志标签句语义颠倒错译（带标签/未带标签主语反转）
  - 补译 improve-codebase-architecture Explore 节 YAGNI 范围界定整段（含 `git log` 指令）
  - 修复 wayfinder 决策 ticket 错译与定义子句漏译，清理残留英文（cheap/rough/concrete）
  - 恢复 to-tickets 本地 ticket 模板占位符（`<NN> — <Ticket title>`）
  - 统一 tdd/to-spec 标题译法与术语；修正 codebase-design/domain-modeling/prototype 硬译
  - 补译 15 个附属文档（tdd/triage/codebase-design/domain-modeling/prototype/improve-codebase-architecture/setup-rolex-skills），技术术语保留英文

## 1.1.0

### Minor Changes

- - refactor: 删除 plugin.json，marketplace.json 改用 sub-plugins 实现 4 组分栏
    - fix: 分组名称加数字前缀修正 npx skills 排序
    - feat: 新增 hooks 技能守卫（grilling/wayfinder 阶段阻止写代码）
    - chore: 充实 .gitignore
    - docs: README 新增技能守卫安装说明

- [`5f5531d`](https://github.com/toRolex/rolex-skills/commit/5f5531dab8016a0ca0c41414af2be29f6219e24d) Thanks [@toRolex](https://github.com/toRolex)! - - feat: 添加 marketplace.json，为 npx skills 安装界面提供技能分组

  - fix: 技能分组调整——将 6 个原创 Git 工具单独成组
  - chore: 分组改名 原创 Git 工具 → 原创工具
  - fix: 统一 20 个翻译 skill 的术语一致性

    建立术语对照表策略：关键术语保留英文或固定为唯一中文译法，
    每篇 SKILL.md 头部插入术语约定表格并全文统一。
    修复多处同词异译问题（如 out of scope 统一为「超出范围」），
    章节标题保留英文原文以避免歧义。

## 1.0.0

### Major Changes

- 从零初始化 rolex-skills 仓库。基于 [mattpocock/skills](https://github.com/mattpocock/skills) 改编：
  - 全中文 SKILL.md 正文
  - `ask-matt` → `ask-rolex`，`setup-matt-pocock-skills` → `setup-rolex-skills`
  - 新增 `uv-python` skill（所有 Python 操作强制 UV）
  - 删除 `personal/`、`deprecated/`、`in-progress/` bucket
  - README/CLAUDE.md 中文化
