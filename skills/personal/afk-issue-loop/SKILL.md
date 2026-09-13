---
name: afk-issue-loop
description: 启动独立本地脚本，分批实现、审查、合并并关闭 GitHub Tickets。
disable-model-invocation: true
argument-hint: "[issue-number ...] [provider/model/target]"
---

# AFK Issue Loop

你只负责解析输入、启动独立本地编排进程、报告启动结果。脚本是唯一调度者，通过本机 CLI 执行 Implementer、Reviewer、Merger；发起会话可在确认启动后结束。

## 1. 解析启动输入

1. 将本 skill 目录解析为绝对路径，读取公开入口 `node "<skill绝对路径>/scripts/afk.mjs" help`。从当前项目确定目标仓库绝对路径，作为 `--repo`；不是 skill 安装仓库。
2. 显式 Ticket 编号转为 `--issues 3,4,5`；没有编号则省略，由脚本首次分页读取 open `ready-for-agent`，固定本次范围。用户标明的父 SPEC 传 `--spec`，仅作上下文，不实施或关闭。
3. 用户指定目标传 `--target`，否则脚本选择已有 develop、其次 main。用户指定执行 CLI 传 `--provider claude|codex|pi`，默认 **claude**，不按调用宿主猜。`--model`、`--effort` 仅在用户明确指定时传入，省略沿用所选 CLI 本机配置。项目验证要求可传 `--verify`。
4. 从项目约定确定优先级标签，按高到低传 `--priority-labels`；没有约定就省略，全部同级按编号。本仓库目前没有现存项目优先级映射，不能把示例标签当约定。
5. 不为正常恢复传 `--reuse`。脚本根据当前 GitHub、标准 `afk/issue-N` 分支、Worktrunk worktree 与 writer socket 事实自动分类：closed 跳过；唯一已有 worktree 原地恢复；只有分支时恢复同一分支 worktree；两者都没有才新建。`--reuse N` 仅保留显式归属兼容信息，不能绕过活跃写者、锁定、quarantine 或非标准现场边界。

完成条件：目标路径、固定输入及显式选项明确；所需 Node >=22、Git、Worktrunk、GitHub CLI、所选执行 CLI 与授权已准备。平台为 macOS/Linux，运行组件仅用 Node 内置模块，无运行时包下载；缺项或 Worktrunk hooks 审批由用户完成，不自动安装、绕过权限或传 `--yes`。

## 2. 启动独立编排

执行公开命令，以实际绝对路径和已确认选项替换占位：

```sh
node "<skill绝对路径>/scripts/afk.mjs" start --repo "<目标仓库绝对路径>" --issues 3,4,5
```

等启动握手返回，入口握手最多 120 秒；普通前置命令默认 30 秒期限，挂起须可见失败，两者都不是角色总运行时长。启动失败报告错误及已有日志位置；不要把普通后台工具任务当独立编排，也不回退为宿主原生子代理或另一个 LLM 总调度者。读票、选批、worktree、接力、等待和下一批均由脚本执行。

完成条件：公开入口实际返回 `started` 及运行身份；仅创建文件或发出启动请求不算成功。

## 3. 报告已启动

报告返回的运行身份、目标仓库/分支、日志目录及原样可用的 `status`、`stop` 命令。日志归目标仓库 `.afk/logs/`；说明 **已启动不等于 Tickets 已交付**，最终进展与结果由脚本记录，用户可在发起会话结束后查看。

`stop` 的停止请求受理不等于角色已结束；以后续 `status` 确认最终停止，未知状态保留现场。新 run 可从当前 Git/GitHub/worktree/writer 事实恢复代码现场，但不恢复旧进程内存、历史 PID 或旧 Reviewer 结论；`status` 与 `events.jsonl` 展示逐票恢复分类和阻碍。

完成条件：启动身份、日志、查看与停止方式均已告知，此 skill 任务结束。

维护运行 prompt 时读 [Implementer](reference/implementer-prompt.md)、[Reviewer](reference/reviewer-prompt.md)、[Merger](reference/merger-prompt.md)：三份是固定上游的逐段中文版，仅作必要本机与 AFK 适配；不再有 common 层。启动握手前从 skill 内读取三 MD，缺失、不可读或空白使启动失败；角色启动前展开可信模板中的 Git 命令，自动注入 Implementer 最近十条提交、Reviewer 完整 diff/log，失败可见。任务参数只作单次替换的数据，命令插参安全转义；结果短协议由引擎附加，职责不在代码重复定义。

需要理解自动批次规则时读 [业务参考](REFERENCE.md)；核对进程、日志及现场边界时读 [工作现场](reference/workspace-binding.md)；演练场景见 [示例](EXAMPLES.md)。接口存在不等于三个 CLI 均已实测通过；以所选 CLI 的实际运行结果为准。
