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
const escHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// B2 信息架构：桌面端左侧 Ticket Kanban，右侧 selected Agent Output Inspector；
// 窄屏顺序堆叠并保持同一信息层级。仅排版 transport envelope，payload 原样渲染。
function page(data = null) {
  const initial = data ? escJson(data) : 'null';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>AFK Dashboard</title><style>
  :root{color-scheme:light;--ink:#15202b;--muted:#586875;--quiet:#71808b;--line:#c7d1d9;--line-strong:#9eacb7;--panel:#fff;--soft:#f5f8fa;--head:#29445d;--blue:#087ea4;--cyan:#dff4f7;--green:#176b49;--amber:#8a5200;--red:#a42921;--violet:#684b7b;--console:#0b1924;--console-2:#132737;--console-line:#385267;--console-text:#dce8ee;--console-muted:#93a9b7}
  *{box-sizing:border-box}html,body{width:100%;max-width:100%;margin:0;overflow-x:hidden}body{min-width:0;font:14px/1.45 system-ui,sans-serif;background:#eef2f5;color:var(--ink)}button{font:inherit}header{min-width:0;padding:14px 18px;background:#17324a;color:#fff}header h1{margin:0;font-size:18px}.state{margin-top:3px;font:12px/1.4 ui-monospace,monospace;overflow-wrap:anywhere}.warning{padding:8px 18px;background:#fff0c2;color:#713f12;overflow-wrap:anywhere}.layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.85fr);gap:12px;width:100%;max-width:100%;height:calc(100vh - 70px);padding:12px}.panel{min-width:0;min-height:0;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:8px}.panel-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0;padding:10px 12px;background:#f8fafb;border-bottom:1px solid #d6dde2}.panel-heading h2{margin:0;font-size:14px}.panel-heading small{min-width:0;color:var(--muted);font-size:11px;text-align:right;overflow-wrap:anywhere}.board-panel{display:grid;grid-template-rows:auto minmax(0,1fr)}.kanban-scroll{min-width:0;overflow:auto}.lane-head,.ticket-lane{display:grid;grid-template-columns:minmax(88px,105px) repeat(3,minmax(0,1fr));min-width:0}.lane-head{position:sticky;z-index:2;top:0;color:#eef8fc;background:var(--head);font-size:10px;font-weight:800;letter-spacing:.04em}.lane-head>div,.ticket-lane>div{min-width:0;padding:9px;border-right:1px solid var(--line)}.lane-head>div{border-right-color:#526b80}.lane-head>div:last-child,.ticket-lane>div:last-child{border-right:0}.ticket-lane{border-bottom:1px solid var(--line)}.ticket-lane:last-child{border-bottom:0}.lane-ticket{display:flex;align-items:stretch;padding:0!important;background:#e4ebef}.ticket-button,.lane-agent{width:100%;min-width:0;color:var(--ink);background:transparent;border:0;cursor:pointer;text-align:left}.ticket-button{display:flex;flex-direction:column;justify-content:center;padding:10px}.ticket-button strong{font:800 16px ui-monospace,monospace}.ticket-button small{margin-top:4px;color:var(--muted);font-size:10px;overflow-wrap:anywhere}.ticket-button[aria-pressed="true"]{background:#d9f0f4;box-shadow:inset 4px 0 0 var(--blue)}.lane-cell{min-height:126px;background:rgba(255,255,255,.6)}.lane-agent{display:block;min-height:94px;padding:9px;background:#fff;border:1px solid var(--line);border-radius:5px}.lane-agent:hover,.ticket-button:hover{background:#f0f9fb}.lane-agent[aria-pressed="true"]{border-color:var(--blue);background:var(--cyan);box-shadow:inset 0 0 0 2px rgba(8,126,164,.18)}.lane-agent[aria-pressed="true"]::after,.ticket-button[aria-pressed="true"]::after{content:"SELECTED";display:block;margin-top:6px;color:var(--blue);font:800 8px ui-monospace,monospace;letter-spacing:.1em}.ticket-button:focus-visible,.lane-agent:focus-visible,.plain:focus-visible,.output-scroll:focus-visible{position:relative;z-index:3;outline:3px solid #087ea4;outline-offset:2px}.agent-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.agent-top strong{min-width:0;font-size:11px;overflow-wrap:anywhere}.agent-time{flex:none;color:var(--quiet);font:9px ui-monospace,monospace;white-space:nowrap}.agent-summary{display:block;margin-top:7px;color:var(--muted);font-size:10px;overflow-wrap:anywhere}.agent-signals{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.signal{display:inline-flex;min-width:0;padding:2px 4px;border:1px solid currentColor;border-radius:3px;font:700 8px/1.25 ui-monospace,monospace;overflow-wrap:anywhere}.tone-running,.tone-accepted,.tone-complete,.tone-closed{color:var(--green);background:#e8f6f0}.tone-ended,.tone-planned,.tone-merged-unverified,.tone-verified{color:var(--blue);background:#e5f3f7}.tone-none,.tone-waiting{color:var(--quiet);background:#f0f3f5}.tone-rejected,.tone-blocked,.tone-failed{color:var(--red);background:#ffebe8}.tone-passed{color:var(--violet);background:#f0eaf5}.empty-stage{display:grid;place-items:center;min-height:94px;padding:10px;color:var(--quiet);border:1px dashed var(--line-strong);font-size:10px;text-align:center;overflow-wrap:anywhere}.empty-stage::after{content:"推导展示态";display:block;margin-top:5px;color:#87939c;font:700 8px ui-monospace,monospace;letter-spacing:.05em}.delivery-result{margin-top:7px;padding:6px 7px;color:var(--muted);background:#f3f6f8;border-left:3px solid var(--blue);font-size:9px;overflow-wrap:anywhere}.delivery-result strong{display:block;color:var(--ink);font-size:9px}.inspector-panel{display:grid;grid-template-rows:auto auto auto minmax(0,1fr);color:var(--console-text);background:var(--console);border-color:var(--console-line)}.inspector-panel .panel-heading{align-items:center;color:#fff;background:var(--console-2);border-color:var(--console-line)}.inspector-panel .panel-heading small{color:#b4c6d1}.plain{flex:none;padding:5px 8px;color:#dce8ee;background:#173247;border:1px solid #527085;border-radius:4px;cursor:pointer;font-size:10px}.plain[aria-pressed="true"]{color:#071820;background:#8fdde5;border-color:#8fdde5}.identity{min-width:0;padding:9px 12px;color:#b8cad5;background:#10202d;border-bottom:1px solid var(--console-line);font:11px/1.45 ui-monospace,monospace;overflow-wrap:anywhere}.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#10202d;border-bottom:1px solid var(--console-line)}.fact{min-width:0;padding:7px 8px;border-right:1px solid var(--console-line)}.fact:last-child{border-right:0}.fact span{display:block;color:var(--console-muted);font-size:11px}.fact strong{display:block;margin-top:3px;color:#edf6fa;font:700 13px/1.3 ui-monospace,monospace;overflow-wrap:anywhere}.inspector-body{display:flex;min-width:0;min-height:0;flex-direction:column}.invocations{flex:none;padding:7px 12px;color:#b8cad5;background:#10202d;border-bottom:1px solid var(--console-line);font:9px/1.45 ui-monospace,monospace;overflow-wrap:anywhere}.batch-deliveries{display:flex;flex:none;flex-wrap:wrap;gap:5px;padding:7px 12px;color:#b8cad5;background:#10202d;border-bottom:1px solid var(--console-line);font:9px/1.4 ui-monospace,monospace}.batch-delivery{min-width:0;padding:3px 5px;border:1px solid var(--console-line);overflow-wrap:anywhere}.batch-delivery strong{color:#edf6fa}.output-scroll{min-width:0;min-height:0;flex:1;overflow:auto;overscroll-behavior:contain}.log{min-width:0;margin:0;padding:0;list-style:none;font:11px/1.5 ui-monospace,monospace}.line{display:grid;grid-template-columns:54px minmax(125px,190px) minmax(0,1fr);min-width:0;border-bottom:1px solid rgba(66,92,111,.6)}.line>*{min-width:0;padding:7px 8px}.seq{color:#7892a3;text-align:right}.kind{color:#a9dce8;border-right:1px solid rgba(66,92,111,.6);border-left:1px solid rgba(66,92,111,.6);overflow-wrap:anywhere}.scope{display:block;margin-top:3px;color:#91a9b9;font-size:9px}.payload{color:var(--console-text);white-space:pre-wrap;overflow-wrap:anywhere}.output-empty{padding:30px 16px;color:var(--console-muted);text-align:center}.empty-board{padding:36px 18px;color:var(--muted);text-align:center}
  @media(max-width:1000px){.layout{grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr)}.lane-head,.ticket-lane{grid-template-columns:88px repeat(3,minmax(0,1fr))}.lane-head>div,.ticket-lane>div{padding:7px}.lane-cell{min-height:116px}.signal{font-size:7px}}
  @media(max-width:760px){header{padding:12px 13px}.warning{padding:8px 13px}.layout{display:flex;flex-direction:column;height:auto;padding:10px;overflow:visible}.panel{width:100%;max-width:100%}.board-panel{display:block}.kanban-scroll{overflow:visible}.lane-head{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.ticket-lane{display:grid;grid-template-columns:minmax(0,1fr);width:auto;min-width:0;margin:8px;border:1px solid var(--line);border-radius:6px;overflow:hidden}.ticket-lane>div{border-right:0;border-bottom:1px solid var(--line)}.ticket-lane>div:last-child{border-bottom:0}.lane-ticket{min-height:58px}.lane-cell{position:relative;min-height:0;padding:29px 8px 8px!important}.lane-cell::before{content:attr(data-stage);position:absolute;top:8px;left:9px;color:var(--quiet);font-size:9px;font-weight:800;letter-spacing:.05em}.lane-agent,.empty-stage{min-height:78px}.inspector-panel{min-height:620px;height:78vh}.line{grid-template-columns:48px minmax(0,1fr)}.seq{grid-row:1 / span 2}.kind{border-right:0}.payload{grid-column:2}.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.fact:nth-child(2n){border-right:0}.fact:nth-child(-n+2){border-bottom:1px solid var(--console-line)}}
  @media(max-width:390px){.layout{padding:8px}.panel-heading{align-items:flex-start;flex-direction:column;gap:5px}.panel-heading small{text-align:left}.inspector-panel .panel-heading{align-items:stretch}.plain{align-self:flex-start}.ticket-lane{margin:7px}.agent-top{display:block}.agent-time{display:block;margin-top:3px;white-space:normal}.signal{max-width:100%}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  </style></head><body><header><h1>AFK Run Dashboard</h1><div class="state" id="state">连接中 · ${escHtml(run)}</div></header><div id="warning"></div><main class="layout" id="app" aria-busy="true"></main><script>
  const initial=${initial};let records=[],selectedKey=null,last=0,follow=true,copyIndex=0,copySlots=new Map(),viewTargets=new Map(),ticketEntries=new Map();const app=document.querySelector('#app');
  const renderPayload=p=>{if(typeof p==='string')return p;const value=JSON.stringify(p,null,2);return value===undefined?String(p):value};
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=role=>({implementer:'Implementer',reviewer:'Reviewer',merger:'Merger'}[role]||role||'Unknown');
  const recordTickets=r=>{const values=[];if(Number.isSafeInteger(r.scope?.ticket))values.push(r.scope.ticket);if(Array.isArray(r.scope?.tickets))for(const id of r.scope.tickets)if(Number.isSafeInteger(id)&&!values.includes(id))values.push(id);return values};
  function entries(){const map=new Map;for(const r of records){for(const id of recordTickets(r)){if(!map.has(id))map.set(id,{last:r.observedAt,count:0,records:[]});const e=map.get(id);e.last=r.observedAt;e.count++;e.records.push(r)}}ticketEntries=map;return map}
  function recordsForTicket(id){return ticketEntries.get(id)?.records||[]}
  function visibleRecords(target){return target?.records||records}
  // 属于同一逻辑行的 text delta 实时追加；遇到换行冻结该行并开始新行。
  function foldLines(list){const out=[];for(const r of list){if(r.kind==='text-delta'&&typeof r.payload?.text==='string'){const prev=out.at(-1);if(prev&&prev.kind==='text-delta'&&prev.scope?.invocation===r.scope?.invocation&&!prev.frozen){prev.text+=r.payload.text;prev.seq=r.seq;if(prev.text.includes('\\n')){const parts=prev.text.split('\\n');prev.text=parts.slice(0,-1).join('\\n');prev.frozen=true;out.push({...prev,seq:r.seq,text:parts.at(-1),frozen:false,cont:true})}continue}out.push({...r,text:r.payload.text,frozen:false})}else out.push(r)}return out}
  function scopeLabel(s){if(!s)return '';const parts=[];if(s.role)parts.push(roleLabel(s.role));if(Number.isSafeInteger(s.attempt))parts.push('Attempt '+s.attempt);if(Number.isSafeInteger(s.invocation))parts.push('Invocation '+s.invocation);if(Number.isSafeInteger(s.batch))parts.push('Batch '+s.batch);if(Number.isSafeInteger(s.ticket))parts.push('#'+s.ticket);else if(Array.isArray(s.tickets)&&s.tickets.length)parts.push(s.tickets.map(id=>'#'+id).join(', '));return parts.join(' · ')}
  // 可观测事实只有三类：进程生命周期、provider 原始输出、Recovery 与
  // Merger 逐票结果。进程存活不代表有效工作，Role 退出不代表已交付；
  // 看板逐票状态只从 Merger 逐票结果推导，不再有自创判定层。
  function layerOf(own,match){for(let i=own.length-1;i>=0;i--){const r=own[i];if(match(r))return r}return null}
  function facets(own){const proc=layerOf(own,r=>r.kind==='attempt-planned'||r.kind==='invocation-started'||r.kind==='role-end');return{process:proc?(proc.kind==='attempt-planned'?'planned':proc.kind==='invocation-started'?'running':'ended'):'none'}}
  // 逐票 Merger 结果：同一票取最新 batch 的记录。
  function mergerResultFor(ticket){return lastOf(recordsForTicket(ticket),r=>r.kind==='merger-result'&&r.scope?.ticket===ticket)}
  function ticketOutcome(ticket){const record=mergerResultFor(ticket);const item=record?.payload;if(!item)return'none';if(item.closed)return'closed';if(item.merged)return item.verified?'verified':'merged-unverified';return'blocked'}
  function copy(value,className){const key=String(++copyIndex);copySlots.set(key,value==null?'':String(value));return '<span class="'+className+'" data-copy-key="'+key+'"></span>'}
  function applyCopies(){for(const node of app.querySelectorAll('[data-copy-key]'))node.textContent=copySlots.get(node.dataset.copyKey)||''}
  function lastOf(own,match=()=>true){for(let i=own.length-1;i>=0;i--)if(match(own[i]))return own[i];return null}
  function relativeTime(value){const time=Date.parse(value);if(!Number.isFinite(time))return value||'尚无时间';const seconds=Math.round((Date.now()-time)/1000);const future=seconds<0;const amount=Math.abs(seconds);let text;if(amount<60)text=amount+' 秒';else if(amount<3600)text=Math.round(amount/60)+' 分钟';else if(amount<86400)text=Math.round(amount/3600)+' 小时';else text=Math.round(amount/86400)+' 天';return future?text+'后':text+'前'}
  function agentFor(ticket,role){const related=recordsForTicket(ticket).filter(r=>r.scope?.role===role&&Number.isSafeInteger(r.scope?.attempt));const latest=lastOf(related);if(!latest)return null;const attempt=latest.scope.attempt;const own=related.filter(r=>r.scope.attempt===attempt);return{ticket,role,attempt,own,key:'agent:'+ticket+':'+role,last:lastOf(own)?.observedAt}}
  function batchForTicket(ticket){return lastOf(recordsForTicket(ticket),r=>Number.isSafeInteger(r.scope?.batch))?.scope.batch}
  function mergerFor(ticket){const batch=batchForTicket(ticket);if(!Number.isSafeInteger(batch))return null;const timeline=records.filter(r=>r.scope?.batch===batch&&r.scope?.role==='merger');if(!timeline.length)return null;const attempt=lastOf(timeline,r=>Number.isSafeInteger(r.scope?.attempt))?.scope.attempt;const own=Number.isSafeInteger(attempt)?timeline.filter(r=>r.scope?.attempt===attempt):timeline;return{ticket,role:'merger',batch,attempt,own,timeline,key:'agent:'+ticket+':merger',last:lastOf(own)?.observedAt}}
  function summaryOf(own){const ended=lastOf(own,r=>r.kind==='role-end');if(ended&&ended.payload?.error)return ended.payload.error;if(lastOf(own,r=>r.kind==='invocation-started'))return 'Invocation 已开始；等待后续事实';if(lastOf(own,r=>r.kind==='attempt-planned'))return 'Attempt 已计划；尚无真实 Invocation';return '尚无可显示摘要'}
  function cardSummary(agent){return summaryOf(agent.own)}
  function tone(value){return ['running','ended','planned'].includes(value)?value:'none'}
  function renderAgentSignals(own){const f=facets(own);return '<span class="agent-signals"><span class="signal tone-'+tone(f.process)+'">Process · '+esc(f.process)+'</span></span>'}
  function registerTarget(key,target){viewTargets.set(key,target);return key}
  function renderLaneAgent(agent,ticket){if(!agent)return renderEmpty('尚未派发');const key=registerTarget(agent.key,{type:agent.role==='merger'?'merger':'agent',ticket,role:agent.role,attempt:agent.attempt,batch:agent.batch,records:agent.timeline||agent.own,summary:cardSummary(agent)});const title=agent.role==='merger'?'Merger · Batch '+agent.batch:(roleLabel(agent.role)+' · 第 '+agent.attempt+' 次 Attempt');const attemptText=agent.role==='merger'&&!Number.isSafeInteger(agent.attempt)?' · 尚无真实 Attempt':'';return '<button class="lane-agent" type="button" data-select-key="'+esc(key)+'" aria-label="工单 #'+esc(ticket)+'，'+esc(title+attemptText)+'，选择 Inspector" aria-pressed="'+(selectedKey===key)+'" aria-controls="output-panel"><span class="agent-top"><strong>'+esc(title+attemptText)+'</strong><time class="agent-time" datetime="'+esc(agent.last||'')+'">'+esc(relativeTime(agent.last))+'</time></span>'+copy(cardSummary(agent),'agent-summary')+renderAgentSignals(agent.own)+'</button>'}
  function renderEmpty(text){return '<div class="empty-stage" aria-label="推导展示态：'+esc(text)+'">'+esc(text)+'</div>'}
  function renderMergerResult(ticket){const record=mergerResultFor(ticket);if(!record)return '';const item=record.payload;const detail='merged='+item.merged+' verified='+item.verified+' closed='+item.closed;return '<div class="delivery-result"><strong>Merger 逐票结果 · '+esc(ticketOutcome(ticket))+'</strong>'+copy(detail,'delivery-copy')+'</div>'}
  function renderMergerCell(reviewer,merger,ticket){if(merger)return renderLaneAgent(merger,ticket)+renderMergerResult(ticket);if(reviewer)return renderEmpty('等待 Merger 派发')+renderMergerResult(ticket);return renderEmpty('等待 Reviewer')+renderMergerResult(ticket)}
  function stageSummary(implementer,reviewer,merger,ticket){const outcome=ticketOutcome(ticket);if(outcome!=='none')return 'Merger · '+outcome;if(merger)return 'Merger / 交付';if(reviewer)return 'Reviewer · Attempt '+reviewer.attempt;if(implementer)return 'Implementer · Attempt '+implementer.attempt;if(recordsForTicket(ticket).some(r=>String(r.kind).startsWith('recovery-')))return 'Recovery';return '等待阶段 Observation'}
  function reviewerEmpty(implementer){if(!implementer)return renderEmpty('尚未派发');return renderEmpty('等待 Reviewer 派发')}
  function renderKanban(ids){if(!ids.length)return '<section class="panel board-panel" aria-labelledby="kanban-heading"><div class="panel-heading"><h2 id="kanban-heading">Ticket Kanban</h2><small>Implementer → Reviewer → Merger</small></div><div class="empty-board">等待 Ticket observation…</div></section>';const rows=ids.map(ticket=>{const implementer=agentFor(ticket,'implementer');const reviewer=agentFor(ticket,'reviewer');const merger=mergerFor(ticket);const ticketKey=registerTarget('ticket:'+ticket,{type:'ticket',ticket,records:recordsForTicket(ticket),summary:'Recovery → Merger 完整时间线'});return '<div class="ticket-lane" role="row" aria-label="工单 #'+esc(ticket)+'"><div class="lane-ticket" role="rowheader"><button class="ticket-button" type="button" data-select-key="'+esc(ticketKey)+'" aria-label="工单 #'+esc(ticket)+'，查看 Recovery 到 Merger 完整时间线" aria-pressed="'+(selectedKey===ticketKey)+'" aria-controls="output-panel"><strong>#'+esc(ticket)+'</strong><small>阶段展示态 · '+esc(stageSummary(implementer,reviewer,merger,ticket))+'</small></button></div><div class="lane-cell" role="cell" data-stage="Implementer">'+renderLaneAgent(implementer,ticket)+'</div><div class="lane-cell" role="cell" data-stage="Reviewer">'+(reviewer?renderLaneAgent(reviewer,ticket):reviewerEmpty(implementer))+'</div><div class="lane-cell" role="cell" data-stage="Merger">'+renderMergerCell(reviewer,merger,ticket)+'</div></div>'}).join('');return '<section class="panel board-panel" aria-labelledby="kanban-heading"><div class="panel-heading"><h2 id="kanban-heading">Ticket Kanban</h2><small>'+ids.length+' 条工单 · Implementer → Reviewer → Merger</small></div><div class="kanban-scroll" role="table" aria-label="按工单划分的 Agent 交付流水线"><div class="lane-head" role="row"><div role="columnheader">工单</div><div role="columnheader">Implementer</div><div role="columnheader">Reviewer</div><div role="columnheader">Merger</div></div>'+rows+'</div></section>'}
  function targetTitle(target){if(!target)return 'Run Observation Inspector';if(target.type==='ticket')return 'Ticket #'+target.ticket+' · 完整时间线';if(target.type==='merger')return 'Batch '+target.batch+' · 逻辑 Merger Inspector';return 'Ticket #'+target.ticket+' · '+roleLabel(target.role)+' · Attempt '+target.attempt}
  function targetDescription(target){if(!target)return '全部 Observation · 未选择 Ticket 或 Agent';if(target.type==='ticket')return 'Recovery → Implementer → Reviewer → Merger；只显示该 Ticket 的完整 Observation 时间线';if(target.type==='merger'){const tickets=[...new Set(target.records.flatMap(recordTickets))].sort((a,b)=>a-b);return '共享 batch-level 对象 · 引用 Ticket '+tickets.map(id=>'#'+id).join(', ')+' · 每次真实 Attempt / Invocation 按 seq 展示'}return '独立 Agent Attempt · '+roleLabel(target.role)+' / Ticket #'+target.ticket+' / Attempt '+target.attempt}
  function invocationSummary(target){if(target?.type!=='merger')return '';const started=target.records.filter(r=>r.kind==='invocation-started'&&Number.isSafeInteger(r.scope?.invocation));const planned=target.records.filter(r=>r.kind==='attempt-planned'&&Number.isSafeInteger(r.scope?.attempt));const invocations=started.map(r=>'Attempt '+r.scope.attempt+' / Invocation '+r.scope.invocation).join(' → ');return '<div class="invocations">真实 Merger Attempt：'+esc([...new Set(planned.map(r=>r.scope.attempt))].join(', ')||'尚无')+' · Invocation 顺序：'+esc(invocations||'尚无真实 Invocation')+'</div>'}
  function batchDeliveries(target){if(target?.type!=='merger')return '';const latest=new Map;for(const record of target.records)if(record.kind==='merger-result'&&Number.isSafeInteger(record.scope?.ticket))latest.set(record.scope.ticket,record);if(!latest.size)return '<div class="batch-deliveries">Merger 逐票结果：尚无 Observation</div>';return '<div class="batch-deliveries" aria-label="Batch 逐票 Merger 结果">'+[...latest.entries()].sort((a,b)=>a[0]-b[0]).map(([ticket,record])=>'<span class="batch-delivery"><strong>#'+esc(ticket)+' · '+esc(ticketOutcome(ticket))+'</strong> · '+copy('merged='+record.payload.merged+' verified='+record.payload.verified+' closed='+record.payload.closed,'batch-delivery-copy')+'</span>').join('')+'</div>'}
  function renderOutputLines(rows){if(!rows.length)return '<div class="output-empty">尚未观察到输出；不据此推断 Agent 卡死或业务完成。</div>';return '<ol class="log" id="log" role="log" aria-live="off" aria-relevant="additions" aria-label="选中对象的 Observation 时间线">'+rows.map(r=>'<li class="line"><span class="seq">#'+esc(r.seq)+'</span><span class="kind">'+esc(r.source)+' / '+esc(r.kind)+(r.scope?'<span class="scope">'+esc(scopeLabel(r.scope))+'</span>':'')+'</span>'+copy(r.text!==undefined?r.text:renderPayload(r.payload),'payload')+'</li>').join('')+'</ol>'}
  function renderInspector(target){const own=visibleRecords(target);const f=facets(own);const statusValue=target?.type==='merger'?'逐票见下方':(target?.type==='ticket'?ticketOutcome(target.ticket):f.process);return '<section class="panel inspector-panel" id="output-panel" aria-labelledby="output-title"><div class="panel-heading"><div><h2 id="output-title">'+esc(targetTitle(target))+'</h2><small>Selected Agent Output Inspector · 进程事实与 Merger 逐票结果</small></div><button class="plain" type="button" data-follow-toggle aria-pressed="'+follow+'">Follow tail</button></div><div class="identity">'+esc(targetDescription(target))+'</div><div class="facts" aria-label="观测事实"><div class="fact"><span>Process</span><strong>'+esc(f.process)+'</strong></div><div class="fact"><span>Merger 结果</span><strong>'+esc(statusValue)+'</strong></div></div><div class="inspector-body">'+invocationSummary(target)+batchDeliveries(target)+'<div class="output-scroll" tabindex="0">'+renderOutputLines(foldLines(own))+'</div></div></section>'}
  function captureViewState(){const active=document.activeElement;const scroll=app.querySelector('.output-scroll');const board=app.querySelector('.kanban-scroll');let focus=null;if(active&&app.contains(active)){if(active.dataset.selectKey)focus={type:'select',value:active.dataset.selectKey};else if(active.matches('[data-follow-toggle]'))focus={type:'follow'};else if(active.matches('.output-scroll'))focus={type:'output'}}return{focus,scrollTop:scroll?.scrollTop||0,boardTop:board?.scrollTop||0,boardLeft:board?.scrollLeft||0}}
  function restoreFocus(token){if(!token)return;let target=null;if(token.type==='select')target=[...app.querySelectorAll('[data-select-key]')].find(node=>node.dataset.selectKey===token.value);else if(token.type==='follow')target=app.querySelector('[data-follow-toggle]');else if(token.type==='output')target=app.querySelector('.output-scroll');target?.focus({preventScroll:true})}
  function render(){const view=captureViewState();copyIndex=0;copySlots=new Map;viewTargets=new Map;const map=entries();const ids=[...map.keys()].sort((a,b)=>a-b);const board=renderKanban(ids);const target=viewTargets.get(selectedKey)||null;app.setAttribute('aria-busy','true');app.innerHTML=board+renderInspector(target);applyCopies();app.setAttribute('aria-busy','false');restoreFocus(view.focus);window.requestAnimationFrame(()=>{const board=app.querySelector('.kanban-scroll');if(board){board.scrollTop=view.boardTop;board.scrollLeft=view.boardLeft}const scroll=app.querySelector('.output-scroll');if(scroll)scroll.scrollTop=follow?scroll.scrollHeight:view.scrollTop})}
  function ingest(r){if(!Number.isSafeInteger(r.seq)||r.seq<=last)return;last=r.seq;records.push(r);render()}
  function setFollow(next){follow=next;app.querySelector('[data-follow-toggle]')?.setAttribute('aria-pressed',String(follow));if(follow){const scroll=app.querySelector('.output-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight}}
  app.addEventListener('click',event=>{const selectable=event.target.closest('[data-select-key]');if(selectable){selectedKey=selectable.dataset.selectKey;render();return}const toggle=event.target.closest('[data-follow-toggle]');if(toggle)setFollow(!follow)});
  app.addEventListener('keydown',event=>{if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;const current=event.target.closest('[data-select-key]');if(!current)return;const items=[...app.querySelectorAll('[data-select-key]')];const index=items.indexOf(current);if(index<0)return;event.preventDefault();items[Math.min(items.length-1,Math.max(0,index+(event.key==='ArrowDown'?1:-1)))].focus()});
  app.addEventListener('scroll',event=>{if(!event.target.matches('.output-scroll'))return;const scroll=event.target;if(scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight>40)setFollow(false)},{capture:true,passive:true});
  function showCompleteness(state){const root=document.querySelector('#warning');root.replaceChildren();if(!state||state.completeness==='complete')return;const warning=document.createElement('div');warning.className='warning';warning.textContent='degraded / incomplete：'+(state.reason||'Observation history 不完整');root.replaceChildren(warning)}
  function loadSnapshot(){const t=new URLSearchParams(location.search).get('token');return fetch('./snapshot?token='+encodeURIComponent(t)).then(response=>response.json()).then(value=>{records=value.observations;last=records.reduce((max,r)=>Math.max(max,Number(r.seq)||0),0);showCompleteness(value.completeness);document.querySelector('#state').textContent=value.final?'final · frozen':'replay';render()}).catch(()=>{document.querySelector('#state').textContent='stale · snapshot unavailable';render()})}
  function connect(){const t=new URLSearchParams(location.search).get('token');const es=new EventSource('./events?token='+encodeURIComponent(t)+'&after='+last);es.onopen=()=>document.querySelector('#state').textContent='live · '+${escJson(run)};es.onmessage=event=>{document.querySelector('#state').textContent='live · '+${escJson(run)};ingest(JSON.parse(event.data))};es.addEventListener('final',()=>{document.querySelector('#state').textContent='final · frozen';es.close()});es.onerror=()=>document.querySelector('#state').textContent='stale · reconnecting'}
  if(initial){records=initial.observations;last=records.reduce((max,r)=>Math.max(max,Number(r.seq)||0),0);document.querySelector('#state').textContent=initial.final?'final · frozen':'replay';showCompleteness(initial.completeness);render()}else loadSnapshot().then(connect);
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
