# Implementation Notes

## 任务

将当前工作区的未提交更改按逻辑边界分批提交。

## 计划

1. 按文件内容和项目约定检查变更边界。
2. 先提交新增 personal skills。
3. 再提交 skill 路由与 bucket README 注册变更。
4. 每批提交后核对状态和提交内容。

## 决策

- 当前没有同名 implementation notes 约定；沿用仓库已有的 `docs/plans/` 作为存放位置。
- 新增的 6 个 personal skills 属于同一组能力扩展，作为一批提交。
- `skills/engineering/ask-rolex/SKILL.md` 与 `skills/personal/README.md` 是索引、路由注册变更，单独作为一批提交。
- 采用 Conventional Commits；新增 skills 使用 `feat(personal)`，索引变更使用 `docs(skills)`。

## Deviations

- 无。

## 执行记录

- [x] 检查当前工作区状态、diff 和近期提交。
- [x] 检查新增 skills 与现有索引内容。
- [x] 提交新增 personal skills（`849024b`）。提交前修正 `to-plan/SKILL.md` 文件末尾多余空行，并通过 `git diff --cached --check`。
- [x] 提交路由与 README 注册（`docs(skills): register new personal workflows`）。
- [x] 更新本 notes，并通过 amend 保持第二批为一个逻辑提交。
- [x] 验证最终工作区状态：`git status --short` 无输出。
