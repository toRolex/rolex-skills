# Merger 单次调用全权收尾，引擎只做 spawn 与调度

grilling 回归上游 `parallel-planner-with-review` 的结论：Merger 单次调用完成合并、验证、summary、逐个 `gh issue close`、再用 `wt` 清理已合入分支/worktree，最后输出 `<promise>COMPLETE</promise>`。删除两阶段（`mode=merge/close`、`summaryCreated/Subject`）、`<afk-result>` 封套、引擎侧祖先核验/逐票校验/`inspectMerger`——凡是上游 agent 做的，本地也由 agent 做；脚本只 spawn、下轮调度。

## Considered Options

引擎 `wt remove` 清理（曾推荐）：与 sandcastle 哲学相悖——上游把工作交给 agent 而非编排器；且 merger prompt 加删分支后引擎再删即双责。否决。

## Consequences

- `CONTEXT.md`：Merger 全权收尾；删除 `仅待关闭`、`Self-report/Gate/Delivery` 残留、`完成信号` 去重、`恢复分类` 去"继续验证关闭"、`merged-unverified` 去 summary 核实。
- ADR 0011 中"两阶段保留""`merger-result` 依据"" verified 与 summary 不再阻断"等段落被本决策取代。
- 风险：agent 删错分支引擎不拦，`wt` 锁只防并发写。
