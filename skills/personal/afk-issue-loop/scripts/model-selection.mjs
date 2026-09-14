import { accessSync, constants, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { effortsFor } from './providers.mjs';

// Credential-blind Pi 0.85.1 declarative catalogue only. Never import runtime,
// provider composer, auth, extensions or the CLI. See ADR 0006.
const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
// 公共 effort 契约取三家 harness 交集 low/high/max，不承诺「任意档位自由组合」；
// 它只写在文档里，不在这里校验——不因此拒绝各家更多的档位，校验仍以该 harness
// （Pi 到具体模型）的实际支持面为准。
export const ROLES = ['implementer', 'reviewer', 'merger'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const tokenLuna = id => /(^|[._/-])luna($|[._/-])/i.test(id);
const PROVIDERS = ['claude', 'codex', 'pi'];
class SelectionError extends Error {}
const fail = message => { throw new SelectionError(message); };
const json = path => JSON.parse(readFileSync(path, 'utf8'));
function optional(path, read) {
  try { lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  return read(path);
}
function packageAt(path, name) {
  const pkg = optional(join(path, 'package.json'), json);
  return pkg?.name === name ? { path: realpathSync(path), pkg } : undefined;
}
function installation() {
  let executable;
  for (const directory of (process.env.PATH || '').split(':')) {
    const candidate = resolve(directory || '.', 'pi');
    try { accessSync(candidate, constants.X_OK); executable = realpathSync(candidate); break; }
    catch (error) { if (!['ENOENT', 'EACCES', 'ENOTDIR'].includes(error.code)) throw error; }
  }
  if (!executable) fail('无法定位本机 Pi 安装');
  // pnpm's published shim contains a literal target comment; never evaluate shell.
  const shim = readFileSync(executable, 'utf8');
  const target = shim.match(/^# cmd-shim-target=(.+)$/m)?.[1];
  if (target) {
    if (!isAbsolute(target)) fail('无法识别 Pi shim');
    executable = realpathSync(target);
  }
  let agent;
  for (let dir = dirname(executable); ; dir = dirname(dir)) {
    agent = packageAt(dir, '@earendil-works/pi-coding-agent');
    if (agent || dirname(dir) === dir) break;
  }
  if (!agent || agent.pkg.version !== '0.85.1' || agent.pkg.piConfig?.configDir !== '.pi') fail('未知 Pi 版本或安装布局（仅核实 0.85.1）');
  let ai;
  for (let dir = agent.path; ; dir = dirname(dir)) {
    ai = packageAt(join(dir, 'node_modules/@earendil-works/pi-ai'), '@earendil-works/pi-ai');
    if (ai || dirname(dir) === dir) break;
  }
  if (!ai || ai.pkg.version !== '0.85.1') fail('无法枚举已核实版本的内置模型目录');
  return { agent: agent.path, ai: ai.path };
}
const load = path => import(pathToFileURL(path).href);
// 返回是否存在不能证明声明式目录完整的动态来源，而不是直接失败：
// 自动选择必须 fail-closed，显式选择仍可用但结论降级为「未验证」（ADR 0006/0008）。
function dynamicSources(repo, agentDir, stripJsonComments) {
  // Conservative even for currently untrusted/disabled sources: do not execute
  // code to decide whether it might register a provider. Ancestors are guarded too.
  const dirs = new Set([agentDir]);
  for (let dir = repo; ; dir = dirname(dir)) {
    dirs.add(join(dir, '.pi'));
    if (dirname(dir) === dir) break;
  }
  const found = [];
  for (const dir of dirs) {
    const text = optional(join(dir, 'settings.json'), path => readFileSync(path, 'utf8'));
    const settings = text === undefined ? {} : JSON.parse(stripJsonComments(text.replace(/^﻿/, '')));
    if (!object(settings)) fail('settings 配置非法');
    for (const key of ['extensions', 'packages']) {
      if (settings[key] !== undefined && !Array.isArray(settings[key])) fail('settings 配置非法');
      if (settings[key]?.length) found.push(`${dir}/settings.json 的 ${key}`);
    }
    const entries = optional(join(dir, 'extensions'), path => readdirSync(path));
    if (entries?.length) found.push(`${dir}/extensions`);
  }
  return found;
}
function project(model) {
  if (!object(model) || typeof model.id !== 'string' || !model.id || typeof model.provider !== 'string' || !model.provider) fail('模型元数据非法');
  return { provider: model.provider, id: model.id, reasoning: model.reasoning, thinkingLevelMap: model.thinkingLevelMap ? { ...model.thinkingLevelMap } : undefined };
}
async function catalogue(repo) {
  const { agent, ai } = installation();
  const { stripJsonComments } = await load(join(agent, 'dist/utils/json.js'));
  const override = process.env.PI_CODING_AGENT_DIR;
  const expanded = override?.replace(/^~(?=\/|$)/, homedir());
  const agentDir = expanded?.startsWith('file://') ? fileURLToPath(expanded) : (expanded || join(homedir(), '.pi/agent'));
  if (!isAbsolute(agentDir)) fail('PI_CODING_AGENT_DIR 必须是绝对路径，避免角色 worktree 改变配置来源');
  const dynamic = dynamicSources(repo, agentDir, stripJsonComments);
  const { MODELS } = await load(join(ai, 'dist/models.generated.js'));
  const { ModelConfig } = await load(join(agent, 'dist/core/model-config.js'));
  // Reject inaccessible files and dangling links rather than accepting Pi's
  // ENOENT fallback. ModelConfig validates JSONC/schema without resolving secrets.
  optional(join(agentDir, 'models.json'), path => { statSync(path); return true; });
  const config = await ModelConfig.load(join(agentDir, 'models.json'));
  if (config.getError()) fail('模型配置读取或校验失败');
  if (!object(MODELS)) fail('内置模型目录非法');
  const result = [];
  for (const provider of new Set([...Object.keys(MODELS), ...config.getProviderIds()])) {
    const base = Object.values(MODELS[provider] || {});
    const models = new Map(base.map(model => [model.id, project(model)]));
    const custom = config.getProvider(provider);
    if (custom) {
      if (custom.oauth && !custom.baseUrl) fail('模型配置缺少 baseUrl');
      if (!custom.models?.length && !custom.baseUrl && !custom.headers && !custom.compat && !Object.keys(custom.modelOverrides || {}).length && !custom.apiKey && !custom.oauth && custom.authHeader === undefined) fail('模型 provider 配置为空');
      // provider-composer.js: models replace same-id definitions (not merge).
      // API/URL are checked internally only; never returned or resolved.
      const defaults = [...base];
      for (const definition of custom.models || []) {
        const api = definition.api ?? custom.api;
        const fallback = defaults.find(m => m.id === definition.id) ?? (api ? defaults.find(m => m.api === api) : undefined) ?? defaults.find(m => m.api === 'openai-completions') ?? defaults[0];
        if (!(api ?? fallback?.api) || !(definition.baseUrl ?? custom.baseUrl ?? fallback?.baseUrl)) fail('自定义模型配置缺少 API/baseUrl');
        if (definition.contextWindow <= 0 || definition.maxTokens <= 0) fail('模型配置容量非法');
        const composed = { ...definition, provider, api: api ?? fallback?.api, baseUrl: definition.baseUrl ?? custom.baseUrl ?? fallback?.baseUrl, reasoning: definition.reasoning ?? false };
        models.set(definition.id, project(composed));
        const index = defaults.findIndex(m => m.id === definition.id);
        if (index < 0) defaults.push(composed); else defaults[index] = composed;
      }
      // Pi applies modelOverrides after custom definitions; maps merge by level.
      for (const [id, patch] of Object.entries(custom.modelOverrides || {})) {
        const model = models.get(id);
        if (model) models.set(id, { ...model, reasoning: patch.reasoning ?? model.reasoning, thinkingLevelMap: patch.thinkingLevelMap ? { ...model.thinkingLevelMap, ...patch.thinkingLevelMap } : model.thinkingLevelMap });
      }
    }
    result.push(...models.values());
  }
  return { models: result, dynamic };
}

// 声明式注册元数据层面的 effort 能力校验。luna 自动路径与显式 Pi 模型共用同一
// seam；Pi 遇到模型不支持的档位会静默降级、不报错不告警，因此这是「不静默
// 降级」的主要技术手段（ADR 0008）。结论只到声明式元数据，不证明认证与远端行为。
function assertEffortSupported(model, effort, label) {
  if (!levels.includes(effort)) fail(`Pi effort 无效：${String(effort)}`);
  if (typeof model.reasoning !== 'boolean') fail(`${label} 的 effort 能力未知`);
  const mapped = model.thinkingLevelMap?.[effort];
  if ((!model.reasoning && effort !== 'off') || mapped === null) fail(`${label} 的注册元数据不支持 effort ${effort}`);
  if (model.reasoning && ['max', 'xhigh'].includes(effort) && mapped === undefined) fail(`${label} 的 effort ${effort} 能力未知`);
}
function registered(models, id) {
  const matches = models.filter(model => `${model.provider}/${model.id}` === id);
  if (!matches.length) fail(`本机声明式注册目录中不存在模型 ${id}`);
  if (matches.length > 1) fail(`模型 ${id} 在声明式注册目录中存在歧义，无法确定 effort 能力面`);
  return matches[0];
}
const lunaHint = message => `${message}；可显式指定准确 --model API-provider/model --effort LEVEL（不代表自动验证）。`;
async function piAuto(repo, effort) {
  let catalogueResult;
  try { catalogueResult = await catalogue(repo); }
  catch (error) { fail(lunaHint(error.message)); }
  const { models, dynamic } = catalogueResult;
  if (dynamic.length) fail(lunaHint(`存在扩展或包动态来源（${dynamic.join('、')}），不能证明声明式目录完整`));
  const matches = models.filter(model => tokenLuna(model.id));
  if (!matches.length) fail(lunaHint('luna 声明式注册模型无匹配'));
  if (matches.length !== 1) fail(lunaHint('luna 声明式注册模型存在歧义，请明确完整模型'));
  const model = matches[0], level = effort ?? 'max';
  const label = `luna 模型 ${model.provider}/${model.id}`;
  assertEffortSupported(model, level, label);
  return { model: `${model.provider}/${model.id}`, effort: level, selectionSource: 'pi-declarative-intent', selectionIntent: 'luna', authenticationVerified: false, capabilityVerified: true };
}
async function piExplicit(repo, model, effort) {
  if (!/^[^\s/]+\/[^\s]+$/.test(model)) throw new Error(`Pi 显式 --model 需要准确 API-provider/model：${JSON.stringify(model)}；简称先消歧`);
  // 旧覆盖语义：仅显式 cliproxy/gpt-5.6-luna 省略 effort 补 max，其他模型不补。
  const level = effort ?? (model === 'cliproxy/gpt-5.6-luna' ? 'max' : undefined);
  let catalogueResult;
  try { catalogueResult = await catalogue(repo); }
  catch (error) {
    // 安装/版本/配置不可读时不能退化为失败：显式选择本就跳过自动验证（ADR 0006）。
    return { model, effort: level ?? null, selectionSource: 'explicit-unverified', authenticationVerified: false, capabilityVerified: false, capabilityNote: `无法读取声明式注册目录，未做能力校验：${error.message}` };
  }
  const { models, dynamic } = catalogueResult;
  let target;
  try { target = registered(models, model); }
  catch (error) {
    // 目录完整时拼写错误必须启动即失败，不拖到角色启动才暴露。
    // 存在动态来源时无法证明该模型不是由扩展注册的，此时保留 ADR 0006 的
    // 「显式完整选择仍可走未验证路径」，但必须显式告警而不静默通过。
    if (!dynamic.length) throw error;
    return { model, effort: level ?? null, selectionSource: 'explicit-unverified', authenticationVerified: false, capabilityVerified: false, capabilityNote: `存在动态来源（${dynamic.join('、')}），无法证明 ${model} 已在声明式注册目录中；未做能力校验` };
  }
  if (level !== undefined) assertEffortSupported(target, level, `模型 ${model}`);
  return {
    model, effort: level ?? null, selectionSource: 'explicit-unverified', authenticationVerified: false,
    capabilityVerified: dynamic.length === 0,
    ...(dynamic.length ? { capabilityNote: `存在动态来源（${dynamic.join('、')}），能力结论按声明式元数据给出，可能被扩展覆盖` } : {}),
  };
}

export async function resolveSelection(values, repo) {
  const checkProvider = provider => {
    if (!PROVIDERS.includes(provider)) throw new Error(`provider 必须为 claude、codex 或 pi：${String(provider)}`);
    return provider;
  };
  // 解析一份显式传入的配置。Claude/Codex 的来源沿用升级前的 single-selection
  // 词汇，使只写顶层 flag（或什么都不写）的既有读取方与断言不失效。
  const resolveOne = async values_ => {
    const provider = checkProvider(values_.provider ?? 'claude');
    const model = values_.model, effort = values_.effort;
    if (provider !== 'pi') {
      if (model !== undefined && (typeof model !== 'string' || !model.trim() || model.startsWith('-'))) throw new Error(`model 必须是非空 CLI 模型 ID 或别名：${JSON.stringify(model)}`);
      const allowed = effortsFor(provider);
      if (effort !== undefined && !allowed.includes(effort)) throw new Error(`不支持的 ${provider} effort：${JSON.stringify(effort)}；${provider} 合法值：${allowed.join('/')}`);
      return { provider, model: model ?? null, effort: effort ?? null, selectionSource: 'cli-config-or-explicit' };
    }
    if (model !== undefined) return { provider, ...await piExplicit(repo, model, effort) };
    try { return { provider, ...await piAuto(repo, effort) }; }
    catch (error) {
      if (error instanceof SelectionError) throw error;
      fail(lunaHint('配置/目录读取或元数据解析失败（底层信息已隐藏）'));
    }
  };
  // 顶层 flag 定义 Run 默认；Role 前缀 flag 逐字段覆盖，未写字段继承顶层。
  // 不做「缺省 Role 跟随已指定 Role」的推断——避免只指定 Implementer 时
  // Reviewer 被悄悄拉到同源模型（Reviewer 独立性，ADR 0008）。
  const roleValues = role => Object.fromEntries(['provider', 'model', 'effort'].map(field => [field, values[`${role}-${field}`] ?? values[field]]));
  const roleExplicit = role => ['provider', 'model', 'effort'].some(field => values[`${role}-${field}`] !== undefined);
  // 顶层 default 是 Run 默认值本身（不是继承来的），因此保留升级前的来源语义，
  // 使既有单份读取方与断言不失效。
  const defaultEntry = await resolveOne({ provider: values.provider, model: values.model, effort: values.effort });
  const roles = {};
  for (const role of ROLES) {
    // 未写任何 Role 前缀的 Role 完整继承顶层默认（含 Pi 解析出的准确模型与
    // luna 意图）。来源只在顶层确实是「用户显式给的本机配置默认」时才标注为
    // 继承；顶层本身由 Pi 意图解析得出时保留该来源，否则继承者会比顶层看起来
    // 更弱，且无法分辨 Pi 意图来自顶层还是继承。
    const inherited = defaultEntry.selectionSource === 'cli-config-or-explicit'
      ? { ...defaultEntry, selectionSource: 'role-inherited-default' }
      : { ...defaultEntry };
    roles[role] = roleExplicit(role) ? await resolveOne(roleValues(role)) : inherited;
  }
  // 顶层三个字段继续扁平暴露（既有单份读取方如 config.provider、result.json
  // 的展开都依赖它），同时给出 `default` 键作为同一份值的规范名字。
  return { ...defaultEntry, default: { ...defaultEntry }, roles };
}
