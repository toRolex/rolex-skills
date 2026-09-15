#!/usr/bin/env node
// Dashboard companion supervisor：只读取 Observation journal，管理 HTTP/SSE worker
// 与终态后的立即回收，不参与 AFK 调度，也不持有 control capability。
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [logDir, run, token] = process.argv.slice(2);
const resultPath = join(logDir, 'result.json');
const metadataPath = join(logDir, 'dashboard.json');
// 终态后默认立即回收（0），不再空转 24 小时；只有显式设置正值
// AFK_DASHBOARD_RETENTION_MS 才恢复旧的保留期行为（回滚逃生口）。
// 注意用 undefined 判定而不用 ||，否则传 '0' 会被误判为未设置。
const retentionMs = process.env.AFK_DASHBOARD_RETENTION_MS === undefined
  ? 0
  : Number(process.env.AFK_DASHBOARD_RETENTION_MS);
// worker 崩溃重建的受控故障注入；只作用于首个 worker。
const faultFirstWorker = process.env.AFK_DASHBOARD_WORKER_FAULT === '1';
const workerPath = fileURLToPath(new URL('dashboard-worker.mjs', import.meta.url));

let worker, restarting = false, stopped = false, retentionTimer, readySent = false;
let firstWorker = true;

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolvePort(port));
    });
  });
}
function record(state) {
  try {
    writeFileSync(metadataPath, `${JSON.stringify({ run, pid: process.pid, port, token, state }, null, 2)}\n`, { mode: 0o600 });
    chmodSync(metadataPath, 0o600);
  } catch { /* companion 元数据不可写不影响 run 与页面。 */ }
}
function startWorker() {
  const inject = faultFirstWorker && firstWorker;
  firstWorker = false;
  worker = spawn(process.execPath, [workerPath, logDir, run, token, String(port)], {
    detached: false,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: { ...process.env, ...(inject ? { AFK_DASHBOARD_WORKER_FAULT_EXIT_MS: '400' } : {}) },
  });
  worker.on('error', error => {
    // companion 不可用时如实记录，不把启动失败伪装成可用页面。
    try { record('unavailable'); } catch {}
    if (!readySent && process.connected) process.send({ ready: false, error: error.message });
  });
  worker.on('message', message => {
    if (message?.ready) {
      record('available');
      // 只转发首个 ready；重建不得改变已公开的 URL identity。
      if (process.connected && !readySent) { readySent = true; process.send({ ready: true, port }); }
    }
    if (message?.final) {
      // 只在真正立即回收时标记 final-export。设置正值 retention 时面板仍在
      // 服务期内，若此时就标记，afk.mjs 会据此隐藏 URL 并判定面板已回收，
      // 逃生口名义上恢复保留期、实际上仍不可用。
      if (!(retentionMs > 0)) { try { record('final-export'); } catch {} }
      beginRetention();
    }
  });
  worker.on('exit', () => {
    if (stopped) return;
    // 只有 HTTP worker 自身退出才重建；页面关闭与 SSE 断线不会走到这里。
    if (restarting) return;
    restarting = true;
    // 该定时器必须保持引用：worker 退出后它是 supervisor 唯一的存活动力，
    // unref 会让 supervisor 在重建前随事件循环一起退出。
    setTimeout(() => { restarting = false; if (!stopped) startWorker(); }, 50);
  });
}
function reclaim() {
  if (stopped) return;
  stopped = true;
  try { worker?.kill('SIGTERM'); } catch {}
  try { process.disconnect?.(); } catch {}
  process.exit(0);
}
function beginRetention() {
  if (retentionTimer || stopped) return;
  // 默认立即回收：先标 final-export，再留短暂宽限让最终 SSE event: final
  // 送达已连接浏览器，然后 SIGTERM worker 并退出，不再空转保留期。
  const graceMs = 2000;
  if (!(retentionMs > 0)) {
    try { record('final-export'); } catch {}
    retentionTimer = setTimeout(reclaim, graceMs);
    return;
  }
  retentionTimer = setTimeout(reclaim, retentionMs);
}
const port = await freePort().catch(() => 0);
startWorker();
const shutdown = () => { stopped = true; try { worker?.kill('SIGTERM'); } catch {} process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// 终态已存在时（reopen 场景）直接进入保留期判定。
if (existsSync(resultPath)) beginRetention();
// 日志目录消失（run 现场被移除）时 companion 没有可服务的对象：
// 继续等待 retention 只会留下无主进程。周期检查必须保持引用。
const liveness = setInterval(() => {
  if (!existsSync(logDir)) shutdown();
  else if (existsSync(resultPath)) beginRetention();
}, 1_000);
