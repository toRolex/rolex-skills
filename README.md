# Rolex Skills

我在用的 AI agent skill 合集，共 41 个：一部分改编自 [mattpocock/skills](https://github.com/mattpocock/skills)，一部分受 [Thariq 的 quadrant walk 方法](https://x.com/trq212/status/2073100352921215386) 启发。

## 快速开始

```bash
npx skills@latest add toRolex/rolex-skills
```

记得勾选 `/setup-rolex-skills`，安装后在项目里运行。

其他安装方式（Plugin / Git 克隆 / 技能守卫 hooks）见 [docs/usage-guide.md](docs/usage-guide.md)。

## Skills

各 bucket 完整列表见其 README：[engineering](skills/engineering/README.md) · [productivity](skills/productivity/README.md) · [personal](skills/personal/README.md) · [Thariq](skills/Thariq/README.md)（[misc](skills/misc/README.md) 保留但不推广）。使用顺序与流向见 [Skill 使用地图](docs/skill-map.md)。

有些技能会调用其他技能。请同时安装以下技能：

| Skill | 同时安装 |
|---|---|
| `grill-me` | `grilling` |
| `grill-with-docs` | `grilling` |
| `triage` | `grilling` |
| `improve-codebase-architecture` | `grilling` |
| `wayfinder` | `grilling`, `prototype` |
| `implement` | `tdd` |
| `implement-spec` | `to-spec`, `to-tickets` |
| `retro` | （建议在 `/implement` 或 `/implement-spec` 之后运行） |
| `setup-rolex-skills` | `to-spec`, `to-tickets` |
| `unknowns` | `blind-spot-pass`, `brainstorm`, `grilling`, `domain-modeling`, `prototype` |
| `brainstorm` | `prototype`（独立使用时另建议 `grilling`，可选） |
| `pre-implement` | （可选：读取 `grilling` 的结论） |

不确定用哪个？`ask-rolex` 是路由器，会按当前情境路由到具体 skill。

部分 skill 可手动以 `/名字` 调用，例如 `/grill-me`、`/teach-me`、`/afk-issue-loop`；其余由模型在匹配场景时自动触发，例如 [personal/github-api-rate-limits](skills/personal/github-api-rate-limits/SKILL.md)——在 gh CLI / GitHub API 的分页、循环、批量请求中遵守 REST 与 GraphQL 两条独立的 rate limit 预算。

另有 4 个保留但不推广的 skill，见 [skills/misc/](skills/misc/)。
## 协议

MIT，见 [LICENSE](LICENSE)。

## 致谢

- [mattpocock/skills](https://github.com/mattpocock/skills)：部分 skill 的上游。
- [Thariq 的 quadrant walk 文章](https://x.com/trq212/status/2073100352921215386)：`Thariq/` bucket 的灵感来源。
- [dzhng/explore-unknowns](https://github.com/dzhng/skills)：`Thariq/unknowns` 四象限地图的来源。
