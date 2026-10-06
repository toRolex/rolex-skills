# Personal

Rolex 原创的个人 skill——本仓库相比上游 mattpocock/skills 的差异化内容，覆盖 Git 运维到批量处理的完整链路。

## User-invoked

- **[next-steps](./next-steps/SKILL.md)** — 手动调用时预测最多三个自然后续请求，展示标题与完整 prompt；回复编号直接执行。
- **[afk-issue-loop](./afk-issue-loop/SKILL.md)** — 启动独立本地脚本，分批实现、审查、合并并关闭 GitHub Tickets。
- **[ask-advisor](./ask-advisor/SKILL.md)** — 显式把当前决策点交给强模型顾问（strong-model-consultant），获取决策建议。
- **[vertical-slice-review](./vertical-slice-review/SKILL.md)** — 审查 ticket 拆解方案是否符合 vertical slice 方法论，必要时重拆并请强模型复核。

## Model-invoked

- **[clean-branches](./clean-branches/SKILL.md)** — 清理已合并 Git 分支（本地 + 远程 + 残留 worktree）。
- **[github-api-rate-limits](./github-api-rate-limits/SKILL.md)** — 在 gh CLI / GitHub API 的分页、循环、批量请求中遵守 REST 与 GraphQL 两条独立的 rate limit 预算。
- **[browser-tools](./browser-tools/SKILL.md)** — 浏览器与网页任务的路由器：按任务把工作交给 ego-browser / OpenCLI / firecrawl / anysearch / CloakBrowser 之一。
