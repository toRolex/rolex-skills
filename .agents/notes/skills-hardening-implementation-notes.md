# skills structure lint Implementation Notes

Date: 2026-10-03 · Branch: main · Source: `/tmp/handoff-skills-hardening.md` 任务 #2

## 选型决策

- **检查器是 Node ESM**（`scripts/check-skills-structure.mjs`），与 `scripts/sync-plugin-version.mjs` 一样零依赖。入口只检查、不改文件。
- **`--root` 只给测试**：默认根是脚本所在仓库。坏 fixture 用临时目录，不碰本仓库。
- **invocation 分组必须和 frontmatter 一致**：`disable-model-invocation: true` → User-invoked；键不存在 → Model-invoked。其他值失败。bucket README 与顶层 README 都要落在对应标题下，且每个 skill 只链接一次。链接文字必须是 skill 目录名，目标必须解析到该 `SKILL.md`。
- **不推广 bucket 用平面列表**：CLAUDE.md bucket 子弹行里含「不推广」的目录（现只有 `misc/`）禁止 `User-invoked` / `Model-invoked` 标题，每个 skill 仍须链接一次。已推广 bucket 两个标题都必须在。
- **CLAUDE 与 plugin.json 比的是 bucket 集合，不是逐 skill 路径**。`plugin.skills` 现为四个目录。条目必须正好是 `skills/<bucket>`（允许 `./` 前缀和末尾 `/`）。集合等于 CLAUDE 里未标「不推广」的 bucket。版本字段仍只由 `sync-plugin-version.mjs` 负责。
- **测试用 `node:test`**，不新增依赖。`package.json` 的 `test:skills-structure` 与检查 script 分开。CI 用新 workflow 直接调 `node`，不 `pnpm install`、不调用 GitHub API。

## 偏离

- 实现子代理只改工作区；独立审查通过后，由编排者按 handoff 提交本次仓库路径。
- 任务 #3 由独立子代理修改个人配置，不进入仓库提交。
- 不改 `ask-rolex` 路由地图。用户尚未裁决 to-pitch 是否入图。
- 不把版本检查再塞进结构 lint 或新 CI。`release.yml` 保持原样。
- 顶层 README 原先只链到 bucket README，不满足「每个已推广 skill 的名称链接到其 SKILL.md」。补全索引是存量修复，不是放宽检查。
- `personal/README.md` 的 `qa-plan` 链到不存在的 `./qa-plan/SKILL.md`（实体在 `misc/`）。删这条坏链，不把 skill 挪出 misc。
- `browser-tools` 无 `disable-model-invocation`，补进 personal 与顶层的 Model-invoked。
- `publish-release` 在 misc README 出现两次，且该文件用了 invocation 分组。平面列表只留一条。它本身没有 disable 键，但平面列表不标分组。

## 偏离（续）

- 任务 #3 由独立子代理做等价规范化：17 条角色行、26 个模型槽全部精确命中 enabledModels，注释块与 thinking 保留。完整 `/setup-pstack` 会重分配并替换注释，所以没有跑它。模型 ID 不写入本文件。
- Reviewer 要求 invocation 键也认 `"disable-model-invocation"` / `'disable-model-invocation'`。引号键若值为 `false` 或重复，按非法标志失败，不能当成缺省的 Model-invoked。
- Reviewer 要求目录链接必须在可见 Markdown 里。围栏代码块和 HTML 注释先清空，行号保留，再解析标题和链接。只藏在这两处的 `SKILL.md` 链接不算条目。

- 最后一处 invocation 漏检是整体缩进的顶层 YAML mapping。按最小非空非注释行缩进定位顶层键，避免把 `description: |` 正文当标志；增加缩进 true/false 和 block scalar 回归。
- 子代理恢复与重新启动均因 Herdr `unknown option: --panes` 失败；编排者接手最后这一处修复，现有 reviewer 继续独立复核。

## 踩坑

- 分组标题若写在外层目录标题里面，必须取最内层标题。第一个包围标题会把链接算到目录标题下，分组检查失效。
- `node --test` 里 `execFileSync` 只设 encoding 时，子进程失败信息会进测试 stderr。CLI 反例要显式 `stdio: pipe`。
- 仓库内绝对路径经 `path.resolve` 后会变成合法相对路径，本机检查通过，GitHub 渲染是坏链。href 在解析前必须是仓库相对路径：拒绝以 `/` 或 `\` 开头（含协议相对 `//`），拒绝 `scheme:`。编码后的形式解码后再查一次。skill 只认 `bucket/<name>/SKILL.md` 这一层，更深层的 `SKILL.md` 不是另一个 skill。
- 顶层 README 原写「共 41 个」。实数是已推广 41、`SKILL.md` 共 45（misc 4）。README 现同时写这两个数。
