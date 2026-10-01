# Walk 之后

地图在规划结束之后继续活着。以下是后续任务的接线，不在 unknowns 交图时自动执行所有步骤。

- **开始实现多步骤任务：** 调用 Skill 工具传入 `pre-implement`。implementation notes 的位置、因果记录和 Deviations 处理由 [pre-implement](../../pre-implement/SKILL.md) 负责。传入地图、已批准计划、spec 和 prototype 指针；新发现的 unknown 与偏离回填地图，需要用户判断的项目明确标出。
- **需要 buy-in 或交付批准：** 读取并执行 [to-pitch](../../to-pitch/SKILL.md)，传入 prototype、spec、地图和 implementation notes。文档打包、demo 开头、两条阅读路径及目标格式由它负责；生成可分享文档不等于获得对外发送授权。
- **长 diff 或复杂变更在 merge 前需要确认理解：** 读取并执行 [quiz-me](../../quiz-me/SKILL.md)。报告、逐题讲解和满分门由它负责；用户没有实际作答时不宣称通过，也不自动 merge。

`to-pitch` 和 `quiz-me` 是 user-invoked，使用文件链接读取正文，不尝试通过 Skill 工具自动触发。后续任务的授权与执行边界仍由用户当前请求决定。
