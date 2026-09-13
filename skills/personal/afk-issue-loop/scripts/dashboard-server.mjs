#!/usr/bin/env node
// Dashboard companion supervisor：只读取 Observation journal，管理 HTTP/SSE worker
// 与终态后的 24 小时保留期，不参与 AFK 调度，也不持有 control capability。
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [logDir, run, token] = process.argv.slice(2);
const resultPath = join(logDir, 'result.json');
const metadataPath = join(logDir, 'dashboard.json');
// 终态后保留期；通过公开 start 的受控 adapter 覆盖，测试不等待真实 24 小时。
const retentionMs = Number(process.env.AFK_DASHBOARD_RETENTION_MS || 24 * 60 * 60 * 1000);
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
    if (message?.final) beginRetention();
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
function beginRetention() {
  if (retentionTimer) return;
  retentionTimer = setTimeout(() => {
    stopped = true;
    try { worker?.kill('SIGTERM'); } catch {}
    try { process.disconnect?.(); } catch {}
    process.exit(0);
  }, retentionMs);
}
const port = await freePort().catch(() => 0);
startWorker();
process.on('SIGTERM', () => { stopped = true; try { worker?.kill('SIGTERM'); } catch {} process.exit(0); });
process.on('SIGINT', () => { stopped = true; try { worker?.kill('SIGTERM'); } catch {} process.exit(0); });
// 终态已存在时（reopen 场景）直接进入保留期判定。
if (existsSync(resultPath)) beginRetention();
