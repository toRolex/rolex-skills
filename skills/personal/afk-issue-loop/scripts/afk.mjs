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

const help = `AFK：独立本地 CLI 编排（Node >=22，macOS/Linux）
  node afk.mjs start --repo /absolute/repository [--issues 1,2] [--spec 7]
      [--target develop] [--provider claude|codex|pi] [--model MODEL]
      [--effort LEVEL] [--verify '项目验证命令'] [--priority-labels critical,high,low]
      [--reuse 1,2]
  node afk.mjs status --run /absolute/repository/.afk/logs/RUN
  node afk.mjs stop --run /absolute/repository/.afk/logs/RUN

默认 provider=claude；模型/effort 省略则沿用该 CLI 本机配置，不从宿主猜测。
默认 scope=首次完整分页的 open ready-for-agent，目标 develop 优先否则 main。
--spec 仅提供上下文，不实现或关闭。无 priority-labels 时全部同级按编号。
--reuse 显式确认相应 afk/issue-N 分支及现场属于该票，可继续已有 dirty 进度。
启动成功只表示运行已启动。最终结果见 status 和 events.jsonl；不自动 push/PR。
不支持系统重启恢复。worktree 隔离代码，不隔离系统权限。`;

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
  const processes = new Processes();
  const control = { run: config.run, pid: process.pid, socket: join(tmpdir(), `afk-${config.run}.sock`), token: randomUUID() };
  let state = 'starting', result, engine, stopPromise, logFailure;
  const diagnostic = error => {
    try { process.stderr.write(`AFK：${error.stack || error.message || error}\n`); }
    catch { /* 日志介质不可用时，仍继续受管停止。 */ }
  };
  const event = (type, data = {}) => {
    try { appendFileSync(join(config.logDir, 'events.jsonl'), `${JSON.stringify({ time: new Date().toISOString(), run: config.run, type, ...data })}\n`); }
    catch (error) {
      logFailure ||= error;
      stop(false, error);
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
  function stop(log = true, failure) {
    if (stopPromise) return stopPromise;
    state = 'stopping';
    // 停止先于记录；日志故障归因于基础设施，不冒充用户停止。
    stopPromise = failure ? processes.halt(failure, 'event-log-error') : processes.stop();
    stopPromise.catch(diagnostic);
    if (log) bestEffortEvent('stop-requested');
    return stopPromise;
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
        socket.end(JSON.stringify({ run: config.run, state, result, ...engine?.describe() }));
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
    const { createEngine } = await import('./engine.mjs');
    engine = await createEngine(config, processes, event);
    if (processes.stopping) throw new Error('启动期间收到停止请求');
    state = 'running';
    event('started', { ...engine.describe(), provider: config.provider, logDir: config.logDir });
    announce({ ready: true, run: config.run, logDir: config.logDir, ...engine.describe() });
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
    if (logFailure) state = 'failed';
    bestEffortEvent('finished', { state });
    if (logFailure) {
      state = 'failed';
      result = { ...result, logError: logFailure.message };
      try { await stop(false); } catch (error) { diagnostic(error); }
    }
    try { save(join(config.logDir, 'result.json'), { ...result, run: config.run, state, finished: new Date().toISOString() }); }
    catch (error) { diagnostic(error); }
    finally {
      server.close();
      try { if (existsSync(control.socket)) unlinkSync(control.socket); } catch (error) { diagnostic(error); }
    }
  }
}

async function start(values) {
  if (process.platform === 'win32') throw new Error('本运行时仅支持 macOS/Linux POSIX 进程组');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node >=22');
  const repo = realpathSync(resolve(values.repo || process.cwd()));
  const provider = values.provider || 'claude';
  if (!['claude', 'codex', 'pi'].includes(provider)) throw new Error('provider 必须为 claude、codex 或 pi');
  const run = randomUUID();
  const logDir = join(repo, '.afk', 'logs', run);
  const config = {
    repo, provider, run, logDir,
    issues: numbers(values.issues),
    specs: numbers(values.spec),
    reuse: numbers(values.reuse),
    target: values.target,
    model: values.model,
    effort: values.effort,
    verify: values.verify,
    priorityLabels: values['priority-labels']?.split(',').filter(Boolean) || [],
  };
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
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
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  const controlCommand = action => [process.execPath, fileURLToPath(import.meta.url), action, '--run', logDir].map(quote).join(' ');
  console.log(JSON.stringify({ state: 'started', ...ready, status: controlCommand('status'), stop: controlCommand('stop') }, null, 2));
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
  if (!['status', 'stop'].includes(action) || !values.run) throw new Error(help);
  const runDir = resolve(values.run);
  const resultPath = join(runDir, 'result.json');
  if (existsSync(resultPath)) return console.log(readFileSync(resultPath, 'utf8').trim());
  const control = JSON.parse(readFileSync(join(runDir, 'control.json'), 'utf8'));
  try { console.log(JSON.stringify(await request(control, action), null, 2)); }
  catch (error) {
    if (existsSync(resultPath)) console.log(readFileSync(resultPath, 'utf8').trim());
    else throw new Error(`无法联系运行 ${control.run}：${error.message}。状态未知；保留现场，勿按 PID 盲目 kill 或恢复。`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
