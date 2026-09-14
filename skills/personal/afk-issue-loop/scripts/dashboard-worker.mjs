#!/usr/bin/env node
// 生产 HTTP/SSE worker：只读 Observation journal，发布 append-only run-level stream。
// 由 dashboard-server.mjs 监督；不含 mutation route，也不接触 control capability。
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const [logDir, run, token, portArg] = process.argv.slice(2);
const journalPath = join(logDir, 'observations.jsonl');
const statePath = join(logDir, 'observation-state.json');
const resultPath = join(logDir, 'result.json');
const finalPath = join(logDir, 'dashboard.html');
const clients = new Set();

const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // 页面不得加载任何外部脚本、字体、样式、图片或 telemetry。
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
const readRecords = () => {
  if (!existsSync(journalPath)) return [];
  return readFileSync(journalPath, 'utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
};
const completeness = () => existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : { completeness: 'incomplete', reason: 'observation-state.json 缺失' };
const snapshot = () => ({ run, observations: readRecords(), completeness: completeness(), final: existsSync(resultPath) });
const escJson = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');

// B2 信息架构：桌面端左侧 Ticket Kanban，右侧 selected Agent Output Inspector；
// 窄屏顺序堆叠并保持同一信息层级。仅排版 transport envelope，payload 原样渲染。
function page(data = null) {
  const initial = data ? escJson(data) : 'null';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>AFK Dashboard</title><style>
  *{box-sizing:border-box}body{margin:0;font:14px system-ui,sans-serif;background:#eef2f5;color:#15202b}header{padding:14px 18px;background:#17324a;color:white}header h1{margin:0;font-size:18px}.state{font:12px ui-monospace,monospace}.layout{display:grid;grid-template-columns:minmax(320px,1fr) minmax(380px,1.2fr);gap:12px;padding:12px;height:calc(100vh - 67px)}section{min-width:0;overflow:auto;background:white;border:1px solid #c7d1d9;border-radius:8px}h2{position:sticky;top:0;margin:0;padding:12px;background:#f8fafb;border-bottom:1px solid #d6dde2;font-size:14px}.tickets{padding:10px}.ticket{width:100%;margin:0 0 8px;padding:10px;text-align:left;background:#f7fafc;border:1px solid #cbd5dc;border-radius:6px}.ticket[aria-pressed="true"]{background:#e0f2fe;border-color:#087ea4}.ticket:focus-visible,button:focus-visible{outline:3px solid #087ea4}.log{margin:0;padding:0;list-style:none;font:12px/1.5 ui-monospace,monospace}.line{display:grid;grid-template-columns:58px 200px 1fr;border-bottom:1px solid #e3e8ec}.line>*{padding:7px}.seq{color:#667}.kind{color:#075985}.payload{white-space:pre-wrap;overflow-wrap:anywhere}.scope{color:#4b5563;font-size:11px}.warning{padding:8px 18px;background:#fff0c2;color:#713f12}button.plain{font:12px system-ui;padding:4px 8px}@media(max-width:760px){.layout{grid-template-columns:1fr;height:auto}.layout section{max-width:100%;min-height:42vh}.line{grid-template-columns:48px 1fr}.payload{grid-column:1/-1}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
  </style></head><body><header><h1>AFK Run Dashboard</h1><div class="state" id="state">连接中 · ${run}</div></header><div id="warning"></div><main class="layout"><section aria-labelledby="tickets-title"><h2 id="tickets-title">Ticket Kanban</h2><div class="tickets" id="tickets"></div></section><section aria-labelledby="output-title"><h2 id="output-title">Selected Agent Output Inspector <button class="plain" id="follow" aria-pressed="true">Follow tail</button></h2><div class="scope" id="identity"></div><ol class="log" id="log" role="log" aria-live="off" aria-relevant="additions" tabindex="0"></ol></section></main><script>
  const initial=${initial};let records=[],selected=null,last=0,follow=true;const log=document.querySelector('#log');const followButton=document.querySelector('#follow');const identity=document.querySelector('#identity');const renderPayload=p=>typeof p==='string'?p:JSON.stringify(p,null,2);
  // 逻辑 Merger 是 batch-level Inspect 对象：多个 Ticket lane 引用同一 batch，
  // 其内部按序保留每次真实 Merger Attempt/Invocation。
  function entries(){const map=new Map;for(const r of records){const ids=r.scope?.tickets?.length?r.scope.tickets:[r.scope?.ticket].filter(Boolean);for(const id of ids){if(!map.has(id))map.set(id,{roles:new Set,last:r.observedAt,count:0});const e=map.get(id);if(r.scope?.role)e.roles.add(r.scope.role);e.last=r.observedAt;e.count++}}return map}
  function visibleRecords(){if(selected==null)return records;return records.filter(r=>r.scope?.ticket===selected||(r.scope?.tickets||[]).includes(selected))}
  // 属于同一逻辑行的 text delta 实时追加；遇到换行冻结该行并开始新行。
  function foldLines(list){const out=[];for(const r of list){if(r.kind==='text-delta'&&typeof r.payload?.text==='string'){const prev=out.at(-1);if(prev&&prev.kind==='text-delta'&&prev.scope?.invocation===r.scope?.invocation&&!prev.frozen){prev.text+=r.payload.text;prev.seq=r.seq;if(prev.text.includes('\\n')){const parts=prev.text.split('\\n');prev.text=parts.slice(0,-1).join('\\n');prev.frozen=true;out.push({...prev,seq:r.seq,text:parts.at(-1),frozen:false,cont:true})}continue}out.push({...r,text:r.payload.text,frozen:false})}else out.push(r)}return out}
  function scopeLabel(s){if(!s)return '';const parts=[];if(s.role)parts.push(s.role);if(Number.isSafeInteger(s.attempt))parts.push('attempt '+s.attempt);if(Number.isSafeInteger(s.invocation))parts.push('invocation '+s.invocation);if(Number.isSafeInteger(s.batch))parts.push('batch '+s.batch);if(Number.isSafeInteger(s.ticket))parts.push('#'+s.ticket);return parts.join(' · ')}
  // 结构性文本（source/kind/scope/时间）经转义后拼入 HTML；payload 与
  // 文本行始终走 textContent，保持原始内容不被解析为标签。
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Process、Self-report、Gate 与 Delivery 是四层独立事实：进程存活不代表
  // 有效工作，Self-report passed 不代表 Gate 接受，Role 退出不代表已交付。
  // 因此四层各自取最新记录并分开呈现，任一层都不冒充业务完成。
  function layerOf(own,match){for(let i=own.length-1;i>=0;i--){const r=own[i];if(match(r))return r}return null}
  function facets(id){const own=records.filter(r=>r.scope?.ticket===id||(r.scope?.tickets||[]).includes(id));
    const proc=layerOf(own,r=>r.kind==='invocation-started'||r.kind==='role-end');
    const self=layerOf(own,r=>r.kind==='self-report');
    const gate=layerOf(own,r=>r.kind==='gate-accepted'||r.kind==='gate-rejected');
    const delivery=layerOf(own,r=>String(r.kind).startsWith('delivery-'));
    return {
      process:proc?(proc.kind==='invocation-started'?'running':'ended'):'none',
      selfReport:self?.payload?.status||'none',
      gate:gate?(gate.kind==='gate-accepted'?'accepted':'rejected'):'none',
      delivery:delivery?String(delivery.payload?.state||delivery.kind.replace('delivery-','')):'none'};}
  // 重绘会替换 Ticket 按钮节点，先记下聚焦的 ticket 再在重建后恢复，
  // 否则按住方向键逐条浏览时焦点会在第一次选择后丢失。
  function render(){const map=entries();const ids=[...map.keys()].sort((a,b)=>a-b);const focused=document.activeElement?.dataset?.ticket;document.querySelector('#tickets').innerHTML=ids.length?ids.map(id=>{const e=map.get(id);const f=facets(id);return '<button class="ticket" data-ticket="'+id+'" aria-pressed="'+(selected===id)+'"><strong>#'+id+'</strong><br><span class="kind">'+esc([...e.roles].join(' · '))+'</span><br>Recovery → Implementer → Reviewer → Merger / Delivery<br><span class="scope">process '+esc(f.process)+' · self-report '+esc(f.selfReport)+' · Gate '+esc(f.gate)+' · Delivery '+esc(f.delivery)+'</span><br><span class="scope">'+e.count+' 条输出 · last observed '+esc(e.last)+'</span></button>'}).join(''):'<p>等待 Ticket observation…</p>';
  if(focused!==undefined)document.querySelector('#tickets [data-ticket="'+focused+'"]')?.focus();
  identity.textContent=selected==null?'全部 Observation':'selected Ticket #'+selected;
  const rows=foldLines(visibleRecords());
  log.innerHTML=rows.map(r=>'<li class="line"><span class="seq">#'+r.seq+'</span><span class="kind">'+esc(r.source)+' / '+esc(r.kind)+(r.scope?'<br><span class="scope">'+esc(scopeLabel(r.scope))+'</span>':'')+'</span><span class="payload"></span></li>').join('');
  rows.forEach((r,i)=>{const cell=log.children[i].lastElementChild;cell.textContent=r.text!==undefined?r.text:renderPayload(r.payload)});
  if(follow)log.parentElement.scrollTop=log.parentElement.scrollHeight}
  function ingest(r){if(r.seq<=last)return;last=r.seq;records.push(r);render()}
  function setFollow(next){follow=next;followButton.setAttribute('aria-pressed',String(follow));if(follow)log.parentElement.scrollTop=log.parentElement.scrollHeight}
  document.querySelector('#tickets').onclick=e=>{const b=e.target.closest('[data-ticket]');if(b){selected=Number(b.dataset.ticket);render()}};
  document.querySelector('#tickets').addEventListener('keydown',e=>{if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;const items=[...document.querySelectorAll('[data-ticket]')];const index=items.indexOf(document.activeElement);if(index<0)return;e.preventDefault();items[Math.min(items.length-1,Math.max(0,index+(e.key==='ArrowDown'?1:-1)))].focus()});
  followButton.onclick=()=>setFollow(!follow);
  log.parentElement.addEventListener('scroll',()=>{const e=log.parentElement;if(e.scrollHeight-e.scrollTop-e.clientHeight>40)setFollow(false)},{passive:true});
  if(initial){records=initial.observations;last=records.at(-1)?.seq||0;document.querySelector('#state').textContent=initial.final?'final · frozen':'replay';showCompleteness(initial.completeness);render()}else{fetch('./snapshot?token='+encodeURIComponent(new URLSearchParams(location.search).get('token'))).then(r=>r.json()).then(s=>{records=s.observations;last=records.at(-1)?.seq||0;showCompleteness(s.completeness);render()})}
  function showCompleteness(state){if(!state||state.completeness==='complete')return;const w=document.createElement('div');w.className='warning';w.textContent='degraded / incomplete：'+(state.reason||'Observation history 不完整');document.querySelector('#warning').replaceChildren(w)}
  function connect(){const t=new URLSearchParams(location.search).get('token');const es=new EventSource('./events?token='+encodeURIComponent(t)+'&after='+last);es.onopen=()=>document.querySelector('#state').textContent='live · '+${JSON.stringify(run)};es.onmessage=e=>{document.querySelector('#state').textContent='live · '+${JSON.stringify(run)};ingest(JSON.parse(e.data))};es.addEventListener('final',()=>{document.querySelector('#state').textContent='final · frozen';es.close()});es.onerror=()=>document.querySelector('#state').textContent='stale · reconnecting'}if(!initial)connect();
  </script></body></html>`;
}

function authorized(url) { return url.searchParams.get('token') === token; }
const writeFinal = () => {
  try {
    const data = snapshot();
    writeFileSync(finalPath, page(data), { mode: 0o600 });
    chmodSync(finalPath, 0o600);
    for (const client of clients) client.res.write('event: final\ndata: {}\n\n');
    process.send?.({ final: true });
  } catch { /* 导出失败只影响静态文件，不影响 run。 */ }
};
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!authorized(url)) { res.writeHead(403, headers); return res.end('Forbidden'); }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers); return res.end('Read only'); }
  if (url.pathname === '/snapshot') { res.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }); return res.end(JSON.stringify(snapshot())); }
  if (url.pathname === '/events') {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' });
    res.socket?.setNoDelay?.(true);
    // SSE event ID 等于 Observation seq；只补发 after 之后的记录。
    // 浏览器自动重连会带 Last-Event-ID，它比 URL 里页面加载时固定的 after
    // 更接近实际已见位置，因此优先采用；否则重连会重发全部增量。
    const after = Number(req.headers['last-event-id'] ?? url.searchParams.get('after') ?? 0);
    // 游标按客户端记录：补发到哪里，后续广播就从哪里继续，
    // 避免刚 replay 完的客户端在下一轮广播里重复收到同一批记录。
    const client = { res, cursor: after };
    for (const record of readRecords()) {
      if (record.seq <= client.cursor) continue;
      res.write(`id: ${record.seq}\ndata: ${JSON.stringify(record)}\n\n`);
      client.cursor = record.seq;
    }
    if (existsSync(resultPath)) res.write('event: final\ndata: {}\n\n');
    clients.add(client);
    req.on('close', () => clients.delete(client));
    return;
  }
  if (url.pathname !== '/') { res.writeHead(404, headers); return res.end('Not found'); }
  const body = page();
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
  const records = readRecords();
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
  if (!frozen && existsSync(resultPath)) { frozen = true; writeFinal(); }
}, 100);
timer.unref();

// 受控故障注入：让生产 worker 自身异常退出，用于验证 companion 自动重建。
if (process.env.AFK_DASHBOARD_WORKER_FAULT_EXIT_MS) {
  setTimeout(() => process.exit(7), Number(process.env.AFK_DASHBOARD_WORKER_FAULT_EXIT_MS)).unref();
}
