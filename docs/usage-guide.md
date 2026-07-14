# Rolex Skills 实战指引

## 一、Skill 全景

源码按两大类组织：**engineering/** 和 **productivity/**。

### 总览

| 分类 | 数量 | Skill |
|------|------|-------|
| **Bootstrap** | 1 | `setup-rolex-skills` |
| **Main Chain** | 5 | `grill-with-docs` → `to-spec` → `to-tickets` → `implement` → `code-review` |
| **On-ramps** | 3 | `wayfinder`, `triage`, `improve-codebase-architecture` |
| **Standalone** | 6 | `prototype`, `diagnosing-bugs`, `research`, `resolving-merge-conflicts`, `domain-modeling`, `codebase-design` |
| **Git Tools** | 4 | `safe-pull`, `clean-branches`, `git-flow-conventions`, `publish-release` |
| **Productivity** | 5 | `grilling`, `grill-me`, `handoff`, `teach`, `writing-great-skills` |
| **Router** | 1 | `ask-rolex` |
| **Internal Engines** | 2 | `tdd`（implement 内部）、`grilling`（grill-with-docs 等内部）、`domain-modeling` / `codebase-design`（共享词汇层） |
| **User-invoked extras** | 2 | `afk-issue-loop`, `qa-plan` |

### 详细清单

#### Bootstrap（一次性）

| Skill | 触发 | 职责 |
|-------|------|------|
| `setup-rolex-skills` | `/setup-rolex-skills` | 配置 Issue Tracker、Triage 标签、领域文档路径，写入 `docs/agents/*.md`。每个仓库仅执行一次 |

#### Main Chain（主交付流）

```
grill-with-docs → to-spec → to-tickets → implement → code-review
```

| Skill | 触发 | 职责 |
|-------|------|------|
| `grill-with-docs` | `/grill-with-docs` | **方案拷问 + 持久化文档**。逐问题拷问设计树，同时写入 `CONTEXT.md`（术语表）和 `docs/adr/`（架构决策记录） |
| `to-spec` | `/to-spec` | **合成 Spec/PRD**。将已对齐的理解转化为规范文档，发布到 Issue Tracker |
| `to-tickets` | `/to-tickets` | **拆分为 Ticket**。将 Spec 分解为垂直切片的可执行 Ticket，每 Ticket 声明阻塞关系 |
| `implement` | `/implement` | **执行实现**。逐一实现 Ticket，内部驱动 `tdd` 引擎，完成 typecheck + 全量测试 + code-review 后提交 |
| `code-review` | `/code-review` | **双轴审查**。并行审查 Standards（代码规范）和 Spec（需求吻合度） |

> `tdd` 是 implement 内部调用的引擎，不是主链路的独立步骤。

#### On-ramps（接入主链）

| Skill | 触发 | 职责 | 接入点 |
|-------|------|------|--------|
| `wayfinder` | `/wayfinder` | **迷雾探索**。将模糊的大型目标拆解为决策 Ticket | 接入 `to-spec` |
| `triage` | `/triage` | **Issue 分类**。经过状态机分类 → 验证 → 标记，产出 agent-ready brief | 接入 build chain |
| `improve-codebase-architecture` | `/improve-codebase-architecture` | **架构巡检**。扫描浅模块，生成 HTML 报告 | 接入 `grilling` |

#### Standalone Engineering

| Skill | 触发 | 职责 |
|-------|------|------|
| `prototype` | `/prototype` 或自动 | 快速 disposable 原型验证，回答设计问题后丢弃 |
| `diagnosing-bugs` | `/diagnosing-bugs` 或自动 | 严谨 Bug 诊断：建立 tight loop → 假设排序 → 修复 → 回归测试 |
| `research` | `/research` 或自动 | 基于一手资料的研究，输出带引用的 Markdown |
| `resolving-merge-conflicts` | 自动 | 按意图（而非文本）解决合并冲突 |

#### Git 实用工具（原创）

| Skill | 触发 | 职责 |
|-------|------|------|
| `safe-pull` | `/safe-pull` 或自动 | 安全 git pull + rebase。检查远程 → stash → rebase → 恢复 → 推送 |
| `clean-branches` | 自动 | 清理已合并的本地和远程分支，也清理残留 worktree |
| `git-flow-conventions` | 自动 | Git Flow 分支命名、commit 格式、PR 流程、发版规范 |
| `publish-release` | `/publish-release` 或自动 | 从 develop 发版：bump 版本、更新 changelog、打 tag、合并到 main |

#### Shared Vocabulary（共享词汇层）

| Skill | 触发 | 职责 | 被调用者 |
|-------|------|------|----------|
| `domain-modeling` | `/domain-modeling` 或自动 | 领域统一语言：更新 `CONTEXT.md` 术语表和 ADR | grill-with-docs, triage, improve-codebase-architecture |
| `codebase-design` | `/codebase-design` 或自动 | 深度模块设计词汇（module/interface/depth/seam） | tdd, to-spec, improve-codebase-architecture |

#### Productivity

| Skill | 触发 | 类别 | 职责 |
|-------|------|------|------|
| `grilling` | `/grilling` 或自动 | **Primitive** | 拷问原语：一次一问的设计树访谈，被多个 skill 内部调用 |
| `grill-me` | `/grill-me` | **User Frontend** | 无持久化文档的轻量拷问 |
| `handoff` | `/handoff` | **Handoff** | 会话压缩：生成交接文档供新 Agent 接手 |
| `teach` | `/teach` | **Learning** | 跨 session 的长期教学 workspace |
| `writing-great-skills` | `/writing-great-skills` | **Reference** | 编写/编辑 Skill 的标准框架 |

#### 用户手动调用的原创工具

| Skill | 触发 | 职责 |
|-------|------|------|
| `afk-issue-loop` | `/afk-issue-loop` | 遍历 `ready-for-agent` 的 issue，逐个分发给独立 agent 处理 |
| `qa-plan` | `/qa-plan` | 从最近 commit 生成 step-by-step QA 测试计划，保存为 GitHub issue |

#### Router

| Skill | 触发 | 职责 |
|-------|------|------|
| `ask-rolex` | `/ask-rolex` | **路由器**：告诉你在当前场景该用哪个 skill、什么顺序 |

---

## 二、依赖关系图

```
┌───────────────────────────────────────────────┐
│              setup-rolex-skills                 │ ← 一次性，所有 skill 的前提
└────────────────┬──────────────────────────────┘
                 │
                 ▼
┌───────────────────────────────────────────────┐
│  On-ramps                                     │
│                                               │
│  ┌─ wayfinder ───────────────────┐            │
│  │  模糊项目 → 决策地图 → 清除迷雾 │            │
│  └──────────────┬───────────────┘            │
│                 │ 接入 to-spec                 │
│  ┌─ triage ─────────────────────┐            │
│  │  Issue 流入 → 验证 → 标记     │            │
│  └──────────────┬───────────────┘            │
│                 │ 接入 build chain             │
│  ┌─ improve-codebase-architecture ┐          │
│  │  架构巡检 → HTML 报告 → 深化    │          │
│  └──────────────┬───────────────┘            │
│                 │ 接入 grilling                │
└─────────────────┼─────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────────────┐
│  Main Chain（idea → ship）                     │
│                                               │
│  grill-with-docs                               │
│  （方案拷问 + 持久化术语/ADR）                    │
│         │                                      │
│         ▼                                      │
│    to-spec                                     │
│    （合成 Spec/PRD）                            │
│         │                                      │
│         ▼                                      │
│    to-tickets                                  │
│    （拆分为垂直切片 Ticket + 阻塞关系）            │
│         │                                      │
│         ▼                                      │
│  ┌─ implement ───────────────────┐             │
│  │  [内部 tdd 引擎]                │             │
│  │   红→绿, 一次一个垂直切片       │             │
│  │  [内部 typecheck / 全量测试]    │             │
│  │  [内部 code-review]            │             │
│  │  → git commit                  │             │
│  └────────────────────────────────┘             │
│         │                                      │
│         ▼                                      │
│    code-review（完整双轴：Standards + Spec）      │
│         │                                      │
│         ▼                                      │
│    Merge → 发布 / publish-release               │
└───────────────────────────────────────────────┘
                  │
                  │  随时插拔:
                  │  prototype → 验证设计后喂给 to-spec
                  │  research  → 结果喂给 grill-with-docs
                  │  diagnosing-bugs → 修复 + 回归测试
                  │  resolving-merge-conflicts → 冲突中
                  │  clean-branches → 合并后清理
                  │  safe-pull → 日常同步
                  │
                  ▼
┌───────────────────────────────────────────────┐
│  Shared Vocabulary Layer                       │
│                                               │
│  domain-modeling  ←── 被 grill-with-docs /     │
│  （领域术语 + ADR）    triage / improve 调用      │
│                                               │
│  codebase-design  ←── 被 tdd / to-spec /       │
│  （深度模块词汇）      improve 调用               │
└───────────────────────────────────────────────┘
```

---

## 三、场景 Skill 链速查

| 你想做什么 | 依次敲 |
|-----------|--------|
| **新项目从零开始** | `wayfinder` → `grill-with-docs` → `to-spec` → `to-tickets` → `implement` × N → merge |
| **小功能改进** | `grill-with-docs` → `to-spec` → `to-tickets` → `implement` → merge |
| **修 Bug** | `triage` → `diagnosing-bugs` → 修复 + 测试 → merge |
| **调研技术方案** | `research` → 审阅 → `grill-with-docs` → 进入主链路 |
| **重构模块** | `improve-codebase-architecture` → 拷问 → `to-spec` → `implement` |
| **批量处理 Issue** | `afk-issue-loop`（自动逐个处理） |
| **发版** | `publish-release`（从 develop 一键发版） |
| **同步代码** | `safe-pull`（自动 stash + rebase） |
| **清理分支** | `clean-branches`（删除已合并分支） |
| **出 QA 计划** | `qa-plan`（从 commit 生成测试计划） |
| **合并冲突** | `resolving-merge-conflicts`（merge 过程中触发） |
| **快速验证想法** | `prototype` → 如果可行 → 进入主链路 |
| **长会话交接** | `handoff` → 新会话读取 |
| **不确定用哪个** | `ask-rolex` |
| **学习新技术** | `teach` |

## 四、Git 规范

### 分支策略

```
main
  └── feature/<描述>    （implement 产物）
       └── prototype/<主题>（原型沙箱，永不合并）
```

### 提交信息

| Type | 使用场景 |
|------|----------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `spec` | Spec/PRD |
| `docs` | ADR/CONTEXT.md 更新 |
| `refactor` | 架构改进 |
| `test` | 仅添加测试 |
| `chore` | 配置 |

### Issue 状态机

```
raw → needs-triage
  │
  ├→ 验证（复现Bug / 检出PR）
  │   ├→ 验证成功 → ready-for-agent
  │   └→ 验证失败 → needs-info
  ├→ wontfix（已有实现 / 已拒绝）
  └→ ready-for-agent → implement → ready-for-human → done
```

## 五、常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 跳过 setup 直接跑 triage | 标签错乱 | 先 `/setup-rolex-skills` |
| 没拷问直接写 Spec | Spec 反映第一印象 | 先 `grill-with-docs` |
| 切出水平切片而非垂直切片 | 不可独立验证 | 每 Ticket 端到端穿透所有层 |
| 一次性写一堆测试 | 测试测"想象的行为" | 一次一个垂直切片 |
| prototype 放主分支 | 无错误处理的代码污染 | 永远放 side branch，不合并 |

---

> 路由参考：任何时候不确定用哪个 skill，输入 `/ask-rolex`。
