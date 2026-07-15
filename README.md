# Rolex Skills

AI 编程技能合集——让 Claude Code 听懂中文、帮你干活。

基于 [mattpocock/skills](https://github.com/mattpocock/skills) 改编并补充了原创工具。这些技能是真实工程师日常使用的，不是"氛围编程"——它们处理真实项目的复杂性和约束。

## 快速开始（30 秒）

两种安装方式，任选其一：

### 方式 A：npx skills（推荐）

可在本地编辑修改：

```bash
npx skills@latest add toRolex/rolex-skills
```

选择你要安装的技能，记得勾选 `/setup-rolex-skills`。然后在项目里运行：

```
/setup-rolex-skills
```

回答三个问题（issue 跟踪器、标签、文档存放位置），即可开始使用。

### 方式 B：Plugin（只读，自动更新）

```bash
# Claude Code 内执行：
/plugin marketplace add toRolex/rolex-skills
/plugin install rolex-skills@toRolex
```

然后同样运行：

```
/setup-rolex-skills
```

**两种方式的区别**：方式 A 的文件可编辑，你可以随意修改；方式 B 是只读包，有更新时会自动同步，适合想保持最新又不想操心的用户。

### 方式 C：Git 克隆（开发者）

如果你在给本仓库贡献或自定义安装：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

然后运行 `/setup-rolex-skills`。

## 为什么要有这些技能

### 痛点 1：「AI 没按我想的做」

Agent 和开发者之间存在沟通鸿沟。**拷问 session** 是解决之道——让 Agent 在动手前先问透你的需求。`/grill-with-docs` 和 `/grill-me` 就是干这个的。前者还会产出共享词汇表（`CONTEXT.md`），让后续每次对话都更精准。

### 痛点 2：「Agent 太啰嗦」

没有共享词汇，Agent 每次都要长篇描述同样的概念。一个共享语言文档（领域模型）能让它直击要害——把"课程章节中某个 lesson 变为 real 时的问题"压缩成"物化级联问题"，省 token 又精准。

### 痛点 3：「代码跑不通」

对齐了需求，但代码质量跟不上。需要：静态类型、浏览器访问、自动化测试、**红-绿-重构**循环。`/tdd` 技能就是这个循环，`/diagnosing-bugs` 则是把调试最佳实践封装成结构化流程。

### 痛点 4：「又建成屎山了」

AI 加速了编码速度，也加速了软件熵增。`/improve-codebase-architecture` 能帮你挽救混乱的代码库，`/codebase-design` 提供深度模块设计的纪律。建议每几天跑一次。

> 软件工程基本功比以往任何时候都重要。这些技能不是让你不用思考——是让你把思考花在刀刃上。

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
