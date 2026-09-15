export const escJson = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
export const escHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// B2 信息架构：桌面端左侧 Ticket Kanban，右侧 selected Agent Output Inspector；
// 窄屏顺序堆叠并保持同一信息层级。仅排版 transport envelope，payload 原样渲染。
export function page(run, data = null) {
  const initial = data ? escJson(data) : 'null';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>AFK Dashboard</title><style>
  :root{color-scheme:light;--ink:#15202b;--muted:#586875;--quiet:#71808b;--line:#c7d1d9;--line-strong:#9eacb7;--panel:#fff;--soft:#f5f8fa;--head:#29445d;--blue:#087ea4;--cyan:#dff4f7;--green:#176b49;--amber:#8a5200;--red:#a42921;--violet:#684b7b;--console:#0b1924;--console-2:#132737;--console-line:#385267;--console-text:#dce8ee;--console-muted:#93a9b7}
  *{box-sizing:border-box}html,body{width:100%;max-width:100%;margin:0;overflow-x:hidden}body{min-width:0;font:14px/1.45 system-ui,sans-serif;background:#eef2f5;color:var(--ink)}button{font:inherit}header{min-width:0;padding:14px 18px;background:#17324a;color:#fff}header h1{margin:0;font-size:18px}.state{margin-top:3px;font:12px/1.4 ui-monospace,monospace;overflow-wrap:anywhere}.warning{padding:8px 18px;background:#fff0c2;color:#713f12;overflow-wrap:anywhere}.layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.85fr);gap:12px;width:100%;max-width:100%;height:calc(100vh - 70px);padding:12px}.panel{min-width:0;min-height:0;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:8px}.panel-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0;padding:10px 12px;background:#f8fafb;border-bottom:1px solid #d6dde2}.panel-heading h2{margin:0;font-size:14px}.panel-heading small{min-width:0;color:var(--muted);font-size:11px;text-align:right;overflow-wrap:anywhere}.board-panel{display:grid;grid-template-rows:auto minmax(0,1fr)}.kanban-scroll{min-width:0;overflow:auto}.lane-head,.ticket-lane{display:grid;grid-template-columns:minmax(88px,105px) repeat(3,minmax(0,1fr));min-width:0}.lane-head{position:sticky;z-index:2;top:0;color:#eef8fc;background:var(--head);font-size:10px;font-weight:800;letter-spacing:.04em}.lane-head>div,.ticket-lane>div{min-width:0;padding:9px;border-right:1px solid var(--line)}.lane-head>div{border-right-color:#526b80}.lane-head>div:last-child,.ticket-lane>div:last-child{border-right:0}.ticket-lane{border-bottom:1px solid var(--line)}.ticket-lane:last-child{border-bottom:0}.lane-ticket{display:flex;align-items:stretch;padding:0!important;background:#e4ebef}.ticket-button,.lane-agent{width:100%;min-width:0;color:var(--ink);background:transparent;border:0;cursor:pointer;text-align:left}.ticket-button{display:flex;flex-direction:column;justify-content:center;padding:10px}.ticket-button strong{font:800 16px ui-monospace,monospace}.ticket-button small{margin-top:4px;color:var(--muted);font-size:10px;overflow-wrap:anywhere}.ticket-button[aria-pressed="true"]{background:#d9f0f4;box-shadow:inset 4px 0 0 var(--blue)}.lane-cell{min-height:126px;background:rgba(255,255,255,.6)}.lane-agent{display:block;min-height:94px;padding:9px;background:#fff;border:1px solid var(--line);border-radius:5px}.lane-agent:hover,.ticket-button:hover{background:#f0f9fb}.lane-agent[aria-pressed="true"]{border-color:var(--blue);background:var(--cyan);box-shadow:inset 0 0 0 2px rgba(8,126,164,.18)}.lane-agent[aria-pressed="true"]::after,.ticket-button[aria-pressed="true"]::after{content:"SELECTED";display:block;margin-top:6px;color:var(--blue);font:800 8px ui-monospace,monospace;letter-spacing:.1em}.ticket-button:focus-visible,.lane-agent:focus-visible,.plain:focus-visible,.output-scroll:focus-visible{position:relative;z-index:3;outline:3px solid #087ea4;outline-offset:2px}.agent-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.agent-top strong{min-width:0;font-size:11px;overflow-wrap:anywhere}.agent-time{flex:none;color:var(--quiet);font:9px ui-monospace,monospace;white-space:nowrap}.agent-summary{display:block;margin-top:7px;color:var(--muted);font-size:10px;overflow-wrap:anywhere}.agent-signals{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.signal{display:inline-flex;min-width:0;padding:2px 4px;border:1px solid currentColor;border-radius:3px;font:700 8px/1.25 ui-monospace,monospace;overflow-wrap:anywhere}.tone-running,.tone-accepted,.tone-complete,.tone-closed{color:var(--green);background:#e8f6f0}.tone-ended,.tone-planned,.tone-merged-unverified,.tone-verified{color:var(--blue);background:#e5f3f7}.tone-none,.tone-waiting{color:var(--quiet);background:#f0f3f5}.tone-rejected,.tone-blocked,.tone-failed{color:var(--red);background:#ffebe8}.tone-passed{color:var(--violet);background:#f0eaf5}.empty-stage{display:grid;place-items:center;min-height:94px;padding:10px;color:var(--quiet);border:1px dashed var(--line-strong);font-size:10px;text-align:center;overflow-wrap:anywhere}.empty-stage::after{content:"推导展示态";display:block;margin-top:5px;color:#87939c;font:700 8px ui-monospace,monospace;letter-spacing:.05em}.merger-result-card{margin-top:7px;padding:6px 7px;color:var(--muted);background:#f3f6f8;border-left:3px solid var(--blue);font-size:9px;overflow-wrap:anywhere}.merger-result-card strong{display:block;color:var(--ink);font-size:9px}.inspector-panel{display:grid;grid-template-rows:auto auto auto minmax(0,1fr);color:var(--console-text);background:var(--console);border-color:var(--console-line)}.inspector-panel .panel-heading{align-items:center;color:#fff;background:var(--console-2);border-color:var(--console-line)}.inspector-panel .panel-heading small{color:#b4c6d1}.plain{flex:none;padding:5px 8px;color:#dce8ee;background:#173247;border:1px solid #527085;border-radius:4px;cursor:pointer;font-size:10px}.plain[aria-pressed="true"]{color:#071820;background:#8fdde5;border-color:#8fdde5}.identity{min-width:0;padding:9px 12px;color:#b8cad5;background:#10202d;border-bottom:1px solid var(--console-line);font:11px/1.45 ui-monospace,monospace;overflow-wrap:anywhere}.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#10202d;border-bottom:1px solid var(--console-line)}.fact{min-width:0;padding:7px 8px;border-right:1px solid var(--console-line)}.fact:last-child{border-right:0}.fact span{display:block;color:var(--console-muted);font-size:11px}.fact strong{display:block;margin-top:3px;color:#edf6fa;font:700 13px/1.3 ui-monospace,monospace;overflow-wrap:anywhere}.inspector-body{display:flex;min-width:0;min-height:0;flex-direction:column}.invocations{flex:none;padding:7px 12px;color:#b8cad5;background:#10202d;border-bottom:1px solid var(--console-line);font:9px/1.45 ui-monospace,monospace;overflow-wrap:anywhere}.batch-merger-results{display:flex;flex:none;flex-wrap:wrap;gap:5px;padding:7px 12px;color:#b8cad5;background:#10202d;border-bottom:1px solid var(--console-line);font:9px/1.4 ui-monospace,monospace}.batch-merger-result{min-width:0;padding:3px 5px;border:1px solid var(--console-line);overflow-wrap:anywhere}.batch-merger-result strong{color:#edf6fa}.output-scroll{min-width:0;min-height:0;flex:1;overflow:auto;overscroll-behavior:contain}.log{min-width:0;margin:0;padding:0;list-style:none;font:11px/1.5 ui-monospace,monospace}.line{display:grid;grid-template-columns:54px minmax(125px,190px) minmax(0,1fr);min-width:0;border-bottom:1px solid rgba(66,92,111,.6)}.line>*{min-width:0;padding:7px 8px}.seq{color:#7892a3;text-align:right}.kind{color:#a9dce8;border-right:1px solid rgba(66,92,111,.6);border-left:1px solid rgba(66,92,111,.6);overflow-wrap:anywhere}.scope{display:block;margin-top:3px;color:#91a9b9;font-size:9px}.payload{color:var(--console-text);white-space:pre-wrap;overflow-wrap:anywhere}.output-empty{padding:30px 16px;color:var(--console-muted);text-align:center}.empty-board{padding:36px 18px;color:var(--muted);text-align:center}.truncated-note{flex:none;margin:0;padding:6px 12px;color:#b8cad5;background:#10202d;border-bottom:1px solid var(--console-line);font:10px/1.4 ui-monospace,monospace;overflow-wrap:anywhere}
  @media(max-width:1000px){.layout{grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr)}.lane-head,.ticket-lane{grid-template-columns:88px repeat(3,minmax(0,1fr))}.lane-head>div,.ticket-lane>div{padding:7px}.lane-cell{min-height:116px}.signal{font-size:7px}}
  @media(max-width:760px){header{padding:12px 13px}.warning{padding:8px 13px}.layout{display:flex;flex-direction:column;height:auto;padding:10px;overflow:visible}.panel{width:100%;max-width:100%}.board-panel{display:block}.kanban-scroll{overflow:visible}.lane-head{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.ticket-lane{display:grid;grid-template-columns:minmax(0,1fr);width:auto;min-width:0;margin:8px;border:1px solid var(--line);border-radius:6px;overflow:hidden}.ticket-lane>div{border-right:0;border-bottom:1px solid var(--line)}.ticket-lane>div:last-child{border-bottom:0}.lane-ticket{min-height:58px}.lane-cell{position:relative;min-height:0;padding:29px 8px 8px!important}.lane-cell::before{content:attr(data-stage);position:absolute;top:8px;left:9px;color:var(--quiet);font-size:9px;font-weight:800;letter-spacing:.05em}.lane-agent,.empty-stage{min-height:78px}.inspector-panel{min-height:620px;height:78vh}.line{grid-template-columns:48px minmax(0,1fr)}.seq{grid-row:1 / span 2}.kind{border-right:0}.payload{grid-column:2}.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.fact:nth-child(2n){border-right:0}.fact:nth-child(-n+2){border-bottom:1px solid var(--console-line)}}
  @media(max-width:390px){.layout{padding:8px}.panel-heading{align-items:flex-start;flex-direction:column;gap:5px}.panel-heading small{text-align:left}.inspector-panel .panel-heading{align-items:stretch}.plain{align-self:flex-start}.ticket-lane{margin:7px}.agent-top{display:block}.agent-time{display:block;margin-top:3px;white-space:normal}.signal{max-width:100%}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  </style></head><body><header><h1>AFK Run Dashboard</h1><div class="state" id="state">连接中 · ${escHtml(run)}</div></header><div id="warning"></div><main class="layout" id="app" aria-busy="true"><section class="panel board-panel" aria-labelledby="kanban-heading"><div class="panel-heading"><h2 id="kanban-heading">Ticket Kanban</h2><small>加载 snapshot…</small></div><div class="empty-board">正在加载 snapshot（仅取尾部），看板稍后呈现…</div></section><section class="panel inspector-panel" id="output-panel" aria-labelledby="output-title"><div class="panel-heading"><div><h2 id="output-title">Run Observation Inspector</h2><small>Selected Agent Output Inspector · 进程事实与 Merger 逐票结果</small></div><button class="plain" type="button" data-follow-toggle aria-pressed="true">Follow tail</button></div><div class="output-scroll" tabindex="0"><div class="output-empty">正在加载 snapshot（仅取尾部），输出稍后呈现…</div></div></section></main><script>
  const initial=${initial};let records=[],selectedKey=null,last=0,follow=true,copyIndex=0,copySlots=new Map(),viewTargets=new Map();
  // 有界渲染：Inspector 最多保留 VIEW_LIMIT 个 <li>；records 数组最多保留
  // STORE_LIMIT 条（仅供 Inspector 行过滤），看板展示态走 summaries（见下）。
  const VIEW_LIMIT=500,STORE_LIMIT=2000;
  // hiddenBefore：records[0] 之前被服务端截断掉的条数（snapshot.truncatedFrom
  // 语义：返回首条 seq；seq 从 1 连续编号时 hiddenBefore = truncatedFrom-1）。
  // domHidden：当前 Inspector 视图因 DOM 裁剪未显示的条数（全量 render 时重置）。
  let hiddenBefore=0,domHidden=0,storeTrimmed=0;
  const app=document.querySelector('#app');
  const renderPayload=p=>{if(typeof p==='string')return p;const value=JSON.stringify(p,null,2);return value===undefined?String(p):value};
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=role=>({implementer:'Implementer',reviewer:'Reviewer',merger:'Merger'}[role]||role||'Unknown');
  const recordTickets=r=>{const values=[];if(Number.isSafeInteger(r.scope?.ticket))values.push(r.scope.ticket);if(Array.isArray(r.scope?.tickets))for(const id of r.scope.tickets)if(Number.isSafeInteger(id)&&!values.includes(id))values.push(id);return values};
  // ---- 每票状态摘要：snapshot 与每条 ingest 增量维护，不依赖 records 全量数组。
  // 只记录推导展示态所需的最小事实：每角色最新 attempt 的 process 态与摘要、
  // merger batch/attempt、逐票 merger-result、是否有 recovery 记录。
  // records 被截断（尾部窗口）只影响 Inspector 行渲染，不影响看板推导，故不失真。
  let summaries=new Map(),batchInfo=new Map();
  function blankSummary(){return{last:null,hasRecovery:false,agents:{},merger:null,batch:null,result:null}}
  // isBackfill=true 只补旧记录：所有覆写带 seq 守卫，旧记录永不覆盖
  // 已观测到的新状态（ingest 先行、backfill 后到是常态）。
  function observe(r,isBackfill){
    const seq=Number.isSafeInteger(r.seq)?r.seq:-1;
    for(const id of recordTickets(r)){
      let s=summaries.get(id);if(!s){s=blankSummary();summaries.set(id,s)}
      if(!isBackfill){s.last=r.observedAt||s.last}
      if(typeof r.kind==='string'&&r.kind.startsWith('recovery-'))s.hasRecovery=true;
      const sc=r.scope||{};
      if((sc.role==='implementer'||sc.role==='reviewer')&&Number.isSafeInteger(sc.attempt)){
        const cur=s.agents[sc.role];
        if(!cur||sc.attempt>cur.attempt)s.agents[sc.role]={attempt:sc.attempt,process:'none',summary:'尚无可显示摘要',last:null,procAt:null,procSeq:-1,lastSeq:-1};
        const a=s.agents[sc.role];
        if(sc.attempt===a.attempt){
          if(r.kind==='attempt-planned'||r.kind==='invocation-started'||r.kind==='role-end'){
            if(seq>=a.procSeq){a.procSeq=seq;a.process=r.kind==='attempt-planned'?'planned':r.kind==='invocation-started'?'running':'ended';a.summary=r.kind==='attempt-planned'?'Attempt 已计划；尚无真实 Invocation':r.kind==='invocation-started'?'Invocation 已开始；等待后续事实':((r.payload&&r.payload.error)||'尚无可显示摘要');a.procAt=r.observedAt||a.procAt}
          }
          if(seq>=a.lastSeq){a.lastSeq=seq;a.last=r.observedAt||a.last}
        }
      }
      if(Number.isSafeInteger(sc.batch)&&seq>=(s.batchSeq??-1)){s.batchSeq=seq;s.batch=sc.batch}
      if(sc.role==='merger'&&Number.isSafeInteger(sc.batch)){
        if(!s.merger||sc.batch>s.merger.batch)s.merger={batch:sc.batch,attempt:null,process:'none',summary:'尚无可显示摘要',last:null,procAt:null,procSeq:-1,lastSeq:-1};
        const m=s.merger;
        if(sc.batch===m.batch){
          if(Number.isSafeInteger(sc.attempt)){
            if(m.attempt===null||sc.attempt>m.attempt){m.attempt=sc.attempt;m.process='none';m.summary='尚无可显示摘要';m.procAt=null;m.procSeq=-1}
            if(sc.attempt===m.attempt&&(r.kind==='attempt-planned'||r.kind==='invocation-started'||r.kind==='role-end')){
              if(seq>=m.procSeq){m.procSeq=seq;m.process=r.kind==='attempt-planned'?'planned':r.kind==='invocation-started'?'running':'ended';m.summary=r.kind==='attempt-planned'?'Attempt 已计划；尚无真实 Invocation':r.kind==='invocation-started'?'Invocation 已开始；等待后续事实':((r.payload&&r.payload.error)||'尚无可显示摘要');m.procAt=r.observedAt||m.procAt}
            }
          }
          if(seq>=m.lastSeq){m.lastSeq=seq;m.last=r.observedAt||m.last}
        }
      }
      if(r.kind==='merger-result'&&Number.isSafeInteger(sc.ticket)&&seq>=(s.resultSeq??-1)){s.resultSeq=seq;s.result={merged:!!r.payload?.merged,verified:!!r.payload?.verified,closed:!!r.payload?.closed}}
    }
    const sc=r.scope||{};
    if(sc.role==='merger'&&Number.isSafeInteger(sc.batch)){
      let b=batchInfo.get(sc.batch);if(!b){b={attempts:[],invocations:[]};batchInfo.set(sc.batch,b)}
      if(r.kind==='attempt-planned'&&Number.isSafeInteger(sc.attempt)&&!b.attempts.includes(sc.attempt))b.attempts.push(sc.attempt);
      if(r.kind==='invocation-started'&&Number.isSafeInteger(sc.attempt)&&Number.isSafeInteger(sc.invocation)){const t='Attempt '+sc.attempt+' / Invocation '+sc.invocation;if(!b.invocations.includes(t))b.invocations.push(t)}
    }
  }
  function rebuildSummaries(){summaries=new Map();batchInfo=new Map();for(const r of records)observe(r)}
  function ticketIds(){return[...summaries.keys()].sort((a,b)=>a-b)}
  // 用摘要合成最小 own 数组，仅供 facets()/summaryOf() 做末态查找；
  // 合成数组与真实历史的末态一致，因此展示态与全量推导相同。
  function synthOwn(process,summary,at){const out=[];const mk=(kind,payload)=>({kind,payload,observedAt:at});if(process==='planned'||process==='running'||process==='ended')out.push(mk('attempt-planned'));if(process==='running'||process==='ended')out.push(mk('invocation-started'));if(process==='ended')out.push(mk('role-end',summary&&summary!=='尚无可显示摘要'?{error:summary}:{}));return out}
  // 属于同一逻辑行的 text delta 实时追加；遇到换行冻结该行并开始新行。
  // 对已合并的多 token 行同样成立：只做字符串拼接与按 \\n 切分，不假设单 token。
  function foldLines(list){const out=[];for(const r of list){if(r.kind==='text-delta'&&typeof r.payload?.text==='string'){const prev=out.at(-1);if(prev&&prev.kind==='text-delta'&&prev.scope?.invocation===r.scope?.invocation&&!prev.frozen){prev.text+=r.payload.text;prev.seq=r.seq;if(prev.text.includes('\\n')){const parts=prev.text.split('\\n');prev.text=parts.slice(0,-1).join('\\n');prev.frozen=true;out.push({...prev,seq:r.seq,text:parts.at(-1),frozen:false,cont:true})}continue}out.push({...r,text:r.payload.text,frozen:false})}else out.push(r)}return out}
  function scopeLabel(s){if(!s)return '';const parts=[];if(s.role)parts.push(roleLabel(s.role));if(Number.isSafeInteger(s.attempt))parts.push('Attempt '+s.attempt);if(Number.isSafeInteger(s.invocation))parts.push('Invocation '+s.invocation);if(Number.isSafeInteger(s.batch))parts.push('Batch '+s.batch);if(Number.isSafeInteger(s.ticket))parts.push('#'+s.ticket);else if(Array.isArray(s.tickets)&&s.tickets.length)parts.push(s.tickets.map(id=>'#'+id).join(', '));return parts.join(' · ')}
  // 可观测事实只有三类：进程生命周期、provider 原始输出、Recovery 与
  // Merger 逐票结果。进程存活不代表有效工作，Role 退出不代表已交付；
  // 看板逐票状态只从 Merger 逐票结果推导，不再有自创判定层。
  function layerOf(own,match){for(let i=own.length-1;i>=0;i--){const r=own[i];if(match(r))return r}return null}
  function facets(own){const proc=layerOf(own,r=>r.kind==='attempt-planned'||r.kind==='invocation-started'||r.kind==='role-end');return{process:proc?(proc.kind==='attempt-planned'?'planned':proc.kind==='invocation-started'?'running':'ended'):'none'}}
  // 逐票 Merger 结果：摘要里记的是该票最新 merger-result，不依赖尾部窗口。
  function mergerResultFor(ticket){return summaries.get(ticket)?.result||null}
  function ticketOutcome(ticket){const item=mergerResultFor(ticket);if(!item)return'none';if(item.closed)return'closed';if(item.merged)return item.verified?'verified':'merged-unverified';return'blocked'}
  function copy(value,className){const key=String(++copyIndex);copySlots.set(key,value==null?'':String(value));return '<span class="'+className+'" data-copy-key="'+key+'"></span>'}
  // 只填充 root 内尚未填充的 [data-copy-key] 节点（新增节点），不碰已填充节点。
  function fillCopies(root){for(const node of root.querySelectorAll('[data-copy-key]:not([data-copy-filled])')){node.textContent=copySlots.get(node.dataset.copyKey)||'';node.setAttribute('data-copy-filled','1')}}
  function applyCopies(){fillCopies(app)}
  function lastOf(own,match=()=>true){for(let i=own.length-1;i>=0;i--)if(match(own[i]))return own[i];return null}
  function relativeTime(value){const time=Date.parse(value);if(!Number.isFinite(time))return value||'尚无时间';const seconds=Math.round((Date.now()-time)/1000);const future=seconds<0;const amount=Math.abs(seconds);let text;if(amount<60)text=amount+' 秒';else if(amount<3600)text=Math.round(amount/60)+' 分钟';else if(amount<86400)text=Math.round(amount/3600)+' 小时';else text=Math.round(amount/86400)+' 天';return future?text+'后':text+'前'}
  function agentFor(ticket,role){const a=summaries.get(ticket)?.agents[role];if(!a)return null;const own=synthOwn(a.process,a.summary,a.procAt);return{ticket,role,attempt:a.attempt,own,key:'agent:'+ticket+':'+role,last:a.last}}
  function mergerFor(ticket){const m=summaries.get(ticket)?.merger;if(!m)return null;const own=synthOwn(m.process,m.summary,m.procAt);return{ticket,role:'merger',batch:m.batch,attempt:m.attempt,own,timeline:own,key:'agent:'+ticket+':merger',last:m.last}}
  function summaryOf(own){const ended=lastOf(own,r=>r.kind==='role-end');if(ended&&ended.payload?.error)return ended.payload.error;if(lastOf(own,r=>r.kind==='invocation-started'))return 'Invocation 已开始；等待后续事实';if(lastOf(own,r=>r.kind==='attempt-planned'))return 'Attempt 已计划；尚无真实 Invocation';return '尚无可显示摘要'}
  function cardSummary(agent){return summaryOf(agent.own)}
  function tone(value){return ['running','ended','planned'].includes(value)?value:'none'}
  function renderAgentSignals(own){const f=facets(own);return '<span class="agent-signals"><span class="signal tone-'+tone(f.process)+'">Process · '+esc(f.process)+'</span></span>'}
  function registerTarget(key,target){viewTargets.set(key,target);return key}
  function renderLaneAgent(agent,ticket){if(!agent)return renderEmpty('尚未派发');const key=registerTarget(agent.key,{type:agent.role==='merger'?'merger':'agent',ticket,role:agent.role,attempt:agent.attempt,batch:agent.batch});const title=agent.role==='merger'?'Merger · Batch '+agent.batch:(roleLabel(agent.role)+' · 第 '+agent.attempt+' 次 Attempt');const attemptText=agent.role==='merger'&&!Number.isSafeInteger(agent.attempt)?' · 尚无真实 Attempt':'';return '<button class="lane-agent" type="button" data-select-key="'+esc(key)+'" aria-label="工单 #'+esc(ticket)+'，'+esc(title+attemptText)+'，选择 Inspector" aria-pressed="'+(selectedKey===key)+'" aria-controls="output-panel"><span class="agent-top"><strong>'+esc(title+attemptText)+'</strong><time class="agent-time" datetime="'+esc(agent.last||'')+'">'+esc(relativeTime(agent.last))+'</time></span>'+copy(cardSummary(agent),'agent-summary')+renderAgentSignals(agent.own)+'</button>'}
  function renderEmpty(text){return '<div class="empty-stage" aria-label="推导展示态：'+esc(text)+'">'+esc(text)+'</div>'}
  function renderMergerResult(ticket){const item=mergerResultFor(ticket);if(!item)return '';const detail='merged='+item.merged+' verified='+item.verified+' closed='+item.closed;return '<div class="merger-result-card"><strong>Merger 逐票结果 · '+esc(ticketOutcome(ticket))+'</strong>'+copy(detail,'merger-result-copy')+'</div>'}
  function renderMergerCell(reviewer,merger,ticket){if(merger)return renderLaneAgent(merger,ticket)+renderMergerResult(ticket);if(reviewer)return renderEmpty('等待 Merger 派发')+renderMergerResult(ticket);return renderEmpty('等待 Reviewer')+renderMergerResult(ticket)}
  function hasRecovery(ticket){return !!summaries.get(ticket)?.hasRecovery}
  function stageSummary(implementer,reviewer,merger,ticket){const outcome=ticketOutcome(ticket);if(outcome!=='none')return 'Merger · '+outcome;if(merger)return 'Merger / 交付';if(reviewer)return 'Reviewer · Attempt '+reviewer.attempt;if(implementer)return 'Implementer · Attempt '+implementer.attempt;if(hasRecovery(ticket))return 'Recovery';return '等待阶段 Observation'}
  function reviewerEmpty(implementer){if(!implementer)return renderEmpty('尚未派发');return renderEmpty('等待 Reviewer 派发')}
  function laneHtml(ticket){const implementer=agentFor(ticket,'implementer');const reviewer=agentFor(ticket,'reviewer');const merger=mergerFor(ticket);const ticketKey=registerTarget('ticket:'+ticket,{type:'ticket',ticket});return '<div class="ticket-lane" role="row" data-ticket="'+esc(ticket)+'" aria-label="工单 #'+esc(ticket)+'"><div class="lane-ticket" role="rowheader"><button class="ticket-button" type="button" data-select-key="'+esc(ticketKey)+'" aria-label="工单 #'+esc(ticket)+'，查看 Recovery 到 Merger 完整时间线" aria-pressed="'+(selectedKey===ticketKey)+'" aria-controls="output-panel"><strong>#'+esc(ticket)+'</strong><small>阶段展示态 · '+esc(stageSummary(implementer,reviewer,merger,ticket))+'</small></button></div><div class="lane-cell" role="cell" data-stage="Implementer">'+renderLaneAgent(implementer,ticket)+'</div><div class="lane-cell" role="cell" data-stage="Reviewer">'+(reviewer?renderLaneAgent(reviewer,ticket):reviewerEmpty(implementer))+'</div><div class="lane-cell" role="cell" data-stage="Merger">'+renderMergerCell(reviewer,merger,ticket)+'</div></div>'}
  function renderKanban(ids){if(!ids.length)return '<section class="panel board-panel" aria-labelledby="kanban-heading"><div class="panel-heading"><h2 id="kanban-heading">Ticket Kanban</h2><small>Implementer → Reviewer → Merger</small></div><div class="empty-board">等待 Ticket observation…</div></section>';const rows=ids.map(laneHtml).join('');return '<section class="panel board-panel" aria-labelledby="kanban-heading"><div class="panel-heading"><h2 id="kanban-heading">Ticket Kanban</h2><small>'+ids.length+' 条工单 · Implementer → Reviewer → Merger</small></div><div class="kanban-scroll" role="table" aria-label="按工单划分的 Agent 交付流水线"><div class="lane-head" role="row"><div role="columnheader">工单</div><div role="columnheader">Implementer</div><div role="columnheader">Reviewer</div><div role="columnheader">Merger</div></div>'+rows+'</div></section>'}
  function targetTitle(target){if(!target)return 'Run Observation Inspector';if(target.type==='ticket')return 'Ticket #'+target.ticket+' · 完整时间线';if(target.type==='merger')return 'Batch '+target.batch+' · 逻辑 Merger Inspector';return 'Ticket #'+target.ticket+' · '+roleLabel(target.role)+' · Attempt '+target.attempt}
  function targetDescription(target){if(!target)return '全部 Observation · 未选择 Ticket 或 Agent';if(target.type==='ticket')return 'Recovery → Implementer → Reviewer → Merger；只显示该 Ticket 的完整 Observation 时间线';if(target.type==='merger'){const tickets=[...summaries.entries()].filter(([,s])=>s.batch===target.batch).map(([id])=>id).sort((a,b)=>a-b);return '共享 batch-level 对象 · 引用 Ticket '+tickets.map(id=>'#'+id).join(', ')+' · 每次真实 Attempt / Invocation 按 seq 展示'}return '独立 Agent Attempt · '+roleLabel(target.role)+' / Ticket #'+target.ticket+' / Attempt '+target.attempt}
  function invocationSummary(target){if(target?.type!=='merger')return '';const b=batchInfo.get(target.batch);if(!b)return '<div class="invocations">真实 Merger Attempt：尚无 · Invocation 顺序：尚无真实 Invocation</div>';return '<div class="invocations">真实 Merger Attempt：'+esc([...new Set(b.attempts)].join(', ')||'尚无')+' · Invocation 顺序：'+esc(b.invocations.join(' → ')||'尚无真实 Invocation')+'</div>'}
  function batchDeliveries(target){if(target?.type!=='merger')return '';const latest=[...summaries.entries()].filter(([,s])=>s.batch===target.batch&&s.result).sort((a,b)=>a[0]-b[0]);if(!latest.length)return '<div class="batch-merger-results">Merger 逐票结果：尚无 Observation</div>';return '<div class="batch-merger-results" aria-label="Batch 逐票 Merger 结果">'+latest.map(([ticket,s])=>'<span class="batch-merger-result"><strong>#'+esc(ticket)+' · '+esc(ticketOutcome(ticket))+'</strong> · '+copy('merged='+s.result.merged+' verified='+s.result.verified+' closed='+s.result.closed,'batch-merger-result-copy')+'</span>').join('')+'</div>'}
  // Inspector 行过滤只读有界 records；看板推导不走这里，走 summaries。
  function targetRows(target){if(!target)return records;if(target.type==='ticket')return records.filter(r=>recordTickets(r).includes(target.ticket));if(target.type==='merger')return records.filter(r=>r.scope?.batch===target.batch&&r.scope?.role==='merger');return records.filter(r=>recordTickets(r).includes(target.ticket)&&r.scope?.role===target.role&&r.scope?.attempt===target.attempt)}
  function currentTarget(){return viewTargets.get(selectedKey)||null}
  function matchesTarget(r,target){if(!target)return true;if(target.type==='ticket')return recordTickets(r).includes(target.ticket);if(target.type==='merger')return r.scope?.batch===target.batch&&r.scope?.role==='merger';return recordTickets(r).includes(target.ticket)&&r.scope?.role===target.role&&r.scope?.attempt===target.attempt}
  function lineInner(r){const text=r.text!==undefined?r.text:renderPayload(r.payload);return '<span class="seq">#'+esc(r.seq)+'</span><span class="kind">'+esc(r.source)+' / '+esc(r.kind)+(r.scope?'<span class="scope">'+esc(scopeLabel(r.scope))+'</span>':'')+'</span>'+copy(text,'payload')}
  function lineAttrs(r){if(r.kind==='text-delta'&&typeof r.payload?.text==='string')return ' data-delta="1" data-frozen="'+(r.frozen?'1':'0')+'" data-invocation="'+esc(r.scope?.invocation)+'"';return ''}
  function renderOutputLines(rows,hidden,total){if(!rows.length)return '<div class="output-empty">尚未观察到输出；不据此推断 Agent 卡死或业务完成。</div>';const note=hidden>0?'<p class="truncated-note" id="truncated-note" role="status">更早的 '+esc(hidden)+' 条记录未显示（共 '+esc(total)+' 条，仅显示尾部 '+esc(rows.length)+' 条）</p>':'';return note+'<ol class="log" id="log" role="log" aria-live="off" aria-relevant="additions" aria-label="选中对象的 Observation 时间线">'+rows.map(r=>'<li class="line"'+lineAttrs(r)+'>'+lineInner(r)+'</li>').join('')+'</ol>'}
  // Inspector 头部事实同样走摘要（不依赖有界 records），仅行列表读 records。
  function factsFor(target,rows){if(!target)return{process:facets(rows).process,status:'none'};if(target.type==='ticket')return{process:facets(rows).process,status:ticketOutcome(target.ticket)};if(target.type==='merger')return{process:'none',status:'逐票见下方'};const a=summaries.get(target.ticket)?.agents[target.role];if(a&&a.attempt===target.attempt)return{process:a.process,status:a.process};return{process:facets(rows).process,status:facets(rows).process}}
  function renderInspector(target){const rows=targetRows(target);const tail=rows.slice(-VIEW_LIMIT);const hidden=!target?hiddenBefore+storeTrimmed+rows.length-tail.length:rows.length-tail.length;domHidden=hidden;const f=factsFor(target,rows);const statusValue=f.status;return '<section class="panel inspector-panel" id="output-panel" aria-labelledby="output-title"><div class="panel-heading"><div><h2 id="output-title">'+esc(targetTitle(target))+'</h2><small>Selected Agent Output Inspector · 进程事实与 Merger 逐票结果</small></div><button class="plain" type="button" data-follow-toggle aria-pressed="'+follow+'">Follow tail</button></div><div class="identity">'+esc(targetDescription(target))+'</div><div class="facts" aria-label="观测事实"><div class="fact"><span>Process</span><strong>'+esc(f.process)+'</strong></div><div class="fact"><span>Merger 结果</span><strong>'+esc(statusValue)+'</strong></div></div><div class="inspector-body">'+invocationSummary(target)+batchDeliveries(target)+'<div class="output-scroll" tabindex="0">'+renderOutputLines(foldLines(tail),hidden,!target?hiddenBefore+rows.length:rows.length)+'</div></div></section>'}
  function captureViewState(){const active=document.activeElement;const scroll=app.querySelector('.output-scroll');const board=app.querySelector('.kanban-scroll');let focus=null;if(active&&app.contains(active)){if(active.dataset.selectKey)focus={type:'select',value:active.dataset.selectKey};else if(active.matches('[data-follow-toggle]'))focus={type:'follow'};else if(active.matches('.output-scroll'))focus={type:'output'}}return{focus,scrollTop:scroll?.scrollTop||0,boardTop:board?.scrollTop||0,boardLeft:board?.scrollLeft||0}}
  function restoreFocus(token){if(!token)return;let target=null;if(token.type==='select')target=[...app.querySelectorAll('[data-select-key]')].find(node=>node.dataset.selectKey===token.value);else if(token.type==='follow')target=app.querySelector('[data-follow-toggle]');else if(token.type==='output')target=app.querySelector('.output-scroll');target?.focus({preventScroll:true})}
  // 全量 render 仅用于 snapshot 加载与用户切换选中目标；SSE 增量走 ingest。
  // 渲染内容有界（看板按票数、Inspector 最多 VIEW_LIMIT 行），首屏骨架在
  // 服务端 HTML 里已直出，fetch 返回后一次替换即见内容。
  function render(){const view=captureViewState();viewTargets=new Map;const ids=ticketIds();const board=renderKanban(ids);const target=viewTargets.get(selectedKey)||null;app.setAttribute('aria-busy','true');app.innerHTML=board+renderInspector(target);applyCopies();app.setAttribute('aria-busy','false');restoreFocus(view.focus);window.requestAnimationFrame(()=>{const board=app.querySelector('.kanban-scroll');if(board){board.scrollTop=view.boardTop;board.scrollLeft=view.boardLeft}const scroll=app.querySelector('.output-scroll');if(scroll)scroll.scrollTop=follow?scroll.scrollHeight:view.scrollTop})}
  // ---- SSE 增量路径：只追加 1 个 <li> + 最小更新受影响票道，绝不全量重建。
  function noteText(){return '更早的 '+domHidden+' 条记录未显示（共 '+(hiddenBefore+storeTrimmed+records.length)+' 条，仅显示尾部）'}
  function refreshNote(){const note=app.querySelector('#truncated-note');if(note)note.textContent=noteText()}
  function enforceLineCap(ol){let trimmed=false;while(ol.children.length>VIEW_LIMIT){ol.removeChild(ol.firstChild);domHidden++;trimmed=true}if(trimmed)refreshNote()}
  function appendDeltaText(li,text){const span=li.querySelector('[data-copy-key]');const key=span?.dataset.copyKey;const prev=key?copySlots.get(key)||'':span?span.textContent:'';const merged=prev+text;if(merged.includes('\\n')){const parts=merged.split('\\n');const head=parts.slice(0,-1).join('\\n');if(key)copySlots.set(key,head);if(span)span.textContent=head;li.dataset.frozen='1';return parts.at(-1)}if(key)copySlots.set(key,merged);if(span)span.textContent=merged;return null}
  function appendLine(r){
    const target=currentTarget();
    if(!matchesTarget(r,target))return;
    const scroll=app.querySelector('.output-scroll');if(!scroll)return;
    let ol=scroll.querySelector('#log');
    if(!ol){render();return}
    if(r.kind==='text-delta'&&typeof r.payload?.text==='string'){
      const prevLi=ol.lastElementChild;
      if(prevLi&&prevLi.dataset.delta==='1'&&prevLi.dataset.frozen!=='1'&&prevLi.dataset.invocation===String(r.scope?.invocation)){
        const rest=appendDeltaText(prevLi,r.payload.text);
        if(rest===null){if(follow)scroll.scrollTop=scroll.scrollHeight;return}
        const li=document.createElement('li');li.className='line';li.dataset.delta='1';li.dataset.frozen='0';li.dataset.invocation=String(r.scope?.invocation);li.innerHTML=lineInner({...r,text:rest,frozen:false});ol.appendChild(li);fillCopies(li);enforceLineCap(ol);if(follow)scroll.scrollTop=scroll.scrollHeight;return;
      }
    }
    const li=document.createElement('li');li.className='line';
    if(r.kind==='text-delta'&&typeof r.payload?.text==='string'){li.dataset.delta='1';li.dataset.frozen=r.frozen?'1':'0';li.dataset.invocation=String(r.scope?.invocation)}
    li.innerHTML=lineInner(r.text!==undefined?r:{...r,text:r.payload?.text,frozen:false});ol.appendChild(li);fillCopies(li);enforceLineCap(ol);if(follow)scroll.scrollTop=scroll.scrollHeight;
  }
  function updateLane(ticket){
    const lane=app.querySelector('.ticket-lane[data-ticket="'+ticket+'"]');
    const active=document.activeElement;const activeKey=active&&app.contains(active)?active.dataset?.selectKey||null:null;
    if(!lane){
      // 新票：按 seq 排序插入对应位置，并更新看板计数。
      const scroll=app.querySelector('.kanban-scroll');if(!scroll||!app.querySelector('.ticket-lane')){render();return}
      const tmp=document.createElement('div');tmp.innerHTML=laneHtml(ticket);const node=tmp.firstChild;fillCopies(node);
      const lanes=[...scroll.querySelectorAll('.ticket-lane')];let placed=false;
      for(const l of lanes){if(Number(l.dataset.ticket)>ticket){scroll.insertBefore(node,l);placed=true;break}}
      if(!placed)scroll.appendChild(node);
      const small=app.querySelector('.board-panel .panel-heading small');if(small)small.textContent=ticketIds().length+' 条工单 · Implementer → Reviewer → Merger';
      if(activeKey)restoreFocus({type:'select',value:activeKey});
      return;
    }
    const tmp=document.createElement('div');tmp.innerHTML=laneHtml(ticket);const node=tmp.firstChild;fillCopies(node);
    lane.replaceWith(node);
    if(activeKey)restoreFocus({type:'select',value:activeKey});
  }
  function affectedTickets(r){
    const set=new Set(recordTickets(r));
    if(r.scope?.role==='merger'&&Number.isSafeInteger(r.scope?.batch)){
      for(const [id,s] of summaries)if(s.batch===r.scope.batch)set.add(id);
    }
    return set;
  }
  function ingest(r){if(!Number.isSafeInteger(r.seq)||r.seq<=last)return;last=r.seq;observe(r);records.push(r);if(records.length>STORE_LIMIT){storeTrimmed+=records.length-STORE_LIMIT;records.splice(0,records.length-STORE_LIMIT)}for(const id of affectedTickets(r))updateLane(id);appendLine(r)}
  function setFollow(next){follow=next;app.querySelector('[data-follow-toggle]')?.setAttribute('aria-pressed',String(follow));if(follow){const scroll=app.querySelector('.output-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight}}
  app.addEventListener('click',event=>{const selectable=event.target.closest('[data-select-key]');if(selectable){selectedKey=selectable.dataset.selectKey;render();return}const toggle=event.target.closest('[data-follow-toggle]');if(toggle)setFollow(!follow)});
  app.addEventListener('keydown',event=>{if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;const current=event.target.closest('[data-select-key]');if(!current)return;const items=[...app.querySelectorAll('[data-select-key]')];const index=items.indexOf(current);if(index<0)return;event.preventDefault();items[Math.min(items.length-1,Math.max(0,index+(event.key==='ArrowDown'?1:-1)))].focus()});
  app.addEventListener('scroll',event=>{if(!event.target.matches('.output-scroll'))return;const scroll=event.target;if(scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight>40)setFollow(false)},{capture:true,passive:true});
  function showCompleteness(state){const root=document.querySelector('#warning');root.replaceChildren();if(!state||state.completeness==='complete')return;const warning=document.createElement('div');warning.className='warning';warning.textContent='degraded / incomplete：'+(state.reason||'Observation history 不完整');root.replaceChildren(warning)}
  function applySnapshot(value){records=value.observations;storeTrimmed=0;last=records.reduce((max,r)=>Math.max(max,Number(r.seq)||0),0);hiddenBefore=Math.max(0,(value.truncatedFrom||0)-1);if(!(hiddenBefore>0)&&value.total>records.length)hiddenBefore=value.total-records.length;rebuildSummaries();showCompleteness(value.completeness);document.querySelector('#state').textContent=value.final?'final · frozen':'replay';render();backfillHead()}
  // 头部回填：summaries 需要全量历史才不失真，但 records/Inspector 只留尾部。
  // 首屏先渲染尾部（<2s），再用 snapshot?after 分块（每块 5000，上限即服务端
  // SNAPSHOT_MAX_LIMIT）把头部摘要补齐；补入走 observe(r,true)（seq 守卫，
  // 不覆盖 ingest 已观测的新状态），不进 records、不碰 Inspector DOM。
  // 补完后 render() 一次刷新看板（滚动/焦点由 captureViewState 保持）。
  const BACKFILL_CHUNK=5000;let backfilling=false;
  function backfillHead(){if(backfilling||!hiddenBefore)return;backfilling=true;const stop=records.length?records[0].seq:Infinity;let cursor=0;(async()=>{try{while(cursor<stop-1&&cursor<hiddenBefore){const response=await fetch('./snapshot?token='+tokenParam()+'&after='+cursor+'&limit='+BACKFILL_CHUNK);const value=await response.json();const obs=value.observations||[];if(!obs.length)break;for(const r of obs){if(records.length&&r.seq>=stop)break;observe(r,true)}cursor=obs[obs.length-1].seq;if(obs.length<BACKFILL_CHUNK)break}}catch{}backfilling=false;render()})()}
  function tokenParam(){return encodeURIComponent(new URLSearchParams(location.search).get('token'))}
  function loadSnapshot(){return fetch('./snapshot?token='+tokenParam()).then(response=>response.json()).then(value=>{applySnapshot(value)}).catch(()=>{document.querySelector('#state').textContent='stale · snapshot unavailable';render()})}
  // truncated 事件：服务端未重放全部历史，用 snapshot?after=last 对齐 lastSeq。
  function resync(lastSeq){fetch('./snapshot?token='+tokenParam()+'&after='+last+'&limit=500').then(response=>response.json()).then(value=>{for(const r of value.observations)ingest(r);if(Number.isSafeInteger(lastSeq)&&lastSeq>last)last=lastSeq;showCompleteness(value.completeness)}).catch(()=>{})}
  function connect(){const es=new EventSource('./events?token='+tokenParam()+'&after='+last);es.onopen=()=>document.querySelector('#state').textContent='live · '+${escJson(run)};es.onmessage=event=>{document.querySelector('#state').textContent='live · '+${escJson(run)};ingest(JSON.parse(event.data))};es.addEventListener('truncated',event=>{try{resync(JSON.parse(event.data).lastSeq)}catch{resync()}});es.addEventListener('final',()=>{document.querySelector('#state').textContent='final · frozen';es.close()});es.onerror=()=>document.querySelector('#state').textContent='stale · reconnecting'}
  if(initial){applySnapshot(initial);if(!initial.final)connect()}else loadSnapshot().then(connect);
  </script></body></html>`;
}
