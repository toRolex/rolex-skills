// 源自 mattpocock/sandcastle e99f832f26dc9d245c019a9ddd19fa5dee792427。
// PromptResolver.ts:23-61、PromptArgumentSubstitution.ts:87-157、PromptPreprocessor.ts:23-102。
// MIT，Copyright (c) 2026 Matt Pocock；许可见 LICENSE.sandcastle。
// 去除类型、Effect/Display/Sandbox 接线；保留单次替换、来源标记、并行展开及逆序回填。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SHELL_BLOCK_MARKER = '\x01';
const SHELL_BLOCK_PATTERN = /!`([^`]+)`/g;
const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
const MARKED_SHELL_BLOCK_PATTERN = /!\x01`(\d+)`/g;
const PROMPT_EXPANSION_TIMEOUT_MS = 30_000;

function resolvePrompt({ prompt, promptFile }) {
  if (prompt !== undefined && promptFile !== undefined) throw new Error('Cannot provide both --prompt and --prompt-file');
  if (prompt !== undefined) return { text: prompt, source: 'inline' };
  if (promptFile === undefined) throw new Error('Must provide either prompt or promptFile');
  try {
    return { text: readFileSync(promptFile, 'utf8'), source: 'template' };
  } catch (error) {
    throw new Error(`Failed to read prompt from ${promptFile}: ${error.message}`, { cause: error });
  }
}

export function loadTemplates() {
  return Object.fromEntries(['implementer', 'reviewer', 'merger'].map(role => {
    const path = fileURLToPath(new URL(`../reference/${role}-prompt.md`, import.meta.url));
    const { text } = resolvePrompt({ promptFile: path });
    if (!text.trim()) throw new Error(`${role} prompt 模板为空：${path}`);
    return [role, text];
  }));
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function substitutePromptArgs(prompt, args) {
  const sanitizedArgs = Object.fromEntries(Object.entries(args).map(([key, value]) => [
    key, typeof value === 'string' ? value.replaceAll(SHELL_BLOCK_MARKER, '') : value,
  ]));
  const raw = prompt.replaceAll(SHELL_BLOCK_MARKER, '');
  const matches = [...raw.matchAll(PLACEHOLDER_PATTERN)];
  const referencedKeys = new Set(matches.map(match => match[1]));
  for (const key of referencedKeys) {
    if (!Object.hasOwn(sanitizedArgs, key)) throw new Error(`Prompt argument "{{${key}}}" has no matching value in promptArgs`);
    if (sanitizedArgs[key] == null) throw new Error(`Prompt argument "{{${key}}}" has value ${sanitizedArgs[key]} in promptArgs`);
    if (!['string', 'number', 'boolean'].includes(typeof sanitizedArgs[key])) throw new Error(`Prompt argument "{{${key}}}" must be a string, number or boolean`);
  }
  // 先固定可信命令的边界，再插参；参数内反引号不能改变预展开解析边界。
  const commands = [];
  const markedPrompt = raw.replace(SHELL_BLOCK_PATTERN, (_match, expression) => {
    const index = commands.length;
    commands.push(expression.replace(PLACEHOLDER_PATTERN, (_placeholder, key) => shellQuote(String(sanitizedArgs[key]))));
    return `!${SHELL_BLOCK_MARKER}\`${index}\``;
  });
  return {
    text: markedPrompt.replace(PLACEHOLDER_PATTERN, (_match, key) => String(sanitizedArgs[key])),
    commands,
  };
}

async function preprocessPrompt({ text: prompt, commands }, command, cwd) {
  const matches = [...prompt.matchAll(MARKED_SHELL_BLOCK_PATTERN)];
  if (matches.length === 0) return prompt.replaceAll(SHELL_BLOCK_MARKER, '');
  if (typeof command !== 'function') throw new Error('Prompt expansion requires a managed command executor');
  // command 必须在 timeoutMs 后终止并确认受管命令结束再 reject；不能只取消 Promise。
  // allSettled 等待其他并行预展开也退出，避免失败返回后仍有受管命令运行。
  const settled = await Promise.allSettled(matches.map(async match => {
    const expression = commands[Number(match[1])];
    try {
      const stdout = await command('sh', ['-c', expression], cwd, { timeoutMs: PROMPT_EXPANSION_TIMEOUT_MS });
      if (typeof stdout !== 'string') throw new Error('command must return stdout as a string');
      return stdout.trimEnd();
    } catch (error) {
      throw new Error(`Prompt shell expression \`${expression}\` failed: ${error.message}`, { cause: error });
    }
  }));
  const failure = settled.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  const results = settled.map(result => result.value);
  let result = prompt;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    result = result.slice(0, match.index) + results[i] + result.slice(match.index + match[0].length);
  }
  return result.replaceAll(SHELL_BLOCK_MARKER, '');
}

// args 为 engine 构造的扁平标量映射；上下文先 JSON.stringify，不能传对象隐式转换。
// 可信模板的 shell 占位符须不预加引号；这里统一进行 POSIX shell 单引号转义。
export async function renderPrompt(template, args, { cwd, command }) {
  if (typeof template !== 'string' || !template.trim()) throw new Error('Prompt template must be non-empty text');
  if (typeof cwd !== 'string' || !cwd) throw new Error('Prompt expansion requires cwd');
  return preprocessPrompt(substitutePromptArgs(template, args), command, cwd);
}
