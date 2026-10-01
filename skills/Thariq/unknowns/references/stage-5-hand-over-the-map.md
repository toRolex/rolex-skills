# Stage 5 — Hand Over the Map

walk 的交付物。收尾时把完成的四象限地图装成一份用户留得住的 artifact。

## 地图 artifact

一页自包含的页面，装着全部四个象限：

- **Known knowns：** 已经定下来的地面，带文件引用。
- **Known unknowns：** decision ledger。每个叫出名字的问题、它的答案、谁关闭了它（user / territory / OPEN）。OPEN 项写明什么能解锁它。
- **Unknown knowns：** 被抽出来的东西：口味、消费者、运行环境、tacit conventions，以及每条改写了什么。
- **Unknown unknowns：** landmine cards，带证据，每条标成 decided、OPEN 或 sharp-edge。

还开着的东西住在地图上，不住在 scrollback 里。实现者写代码前必须确认的小事实单列一张清单。它们是地图条目，不是脚注。

## 一起带走的东西

- **build plan 可以陪着地图，但不能取代地图。** 用户需要附带计划时，读取并执行 [to-plan](../../to-plan/SKILL.md)，传入地图、references 和 prototype 指针。关键决定置顶、HTML artifact 与审阅门由它负责，不在这里另写一套计划规则。计划被用户调整时同步更新地图；用户未要求计划时只交图，不自动展开另一场审阅。
- **一条可复制的下一步 prompt。** 没有阻塞 OPEN 时，提供引用地图及已批准计划的实现 prompt；仍有阻塞 OPEN 时，提供继续澄清 prompt，明确地图尚不能启动实现。生成 prompt 不等于获得执行授权。

**正常完成：** 前面各阶段正常完成，用户手里拿着地图。实现是从它出发的另一件任务，可以提议开始，并指向 [walk 之后](after-the-walk.md)。

**暂停交接：** 来自 stage 4 的暂停分支时，交付标注“访谈暂停”的阶段性地图，写明 OPEN、阻塞性、解锁条件和恢复入口。只完成进度保存，不宣称 walk 完成；下一步 prompt 指向恢复访谈，不指向实现。
