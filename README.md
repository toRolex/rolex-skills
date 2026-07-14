# Rolex Skills

开箱即用的 AI 编程技能——让 Claude Code 听懂中文、帮你干活。

基于 [mattpocock/skills](https://github.com/mattpocock/skills) 改编，加了 6 个原创实用工具。

## 安装

```bash
npx skills@latest add toRolex/rolex-skills
# 或者
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

装完在项目里跑一次 `/setup-rolex-skills`，回答三个问题即可使用。

## 技能一览

### 主流程：想法 → 交付

| 命令 | 作用 | 怎么触发 |
|------|------|----------|
| `/grill-with-docs` | 深入访谈，打磨方案，记录术语和决策 | 手动敲 |
| `/to-spec` | 对话转成规范文档（PRD） | 手动敲 |
| `/to-tickets` | 规范拆成可执行的 ticket | 手动敲 |
| `/implement` | 按 ticket 逐个实现，内部走 TDD | 手动敲 |
| `/code-review` | 双轴审查：代码规范 + 需求吻合度 | 自动调用 |
| `/ask-rolex` | 路由器，告诉你该用哪个 skill | 手动敲 |

### 匝道：进入主流程的入口

| 命令 | 作用 | 怎么触发 |
|------|------|----------|
| `/wayfinder` | 超大模糊项目绘制决策地图 | 手动敲 |
| `/triage` | Issue 分类、验证、标记 | 手动敲 |
| `/improve-codebase-architecture` | 扫描架构问题，生成报告 | 手动敲 |

### 独立工具

| 命令 | 作用 | 怎么触发 |
|------|------|----------|
| `/diagnosing-bugs` | 困难 bug 的严谨诊断流程 | 自动调用 |
| `/prototype` | 一次性原型验证想法 | 自动调用 |
| `/research` | 一手资料调研，输出引用文档 | 自动调用 |
| `/tdd` | 红-绿重构循环，implement 内部引擎 | 自动调用 |
| `/domain-modeling` | 打磨领域术语，写 ADR | 自动调用 |
| `/codebase-design` | 深度模块设计词汇 | 自动调用 |
| `/resolving-merge-conflicts` | 按意图解决合并冲突 | 自动调用 |
| `/grill-me` | 无代码库的轻量访谈 | 手动敲 |
| `/teach` | 跨会话教学 | 手动敲 |
| `/handoff` | 长会话压缩交接 | 自动调用 |
| `/writing-great-skills` | 编写 skill 的规范参考 | 手动敲 |

### 原创 Git 实用工具

| 命令 | 作用 | 怎么触发 |
|------|------|----------|
| `/safe-pull` | 安全 git pull + rebase，自动 stash | 自动调用 |
| `/clean-branches` | 清理已合并的本地和远程分支 | 自动调用 |
| `/git-flow-conventions` | 分支命名、commit 格式、发版规范 | 自动调用 |
| `/publish-release` | 从 develop 一键发版 | 自动调用 |
| `/qa-plan` | 从 commit 生成 Step-by-Step 测试计划 | 手动敲 |
| `/afk-issue-loop` | 批量处理 ready-for-agent 的 issue | 手动敲 |

## 场景速查

| 你想做什么 | 依次敲 |
|-----------|--------|
| 新功能从零开始 | `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` × N |
| 修 Bug | `/triage` → `/diagnosing-bugs` → 修复 → 测试 |
| 重构模块 | `/improve-codebase-architecture` → 拷问 → 进入主流程 |
| 同步代码 | `/safe-pull` |
| 发版 | `/publish-release` |
| 不确定用哪个 | `/ask-rolex` |

详细用法见 [docs/usage-guide.md](docs/usage-guide.md)。

## 协议

MIT — 自由使用，商业或个人均可。
