# ask-rolex 地图同步 implementation notes

## 原因与范围

- `ask-rolex` 主入口仅覆盖四个已推广 bucket 的 34/41 个 skills，缺少七条路由；还推荐了 misc 技能并错误标注 `blind-spot-pass` invocation。
- 已完整读取仓库规则、invocation 约定、主入口、阶段边界、现有地图，以及新增路由相关 skill 正文。
- 仅修导航与独立 notes；保持各 skill invocation 和执行语义，不触碰个人配置或未跟踪 harness 目录。

## 决策

- 主入口承载场景与下一步选择；用相对指针到 `docs/skill-map.md` 查看已有完整图，不复制 Mermaid，不另造一套图。
- 整段模糊走 `unknowns`，单项盲点扫描或偏好探索仍可独立取用；地图交付后才转规划、实现。
- 新增路由按真实 frontmatter 区分手动入口与 agent 可调用参考，避免把 router 的建议变成自动触发 user-only skill。

## Deviations

无。用户已给足 spec 与范围，由本 subagent 独立执行，不再派代理。

## 完成与验证

- 已补齐七条缺失路由及相互关系，修正 `blind-spot-pass` 为 model-invoked；强顾问场景改为用户手动调用 `ask-advisor`。
- 清除全部 misc 推荐与过时原创技能数量段；同时明确 user-only 导航标签的手动调用边界，修正 `wait-what` 的跨流程表述，避免暗示自动调用。
- `docs/skill-map.md` 已准确覆盖当前技能与新增关系，因此不改；主入口使用 `../../../docs/skill-map.md` 指向它。
- 四 bucket 逐一枚举并人工核验场景、关系与 invocation：engineering 20、productivity 8、personal 6、Thariq 7，共 41/41（含 ask-rolex；user-only 24，model-invoked 17）。主文件 misc 路由为 0。
- 主文件与现有地图合计 47 个本地 Markdown 链接均可解析。
- `node scripts/check-skills-structure.mjs` 通过；`node --test scripts/check-skills-structure.test.mjs` 8/8 通过；`git diff --check` 通过。
- 未修改任何 skill 的 frontmatter 或执行语义；未改 harness 未跟踪目录；未提交或 push。
