---
"rolex-skills": major
---

发布 v2.0.0 技能合集大版本，由 Changesets 统一生成版本提交与 tag，替代手工修改 package.json；Claude plugin 版本同步到包版本。

- 新增 Thariq bucket：unknowns、blind-spot-pass、brainstorm、to-plan、quiz-me、to-pitch、pre-implement 七个 skill。
- 新增 afk-issue-loop 无人值守批量交付：四角色编排、Ticket Kanban Dashboard、崩溃与 Git 现场恢复，支持 Git Flow / Trunk-based。
- 新增 implement-spec、pr、retro、browser-tools、vertical-slice-review、ask-advisor、github-api-rate-limits 和 setup-rolex-skills；补充 skill 使用地图，更新 ask-rolex 路由。
- 同步上游 mattpocock/skills 至 885e2ca，更新 25 个 skill；重写 README 定位，implementation notes 统一到 .agents/notes/。
- 修复 skill-guard session key、afk-issue-loop Dashboard 与恢复相关问题，修正翻译及术语。

迁移注意：teach 重命名为 teach-me，需更新 /teach 引用；删除 resolving-merge-conflicts；低频 personal skills 移至 skills/misc/，直接引用旧路径的配置需同步更新。
