快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/retro)

## 功能

`retro` 对一次 coding session 做复盘，针对 agent 的**环境**而不是代码提出改进建议：机械性错误变成确定性检查，判断性取舍变成 coding standards，让下一次构建从一个更好的环境开始。

它在这些类别中寻找改进候选：**Navigation**（navigation pointer）、**Automated checks**（lint/type/test guardrail，含"检查存在但没接线"这种发现）、**Coding standards**（mechanical 违规上确定性检查，`CODING_STANDARDS.md` 只留真正的 judgement calls）、**Global AGENTS.md**（臃肿的 steering 指令下沉）、**Tool economy**、**No-ops**、**Information access**。候选按严重程度排序后呈现给用户。

## 何时使用

手动敲 `/retro` 调用。

在一次构建之后运行——尤其是走得磕磕绊绊的那次。`/retro` 要在它所回看的那个 session 里、clear 之前运行；clear 之后，让它指向那个 session 的日志。

核心分工：implementation agent 承受最大的 context pressure，review agent 压力最小，所以 coding standards 由 review agent 执行。

## 在流程中的位置

```
grill-with-docs → to-spec → to-tickets → implement 或 implement-spec → code-review → pr → retro
```

它在主链路末端闭环：改进产出的是环境（checks、standards、pointers），喂给下一次构建。不确定时问 `/ask-rolex`。
