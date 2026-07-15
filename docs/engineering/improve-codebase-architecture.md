快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/improve-codebase-architecture)

## 功能

`improve-codebase-architecture` 扫描代码库寻找**深化机会**——将浅模块（接口几乎和它隐藏的东西一样复杂）变成深模块——呈现为自包含的 HTML 报告，然后对你选中的候选进行访谈。

它不会给你一长串重构建议。每个候选必须通过**删除测试**——删除这个模块会*集中*复杂性还是只是到处移动？只有"集中"的案例才会生成卡片。这个过滤器防止报告变成泛泛的清理建议。

## 何时使用

手动敲 `/improve-codebase-architecture` 调用。

作为定期健康检查使用：每几天一次，或当代码库让你感觉理解一个概念需要在许多小模块之间跳转时。如果已经知道要重新设计哪个模块，直接用 `/codebase-design`——这个 skill 是做勘察的，那个是设计台。

## 深化机会

核心概念是**深度（depth）**。深模块在小接口后隐藏大量功能；浅模块的接口几乎和下面的代码一样宽。报告搜索浅度——仅为可测试性提取的纯函数（真正的 bug 藏在调用方式中）、跨 seams 泄漏的模块、不看五个文件就无法理解的概念——并建议深化方案。

## 报告，然后访谈

输出是写入 OS 临时目录的 HTML 文件——什么都不会留在仓库里。每个候选是一个卡片，包含涉及的文件、摩擦点、纯语言描述的问题和收益、前后对比图、推荐强度徽章。

然后停下来问你想看哪个。选一个后，通过 `/grilling` 循环走设计树。

## 在流程中的位置

定期维护，不是链路中的一步。依赖 `/codebase-design`（词汇层）和 `/domain-modeling`（领域模型更新）。不确定时问 `/ask-rolex`。
