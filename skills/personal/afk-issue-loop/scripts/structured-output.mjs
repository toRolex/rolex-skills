// 提取自 https://github.com/mattpocock/sandcastle
// e99f832f26dc9d245c019a9ddd19fa5dee792427 的 src/extractStructuredOutput.ts:119-161。
// 保留最后完整标签及可选 Markdown fence 语义；仅去除 TypeScript 类型。
// MIT，Copyright (c) 2026 Matt Pocock；完整许可见同目录 LICENSE.sandcastle，分发时一并保留。
// 仓库维护研究（运行及许可不依赖）：../../../../docs/research/afk-local-cli-source-provenance.md。
export const findLastTagContent = (text, tag) => {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  let lastContent;
  let searchFrom = 0;
  while (true) {
    const openIdx = text.indexOf(openTag, searchFrom);
    if (openIdx === -1) break;
    const contentStart = openIdx + openTag.length;
    const closeIdx = text.indexOf(closeTag, contentStart);
    if (closeIdx === -1) break;
    lastContent = text.slice(contentStart, closeIdx);
    searchFrom = closeIdx + closeTag.length;
  }
  return lastContent;
};

export const unwrapFences = text => {
  const fenceMatch = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return text;
};
