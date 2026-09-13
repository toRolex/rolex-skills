import { accessSync, constants, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Credential-blind Pi 0.85.1 declarative catalogue only. Never import runtime,
// provider composer, auth, extensions or the CLI. See ADR 0006.
const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const tokenLuna = id => /(^|[._/-])luna($|[._/-])/i.test(id);
const fail = message => { throw new SelectionError(`Pi 自动选择失败：${message}；可显式指定准确 --model API-provider/model --effort LEVEL（不代表自动验证）。`); };
class SelectionError extends Error {}
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
function assertDeclarative(repo, agentDir, stripJsonComments) {
  // Conservative even for currently untrusted/disabled sources: do not execute
  // code to decide whether it might register a provider. Ancestors are guarded too.
  const dirs = new Set([agentDir]);
  for (let dir = repo; ; dir = dirname(dir)) {
    dirs.add(join(dir, '.pi'));
    if (dirname(dir) === dir) break;
  }
  for (const dir of dirs) {
    const text = optional(join(dir, 'settings.json'), path => readFileSync(path, 'utf8'));
    const settings = text === undefined ? {} : JSON.parse(stripJsonComments(text.replace(/^﻿/, '')));
    if (!object(settings)) fail('settings 配置非法');
    for (const key of ['extensions', 'packages']) {
      if (settings[key] !== undefined && !Array.isArray(settings[key])) fail('settings 配置非法');
      if (settings[key]?.length) fail('存在扩展或包动态来源，不能证明声明式目录完整');
    }
    const entries = optional(join(dir, 'extensions'), path => readdirSync(path));
    if (entries?.length) fail('存在自动发现扩展动态来源，不能证明声明式目录完整');
  }
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
  assertDeclarative(repo, agentDir, stripJsonComments);
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
  return result;
}
export async function resolveSelection(values, repo) {
  const provider = values.provider || 'claude';
  if (!['claude', 'codex', 'pi'].includes(provider)) throw new Error('provider 必须为 claude、codex 或 pi');
  if (provider !== 'pi') return { provider, model: values.model ?? null, effort: values.effort ?? null, selectionSource: 'cli-config-or-explicit' };
  if (values.model !== undefined) {
    if (!/^[^\s/]+\/[^\s]+$/.test(values.model)) throw new Error('Pi 显式 --model 需要准确 API-provider/model；简称先消歧');
    // Preserve the previously documented explicit legacy-model effort default.
    return { provider, model: values.model, effort: values.effort ?? (values.model === 'cliproxy/gpt-5.6-luna' ? 'max' : null), selectionSource: 'explicit-unverified' };
  }
  try {
    const models = await catalogue(repo);
    const matches = models.filter(model => tokenLuna(model.id));
    if (!matches.length) fail('luna 声明式注册模型无匹配');
    if (matches.length !== 1) fail('luna 声明式注册模型存在歧义，请明确完整模型');
    const model = matches[0], effort = values.effort ?? 'max';
    if (!levels.includes(effort)) fail('effort 无效');
    if (typeof model.reasoning !== 'boolean') fail('effort 能力未知');
    const mapped = model.thinkingLevelMap?.[effort];
    if ((!model.reasoning && effort !== 'off') || mapped === null) fail('注册元数据不支持所选 effort');
    if (model.reasoning && ['max', 'xhigh'].includes(effort) && mapped === undefined) fail('effort 能力未知');
    return { provider, model: `${model.provider}/${model.id}`, effort, selectionSource: 'pi-declarative-intent', selectionIntent: 'luna', authenticationVerified: false };
  } catch (error) {
    if (error instanceof SelectionError) throw error;
    fail('配置/目录读取或元数据解析失败（底层信息已隐藏）');
  }
}
