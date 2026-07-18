# rolex-skills

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
