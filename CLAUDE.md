# 这个仓库是什么

本项目是 [mattpocock/skills](https://github.com/mattpocock/skills) 的中文改编版。

关系就像 [obra/superpowers](https://github.com/obra/superpowers) 和 [jnMetaCode/superpowers-zh](https://github.com/jnMetaCode/superpowers-zh)：上游英文 → 下游中文增强版。

具体来说：

1. **先翻译**——所有 SKILL.md 正文翻译成中文，保留英文技术术语
2. **再适配**——`ask-matt` → `ask-rolex`，删掉个人化/过时的技能，改了 README 和 CLAUDE.md
3. **再补充**——加了上游没有的东西，比如 `uv-python`（Python 强制 UV），中文开发环境相关
4. **能跟上**——上游更新了可以 cherry-pick 过来，不依赖上游的分支

# 仓库规则

Skills 按 bucket 文件夹组织在 `skills/` 下：

- `engineering/` — 日常编码工作
- `productivity/` — 日常非编码工作流工具
- `misc/` — 保留但很少使用，不推广

`engineering/` 或 `productivity/` 中的每个 skill（**已推广的** buckets）必须在顶层 `README.md` 中有引用，并在 `.claude-plugin/plugin.json` 中有条目。`misc/` 中的 skill 不能出现在两者中的任何一个。

顶层 `README.md` 中的每个 skill 条目必须将 skill 名称链接到其 `SKILL.md`。

每个 bucket 文件夹有一个 `README.md`，列出该 bucket 中的每个 skill 及其一行描述，skill 名称链接到其 `SKILL.md`。已推广 bucket 的 `README.md` 和顶层 `README.md` 将条目分组为 **User-invoked** 和 **Model-invoked**；`misc/` bucket 的 `README.md` 使用平面列表。

每个 `SKILL.md` 要么是 user-invoked（`disable-model-invocation: true`，仅由人类调用），要么是 model-invoked（模型或用户均可调用）。见 [.agents/invocation.md](./.agents/invocation.md)。

[`ask-rolex`](./skills/engineering/ask-rolex/SKILL.md) 是路由器，映射所有用户可调用的 skill 及其相互关系。当你添加、重命名、删除或更改用户可调用 skill 在流程中的位置时，重新阅读 `ask-rolex` 的 `SKILL.md` 并更新它，使地图保持准确。

要将所有 skill（重新）链接到本地 harness skill 目录（`~/.claude/skills`、`~/.agents/skills`），运行 `scripts/link-skills.sh`。每个条目是指向此仓库的符号链接，因此 `git pull` 可以保持已安装的 skill 最新；在添加、删除或重命名 skill 后重新运行该脚本。
