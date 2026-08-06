# HTML Report 格式

架构审查被渲染为 OS 临时目录里的单个自包含 HTML 文件。Tailwind 和 Mermaid 都来自 CDN。Mermaid 可靠地处理图状图表；手工构建的 div 和内联 SVG 处理更具编辑性的视觉元素（质量图、截面）。把两者混用——不要什么都依赖 Mermaid，否则它会开始看起来千篇一律。

## Scaffold（脚手架）

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>架构审查 — {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      /* Tailwind 无法干净覆盖的东西的小型自定义层：
         虚线 seam 线、手绘感箭头等。 */
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## Header（头部区）

仓库名、日期，以及一个紧凑的图例：实线框 = module，虚线 = seam，红色箭头 = leakage，厚深色框 = deep module。没有引言段落——直接进入候选项。

## 候选项卡片

图表承担分量。文字稀疏、平实，使用（来自 `/codebase-design` skill 的）词汇表术语，不绕弯子。

每个候选项是一个 `<article>`：

- **标题**——简短，命名这次深化（例如"折叠 Order intake 流水线"）。
- **徽章行**——推荐强度（`Strong` = emerald，`Worth exploring` = amber，`Speculative` = slate），外加一个依赖类别标签（`in-process`、`local-substitutable`、`ports & adapters`、`mock`）。
- **文件**——等宽列表，`font-mono text-sm`。
- **Before / After 图**——中心内容。两列并排。参见下面的模式。
- **问题**——一句话。哪里疼。
- **解决方案**——一句话。什么会改变。
- **收益**——要点，每条 <=6 个词。例如"测试只打一个 interface"、"Pricing 逻辑不再泄漏"、"删除 4 个浅 wrapper"。
- **ADR 标注**（如果适用）——amber 色调盒子里的单行。

没有解释性段落。如果图表需要一段话才能被理解，就重画图表。

## 图表模式

选择适合候选项的模式。混用它们。不要让每个图表看起来都一样——多样性本来就是重点的一部分。

### Mermaid graph（依赖 / 调用流的主力）

当重点是"X 调用 Y 调用 Z，看这团乱"时，使用 Mermaid `flowchart` 或 `graph`。把它包在一个 Tailwind 样式的卡片里，这样它不会感觉是空降的。用 classDef 样式把泄漏的边染成红色、deep module 染成深色。序列图很适合"before：6 次往返；after：1 次"。

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### 手工构建的 boxes-and-arrows（当 Mermaid 的布局跟你作对时）

Modules 用带边框和标签的 `<div>` 表示。箭头用内联 SVG `<line>` 或 `<path>` 元素，绝对定位在 relative 容器之上。当你想要"after"图感觉像一个带粗边框、内部灰掉的 deep module 时用它——Mermaid 无法以正确的权重渲染那种效果。

### Cross-section（适合分层浅度）

堆叠水平色带（`h-12 border-l-4`）来展示一次调用穿过的层。Before：6 个薄层，每个什么都不做。After：1 条厚色带，标注着整合后的职责。

### Mass diagram（适合"interface 与 implementation 一样宽"）

每个 module 两个矩形——一个表示 interface 的表面积，一个表示 implementation。Before：interface 矩形几乎和 implementation 矩形一样高（浅）。After：interface 矩形短，implementation 矩形高（深）。

### Call-graph 折叠

Before：一棵渲染成嵌套盒子的函数调用树。After：同一棵树折叠进一个盒子，现在内部的调用以淡化方式显示在里面。

## 样式指南

- 偏编辑风格，而不是企业 dashboard 风。充足留白。标题可选 serif（`font-serif` 与 stone/slate 搭配得很好）。
- 节制地用色：一个强调色（emerald 或 indigo），加上红色表示泄漏、amber 表示警告。
- 让图表保持约 320px 高，这样 before/after 能舒服地并排，无需滚动。
- 对图表内部的 module 标签使用 `text-xs uppercase tracking-wider`——它们应该读起来像示意图，而不是 UI。
- 唯一的脚本是 Tailwind CDN 和 Mermaid ESM import。报告其余部分都是静态的——没有 app 代码，除了 Mermaid 自身的渲染之外没有任何交互。

## Top recommendation 部分

一张更大的卡片。候选项名称、一句话说明为什么、指向它卡片的锚点链接。就这些。

## 语气

平实的英文、简洁——但架构名词和动词直接来自 `/codebase-design` skill。简洁不是漂移的借口。

**精确使用：** module、interface、implementation、depth、deep、shallow、seam、adapter、leverage、locality。

**绝不用替代：** component、service、unit（替代 module）；API、signature（替代 interface）；boundary（替代 seam）；layer、wrapper（在你指 module 时替代 module）。

**符合风格的措辞：**

- "Order intake module 是浅的——interface 几乎和 implementation 匹配。"
- "Pricing 跨 seam 泄漏。"
- "深化：一个 interface，一个测试的地方。"
- "两个 adapter 为 seam 提供合理性：prod 用 HTTP，测试用 in-memory。"

**收益要点**用词汇表术语命名收益：*"locality：bug 集中在同一个 module"*、*"leverage：一个 interface，N 个调用点"*、*"interface 收缩；implementation 吸收 wrapper"*。不要写 *"easier to maintain"* 或 *"cleaner code"*——这些术语不在词汇表里，也不配拥有自己的位置。

不要含糊其辞，不要清嗓子，不要"it's worth noting that…"。如果一个句子可以是要点，就把它写成要点。如果一条要点可以被删掉，就删掉它。如果一个术语不在 `/codebase-design` 词汇表里，在发明新词之前，先找一个在词汇表里的。
