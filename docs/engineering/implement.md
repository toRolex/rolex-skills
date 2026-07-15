快速开始：

```bash
git clone https://github.com/toRolex/rolex-skills
cd rolex-skills
bash scripts/link-skills.sh
```

在项目里跑 `/setup-rolex-skills` 完成配置后即可使用。

[源码](https://github.com/toRolex/rolex-skills/tree/main/skills/engineering/implement)

## 功能

`implement` 按照 spec 或 tickets 中描述的工作进行实现——驱动 TDD、类型检查、全量测试套件，然后交接给审查并提交到当前分支。

它**不做**决定构建什么。spec 已经确定、seams 已经约定好；`implement` 执行计划而不是重新打开讨论。它是手，不是头——思考在上游已完成。

## 何时使用

手动敲 `/implement` 调用。

当工作已写成 spec 或拆成 tickets，准备将其变成代码时使用。如果 spec 还不存在，先用 `/to-spec`。只想做 TDD 不需要完整 spec，直接用 `/tdd`。

## 预先约定的 Seams

`implement` 运行的基础概念是 **seam**——功能被测试的稳定接口，在代码编写之前已选定。它不在构建中发明 seams，使用 `/to-spec` 已选好的 seams，通过 `/tdd` 编写测试。在预先约定的 seam 上工作让实现保持诚实：测试针对持久的东西，底下的代码可以变动而不影响测试。

## 在流程中的位置

```
grill-with-docs → to-spec → to-tickets → implement → code-review
```

它是主构建链的构建步骤。前接 `/to-tickets`（产出 tickets），内部驱动 `/tdd`，完成后调用 `/code-review`。不确定时问 `/ask-rolex`。
