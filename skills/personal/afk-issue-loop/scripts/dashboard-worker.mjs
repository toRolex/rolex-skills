#!/usr/bin/env node
// 生产 HTTP/SSE worker：只读 Observation journal，发布 append-only run-level stream。
// 由 dashboard-server.mjs 监督；不含 mutation route，也不接触 control capability。
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { page } from './dashboard-page.mjs';
import { openJournal } from './dashboard-store.mjs';

const [logDir, run, token, portArg] = process.argv.slice(2);
const journalPath = join(logDir, 'observations.jsonl');
const statePath = join(logDir, 'observation-state.json');
const resultPath = join(logDir, 'result.json');
const finalPath = join(logDir, 'dashboard.html');
const clients = new Set();
const journal = openJournal(journalPath);

const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // 页面不得加载任何外部脚本、字体、样式、图片或 telemetry。
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
const completeness = () => existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : { completeness: 'incomplete', reason: 'observation-state.json 缺失' };
const SNAPSHOT_DEFAULT_LIMIT = 500;
const SNAPSHOT_MAX_LIMIT = 5000;
const SSE_REPLAY_GAP_LIMIT = 5000;
const SSE_TAIL_REPLAY = 500;
function parseLimit(raw) {
  if (raw === null) return SNAPSHOT_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return SNAPSHOT_DEFAULT_LIMIT;
  return Math.min(SNAPSHOT_MAX_LIMIT, Math.max(1, Math.floor(n)));
}
function parseAfter(raw) {
  if (raw === null || raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
const snapshot = (after, limit) => {
  const lim = limit ?? SNAPSHOT_DEFAULT_LIMIT;
  const total = journal.total();
  const lastSeq = journal.lastSeq();
  let observations;
  let truncatedFrom = 0;
  if (after === undefined) {
    const all = journal.all();
    observations = all.length > lim ? all.slice(-lim) : all;
  } else {
    observations = journal.readRange(after, lim);
  }
  if (observations.length > 0 && total > observations.length) truncatedFrom = observations[0].seq;
  return { run, observations, total, truncatedFrom, lastSeq, completeness: completeness(), final: existsSync(resultPath) };
};

// 终态归档走全量：/snapshot 是有界的实时视图，而 dashboard.html 是
// frozen 归档，其唯一价值就是完整历史；静默丢弃早期记录不可接受。
// truncatedFrom=0 即「未发生截断」，前端据此不显示「更早记录未显示」提示。
const snapshotAll = () => ({
  run,
  observations: journal.all(),
  total: journal.total(),
  truncatedFrom: 0,
  lastSeq: journal.lastSeq(),
  completeness: completeness(),
  final: existsSync(resultPath),
});
function authorized(url) { return url.searchParams.get('token') === token; }
const writeFinal = () => {
  try {
    const data = snapshotAll();
    writeFileSync(finalPath, page(run, data), { mode: 0o600 });
    chmodSync(finalPath, 0o600);
    for (const client of clients) client.res.write('event: final\ndata: {}\n\n');
    process.send?.({ final: true });
  } catch { /* 导出失败只影响静态文件，不影响 run。 */ }
};
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!authorized(url)) { res.writeHead(403, headers); return res.end('Forbidden'); }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers); return res.end('Read only'); }
  if (url.pathname === '/snapshot') {
    const after = parseAfter(url.searchParams.get('after'));
    const limit = url.searchParams.has('limit') ? parseLimit(url.searchParams.get('limit')) : SNAPSHOT_DEFAULT_LIMIT;
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(snapshot(after, limit)));
  }
  if (url.pathname === '/events') {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' });
    res.socket?.setNoDelay?.(true);
    // SSE event ID 等于 Observation seq；只补发 after 之后的记录。
    // 浏览器自动重连会带 Last-Event-ID，它比 URL 里页面加载时固定的 after
    // 更接近实际已见位置，因此优先采用；否则重连会重发全部增量。
    const afterRaw = Number(req.headers['last-event-id'] ?? url.searchParams.get('after') ?? 0);
    const after = Number.isFinite(afterRaw) ? afterRaw : 0;
    // 游标按客户端记录：补发到哪里，后续广播就从哪里继续，
    // 避免刚 replay 完的客户端在下一轮广播里重复收到同一批记录。
    const client = { res, cursor: after };
    const gap = journal.lastSeq() - after;
    if (Number.isFinite(gap) && gap > SSE_REPLAY_GAP_LIMIT) {
      // 有界补发：落后太远时不重放全量历史，先发 truncated 让客户端
      // 重新对齐（snapshot 返回尾部），再从尾部补发一小段。
      res.write(`event: truncated\ndata: ${JSON.stringify({ lastSeq: journal.lastSeq() })}\n\n`);
      const tail = journal.readRange(journal.lastSeq() - SSE_TAIL_REPLAY, SSE_TAIL_REPLAY);
      for (const record of tail) {
        res.write(`id: ${record.seq}\ndata: ${JSON.stringify(record)}\n\n`);
        client.cursor = record.seq;
      }
    } else {
      for (const record of journal.readRange(after, SSE_REPLAY_GAP_LIMIT)) {
        res.write(`id: ${record.seq}\ndata: ${JSON.stringify(record)}\n\n`);
        client.cursor = record.seq;
      }
    }
    if (existsSync(resultPath)) res.write('event: final\ndata: {}\n\n');
    clients.add(client);
    req.on('close', () => clients.delete(client));
    return;
  }
  if (url.pathname !== '/') { res.writeHead(404, headers); return res.end('Not found'); }
  const body = page(run);
  res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.method === 'HEAD' ? '' : body);
});
server.listen(Number(portArg) || 0, '127.0.0.1', () => {
  process.send?.({ ready: true, port: server.address().port });
  if (existsSync(resultPath)) writeFinal();
});

let observed = 0;
let frozen = false;
// 每个 SSE 客户端的有界旁路队列上限（字节）。慢客户端被断开后
// 可通过 journal 按 seq 重连，不需要 worker 无限缓冲。
const MAX_CLIENT_BUFFER = 4 * 1024 * 1024;
const timer = setInterval(() => {
  // journal size 未变时跳过：all() 需拷贝整个记录数组（大 run 下为 O(万级)），
  // 而无可广播内容时这份拷贝纯属浪费。终态检测仍每轮执行，不受影响。
  if (journal.notify()) {
    // tailAfter 从尾部反向扫描到已见游标，避免每轮全表拷贝与遍历；
    // 广播只需「observed 之后的新记录」，历史部分无需触碰。
    const records = journal.tailAfter(observed, Number.MAX_SAFE_INTEGER);
    for (const record of records) {
      if (record.seq <= observed) continue;
      observed = record.seq;
      for (const client of [...clients]) {
        if (client.cursor >= record.seq) continue;
        if (client.res.writableLength > MAX_CLIENT_BUFFER) {
          clients.delete(client);
          try { client.res.destroy(); } catch {}
          continue;
        }
        try { client.res.write(`id: ${record.seq}\ndata: ${JSON.stringify(record)}\n\n`); client.cursor = record.seq; }
        catch { clients.delete(client); try { client.res.destroy(); } catch {} }
      }
    }
  }
  if (!frozen && existsSync(resultPath)) { frozen = true; writeFinal(); }
}, 100);
timer.unref();

// 受控故障注入：让生产 worker 自身异常退出，用于验证 companion 自动重建。
if (process.env.AFK_DASHBOARD_WORKER_FAULT_EXIT_MS) {
  setTimeout(() => process.exit(7), Number(process.env.AFK_DASHBOARD_WORKER_FAULT_EXIT_MS)).unref();
}
