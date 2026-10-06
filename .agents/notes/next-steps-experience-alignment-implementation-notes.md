# next-steps experience alignment implementation notes

## Confirmed contract

- 保留手动调用的纯 skill，不新增插件或自动 turn hook。
- 推荐用户最可能接着提出的请求；自然下一步适合可用 skill 时优先写其真实调用与参数，不强凑 skill。
- 同时展示短 label 和完整 prompt，格式为 `1. 精简标题：完整请求`，最多三条；完整请求保留必要上下文，不展开实施方案。
- 用户回复编号直接执行对应完整请求，不回显、不填充输入框。用户已明确选择此行为，取代此前 draft-only 约定。
- 不提供 dismiss；无自然下一步时也反馈，对话明确结束时告知已结束。

## Decisions

- 上游展示 label、选择后填入 prompt；纯 skill 没有输入框 API，用户要求两者同时展示并将编号选择作为执行请求。这是有意的交互适配，不宣称与插件 UI 完全等价。
- 生成建议和执行选择分开：生成阶段只输出建议；执行阶段沿用已展示的完整请求及现有约束。选中 skill 后遵循宿主加载方式和 skill 自身流程，不绕过授权或前置条件。
- SKILL.md 是行为契约的权威位置；README 与路由只做简短摘要。此前任务的 notes 保留为历史记录，本任务记录新决定，避免改写过去的决策。
- 本地 next-steps 安装链已指向仓库，因此修改即时反映在安装文件；没有新增或重命名 skill，无需重建全仓库链接。
- 在根 GLOSSARY 中记录 next-steps 语境下的建议标题、完整请求、编号选择，分清展示内容与执行授权；不把格式、宿主 API 或实现步骤放进术语定义。
- 不新增 ADR：这是易于修改的 skill 交互约定，不满足难以逆转的条件。

## Validation

- `pnpm test:skills-structure`：8/8 通过；`pnpm check-skills-structure`：通过。检查覆盖仓库结构，不代表模型行为得到程序保证。
- 独立只读审查：七个改动文件的行为口径一致，无严重或重要发现。纸面验收覆盖可用 skill 推荐、无关 skill 不强凑、明确结束反馈、无建议后编号不触发旧选项。
- 主 agent 最后将建议的长度目标正面化：label 一眼可辨，prompt 通常为一句具体请求或一条调用命令，必要参数可补充，防止再次退化为压缩实施方案。
- 复读 `/Users/rolex/.pi/agent/skills/next-steps/SKILL.md` 已看到新内容，确认安装软链接有效。未进行实际宿主交互或多模型行为测试。
- `jj diff --git` / `jj status`：只涉及本任务七个文件，无冲突；未推送。
