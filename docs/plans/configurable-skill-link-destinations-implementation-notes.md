# 可配置 Skill 链接目录 Implementation Notes

## 任务

让 `scripts/link-skills.sh` 可将仓库 skill 链接到调用者指定的目录，以支持 Skills Manager 的中央目录；保留无参数时链接 `~/.claude/skills` 与 `~/.agents/skills` 的现有行为。

## 计划

1. 定义兼容的命令行接口与目标目录安全边界。
2. 修改链接脚本并补充帮助信息。
3. 更新贡献者安装文档和仓库维护说明。
4. 在临时目录验证默认/自定义/多目标/错误输入分支，不改动真实 agent 目录。

## 决策

- 沿用仓库 `docs/plans/` 的 implementation notes 位置，使用独立任务文件，避免覆盖既有记录。
- 命令行采用 `scripts/link-skills.sh [DEST ...]`：传入一个或多个位置时仅写这些位置；无参数时沿用两个默认 harness 目录。
- Skills Manager 示例使用用户指定的 `$HOME/.config/.skills-manager/skills`。该目录中的每个 skill 将直接指向本仓库，因此仓库更新会即时反映到中央目录及其下游 agent 链接。
- 目标目录全部先校验、后统一写入，避免后续目标失败时留下部分更新。
- 同名实体文件或目录默认报错退出；调用者可显式传入 `--replace-existing` 将中央库中的同名实体副本替换为软链接。
- 目标不得解析到仓库内部，且此检查在创建目标目录前完成。

## Deviations

- 初版沿用了旧脚本自动删除同名实体的行为。交付前复核指出：开放任意目标参数后，误传宽泛目录可能删除用户数据。改为默认拒绝同名非软链接，并将所有目标预检置于任何写操作之前。
- 第二轮审查发现多目标之间可能通过新建软链接改变后续目标的解析结果，且含 `..` 的不存在路径可绕过检查。增加词法规范化、目标间生成链接关系检查、写入时路径复查，并在 `rm -rf` 处再次要求 `--replace-existing`。

## 执行记录

- [x] 阅读现有脚本、README、CLAUDE.md 与仓库 implementation notes 约定。
- [x] 修改脚本：支持零个、一个或多个目标参数，提供 `--help` 与显式 `--replace-existing`，拒绝空目标、仓库内部目标与默认模式下的同名实体目标；所有目标通过预检后才写入。
- [x] 更新 README 与 CLAUDE.md，加入 Skills Manager 中央目录示例。
- [x] 通过 `bash -n`、`git diff --check` 和 `--help` 检查。
- [x] 在 `/tmp/rolex-skills-link-test/{one,two}` 验证多目标链接：两个目录各生成 40 个链接，且 `pre-implement` 指向仓库源目录。
- [x] 验证空目标、未知选项与仓库内部目标均以明确错误退出，且非法仓库目标不会被创建。
- [x] 验证默认模式保留同名实体内容并退出；`--replace-existing` 可将该实体替换为仓库软链接。
- [x] 第二轮安全修复后复测：多目标各 40 个链接；路径规范化阻止 `..` 绕过；目标间不会经新生成的 skill 链接穿透；删除点再次检查 `--replace-existing`。
