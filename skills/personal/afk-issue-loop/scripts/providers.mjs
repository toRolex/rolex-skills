// Extracted from mattpocock/sandcastle e99f832f26dc9d245c019a9ddd19fa5dee792427.
// MIT, Copyright (c) 2026 Matt Pocock; keep LICENSE.sandcastle.
// AgentProvider.ts:41-121,546-611,681-747: parser bodies with TS removed.
// Session storage, UI and other providers are outside this dependency closure.
import { isAbsolute } from "node:path";

const shellEscape = (s)=>"'" + s.replace(/'/g, "'\\''") + "'";
const TOOL_ARG_FIELDS = {
    Bash: "command",
    WebSearch: "query",
    WebFetch: "url",
    Agent: "description"
};
const extractErrorMessage = (obj)=>{
    const err = obj.error;
    if (typeof err === "string") return err;
    if (typeof err === "object" && err !== null) {
        if (typeof err.message === "string") return err.message;
        if (typeof err.data?.message === "string") return err.data.message;
    }
    if (typeof obj.message === "string") return obj.message;
    return undefined;
};
const parseStreamJsonLine = (line)=>{
    if (!line.startsWith("{")) return [];
    try {
        const obj = JSON.parse(line);
        if (obj.type === "assistant" && Array.isArray(obj.message?.content)) {
            const events = [];
            const texts = [];
            for (const block of obj.message.content){
                if (block.type === "text" && typeof block.text === "string") {
                    texts.push(block.text);
                } else if (block.type === "tool_use" && typeof block.name === "string" && block.input !== undefined) {
                    const argField = TOOL_ARG_FIELDS[block.name];
                    if (argField === undefined) continue;
                    const argValue = block.input[argField];
                    if (typeof argValue !== "string") continue;
                    if (texts.length > 0) {
                        events.push({
                            type: "text",
                            text: texts.join("")
                        });
                        texts.length = 0;
                    }
                    events.push({
                        type: "tool_call",
                        name: block.name,
                        args: argValue
                    });
                }
            }
            if (texts.length > 0) {
                events.push({
                    type: "text",
                    text: texts.join("")
                });
            }
            return events;
        }
        if (obj.type === "result" && typeof obj.result === "string") {
            return [
                {
                    type: "result",
                    result: obj.result
                }
            ];
        }
        if (obj.type === "system" && obj.subtype === "init" && typeof obj.session_id === "string") {
            return [
                {
                    type: "session_id",
                    sessionId: obj.session_id
                }
            ];
        }
    } catch  {}
    return [];
};
const parsePiStreamLine = (line)=>{
    if (!line.startsWith("{")) return [];
    try {
        const obj = JSON.parse(line);
        if (obj.type === "session" && typeof obj.id === "string") {
            return [
                {
                    type: "session_id",
                    sessionId: obj.id
                }
            ];
        }
        if (obj.type === "message_update" && obj.assistantMessageEvent) {
            const evt = obj.assistantMessageEvent;
            if (evt.type === "text_delta" && typeof evt.delta === "string") {
                return [
                    {
                        type: "text",
                        text: evt.delta
                    }
                ];
            }
            return [];
        }
        if (obj.type === "tool_execution_start") {
            const toolName = obj.toolName;
            if (typeof toolName !== "string") return [];
            const argField = TOOL_ARG_FIELDS[toolName];
            if (argField === undefined) return [];
            const args = obj.args;
            if (!args) return [];
            const argValue = args[argField];
            if (typeof argValue !== "string") return [];
            return [
                {
                    type: "tool_call",
                    name: toolName,
                    args: argValue
                }
            ];
        }
        if (obj.type === "agent_error" || obj.type === "error") {
            const msg = extractErrorMessage(obj);
            return msg ? [
                {
                    type: "result",
                    result: msg
                }
            ] : [];
        }
        if (obj.type === "agent_end" && Array.isArray(obj.messages)) {
            const messages = obj.messages;
            for(let i = messages.length - 1; i >= 0; i--){
                const msg = messages[i];
                if (msg?.role === "assistant") {
                    const texts = [];
                    for (const block of msg.content){
                        if (block.type === "text" && typeof block.text === "string") {
                            texts.push(block.text);
                        }
                    }
                    if (texts.length > 0) {
                        return [
                            {
                                type: "result",
                                result: texts.join("")
                            }
                        ];
                    }
                    break;
                }
            }
            return [];
        }
    } catch  {}
    return [];
};
const parseCodexUsage = (usage)=>{
    if (typeof usage !== "object" || usage === null) return undefined;
    const u = usage;
    if (typeof u.input_tokens !== "number" || typeof u.cached_input_tokens !== "number" || typeof u.output_tokens !== "number") {
        return undefined;
    }
    return {
        inputTokens: u.input_tokens - u.cached_input_tokens,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: u.cached_input_tokens,
        outputTokens: u.output_tokens
    };
};
const parseCodexStreamLine = (line)=>{
    if (!line.startsWith("{")) return [];
    try {
        const obj = JSON.parse(line);
        if (obj.type === "thread.started" && typeof obj.thread_id === "string") {
            return [
                {
                    type: "session_id",
                    sessionId: obj.thread_id
                }
            ];
        }
        if (obj.type === "item.completed" && obj.item?.type === "agent_message" && typeof obj.item.text === "string") {
            const text = obj.item.text;
            return [
                {
                    type: "text",
                    text
                },
                {
                    type: "result",
                    result: text
                }
            ];
        }
        if (obj.type === "item.started" && obj.item?.type === "command_execution" && typeof obj.item.command === "string") {
            return [
                {
                    type: "tool_call",
                    name: "Bash",
                    args: obj.item.command
                }
            ];
        }
        if (obj.type === "error") {
            const msg = extractErrorMessage(obj);
            return msg ? [
                {
                    type: "result",
                    result: msg
                }
            ] : [];
        }
        if (obj.type === "turn.completed") {
            const usage = parseCodexUsage(obj.usage);
            return usage ? [
                {
                    type: "usage",
                    usage
                }
            ] : [];
        }
    } catch  {}
    return [];
};

// AgentProvider.ts:637-665,782-825,1190-1236: three provider methods.
// D2/D9: session/UI and permission wiring removed; omitted model stays local.
// stdin/flag construction remains upstream; Claude duplicate -p - omitted.
const pi = (model, options) => ({
  name: "pi",
  buildPrintCommand({
    prompt,
  }) {
    const modelFlag = model === undefined ? "" : ` --model ${shellEscape(model)}`;
    const thinkingFlag = options?.thinking
      ? ` --thinking ${options.thinking}`
      : "";

    return {
      command: `pi -p --mode json${modelFlag}${thinkingFlag}`,
      stdin: prompt,
    };
  },
  parseStreamLine(line) {
    return parsePiStreamLine(line);
  },
});
const codex = (model, options) => ({
  name: "codex",
  buildPrintCommand({
    prompt,
  }) {
    const modelFlag = model === undefined ? "" : ` -m ${shellEscape(model)}`;
    const effortFlag = options?.effort
      ? ` -c ${shellEscape(`model_reasoning_effort="${options.effort}"`)}`
      : "";

    const base = "codex exec";
    return {
      command: `${base} --json${modelFlag}${effortFlag}`,
      stdin: prompt,
    };
  },
  parseStreamLine(line) {
    return parseCodexStreamLine(line);
  },
});
const claudeCode = (model, options) => ({
  name: "claude-code",
  buildPrintCommand({
    prompt,
  }) {
    const modelFlag = model === undefined ? "" : ` --model ${shellEscape(model)}`;

    const effortFlag = options?.effort ? ` --effort ${options.effort}` : "";

    return {
      command: `claude --print --verbose --output-format stream-json${modelFlag}${effortFlag}`,
      stdin: prompt,
    };
  },
  parseStreamLine(line) {
    return parseStreamJsonLine(line);
  },
});

const EFFORTS = {
  claude: ['low', 'medium', 'high', 'xhigh', 'max'],
  codex: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
  pi: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
};
function checkProvider(provider) {
  if (!Object.hasOwn(EFFORTS, provider)) throw new Error(`不支持的 provider：${String(provider)}`);
}
export function buildInvocation({ provider, model, effort, prompt, cwd }) {
  checkProvider(provider);
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('prompt 必须是非空字符串');
  if (typeof cwd !== 'string' || !isAbsolute(cwd) || cwd.includes('\0')) throw new Error('cwd 必须是绝对路径');
  if (model !== undefined && (typeof model !== 'string' || !model.trim() || model.startsWith('-') || /[\0\r\n]/.test(model))) throw new Error('model 必须是非空 CLI 模型 ID 或别名');
  if (effort !== undefined && !EFFORTS[provider].includes(effort)) throw new Error(`不支持的 ${provider} effort：${String(effort)}`);
  const factory = provider === 'claude' ? claudeCode : provider === 'codex' ? codex : pi;
  const printCmd = factory(model, { effort, thinking: effort }).buildPrintCommand({ prompt });
  // no-sandbox's sh -c boundary; exec avoids a gratuitous shell parent.
  return { command: 'sh', args: ['-c', `exec ${printCmd.command}`], input: printCmd.stdin };
}

// D4 additions are provenance-aware lifecycle metadata, not business validation.
// Ordinary tool failures (including test EPERM) do not imply denied approval.
const approvalRefusal = text => /rejected by user approval settings|writing is blocked by read-only sandbox|user (?:denied|rejected) (?:the )?(?:tool|permission|approval)|permission request (?:denied|rejected)/i.test(text);
export const explicitRefusal = text => /^(?:error:\s*)?(?:permission denied|access denied|approval (?:denied|rejected|required))\s*[.!]?$/im.test(text) || approvalRefusal(text);
const authorizationError = text => /permission[_ -]denied|access[_ -]denied|approval.{0,40}(?:required|denied|reject)|not logged in|authentication (?:failed|required)|auth_unavailable|no auth available|invalid api key|missing api key|no api key|unauthorized/i.test(text);

export function parseLine(provider, line) {
  checkProvider(provider);
  const parser = provider === 'claude' ? parseStreamJsonLine : provider === 'codex' ? parseCodexStreamLine : parsePiStreamLine;
  let events = parser(line);
  let obj;
  try { obj = JSON.parse(line); } catch {
    return { events, texts: [], ...(explicitRefusal(line) ? { permissionDenied: true, error: line } : {}) };
  }
  if (!obj || typeof obj !== 'object') return { events, texts: [] };
  if (provider === 'claude' && obj.parent_tool_use_id) return { events: [], texts: [] };
  let error, terminal = false, cancelled = false;
  let replyText;
  const replyStart = provider === 'pi' && obj.type === 'message_start' && obj.message?.role === 'assistant';
  const textContent = content => Array.isArray(content)
    ? content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('') : '';
  if (provider === 'claude' && obj.type === 'assistant') replyText = textContent(obj.message?.content);
  if (provider === 'pi' && obj.type === 'message_end' && obj.message?.role === 'assistant') replyText = textContent(obj.message.content);
  let permissionDenied = obj.type === 'permission_denied' || (obj.type === 'system' && obj.subtype === 'permission_denied');
  if (provider === 'claude' && obj.type === 'result') {
    // Even an empty/missing final is authoritative; never reuse an old passed.
    events = [{ type: 'result', result: typeof obj.result === 'string' ? obj.result : '' }];
    permissionDenied ||= Array.isArray(obj.permission_denials) && obj.permission_denials.length > 0;
    if (obj.is_error === true || (typeof obj.subtype === 'string' && obj.subtype.startsWith('error'))) {
      terminal = true;
      error = (Array.isArray(obj.errors) ? obj.errors.join('\n') : '') || extractErrorMessage(obj) || obj.result || 'Claude 终态错误';
    }
  }
  if (obj.type === 'error' || obj.type === 'agent_error' || obj.type === 'turn.failed' ||
      (provider === 'claude' && obj.type === 'assistant' && obj.error)) {
    error = extractErrorMessage(obj) || `${provider} ${obj.type}`;
    terminal = obj.type === 'turn.failed' || obj.type === 'agent_error';
    // Upstream exposes errors as result for diagnostics. Keep them separate
    // here so a later successful final can recover without historical fallback.
    events = events.filter(e => e.type !== 'result');
  }
  if (provider === 'codex' && obj.type === 'item.completed' && obj.item?.type === 'error') {
    error = extractErrorMessage(obj.item) || 'Codex item 错误';
  }
  if (provider === 'pi') {
    const msg = obj.type === 'message_end' ? obj.message : obj.type === 'agent_end' && Array.isArray(obj.messages)
      ? obj.messages.findLast(m => m?.role === 'assistant') : undefined;
    if (obj.type === 'agent_end') {
      events = events.filter(e => e.type !== 'result');
      const text = Array.isArray(msg?.content) ? msg.content.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text).join('') : '';
      events.push({ type: 'result', result: text });
    }
    if (msg?.role === 'assistant' && ['error', 'aborted'].includes(msg.stopReason)) {
      // A message_end can precede a recovered/retried message; agent_end is
      // the authoritative turn boundary. An unrecovered pending error fails.
      terminal = obj.type === 'agent_end';
      cancelled = msg.stopReason === 'aborted';
      error = msg.errorMessage || `Pi assistant ${msg.stopReason}`;
    }
    if (obj.type === 'message_update' && obj.assistantMessageEvent?.type === 'error') {
      error = extractErrorMessage(obj.assistantMessageEvent) || obj.assistantMessageEvent.error?.errorMessage || 'Pi assistant 错误';
    }
  }
  // Tool failures are ordinarily recoverable. Only explicit approval/sandbox
  // refusal language in an actual failed tool event is sticky, never EPERM or
  // generic permission text in test output.
  let toolDiagnostic;
  if (provider === 'claude' && obj.type === 'user' && Array.isArray(obj.message?.content)) {
    toolDiagnostic = obj.message.content.filter(block => block?.type === 'tool_result' && block.is_error === true)
      .map(block => typeof block.content === 'string' ? block.content : textContent(block.content)).join('\n');
  } else if (provider === 'codex' && obj.type === 'item.completed' && obj.item?.type === 'command_execution' &&
      (obj.item.status === 'failed' || (Number.isInteger(obj.item.exit_code) && obj.item.exit_code !== 0))) {
    toolDiagnostic = obj.item.aggregated_output;
  } else if (provider === 'pi' && obj.type === 'tool_execution_end' && obj.isError === true) {
    toolDiagnostic = textContent(obj.result?.content);
  }
  if (typeof toolDiagnostic === 'string' && approvalRefusal(toolDiagnostic)) {
    permissionDenied = true;
    error = toolDiagnostic;
  }
  if (permissionDenied) error ||= `${provider} 明确权限拒绝`;
  if (error && authorizationError(error)) permissionDenied = true;
  return { events, texts: events.filter(e => e.type === 'text').map(e => e.text), replyText, replyStart, error, terminal, cancelled, permissionDenied };
}
