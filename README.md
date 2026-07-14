# Rolex Skills

开箱即用的 AI 编程技能——让 Claude Code 听懂中文、帮你干活。

基于 [mattpocock/skills](https://github.com/mattpocock/skills) 改编，加了 6 个原创实用技能。

## 装

```bash
npx skills@latest add toRolex/rolex-skills
# 或者
git clone https://github.com/toRolex/rolex-skills && cd rolex-skills && bash scripts/link-skills.sh
```

装完在仓库里跑一次 `/setup-rolex-skills`，回答三个问题（issue tracker、标签、文档位置），搞定。

## 有哪些技能

**访谈与设计：** `/grill-with-docs` 打磨需求 → `/domain-modeling` 统一语言 → `/codebase-design` 设计模块 → `/to-spec` 写 spec → `/to-tickets` 拆 tickets

**开发：** `/implement` 按 tickets 构建 → `/tdd` 红绿循环 → `/code-review` 双轴审查

**Git 实用工具：** `/safe-pull` 安全同步 → `/clean-branches` 删已合并分支 → `/git-flow-conventions` 分支规范 → `/publish-release` 一键发版

**排查与维护：** `/diagnosing-bugs` 困难 bug → `/triage` issue 分类 → `/improve-codebase-architecture` 架构扫描 → `/resolving-merge-conflicts` 解冲突

**其他：** `/prototype` 一次性质疑 → `/research` 后台调研 → `/wayfinder` 超大工作量探路 → `/qa-plan` 从 commit 生成 QA 计划 → `/afk-issue-loop` 批量处理 issues

## 跟原版有什么不同

上游全英文，技能正文和提示词都翻了中文，加了 Git 工作流相关的实用技能（`/safe-pull`、`/clean-branches`、`/git-flow-conventions`、`/publish-release`）。自己用的习惯的副本，不是竞争关系。

## 协议

MIT
