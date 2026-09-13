# AFK 角色 prompt 文件恢复实施记录

## 范围

仅恢复 skill 内运行用角色 Markdown，engine 读取其作为角色职责唯一真源；保留字段契约、调度状态机及既有未提交改动。不 commit/push、不跑真实 LLM/GitHub 业务、不扩展 Sandcastle runtime 审计。历史任务验收记录不改写。

## 实施决策

- 已读当前完整 engine、迁出的三份角色文件及引用；以当前 engine 有效边界整合角色细节，尤其保留整批单 summary、summary 后关闭、close-only、同现场独占写者和权限边界。
- 已核对指定上游 `e99f832` 的 `src/templates/parallel-planner-with-review/main.mts`：各角色以 `promptFile` 选择 Markdown、`promptArgs` 传任务参数。指定快照中 `PromptResolver.ts` / `PromptPreprocessor.ts` 不存在（仅发现 import），本轮不下载或补齐上游。
- 本地零依赖最小适配：以 `import.meta.url` 解析 skill/reference，启动前读取三角色及公共模板并检查非空；本运行固定加载快照。代码只选择正文、注入配置/上下文与结果契约。上下文直接 JSON 序列化附加，不做占位符替换、eval 或 shell 预处理，因此需求中的占位符保持字面量。

## 验证

2026-09-12：17 项受控验收全部通过，入口均为公开 `afk.mjs start/status`，未直接调用 engine 内部接口。

- 原仓库 CLI 从 `/tmp` 发起，daemon 的 cwd 为 fixture 目标仓库，成功读取 skill 模板，单票 Implementer → 同现场 Reviewer → Merger → summary → 关闭，SPEC 保持 OPEN。
- 分别在 skill 的独立临时副本修改三份角色 Markdown，每次仅对应角色指令输入改变；其他角色指令部分与原始输入逐字相同（动态 run/cwd/前序结果不作跨运行相等比较）。实际 stdin 包含对应角色及 common 文件全文。
- 上下文携带 `{{BRANCH}} {{CONTEXT}} {{VERIFY}} ${notEvaluated} $(not-executed)`，三角色输入保持原样；没有二次替换或表达式执行。
- 三角色与 common 各验证缺失、纯空白、不可读（路径为目录，EISDIR）共 12 项：start 退出 1，错误包含模板角色及绝对路径，最终 failed，无 started 事件、无角色派发，甚至未执行前置业务命令。不改文件权限来制造测试。
- close-only：首轮关闭暂时失败后，公开运行续派仅 Merger；总计 1 Implementer、1 Reviewer、2 Merger，但只有 1 merge、1 summary。第二次 mode=close，summary 标题保留，无代码提交/合并/summary 重做；最终关闭成功。引擎现有目标 HEAD/clean 核验同时通过。
- `node --check engine.mjs`、`git diff --check` 通过；无迁出角色路径或“运行时不读取角色模板”的陈旧引用。三份 docs 副本已移除，SOURCE 研究未移动；已更新 skill 入口、REFERENCE 及使用文档指针。

证据及临时 runner：`/tmp/afk-issue7-acceptance.role-prompts.lMwvTj/acceptance.mjs`、`results.json`，各用例目录保留实际 prompt、trace、公开 CLI 输出和运行日志。复用旧 fixture 的假 gh/LLM 与受控 Worktrunk 包装；Git/Worktrunk 仅操作新建临时仓库，未运行真实业务或 LLM，未增加仓库 runner 测试脚本。旧证据 `/tmp/afk-issue7-acceptance.clydzK` 未改写，未跑 615 秒场景。

## Deviations

- 不复用 Sandcastle API 或预处理实现；只适配文件与参数分离的方式。完整架构审计留下一轮。
