快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/wizard)

## 功能

`wizard` 生成一个交互式 bash 脚本，一步步引导人类完成**只有他们能执行**的流程——开通基础设施、设置凭据或 CI secrets、在一个不熟悉的第三方 dashboard 里操作、跑一次性迁移或切换。它打开每个 URL、准确说出要点击和复制什么、捕获值、写进 `.env` 和 GitHub secrets、每阶段确认、显示还剩多少。

令人愉悦的 UX 已由 `template.sh` 解决。`STAGES` 标记上方的库在每个 wizard 中相同，永远不要手工编辑。

## 何时使用

`wizard` 是 model-invoked——agent 一碰到只有你能过的墙就自动够它。

当 agent 自己能做时它不该用 wizard；这是给真正有人类在循环里的情况。wizard 默认一次性：保存到 scratch 或 `scripts/`，工作完成后删除。

## 在流程中的位置

独立工具，脱离主流程。参考主流程时先跑 `/grill-with-docs` 想清楚，再用 wizard 处理只有人能做的收尾步骤。
