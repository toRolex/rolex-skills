#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Processes } from './processes.mjs';
import { ObservationJournal } from './observations.mjs';
import { resolveSelection } from './model-selection.mjs';

const help = `AFK：独立本地 CLI 编排（Node >=22，macOS/Linux）
  node afk.mjs start --repo /absolute/repository [--issues 1,2] [--spec 7]
      [--target develop] [--provider claude|codex|pi] [--model MODEL]
      [--effort LEVEL] [--verify '项目验证命令'] [--priority-labels critical,high,low]
      [--reuse 1,2]
  node afk.mjs resolve-selection --repo /absolute/repository [--provider pi] [--model API-provider/model] [--effort LEVEL]
  node afk.mjs status --run /absolute/repository/.afk/logs/RUN
  node afk.mjs stop --run /absolute/repository/.afk/logs/RUN
  node afk.mjs dashboard --run /absolute/repository/.afk/logs/RUN

默认 provider=claude，不从宿主猜测；Claude/Codex 省略模型/effort 沿用 CLI 本机配置。
Pi 省略模型意图 luna + max；每次 start 重新查询 0.85.1 纯内置目录＋models.json。
luna 匹配 ID 内完整 token（首尾或 . _ / - 分隔，忽略大小写），唯一且 effort 能力明确才启动。
扩展/包动态来源、未知版本、读取/配置失败、无匹配/歧义或未知/不支持 effort 均失败，不换模型。
只验证声明式注册元数据，不读取 auth、不执行配置命令/扩展、不证明认证可用。
显式 Pi --model 必须完整 API-provider/model，跳过自动验证；--effort 优先。
其他显式 Pi 模型省略 effort 不补 max；仅显式旧 cliproxy/gpt-5.6-luna 保留省略补 max 的覆盖语义。
resolve-selection 是相同只读解析路径；start 再查最新目录并保存 selection.json，同 run 三角色固定。
其他 CLI 的 --model 接受准确 ID/CLI 别名；自然语言由 skill 启动者理解。
角色默认权限同 Sandcastle：Claude --dangerously-skip-permissions，
Codex exec --dangerously-bypass-approvals-and-sandbox；Pi 不加权限 flag。
仅作用于角色 CLI，不改本机权限配置、不删除保护环境变量、不绕过外层 sandbox。
默认 scope=首次完整分页的 open ready-for-agent，目标 develop 优先否则 main。
--spec 仅提供上下文，不实现或关闭。无 priority-labels 时全部同级按编号。
唯一标准 afk/issue-N 现场默认按当前 Git/worktree/writer 事实恢复；--reuse 仅保留显式归属兼容信息，不能绕过活跃写者、锁定或 quarantine。
恢复保留已有 commits 与 dirty 修改；已合入目标的分支跳过重复 merge，继续验证和关闭。
启动成功只表示运行已启动。恢复分类、阻碍和最终结果见 status/events.jsonl；不自动 push/PR。
支持进程退出后的 Git 现场恢复，不恢复旧进程内存或历史 PID。worktree 隔离代码，不隔离系统权限。`;

function save(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}

function numbers(value) {
  if (!value) return [];
  const parts = value.split(',');
  if (parts.some(part => !/^[1-9]\d*$/.test(part) || !Number.isSafeInteger(Number(part)))) throw new Error('编号必须为逗号分隔的正整数');
  return [...new Set(parts.map(Number))];
}

async function request(control, action) {
  return new Promise((resolveRequest, reject) => {
    const socket = createConnection(control.socket);
    let data = '';
    socket.setTimeout(10_000, () => socket.destroy(new Error('控制请求超时；不推断任务已结束')));
    socket.on('connect', () => socket.write(`${JSON.stringify({ action, token: control.token })}\n`));
    socket.on('data', chunk => { data += chunk; });
    socket.on('error', reject);
    socket.on('end', () => {
      try { resolveRequest(JSON.parse(data)); } catch (error) { reject(error); }
    });
  });
}

async function daemon(config) {
  process.umask(0o077);
  const observations = new ObservationJournal(config.logDir, config.run);
  const processes = new Processes();
  const control = { run: config.run, pid: process.pid, socket: join(tmpdir(), `afk-${config.run}.sock`), token: randomUUID() };
  let state = 'starting', result, engine, stopPromise, logFailure, livenessTimer, abandonmentCleanup;
  let missingRunSiteTicks = 0, runAbandoned = false;
  const diagnostic = error => {
    try { process.stderr.write(`AFK：${error.stack || error.message || error}\n`); }
    catch { /* 日志介质不可用时，仍继续受管停止。 */ }
  };
  const event = (type, data = {}) => {
    observations.observe(type.startsWith('recovery-') || type.startsWith('workspace') ? 'engine/recovery' : 'engine', type, {
      ...(Number.isSafeInteger(data.ticket) ? { ticket: data.ticket } : {}),
      ...(Array.isArray(data.tickets) ? { tickets: data.tickets } : {}),
      ...(Number.isSafeInteger(data.batch) ? { batch: data.batch } : {}),
      ...(data.role ? { role: data.role } : {}),
      ...(Number.isSafeInteger(data.attempt) ? { attempt: data.attempt } : {}),
    }, data);
    try { appendFileSync(join(config.logDir, 'events.jsonl'), `${JSON.stringify({ time: new Date().toISOString(), run: config.run, type, ...data })}\n`); }
    catch (error) {
      logFailure ||= error;
      stop({ log: false, failure: error });
      throw error;
    }
  };
  const bestEffortEvent = (type, data) => {
    try { event(type, data); } catch (error) { diagnostic(error); }
  };
  const announce = message => {
    if (!process.connected) return;
    process.send(message, error => {
      if (error) bestEffortEvent('launcher-disconnected', { error: error.message });
      if (process.connected) process.disconnect();
    });
  };
  function stop({ log = true, failure, reason = 'event-log-error' } = {}) {
    if (stopPromise) return stopPromise;
    state = 'stopping';
    // 停止先于记录；基础设施故障不冒充用户停止。
    stopPromise = failure ? processes.halt(failure, reason) : processes.stop();
    stopPromise.catch(diagnostic);
    if (log) bestEffortEvent('stop-requested');
    return stopPromise;
  }
  function runSiteMissing() {
    return !existsSync(config.logDir);
  }
  async function cleanUpAbandonedRun() {
    try {
      await stopPromise.catch(() => {});
      const released = await engine?.releaseAbandonedLocks();
      if (released) clearInterval(livenessTimer);
    } catch (error) {
      diagnostic(error);
    } finally {
      abandonmentCleanup = undefined;
    }
  }
  function checkRunSiteLiveness() {
    if (runAbandoned) {
      abandonmentCleanup ??= cleanUpAbandonedRun();
      return;
    }
    if (!runSiteMissing()) {
      missingRunSiteTicks = 0;
      return;
    }
    missingRunSiteTicks++;
    if (missingRunSiteTicks < 2) return;
    runAbandoned = true;
    const error = new Error(`运行现场已消失：${config.logDir}`);
    diagnostic(error);
    if (!stopPromise) void stop({ log: false, failure: error, reason: 'run-site-missing' });
    abandonmentCleanup = cleanUpAbandonedRun();
  }
  process.on('SIGTERM', () => { stop(); });
  process.on('SIGINT', () => { stop(); });
  // 发起终端关闭不是停止请求；只有公开 stop/SIGTERM/SIGINT 停止运行。
  process.on('SIGHUP', () => {});
  const server = createServer(socket => {
    let input = '';
    socket.setTimeout(10_000, () => socket.destroy());
    socket.on('error', error => bestEffortEvent('control-client-error', { error: error.message }));
    socket.on('data', chunk => {
      input += chunk;
      if (input.length > 4096) return socket.destroy();
      if (!input.includes('\n')) return;
      try {
        const message = JSON.parse(input);
        if (message.token !== control.token) return socket.end(JSON.stringify({ error: '控制身份不匹配' }));
        if (message.action === 'stop') {
          void stop();
          return socket.end(JSON.stringify({ run: config.run, state: 'stopping', note: '已请求停止；status 确认最终 stopped 后才可复用现场' }));
        }
        if (message.action !== 'status') return socket.end(JSON.stringify({ error: '未知控制动作' }));
        socket.end(JSON.stringify({ run: config.run, state, result, ...engine?.describe(), ...config.selection }));
      } catch (error) { socket.end(JSON.stringify({ error: error.message })); }
    });
  });
  try {
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(control.socket, resolveListen);
    });
    chmodSync(control.socket, 0o600);
    save(join(config.logDir, 'control.json'), control);
    // detached daemon 不依赖发起会话，但仍依赖 run 现场。外部清理器或测试宿主
    // 移除现场后必须受管停止；否则静默角色不会再触发日志写入，daemon 会永久孤立。
    livenessTimer = setInterval(checkRunSiteLiveness, 1_000);
    livenessTimer.unref();
    const { createEngine } = await import('./engine.mjs');
    engine = await createEngine(config, processes, event, observations);
    if (processes.stopping) throw new Error('启动期间收到停止请求');
    state = 'running';
    const selection = config.selection;
    event('started', { ...engine.describe(), ...selection, logDir: config.logDir });
    announce({ ready: true, run: config.run, logDir: config.logDir, ...selection, ...engine.describe() });
    result = await engine.run();
    if (stopPromise) await stopPromise;
    if (processes.hasUnsafeWriters) throw new Error('角色终止未确认，现场写锁保留；不能报告已停止');
    if (logFailure) throw new Error(`运行日志不可用：${logFailure.message}`, { cause: logFailure });
    if (processes.failure) throw processes.failure;
    state = processes.stopping ? 'stopped' : result.state;
    if (!['completed', 'waiting-user', 'stopped', 'failed'].includes(state)) throw new Error(`无效最终状态：${state}`);
  } catch (error) {
    const startup = state === 'starting';
    state = processes.stopping && !logFailure && !processes.failure ? 'stopped' : 'failed';
    result = { error: error.stack || error.message };
    try { await processes.stop(); }
    catch (stopError) { state = 'failed'; result.stopError = stopError.message; }
    if (processes.hasUnsafeWriters) state = 'failed';
    bestEffortEvent(startup ? 'startup-failed' : 'failed', result);
    announce({ ready: false, error: error.message });
  } finally {
    // 终止未确认时 writer ownership server 有意保留；同时保留 liveness，
    // 只在 run 现场后来确实消失时释放本 daemon 的锁并退出。
    if (!processes.hasUnsafeWriters) clearInterval(livenessTimer);
    if (logFailure) state = 'failed';
    bestEffortEvent('finished', { state });
    // 冻结 Observation history：落盘节流中的 state，此后 journal 不再增长。
    observations.flush();
    if (logFailure) {
      state = 'failed';
      result = { ...result, logError: logFailure.message };
      try { await stop({ log: false }); } catch (error) { diagnostic(error); }
    }
    try { save(join(config.logDir, 'result.json'), { ...engine?.describe(), ...result, ...config.selection, run: config.run, state, finished: new Date().toISOString() }); }
    catch (error) { diagnostic(error); }
    finally {
      server.close();
      try { if (existsSync(control.socket)) unlinkSync(control.socket); } catch (error) { diagnostic(error); }
    }
  }
}

const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const dashboardCommand = runDir => [process.execPath, fileURLToPath(import.meta.url), 'dashboard', '--run', runDir].map(quote).join(' ');
// run identity 来自 control（live）或 result（终态），不依赖 Dashboard 元数据。
function resolveRunIdentity(runDir, resultPath) {
  if (existsSync(join(runDir, 'control.json'))) {
    try { return JSON.parse(readFileSync(join(runDir, 'control.json'), 'utf8')).run; } catch {}
  }
  return JSON.parse(readFileSync(resultPath, 'utf8')).run;
}
function dashboardPublic(logDir) {
  try {
    const metadata = JSON.parse(readFileSync(join(logDir, 'dashboard.json'), 'utf8'));
    const observation = existsSync(join(logDir, 'observation-state.json')) ? JSON.parse(readFileSync(join(logDir, 'observation-state.json'), 'utf8')) : { completeness: 'incomplete' };
    return { state: metadata.state, url: `http://127.0.0.1:${metadata.port}/?token=${encodeURIComponent(metadata.token)}`, reopenCommand: dashboardCommand(logDir), finalExport: existsSync(join(logDir, 'dashboard.html')) ? join(logDir, 'dashboard.html') : undefined, completeness: observation.completeness, ...(observation.reason ? { reason: observation.reason } : {}) };
  } catch (error) { return { state: 'unavailable', reopenCommand: dashboardCommand(logDir), completeness: 'incomplete', reason: error.message }; }
}
// companion 存活判定基于其自身 PID，而不是一次 HEAD 探测。
// HEAD 会因 worker 重建的短暂空窗失败，从而误起第二个 companion，
// 造成重复 server、dashboard.json 写竞争与孤儿进程。
function companionAlive(logDir) {
  let pid;
  try { pid = JSON.parse(readFileSync(join(logDir, 'dashboard.json'), 'utf8')).pid; } catch { return false; }
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}
async function launchDashboard(logDir, run) {
  // 重建时复用原 read token，使已公开的 URL capability 保持有效；
  // 无既有元数据（新 run）时生成新 token。
  let token = randomUUID();
  try { token = JSON.parse(readFileSync(join(logDir, 'dashboard.json'), 'utf8')).token || token; } catch {}
  const child = spawn(process.execPath, [join(fileURLToPath(new URL('.', import.meta.url)), 'dashboard-server.mjs'), logDir, run, token], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    await new Promise((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error('Dashboard 启动超时')), 5_000);
      const finish = (error, message) => {
        clearTimeout(timer);
        child.removeListener('error', onError);
        child.removeListener('exit', onExit);
        child.removeListener('message', onMessage);
        if (error) reject(error);
        else resolveReady(message);
      };
      const onError = error => finish(error);
      const onExit = code => finish(new Error(`Dashboard 启动退出 ${code}`));
      const onMessage = message => finish(message?.ready ? null : new Error(`Dashboard 启动失败：${message?.error || '未知原因'}`), message);
      child.once('error', onError);
      child.once('exit', onExit);
      child.once('message', onMessage);
    });
  } catch (error) {
    // 启动失败不留孤儿 companion：它没有可用 URL，也不会被任何读者引用。
    try { child.kill('SIGTERM'); } catch {}
    throw error;
  } finally { if (child.connected) child.disconnect(); child.unref(); }
  const dashboard = dashboardPublic(logDir);
  // AFK_DASHBOARD_OPEN=0 关闭浏览器自动打开（测试与无人值守环境）；
  // opener 失败只影响打开动作，不影响 run 与 URL 可用性。
  if (dashboard.url && process.env.AFK_DASHBOARD_OPEN !== '0') {
    try {
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
      const opened = spawn(opener, [dashboard.url], { detached: true, stdio: 'ignore' });
      opened.unref();
    } catch {}
  }
  return dashboard;
}

async function start(values) {
  if (process.platform === 'win32') throw new Error('本运行时仅支持 macOS/Linux POSIX 进程组');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node >=22');
  const repo = realpathSync(resolve(values.repo || process.cwd()));
  const selection = await resolveSelection(values, repo);
  const { provider, model, effort } = selection;
  const run = randomUUID();
  const logDir = join(repo, '.afk', 'logs', run);
  const config = {
    repo, provider, run, logDir, selection,
    issues: numbers(values.issues),
    specs: numbers(values.spec),
    reuse: numbers(values.reuse),
    target: values.target,
    model: model ?? undefined,
    effort: effort ?? undefined,
    verify: values.verify,
    priorityLabels: values['priority-labels']?.split(',').filter(Boolean) || [],
  };
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
  save(join(logDir, 'selection.json'), selection);
  new ObservationJournal(logDir, run);
  const output = openSync(join(logDir, 'daemon.log'), 'a', 0o600);
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '_daemon'], { cwd: repo, detached: true, stdio: ['ignore', output, output, 'ipc'] });
  closeSync(output);
  // IPC 仅用于启动握手；确认后断开，角色与运行时不持有发起工具管道。
  let ready;
  try {
    ready = await new Promise((resolveReady, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        finish(new Error(`启动握手超时，已请求停止；检查 ${logDir}/result.json 确认终态，不能推断角色已结束`));
      }, 120_000);
      const finish = (error, message) => {
        clearTimeout(timeout);
        child.removeListener('error', onError);
        child.removeListener('exit', onExit);
        child.removeListener('message', onMessage);
        if (error) reject(error);
        else resolveReady(message);
      };
      const onError = error => finish(error);
      const onExit = (code, signal) => finish(new Error(`启动器在确认前退出 ${signal || code}；检查 ${logDir}/daemon.log`));
      const onMessage = message => finish(message.ready ? null : new Error(`启动失败：${message.error}；日志 ${logDir}`), message);
      child.once('error', onError);
      child.once('exit', onExit);
      child.once('message', onMessage);
      child.send(config, error => { if (error) finish(error); });
    });
  } finally {
    if (child.connected) child.disconnect();
    child.unref();
  }
  const controlCommand = action => [process.execPath, fileURLToPath(import.meta.url), action, '--run', logDir].map(quote).join(' ');
  let dashboard;
  try { dashboard = await launchDashboard(logDir, run); }
  catch (error) { dashboard = { state: 'unavailable', reopenCommand: dashboardCommand(logDir), completeness: 'incomplete', reason: error.message }; }
  console.log(JSON.stringify({ state: 'started', ...ready, dashboard, status: controlCommand('status'), stop: controlCommand('stop') }, null, 2));
}

async function main() {
  const action = process.argv[2];
  if (action === '_daemon') {
    process.once('message', config => daemon(config).catch(error => { console.error(error); process.exitCode = 1; }));
    return;
  }
  const { values } = parseArgs({ args: process.argv.slice(3), options: Object.fromEntries(['repo', 'issues', 'spec', 'target', 'provider', 'model', 'effort', 'verify', 'priority-labels', 'reuse', 'run'].map(name => [name, { type: 'string' }])) });
  if (!action || ['help', '--help', '-h'].includes(action)) return console.log(help);
  if (action === 'start') return start(values);
  if (action === 'resolve-selection') return console.log(JSON.stringify(await resolveSelection(values, realpathSync(resolve(values.repo || process.cwd()))), null, 2));
  if (!['status', 'stop', 'dashboard'].includes(action) || !values.run) throw new Error(help);
  const runDir = resolve(values.run);
  const resultPath = join(runDir, 'result.json');
  if (action === 'dashboard') {
    const existing = dashboardPublic(runDir);
    const run = resolveRunIdentity(runDir, resultPath);
    // companion 仍存活即复用：worker 重建期间也返回同一 URL identity，
    // 不重复启动第二个 server。
    if (existing.url && companionAlive(runDir)) return console.log(JSON.stringify({ state: 'reused', run, url: existing.url, final: existsSync(resultPath) }, null, 2));
    const dashboard = await launchDashboard(runDir, run);
    return console.log(JSON.stringify({ state: 'started', run, url: dashboard.url, final: existsSync(resultPath) }, null, 2));
  }
  if (existsSync(resultPath)) {
    const result = JSON.parse(readFileSync(resultPath, 'utf8'));
    return console.log(JSON.stringify({ ...result, dashboard: dashboardPublic(runDir) }, null, 2));
  }
  const control = JSON.parse(readFileSync(join(runDir, 'control.json'), 'utf8'));
  try {
    const response = await request(control, action);
    console.log(JSON.stringify(action === 'status' ? { ...response, dashboard: dashboardPublic(runDir) } : response, null, 2));
  }
  catch (error) {
    if (existsSync(resultPath)) console.log(readFileSync(resultPath, 'utf8').trim());
    else throw new Error(`无法联系运行 ${control.run}：${error.message}。状态未知；保留现场，勿按 PID 盲目 kill 或恢复。`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
