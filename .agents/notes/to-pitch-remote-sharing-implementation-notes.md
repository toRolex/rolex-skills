# to-pitch remote 分享 Implementation Notes

Date: 2026-10-02 · Branch: main · Source: /tmp/handoff-to-pitch-remote.md + grilling session

## 选型决策

- **REMOTE.md 独立成文件**（而非主文件内新节）：按 writing-for-agents 的 branching 披露测试，remote 细节只有部分调用到达，内联会埋葬主路径 steps。主 SKILL.md 仅在流程末尾加一条分支指针。
- **临时目录，不写模板**：产出物写系统临时目录，目录名 agent 按主题自取。handoff 初稿的固定家目录方案被否决（用户裁决：只能写临时目录），修订稿的命名模板也被否决（"没有模板"）。
- **不指向参考实现文件**：曾考虑指向历史成品，但参考实现位于临时目录（重启即清），指针不可靠；结构要点（零外链、双路径按钮、viewport、CSS/JS 动画可选）直接写进 REMOTE.md 正文。
- **正面表述替代禁令**：handoff 的位置禁令改写为「写入系统临时目录」，被禁路径不出现在 skill 文档（writing-for-agents negation 原则）。
- **完成标准双通道化**：remote 完成标准 = curl 验 127.0.0.1 与 Tailscale IP 各 200 + 二维码/URL 已展示 + 已告知如何停。

## 偏离

- Handoff 骨架建议「在流程后追加一节」；实现改为独立 REMOTE.md + 一条指针，经 grilling 确认。
- 元数据同步范围经核实收窄：顶层 README 与 plugin.json 只列 bucket 不列单个 skill，实际只有 skills/Thariq/README.md 一行需要更新；ask-rolex 地图本就不含 to-pitch（位置未变），不动。
- ADR：按 domain-modeling 三条件评估不构成（易换、理由在 skill 内），跳过。

## 踩坑

- 无。grilling 阶段已提前消解「临时目录 vs 永久目录」「模板命名」两处矛盾，实现零返工。
