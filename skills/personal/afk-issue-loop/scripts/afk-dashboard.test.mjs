import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'afk.mjs');

function command(name, args, options = {}) {
  return execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}

function writeExecutable(path, body) {
  writeFileSync(path, `#!/bin/sh\nset -eu\n${body}\n`);
  chmodSync(path, 0o755);
}

// 公开 CLI fixture：GitHub、Worktrunk、provider、browser opener 均为受控 adapter。
// 不调用真实 GitHub、不启动真实模型、不打开真实浏览器、不操作真实用户仓库。
// omit：不写出该 harness 的受控可执行文件，用于断言启动期可执行检查确实
// 覆盖了全部被用到的 harness。claude 是角色执行载体，正常用例必须保留。
function createFixture({ omit = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'afk-dashboard-'));
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  const roleLog = join(root, 'roles.log');
  const issueStateDir = join(root, 'issues');
  const openLog = join(root, 'opened.log');
  mkdirSync(repo);
  mkdirSync(bin);
  mkdirSync(issueStateDir);
  writeFileSync(join(issueStateDir, '9'), 'open');
  writeFileSync(join(issueStateDir, '10'), 'open');
  command('git', ['init', '-q', '-b', 'main', repo]);
  command('git', ['-C', repo, 'config', 'user.name', 'AFK Test']);
  command('git', ['-C', repo, 'config', 'user.email', 'afk@example.test']);
  writeFileSync(join(repo, 'README.md'), 'fixture\n');
  command('git', ['-C', repo, 'add', 'README.md']);
  command('git', ['-C', repo, 'commit', '-q', '-m', 'chore: fixture']);

  writeExecutable(join(bin, 'gh'), `
case "\${1:-}" in
  --version) printf '%s\\n' 'gh version fixture' ;;
  auth) exit 0 ;;
  repo) printf '%s\\n' '{"nameWithOwner":"owner/repo"}' ;;
  api)
    endpoint=''
    for arg in "$@"; do case "$arg" in repos/*) endpoint="$arg" ;; esac; done
    case "$endpoint" in
      repos/owner/repo/issues/*/comments*) printf '%s\\n' '[[]]' ;;
      repos/owner/repo/issues/*/dependencies/blocked_by*) printf '%s\\n' '[[]]' ;;
      repos/owner/repo/issues/*/parent) printf '%s\\n' 'HTTP 404' >&2; exit 1 ;;
      repos/owner/repo/issues/*)
        number="\${endpoint##*/}"
        state="$(cat "$AFK_ISSUE_STATE_DIR/$number")"
        printf '{"number":%s,"state":"%s","title":"看板票 %s","body":"","labels":[{"name":"ready-for-agent"}]}\\n' "$number" "$state" "$number"
        ;;
      *) printf 'unexpected gh endpoint: %s\\n' "$endpoint" >&2; exit 1 ;;
    esac
    ;;
  *) printf 'unexpected gh command: %s\\n' "$*" >&2; exit 1 ;;
esac`);
  writeExecutable(join(bin, 'wt'), `
if [ "\${1:-}" = '--version' ]; then printf '%s\\n' 'wt fixture'; exit 0; fi
if [ "\${1:-}" != 'switch' ]; then printf 'unexpected wt command: %s\\n' "$*" >&2; exit 1; fi
shift
create=0
base=''
while [ "$#" -gt 1 ]; do
  case "$1" in
    --no-cd) shift ;;
    --create) create=1; shift ;;
    --base) base="$2"; shift 2 ;;
    *) break ;;
  esac
done
branch="$1"
path="${root}/worktrees/\${branch##*/}"
mkdir -p "$(dirname "$path")"
if [ "$create" -eq 1 ]; then git -C "${repo}" worktree add -q -b "$branch" "$path" "$base"
else git -C "${repo}" worktree add -q "$path" "$branch"
fi`);
  // 受控浏览器 opener：只记录调用，不打开真实浏览器。
  for (const opener of ['open', 'xdg-open']) {
    writeExecutable(join(bin, opener), `
printf '%s\\n' "$*" >> "$AFK_OPEN_LOG"
if [ "\${AFK_OPENER_FAILS:-0}" = '1' ]; then printf 'cannot open display\\n' >&2; exit 1; fi
exit 0`);
  }
  const fakeClaude = join(root, 'fake-claude.mjs');
  writeFileSync(fakeClaude, `
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
const input = JSON.parse(prompt.slice(prompt.lastIndexOf('\\n{') + 1));
const context = input.context;
appendFileSync(process.env.AFK_ROLE_LOG, JSON.stringify({ role: context.role, ticket: context.ticket?.number, mode: context.mode, cwd: process.cwd() }) + '\\n');
// 原始 transport 负载先于 provider-specific 解析进入 Observation journal：
// text delta、完整 tool-call 参数、未识别事件、stderr 原文都不被过滤或改写。
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n');
emit({ type: 'assistant', message: { content: [{ type: 'text', text: '第一行输出' }] } });
emit({ type: 'assistant', message: { content: [{ type: 'text', text: '继续同一行' }] } });
emit({ type: 'assistant', message: { content: [{ type: 'text', text: '，当前行仍在增长\\n第二行完成\\n' }] } });
emit({ type: 'assistant', message: { content: [
  { type: 'text', text: '执行检查' },
  { type: 'tool_use', name: 'Bash', input: { command: 'git status --porcelain --untracked-files=all', retained: '必须完整保留' } },
] } });
emit({ type: 'afk-fixture-unknown-event', subtype: 'not-recognised', payload: { nested: [1, 2, 3], text: '未知事件 <完整保留>' } });
process.stderr.write('fixture stderr：完整错误原文\\n');
// recovery fixture 的受控行为在本 fixture 中不存在：误用应立刻失败而不是挂住。
if (['permission-recovered', 'carrier-failure'].includes(process.env.AFK_ROLE_BEHAVIOR)) {
  process.stderr.write('dashboard fixture 不支持该 AFK_ROLE_BEHAVIOR\\n');
  process.exit(1);
}
// 受控场景：Reviewer 结果带一个 not-run 验证。tests 对 Reviewer 是信息性，
 // pipeline 只看 commits 摘要与 Git 事实，不再有门控拒绝。
const notRun = process.env.AFK_ROLE_BEHAVIOR === 'reviewer-not-run-passed' && context.role === 'reviewer';
// Merger 行为：把本批分支合入目标并写 summary，使逐票 Merger 结果与 batch
// identity 可被观察。
let result;
if (context.role === 'merger') {
  if (context.mode === 'merge') {
    for (const item of context.items) execFileSync('git', ['merge', '--no-edit', item.workspace.branch], { cwd: context.cwd });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'chore(afk): Dashboard fixture summary'], { cwd: context.cwd });
  }
  result = {
    run: context.run, attempt: context.attempt, role: context.role,
    status: 'passed', summary: 'fixture 合并完成', tests: [], remaining: [],
    branch: context.branch, cwd: context.cwd,
    summaryCreated: true, summarySubject: 'chore(afk): Dashboard fixture summary',
    tickets: context.items.map(item => ({ ticket: item.ticket.number, branch: item.workspace.branch, merged: true, verified: true, closed: false })),
  };
} else {
  result = {
    run: context.run, attempt: context.attempt, role: context.role,
    status: 'passed', summary: '复用已有实现，无需新增提交',
    tests: notRun ? [{ command: 'fixture verify', status: 'not-run', summary: '未执行' }] : [],
    remaining: [],
    branch: context.branch, cwd: context.cwd, ticket: context.ticket.number,
    commits: ['已有可交付提交'],
  };
}
emit({ type: 'result', result: '<afk-result>' + JSON.stringify(result) + '</afk-result>' });
`);
  writeExecutable(join(bin, 'claude'), `
if [ "\${1:-}" = '--version' ]; then printf '%s\\n' 'claude fixture'; exit 0; fi
exec "${process.execPath}" "$AFK_FAKE_CLAUDE" "$@"`);
  // 混 harness 的启动期可执行检查可被外部断言：受控 harness 记录每次调用
  // （含 --version 探针）。它们只是可执行文件占位，不冒充真实 harness 语义。
  for (const provider of ['pi', 'codex']) {
    if (omit.includes(provider)) continue;
    writeExecutable(join(bin, provider), `
printf '%s %s\\n' '${provider}' "$*" >> "$AFK_PROVIDER_LOG"
if [ "\${1:-}" = '--version' ]; then printf '%s\\n' '${provider} fixture'; exit 0; fi
printf '%s\\n' '${provider} fixture 占位输出，不模仿真实 harness 语义'
exit 0`);
  }

  const env = {
    ...process.env,
    AFK_DASHBOARD_OPEN: '0',
    AFK_PROVIDER_LOG: join(root, 'providers.log'),
    // 受控 retention：不真实等待 24 小时，也避免测试残留 companion 进程。
    AFK_DASHBOARD_RETENTION_MS: '3000',
    PATH: `${bin}:${process.env.PATH}`,
    AFK_ROLE_LOG: roleLog,
    AFK_FAKE_CLAUDE: fakeClaude,
    AFK_ISSUE_STATE_DIR: issueStateDir,
    AFK_OPEN_LOG: openLog,
  };
  return { root, repo, roleLog, openLog, env };
}

const providerLog = fixture => existsSync(fixture.env.AFK_PROVIDER_LOG) ? readFileSync(fixture.env.AFK_PROVIDER_LOG, 'utf8').trim().split('\n').filter(Boolean) : [];
const resolveSelection = (fixture, args = []) => JSON.parse(command(process.execPath, [script, 'resolve-selection', '--repo', fixture.repo, ...args], { env: fixture.env, timeout: 15_000 }));

function addBranchCommit(fixture, number) {
  const branch = `afk/issue-${number}`;
  const worktree = join(fixture.root, `prepared-${number}`);
  command('git', ['-C', fixture.repo, 'branch', branch]);
  command('git', ['-C', fixture.repo, 'worktree', 'add', '-q', worktree, branch]);
  writeFileSync(join(worktree, `issue-${number}.txt`), 'implemented\n');
  command('git', ['-C', worktree, 'add', `issue-${number}.txt`]);
  command('git', ['-C', worktree, 'commit', '-q', '-m', `feat: issue ${number}`]);
  return { branch, worktree };
}

function writerSocketPath(fixture, branch) {
  const common = realpath(command('git', ['-C', fixture.repo, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
  const key = createHash('sha256').update(`${common}\0${branch}`).digest('hex').slice(0, 32);
  return join(tmpdir(), `afk-writer-${key}.sock`);
}
const realpath = value => execFileSync('node', ['-e', 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))', value], { encoding: 'utf8' });

async function waitUntil(predicate, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(50);
  }
  assert.fail(typeof message === 'function' ? message() : message);
}

async function stopRun(runDir, env) {
  if (!runDir || existsSync(join(runDir, 'result.json'))) return;
  try { command(process.execPath, [script, 'stop', '--run', runDir], { env }); } catch {}
  await waitUntil(() => existsSync(join(runDir, 'result.json')), 'AFK stop 后未写入最终结果');
}

async function startRun(fixture, issues = '9') {
  return JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', issues], { env: fixture.env, timeout: 15_000 }));
}

const journal = runDir => readFileSync(join(runDir, 'observations.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const roleLogHas = (fixture, role) => existsSync(fixture.roleLog) && readFileSync(fixture.roleLog, 'utf8').split('\n').filter(Boolean).some(line => { try { return JSON.parse(line).role === role; } catch { return false; } });
const withKind = (records, kind) => records.filter(record => record.kind === kind || record.kind.startsWith(`${kind}-`));
const readToken = url => new URL(url).searchParams.get('token');

test('Observation journal 完整保留 provider 原始负载并携带 run/seq 身份', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    // 等 provider 原始负载与 Invocation 事实入库。
    await waitUntil(
      () => existsSync(join(runDir, 'observations.jsonl'))
        && journal(runDir).some(record => record.kind === 'raw-payload')
        && journal(runDir).some(record => record.kind === 'invocation-started'),
      '未观察到 provider 原始负载与 Invocation',
    );

    const records = journal(runDir);
    const seqs = records.map(record => record.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'seq 必须单调递增');
    assert.equal(new Set(seqs).size, seqs.length, 'seq 必须唯一');
    assert.equal(seqs[0], 1, 'seq 从 1 开始');
    assert.ok(records.every(record => record.runId === started.run), '所有 Observation 归属当前 run');
    assert.ok(records.every(record => typeof record.source === 'string' && typeof record.kind === 'string' && typeof record.observedAt === 'string'), '每条记录必须有 source/kind/observedAt');

    // provider 原始 payload 在解析前逐行入库，未被过滤、改写或截断。
    const raw = withKind(records, 'raw-payload');
    assert.ok(raw.length >= 6, 'provider 原始负载未完整进入 journal');
    const rawText = raw.map(record => record.payload).join('\n');
    assert.match(rawText, /afk-fixture-unknown-event/, '未知 provider 事件不得被静默丢弃');
    assert.match(rawText, /必须完整保留/, '完整 tool-call 参数不得被过滤');
    // 每个 provider 事件各占一条原始记录，逐行入库且顺序保持。
    for (const fragment of ['第一行输出', '继续同一行', '当前行仍在增长', '第二行完成', '执行检查']) assert.ok(rawText.includes(fragment), `原始 payload 缺少 ${fragment}；不得截断或合并`);

    const stderr = withKind(records, 'stderr');
    assert.ok(stderr.some(record => record.payload.includes('fixture stderr：完整错误原文')), 'stderr 未完整进入 journal');

    // planned Attempt 先于 spawn 存在且 Invocation 为空。
    const planned = withKind(records, 'attempt-planned');
    assert.ok(planned.length >= 1, '缺少 planned Attempt');
    assert.ok(planned.every(record => !('invocation' in record.scope)), 'planned Attempt 不得冒充运行中的 Invocation');

    // Invocation 只在 spawn 成功后分配，run 内全局单调。
    const invocations = withKind(records, 'invocation-started');
    assert.ok(invocations.length >= 1, '缺少实际 Invocation');
    assert.ok(invocations.every(record => Number.isSafeInteger(record.payload.managedPid)), 'Invocation 必须携带 PID');
    assert.deepEqual(invocations.map(record => record.scope.invocation), invocations.map((_, index) => index + 1), 'Invocation 必须全局单调');

    // 三层零出现：全量观测中无 self-report / gate-* / delivery-* kind。
    assert.equal(records.some(record => record.kind === 'self-report' || record.kind.startsWith('gate-') || String(record.kind).startsWith('delivery-')), false, '三层观测必须零出现');

    // Recovery provenance 与 Agent 输出可区分。
    const recovery = records.filter(record => record.source === 'engine/recovery');
    assert.ok(recovery.length >= 1, '缺少 engine/recovery Observation');
    assert.ok(recovery.every(record => record.kind.startsWith('recovery') || record.kind.startsWith('workspace')), 'recovery source 不得冒充 provider 输出');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('共享逻辑 Merger 以 batch identity 关联多票，逐票 Merger 结果独立发布', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    addBranchCommit(fixture, 10);
    const started = await startRun(fixture, '9,10');
    runDir = started.logDir;
    await waitUntil(
      () => existsSync(join(runDir, 'observations.jsonl'))
        && journal(runDir).some(record => record.kind === 'merger-result' && Number.isSafeInteger(record.scope.batch)),
      '未观察到 batch 维度的 Merger 逐票结果',
    );

    const records = journal(runDir);
    // 一个逻辑 Merger 关联一个 batch、多个 Ticket；batch identity 稳定。
    const mergerPlanned = records.filter(record => record.kind === 'attempt-planned' && record.scope.role === 'merger');
    assert.ok(mergerPlanned.length >= 1, '缺少 Merger planned Attempt');
    assert.ok(mergerPlanned.every(record => Number.isSafeInteger(record.scope.batch)), 'Merger Attempt 必须携带 batch identity');
    const batches = new Set(mergerPlanned.map(record => record.scope.batch));
    assert.equal(batches.size, 1, `同一批 Merger 不得产生多个 batch identity：${[...batches].join(',')}`);

    // 逐票 Merger 结果必须各自发布，不能只在 batch 层面汇总。
    const results = records.filter(record => record.kind === 'merger-result');
    const resultTickets = new Set(results.map(record => record.scope.ticket));
    assert.ok(resultTickets.size >= 1, '逐票 Merger 结果必须携带 ticket scope');
    assert.ok(results.every(record => Number.isSafeInteger(record.scope.ticket)), 'Merger 结果必须逐票关联 Ticket');
    assert.ok(results.every(record => typeof record.payload.merged === 'boolean' && typeof record.payload.verified === 'boolean' && typeof record.payload.closed === 'boolean'), 'Merger 逐票结果必须带 merged/verified/closed');
    assert.equal(records.some(record => record.kind === 'self-report' || record.kind.startsWith('gate-') || String(record.kind).startsWith('delivery-')), false, '三层观测必须零出现');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('慢 SSE 客户端不给 run 施加 backpressure，journal 仍继续增长', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    await waitUntil(() => existsSync(join(runDir, 'observations.jsonl')) && journal(runDir).length >= 3, 'journal 未产生记录');
    const origin = new URL(started.dashboard.url).origin;
    const token = readToken(started.dashboard.url);

    // 建立 SSE 连接但不读取，模拟慢客户端。
    const response = await fetch(`${origin}/events?token=${token}&after=0`, { headers: { Accept: 'text/event-stream' } });
    assert.equal(response.status, 200);
    const before = journal(runDir).length;

    // 客户端不消费数据期间，run 的 Observation 采集必须继续进行。
    await waitUntil(() => journal(runDir).length > before, '慢客户端阻塞了 Observation 采集', 12_000);
    const after = journal(runDir).length;
    assert.ok(after > before, '慢客户端期间 journal 必须继续增长');
    await response.body.cancel().catch(() => {});
    // run 未因此失败或停止：最终仍可正常收尾。
    await stopRun(runDir, fixture.env);
    assert.equal(existsSync(join(runDir, 'result.json')), true, '慢客户端不得使 run 失败');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('SSE 按 seq 发布且只补发最后已见 ID 之后的记录', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    await waitUntil(() => existsSync(join(runDir, 'observations.jsonl')) && journal(runDir).length >= 6, 'journal 未产生足够记录');

    // SSE event ID 等于 Observation seq；Last-Event-ID/after 只补发后续记录。
    const response = await fetch(`${new URL(started.dashboard.url).origin}/events?token=${readToken(started.dashboard.url)}&after=2`, { headers: { Accept: 'text/event-stream' } });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if ([...text.matchAll(/^id: (\d+)$/gm)].length >= 3) break;
    }
    await reader.cancel();
    const ids = [...text.matchAll(/^id: (\d+)$/gm)].map(match => Number(match[1]));
    assert.ok(ids.length > 0, `SSE 未返回任何记录：${text.slice(0, 200)}`);
    assert.ok(ids.every(id => id > 2), `SSE 重放了已见记录：${ids.join(',')}`);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), 'SSE ID 必须单调不跳号');
    assert.deepEqual(ids, [...new Set(ids)], 'SSE 不得重复发送同一 seq');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('SSE 重连按 Last-Event-ID 只补缺失记录，不重发也不跳号', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    await waitUntil(() => existsSync(join(runDir, 'observations.jsonl')) && journal(runDir).length >= 8, 'journal 未产生足够记录');
    const origin = new URL(started.dashboard.url).origin;
    const token = readToken(started.dashboard.url);

    // 第二次连接携带更靠后的 Last-Event-ID；URL 里保留页面加载时的旧 after，
    // 服务端必须优先采用 Last-Event-ID，否则会重发已见记录。
    const response = await fetch(`${origin}/events?token=${token}&after=1`, { headers: { Accept: 'text/event-stream', 'Last-Event-ID': '5' } });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if ([...text.matchAll(/^id: (\d+)$/gm)].length >= 3) break;
    }
    await reader.cancel();
    const ids = [...text.matchAll(/^id: (\d+)$/gm)].map(match => Number(match[1]));
    assert.ok(ids.length > 0, `SSE 未返回任何记录：${text.slice(0, 200)}`);
    assert.ok(ids.every(id => id > 5), `SSE 重放了 Last-Event-ID 之前的记录：${ids.join(',')}`);
    assert.deepEqual(ids, [...new Set(ids)], 'SSE 重连不得重复同一 seq');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('关闭页面与 SSE 断线不影响 run，重开 URL 恢复全部历史', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;

    const companionPid = () => JSON.parse(readFileSync(join(runDir, 'dashboard.json'), 'utf8')).pid;
    const before = companionPid();
    const first = await fetch(started.dashboard.url);
    assert.equal(first.status, 200);
    assert.match(await first.text(), /Ticket Kanban/);

    // 断开客户端后采集仍继续推进。
    await waitUntil(() => journal(runDir).length > 5, 'journal 未继续增长');
    const snapshot = await (await fetch(`${new URL(started.dashboard.url).origin}/snapshot?token=${readToken(started.dashboard.url)}`)).json();
    assert.equal(snapshot.run, started.run);
    assert.ok(snapshot.observations.length >= 5, '重开后未恢复全部历史');
    assert.equal(snapshot.completeness.completeness, 'complete');
    assert.deepEqual(
      snapshot.observations.map(record => record.seq),
      [...snapshot.observations.map(record => record.seq)].sort((a, b) => a - b),
      '重放顺序必须与 seq 一致',
    );
    // 页面关闭不改变 server identity，原 URL 仍可访问且 companion 未被重建。
    assert.equal((await fetch(started.dashboard.url)).status, 200);
    assert.equal(companionPid(), before, '关闭页面不得重建 companion');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Dashboard 只读、localhost-only，且 read token 与 control capability 分离', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    const control = JSON.parse(readFileSync(join(runDir, 'control.json'), 'utf8'));
    const url = new URL(started.dashboard.url);
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.protocol, 'http:');
    assert.notEqual(readToken(started.dashboard.url), control.token, 'read token 必须与 control token 不同');

    // 错误 read token 不能读取完整未脱敏内容。
    assert.equal((await fetch(`${url.origin}/?token=wrong`)).status, 403);
    assert.equal((await fetch(`${url.origin}/?token=`)).status, 403);

    // 不存在任何 mutation endpoint。
    for (const path of ['/stop', '/retry', '/approve', '/resume', '/merge']) {
      assert.equal((await fetch(`${url.origin}${path}?token=${readToken(started.dashboard.url)}`)).status, 404, `${path} 不得存在`);
    }
    assert.equal((await fetch(started.dashboard.url, { method: 'POST' })).status, 405);

    // owner-only 权限与安全响应头。
    for (const name of ['observations.jsonl', 'dashboard.json', 'observation-state.json']) {
      assert.equal(statSync(join(runDir, name)).mode & 0o777, 0o600, `${name} 必须为 0600`);
    }
    const page = await fetch(started.dashboard.url);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
    const html = await page.text();
    assert.doesNotMatch(html, /https?:\/\/(?!127\.0\.0\.1)/, '页面不得引用外部资源');
    assert.equal(html.includes(control.token), false, 'control token 不得进入页面');
    const journalText = readFileSync(join(runDir, 'observations.jsonl'), 'utf8');
    assert.equal(journalText.includes(control.token), false, 'control token 不得进入 Observation journal');
    assert.equal(journalText.includes(readToken(started.dashboard.url)), false, 'read token 不得进入 Observation journal');
    assert.equal(readFileSync(join(runDir, 'events.jsonl'), 'utf8').includes(readToken(started.dashboard.url)), false, 'read token 不得进入核心事件日志');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('浏览器 opener 失败不影响 run，公开 start 仍返回可用 URL', async () => {
  const fixture = createFixture();
  // 受控 opener（PATH 首位的 fake open/xdg-open）记录调用并失败；
  // 真实浏览器不会被打开。
  fixture.env.AFK_DASHBOARD_OPEN = '1';
  fixture.env.AFK_OPENER_FAILS = '1';
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    assert.equal(started.state, 'started');
    assert.equal(started.dashboard.state, 'available');
    assert.match(started.dashboard.url, /^http:\/\/127\.0\.0\.1:\d+\/?\?token=[^&]+$/);
    assert.equal((await fetch(started.dashboard.url)).status, 200, 'opener 失败后页面仍必须可访问');
    await waitUntil(() => existsSync(fixture.openLog) && readFileSync(fixture.openLog, 'utf8').includes('127.0.0.1'), '受控 opener 未被调用', 3_000);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Observation journal 写入失败时 run 继续但公开状态显式 degraded', async () => {
  const fixture = createFixture();
  // 通过公开 start 的受控注入让 journal 目标不可写。
  fixture.env.AFK_DASHBOARD_JOURNAL_PATH = join(fixture.root, 'missing-directory', 'observations.jsonl');
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    assert.equal(started.dashboard.state, 'available', 'journal 故障不得阻止 Dashboard 启动');
    assert.equal(started.dashboard.completeness, 'incomplete');
    assert.ok(started.dashboard.reason, 'start 必须说明缺口原因');

    const status = JSON.parse(command(process.execPath, [script, 'status', '--run', runDir], { env: fixture.env }));
    assert.equal(status.dashboard.completeness, 'incomplete', 'degraded 必须对公开 status 可见');
    assert.ok(status.dashboard.reason);

    // run 仍在正常推进：journal 故障不进入核心失败路径。
    await waitUntil(() => existsSync(fixture.roleLog), 'journal 故障使 Agent 未被派发');
    const html = await (await fetch(started.dashboard.url)).text();
    assert.match(html, /degraded|incomplete/, '页面必须显式展示 degraded 状态');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('run 终态后冻结 history、导出可离线重放的自包含 dashboard.html', async () => {
  const fixture = createFixture();
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    // 等 provider 原始负载与 Recovery 事实都已入库，再进入终态。
    await waitUntil(
      () => existsSync(join(started.logDir, 'observations.jsonl'))
        && journal(started.logDir).some(record => record.kind === 'raw-payload')
        && journal(started.logDir).some(record => record.source === 'engine/recovery'),
      'journal 未产生完整记录',
    );
    await stopRun(started.logDir, fixture.env);

    const finalPath = join(started.logDir, 'dashboard.html');
    await waitUntil(() => existsSync(finalPath), '未生成最终 dashboard.html');
    assert.equal(statSync(finalPath).mode & 0o777, 0o600, '最终 HTML 必须为 0600');
    const html = readFileSync(finalPath, 'utf8');
    // 自包含：离线打开即包含完整 history 与 Recovery，且不内嵌 read token。
    assert.match(html, /afk-fixture-unknown-event/, '最终导出必须包含完整 provider 原始负载');
    assert.match(html, /engine\/recovery/, '最终导出必须包含 Recovery history');

    const status = JSON.parse(command(process.execPath, [script, 'status', '--run', started.logDir], { env: fixture.env }));
    assert.equal(status.dashboard.finalExport, finalPath);
    assert.equal(status.dashboard.reopenCommand.includes('dashboard'), true);

    // companion 不可用时，公开 reopen 命令按 run identity 重建并恢复 URL。
    const reopened = JSON.parse(command(process.execPath, [script, 'dashboard', '--run', started.logDir], { env: fixture.env }));
    assert.ok(['reused', 'started'].includes(reopened.state), `reopen 状态未知：${reopened.state}`);
    assert.equal(reopened.run, started.run);
    assert.equal(reopened.final, true);
    assert.match(reopened.url, /^http:\/\/127\.0\.0\.1:\d+\/?\?token=/);
    assert.equal(html.includes(readToken(reopened.url)), false, 'read token 不得进入最终 HTML');
    // 重建复用原 read token，使已公开的 URL capability 保持有效。
    assert.equal(readToken(reopened.url), readToken(started.dashboard.url));
    assert.equal((await fetch(reopened.url)).status, 200, 'reopen 后 URL 必须可用');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('生产 HTTP worker 异常退出后由 companion 自动重建且不丢失记录', async () => {
  const fixture = createFixture();
  fixture.env.AFK_DASHBOARD_WORKER_FAULT = '1';
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    // 等待受控故障使首个 worker 自行退出（400ms）；若 companion 不重建，
    // 此后端口将不再接受连接。
    await delay(1_500);
    await waitUntil(async () => {
      try { return (await fetch(started.dashboard.url)).status === 200; } catch { return false; }
    }, 'worker 重建后 URL 不可用', 10_000);
    const snapshot = await (await fetch(`${new URL(started.dashboard.url).origin}/snapshot?token=${readToken(started.dashboard.url)}`)).json();
    assert.equal(snapshot.run, started.run);
    assert.deepEqual(
      snapshot.observations.map(record => record.seq),
      [...new Set(snapshot.observations.map(record => record.seq))].sort((a, b) => a - b),
      '重建后不得重复或丢失记录',
    );
    // 页面关闭与 SSE 断线不触发重建：URL 与 seq 空间保持同一 identity。
    assert.equal(readToken(started.dashboard.url), readToken(dashboardUrl(runDir)));
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

const dashboardUrl = runDir => `http://127.0.0.1:${JSON.parse(readFileSync(join(runDir, 'dashboard.json'), 'utf8')).port}/?token=${JSON.parse(readFileSync(join(runDir, 'dashboard.json'), 'utf8')).token}`;

test('active writer 消失后自动重新检查并恢复派发', async () => {
  const fixture = createFixture();
  let server;
  let socketPath;
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    socketPath = writerSocketPath(fixture, 'afk/issue-9');
    // 受控 ownership channel：明确响应 active，证明 writer 仍在运行。
    server = createServer(socket => socket.end('AFK workspace in use\n'));
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(socketPath, resolveListen);
    });

    const started = await startRun(fixture);
    runDir = started.logDir;
    await waitUntil(() => {
      try {
        const status = JSON.parse(command(process.execPath, [script, 'status', '--run', runDir], { env: fixture.env }));
        return status.recovery?.['9']?.state === 'waiting-writer';
      } catch { return false; }
    }, 'active writer 未使 Ticket 进入 waiting-writer', 15_000);
    assert.equal(existsSync(fixture.roleLog), false, 'active writer 期间不得启动第二个 writer');

    // writer 不再响应后，无需重新调用 skill 即可继续恢复并派发。
    await new Promise(resolveClose => server.close(resolveClose));
    server = undefined;
    rmSync(socketPath, { force: true });
    socketPath = undefined;
    await waitUntil(() => existsSync(fixture.roleLog), 'active writer 消失后未自动恢复派发', 20_000);
    assert.equal(readFileSync(fixture.roleLog, 'utf8').includes('implementer'), true);
  } finally {
    if (server) await new Promise(resolveClose => server.close(resolveClose));
    if (socketPath) rmSync(socketPath, { force: true });
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// Issue #12 保留：Reviewer 回到上游「复核者」定位后，tests 对 pipeline 是信息性。
// Reviewer passed + 必需验证 not-run 照常合入待合集，Merger 被派发。
test('Reviewer passed 且必需验证 not-run 时照常合入待合集并派发 Merger', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'reviewer-not-run-passed';
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    await waitUntil(() => roleLogHas(fixture, 'merger'), 'Reviewer 通过后未派发 Merger', 15_000);

    const records = journal(runDir);
    // not-run 不再阻断：无三层观测，Merger 照常派发。
    assert.equal(records.some(record => record.kind === 'self-report' || record.kind.startsWith('gate-') || String(record.kind).startsWith('delivery-')), false, '三层观测必须零出现');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('尚未 spawn 时 planned Attempt 可见且没有 Invocation，Invocation 从 1 起单调', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    await waitUntil(() => existsSync(join(runDir, 'observations.jsonl')) && journal(runDir).some(record => record.kind === 'invocation-started'), '未观察到 Invocation');

    const records = journal(runDir);
    const planned = records.find(record => record.kind === 'attempt-planned');
    const invocation = records.find(record => record.kind === 'invocation-started');
    // planned Attempt 先于 Invocation 出现，且当时没有 PID/Invocation 身份。
    assert.ok(planned.seq < invocation.seq, 'planned Attempt 必须先于 Invocation');
    assert.equal(planned.scope.invocation, undefined, 'planned Attempt 不得冒充运行中的 Invocation');
    assert.equal(invocation.scope.attempt, planned.scope.attempt, 'Invocation 必须关联对应 planned Attempt');
    assert.equal(invocation.scope.invocation, 1, '本 run 首个 Invocation 为 1');
    assert.equal(invocation.payload.attempt, planned.scope.attempt);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Attempt 按 per-Ticket/per-Role 计数，不同 Ticket 各自从 1 开始', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    addBranchCommit(fixture, 10);
    const started = await startRun(fixture, '9,10');
    runDir = started.logDir;
    await waitUntil(() => {
      if (!existsSync(join(runDir, 'observations.jsonl'))) return false;
      const planned = journal(runDir).filter(record => record.kind === 'attempt-planned' && record.scope.role === 'implementer');
      return new Set(planned.flatMap(record => record.scope.tickets)).size >= 2;
    }, '两个 Ticket 的 Implementer Attempt 未出现');

    const implementers = journal(runDir).filter(record => record.kind === 'attempt-planned' && record.scope.role === 'implementer');
    const byTicket = new Map(implementers.map(record => [record.scope.tickets[0], record.scope.attempt]));
    // 两票在同一 run 内并发派发：per-Ticket Attempt 各自从 1 开始，
    // 而不是共用 run 级全局递增序号。
    assert.deepEqual([...byTicket.entries()].sort((a, b) => a[0] - b[0]), [[9, 1], [10, 1]], `Attempt 必须按 Ticket/Role 计数：${JSON.stringify([...byTicket])}`);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('text delta 与 tool-call 以 typed Observation 逐条发布，可逐行重建', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    await waitUntil(() => existsSync(join(runDir, 'observations.jsonl')) && journal(runDir).some(record => record.kind === 'tool_call'), '未观察到 tool_call');

    const records = journal(runDir);
    const deltas = records.filter(record => record.kind === 'text-delta');
    assert.ok(deltas.length >= 3, 'text delta 必须逐条发布');
    assert.ok(deltas.every(record => Number.isSafeInteger(record.scope.invocation)), 'text delta 必须关联 Invocation');
    // 重放必须重建完全相同的文本（换行为真实换行，不是转义字符）。
    assert.equal(deltas.map(record => record.payload.text).join(''), '第一行输出继续同一行，当前行仍在增长\n第二行完成\n执行检查');
    assert.ok(deltas.some(record => record.payload.text.includes('\n')), '换行必须原样保留，供 UI 冻结行边界');
    const toolCall = records.find(record => record.kind === 'tool_call');
    assert.equal(toolCall.payload.name, 'Bash');
    assert.equal(toolCall.payload.args, 'git status --porcelain --untracked-files=all', 'typed tool-call 必须保留完整参数');
    // 原始负载仍在，typed 事件只是附加视图。
    assert.ok(records.some(record => record.kind === 'raw-payload' && record.payload.includes('必须完整保留')));
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('run 现场被移除后 companion 自行退出，不留下无主进程', async () => {
  const fixture = createFixture();
  let runDir;
  let pid;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    pid = JSON.parse(readFileSync(join(runDir, 'dashboard.json'), 'utf8')).pid;
    assert.doesNotThrow(() => process.kill(pid, 0), 'companion 应当存活');

    // 保留期设得很长时，日志目录消失仍必须让 companion 自毁；
    // 否则 run 现场已消失，只会留下无主进程。
    fixture.env.AFK_DASHBOARD_RETENTION_MS = '600000';
    // 先停止仍持有现场的 AFK daemon，再移除整个 run 现场。
    const daemonPid = JSON.parse(readFileSync(join(runDir, 'control.json'), 'utf8')).pid;
    try { process.kill(daemonPid, 'SIGTERM'); } catch {}
    await waitUntil(() => {
      try { process.kill(daemonPid, 0); return false; } catch (error) { return error.code === 'ESRCH'; }
    }, 'AFK daemon 未在停止后退出');
    // daemon 退出与最后几次日志写入之间仍有竞态，重试直到目录真正移除。
    for (let i = 0; i < 40; i++) {
      try { rmSync(runDir, { recursive: true, force: true }); break; }
      catch (error) { if (error.code !== 'ENOTEMPTY') throw error; await delay(100); }
    }
    await waitUntil(() => {
      try { process.kill(pid, 0); return false; } catch (error) { return error.code === 'ESRCH'; }
    }, '日志目录消失后 companion 未退出', 15_000);
  } finally {
    if (pid) { try { process.kill(pid, 'SIGTERM'); } catch {} }
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('companion 存活时 reopen 不重复启动第二个 server', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    runDir = started.logDir;
    const before = JSON.parse(readFileSync(join(runDir, 'dashboard.json'), 'utf8'));
    const first = JSON.parse(command(process.execPath, [script, 'dashboard', '--run', runDir], { env: fixture.env }));
    const second = JSON.parse(command(process.execPath, [script, 'dashboard', '--run', runDir], { env: fixture.env }));
    assert.equal(first.state, 'reused');
    assert.equal(second.state, 'reused');
    assert.equal(first.url, started.dashboard.url);
    assert.equal(second.url, started.dashboard.url, 'reopen 不得改变 URL identity');
    // companion 未被替换：PID 与端口保持同一 identity。
    const after = JSON.parse(readFileSync(join(runDir, 'dashboard.json'), 'utf8'));
    assert.equal(after.pid, before.pid, 'reopen 不得起第二个 companion');
    assert.equal(after.port, before.port);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Recovery 记录完整命令与分类依据，且归属新 run 并先于新 Invocation', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    // 预置旧 AFK 执行留下的 branch 与 commit（worktree 已不在，
    // 由 Worktrunk 恢复同一分支）。
    const { worktree } = addBranchCommit(fixture, 9);
    command('git', ['-C', fixture.repo, 'worktree', 'remove', worktree]);
    const started = await startRun(fixture);
    runDir = started.logDir;
    await waitUntil(
      () => existsSync(join(runDir, 'observations.jsonl')) && journal(runDir).some(record => record.kind === 'invocation-started'),
      '未观察到 Invocation',
    );

    const records = journal(runDir);
    // 全部 Recovery Observation 归属本 run，且先于新 Agent Invocation。
    const recovery = records.filter(record => record.source === 'engine/recovery');
    assert.ok(recovery.length >= 2, '缺少 Recovery Observation');
    assert.ok(recovery.every(record => record.runId === started.run), 'Recovery 必须归属新 run');
    const firstInvocation = records.find(record => record.kind === 'invocation-started');
    assert.ok(recovery.every(record => record.seq < firstInvocation.seq), 'Recovery 必须先于新 Invocation');
    // 不继承旧 run ID/旧 Agent/旧 Attempt/旧 Reviewer verdict。
    const recoveryText = JSON.stringify(recovery);
    assert.doesNotMatch(recoveryText, /"priorRun"|"previousRunId"|"reviewerVerdict"/, 'Recovery 不得猜测旧身份');

    // 完整 Git 命令与 stdout 落盘，可诊断接管行为。
    const commands = records.filter(record => record.kind === 'recovery-command');
    assert.ok(commands.some(record => record.payload.command === 'git' && record.payload.args.includes('for-each-ref')), '缺少分支探测命令');
    assert.ok(commands.some(record => record.payload.command === 'wt' && record.payload.args.includes('switch')), '缺少 Worktrunk 恢复命令');
    assert.ok(commands.every(record => typeof record.payload.cwd === 'string'), '命令必须记录 cwd');

    // 分类依据：worktree/target OID、commits ahead、ancestry、dirty、in-progress。
    const facts = records.find(record => record.kind === 'recovery-facts');
    assert.ok(facts, '缺少 recovery-facts');
    assert.match(facts.payload.branchOid, /^[0-9a-f]{40}$/, '必须记录 branch HEAD OID');
    assert.match(facts.payload.targetOid, /^[0-9a-f]{40}$/, '必须记录 target OID');
    assert.equal(facts.payload.commitsAhead, 1, '必须记录 commits ahead');
    assert.equal(facts.payload.ancestorOfTarget, false);
    assert.equal(facts.payload.dirty, false);
    assert.equal(facts.payload.inProgress, false);
    // branch/worktree/cwd 的发现选择也可追溯。
    const detected = records.find(record => record.kind === 'recovery-detected');
    assert.equal(detected.payload.branch, 'afk/issue-9');
    assert.equal(detected.payload.site, 'detected-branch', '只有分支时应按分支发现');
    assert.equal(detected.payload.ownership, 'recovered-standard');
    const adopted = records.find(record => record.kind === 'recovery-adopted');
    assert.equal(adopted.payload.state, 'recovered-branch', '应恢复同一分支 worktree');
    assert.ok(adopted.payload.cwd, '必须记录最终选择的 worktree cwd');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('run 终态后 companion 按 retention 到期退出，最终 HTML 长期保留', async () => {
  const fixture = createFixture();
  fixture.env.AFK_DASHBOARD_RETENTION_MS = '1200';
  try {
    addBranchCommit(fixture, 9);
    const started = await startRun(fixture);
    await waitUntil(
      () => existsSync(join(started.logDir, 'observations.jsonl')) && journal(started.logDir).some(record => record.kind === 'raw-payload'),
      'journal 未产生完整记录',
    );
    await stopRun(started.logDir, fixture.env);

    const finalPath = join(started.logDir, 'dashboard.html');
    await waitUntil(() => existsSync(finalPath), '未生成最终 dashboard.html');
    const companionPid = JSON.parse(readFileSync(join(started.logDir, 'dashboard.json'), 'utf8')).pid;

    // 终态后超过 retention：companion 退出，页面不再由 server 提供。
    await waitUntil(() => {
      try { process.kill(companionPid, 0); return false; } catch (error) { return error.code === 'ESRCH'; }
    }, 'retention 到期后 companion 未退出', 15_000);
    assert.equal(existsSync(finalPath), true, '静态最终页面必须在 server 退出后继续存在');
    // 离线重放同一完整 history，不依赖任何 server。
    const html = readFileSync(finalPath, 'utf8');
    assert.match(html, /afk-fixture-unknown-event/);
    assert.match(html, /Ticket Kanban/);
    assert.match(html, /Output Inspector/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('resolve-selection 不创建 run、Dashboard 或浏览器副作用', async () => {
  const fixture = createFixture();
  try {
    const selection = resolveSelection(fixture);
    assert.equal(existsSync(join(fixture.repo, '.afk', 'logs')), false, 'resolve-selection 不得创建 run');
    assert.equal(existsSync(fixture.openLog), false, 'resolve-selection 不得打开浏览器');
    assert.ok(selection.provider);
    // per-Role 形状不得引入副作用，且每一格都可读。
    assert.deepEqual(Object.keys(selection.roles).sort(), ['implementer', 'merger', 'reviewer']);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 向后兼容回归护栏：不写任何 Role 前缀时三角色必须与顶层完全一致，
// 且来源标注为「继承」而不是静默等同于显式指定。
test('只写顶层 flag 时三角色一致且来源标注为继承（向后兼容）', async () => {
  const fixture = createFixture();
  try {
    const bare = resolveSelection(fixture);
    for (const role of ['implementer', 'reviewer', 'merger']) {
      assert.equal(bare.roles[role].provider, 'claude');
      assert.equal(bare.roles[role].model, null);
      assert.equal(bare.roles[role].effort, null);
      assert.equal(bare.roles[role].selectionSource, 'role-inherited-default', `${role} 省略时应标注继承而非显式`);
    }
    // 顶层 default 保留升级前的来源语义，使既有单份读取方不失效。
    assert.equal(bare.selectionSource, 'cli-config-or-explicit');
    assert.equal(bare.provider, 'claude', '默认 provider 仍是 claude，不从宿主猜测');

    const top = resolveSelection(fixture, ['--provider', 'claude', '--model', 'opus', '--effort', 'high']);
    assert.equal(top.selectionSource, 'cli-config-or-explicit');
    for (const role of ['implementer', 'reviewer', 'merger']) {
      assert.deepEqual(
        { provider: top.roles[role].provider, model: top.roles[role].model, effort: top.roles[role].effort },
        { provider: 'claude', model: 'opus', effort: 'high' },
        `${role} 应完整继承顶层默认`,
      );
      assert.equal(top.roles[role].selectionSource, 'role-inherited-default');
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('per-Role flag 逐角色解析、逐字段继承顶层默认', async () => {
  const fixture = createFixture();
  try {
    const selection = resolveSelection(fixture, [
      '--provider', 'claude', '--model', 'sonnet', '--effort', 'medium',
      '--implementer-provider', 'pi', '--implementer-model', 'cliproxy/gpt-5.6-luna', '--implementer-effort', 'high',
      '--reviewer-model', 'opus',
      '--merger-effort', 'max',
    ]);
    assert.deepEqual(
      { ...selection.roles.implementer, capabilityNote: undefined, selectionIntent: undefined, capabilityVerified: undefined, authenticationVerified: undefined },
      { provider: 'pi', model: 'cliproxy/gpt-5.6-luna', effort: 'high', selectionSource: 'explicit-unverified', capabilityNote: undefined, selectionIntent: undefined, capabilityVerified: undefined, authenticationVerified: undefined },
      'Implementer 应使用自己的 harness/模型/effort',
    );
    // 只给 --reviewer-model：provider/effort 逐字段继承顶层，不是整份回退。
    assert.equal(selection.roles.reviewer.provider, 'claude');
    assert.equal(selection.roles.reviewer.model, 'opus');
    assert.equal(selection.roles.reviewer.effort, 'medium', 'Reviewer 未指定的 effort 必须继承顶层');
    assert.equal(selection.roles.merger.provider, 'claude');
    assert.equal(selection.roles.merger.model, 'sonnet');
    assert.equal(selection.roles.merger.effort, 'max');
    // 顶层 default 仍是 Run 默认值，供既有单份读取方使用。
    assert.equal(selection.provider, 'claude');
    assert.equal(selection.model, 'sonnet');
    assert.equal(selection.effort, 'medium');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 缺省 Role 只跟随顶层默认，不跟随其他已指定 Role：否则只指定 Implementer
// 时 Reviewer 会被悄悄拉到同源模型，而 Reviewer 需要独立判读。
test('缺省 Role 只继承顶层默认，不跟随其他已指定 Role', async () => {
  const fixture = createFixture();
  try {
    const selection = resolveSelection(fixture, ['--implementer-model', 'sonnet']);
    assert.equal(selection.roles.implementer.model, 'sonnet');
    assert.equal(selection.roles.reviewer.model, null, 'Reviewer 不得被推断为与 Implementer 同源');
    assert.equal(selection.roles.merger.model, null, 'Merger 不得被推断为与 Implementer 同源');
    assert.equal(selection.roles.reviewer.selectionSource, 'role-inherited-default');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// selection.json 的公开形状：既有单份读取方读顶层扁平三字段，新增方读
// `roles`/`default`；三者必须是同一份值，不能各说各话。
test('selection.json 同时给出顶层扁平值、default 与 roles 且互相一致', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = JSON.parse(command(process.execPath, [
      script, 'start', '--repo', fixture.repo, '--issues', '9',
      '--provider', 'claude', '--model', 'sonnet', '--effort', 'medium',
      '--reviewer-model', 'opus',
    ], { env: fixture.env, timeout: 15_000 }));
    runDir = started.logDir;
    const selection = JSON.parse(readFileSync(join(runDir, 'selection.json'), 'utf8'));
    const defaultFields = ({ provider, model, effort, selectionSource }) => ({ provider, model, effort, selectionSource });
    // 顶层扁平值就是 default 键的内容。
    assert.deepEqual(defaultFields(selection.default), defaultFields(selection));
    // 未指定任何前缀的角色是 default 的副本（仅来源标注不同）。
    assert.deepEqual(defaultFields(selection.roles.merger), { ...defaultFields(selection.default), selectionSource: 'role-inherited-default' });
    // 显式覆盖的角色只改被指定的字段。
    assert.deepEqual(defaultFields(selection.roles.reviewer), { provider: 'claude', model: 'opus', effort: 'medium', selectionSource: 'cli-config-or-explicit' });
    await stopRun(runDir, fixture.env);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// resolve-selection 是只读预览入口，必须与 start 用同一展示路径逐角色列出，
// 否则用户在派发前看不到「哪一格是哪来的」。
test('resolve-selection 输出逐角色展示且不改变机器可读字段', async () => {
  const fixture = createFixture();
  try {
    const result = resolveSelection(fixture, ['--provider', 'claude', '--model', 'sonnet', '--effort', 'medium', '--merger-model', 'opus']);
    // 机器可读的原始映射保持枚举值，供脚本消费。
    assert.equal(result.roles.merger.selectionSource, 'cli-config-or-explicit');
    assert.equal(result.roles.implementer.selectionSource, 'role-inherited-default');
    // display 是同一份数据的人类可读视图。
    assert.deepEqual(result.display.implementer, {
      harness: 'claude', model: 'sonnet', effort: 'medium', source: '继承顶层默认',
      capability: result.display.implementer.capability,
    });
    assert.equal(result.display.merger.model, 'opus');
    // 省略模型/effort 用既有措辞，且不把 null 说成已探测。
    const bare = resolveSelection(fixture);
    for (const role of ['implementer', 'reviewer', 'merger']) {
      assert.equal(bare.display[role].model, 'CLI 本机配置');
      assert.equal(bare.display[role].effort, 'CLI 本机配置');
    }
    assert.equal(existsSync(join(fixture.repo, '.afk', 'logs')), false, 'resolve-selection 仍不得创建 run');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 不静默降级：非法组合必须在启动前被拒，并给出该 harness 的合法值。
test('非法 provider/effort 组合被拒并列出合法值', async () => {
  const fixture = createFixture();
  const fails = (args, pattern) => {
    try {
      resolveSelection(fixture, args);
      assert.fail(`未拒绝：${args.join(' ')}`);
    } catch (error) {
      assert.match(`${error.stderr || ''}${error.stdout || ''}${error.message}`, pattern, `${args.join(' ')} 的拒绝理由必须可读`);
    }
  };
  try {
    fails(['--provider', 'gemini'], /provider 必须为 claude、codex 或 pi/);
    fails(['--provider', 'codex', '--effort', 'none'], /不支持的 codex effort：?"none".*low\/medium\/high\/xhigh\/max/s);
    fails(['--provider', 'codex', '--effort', 'minimal'], /不支持的 codex effort/);
    fails(['--reviewer-effort', 'ultra'], /不支持的 claude effort/);
    fails(['--implementer-provider', 'pi', '--implementer-model', 'deepseek-v4.1-flash'], /准确 API-provider\/model/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 受控 pi 可执行文件会遮蔽真实 Pi 安装，而「声明式注册目录里这个模型支持哪些
// 档位」只能从真实安装读到——能力校验本身没有 fake 可注入。因此这一条**不做
// 夹具**：它明确依赖本机 Pi 安装，没有时整条跳过，而不是伪装成 hermetic 测试。
const realPiCatalogue = () => {
  try { return JSON.parse(command(process.execPath, [script, 'resolve-selection', '--repo', process.cwd(), '--provider', 'pi', '--model', 'cliproxy/deepseek-v4.1-flash', '--effort', 'high'], { timeout: 30_000 })); }
  catch { return undefined; }
};
test('Pi 模型级 effort 能力校验拦住不支持的档位', { skip: realPiCatalogue() === undefined ? '本机无可用真实 Pi 声明式目录' : false }, () => {
  const run = args => command(process.execPath, [script, 'resolve-selection', '--repo', process.cwd(), ...args], { timeout: 30_000 });
  const rejects = (args, pattern) => {
    try {
      run(args);
      assert.fail(`未拒绝：${args.join(' ')}`);
    } catch (error) {
      assert.match(`${error.stderr || ''}${error.stdout || ''}${error.message}`, pattern);
    }
  };
  // cliproxy/deepseek-v4.1-flash 支持 low/high/max，不支持 medium。
  rejects(['--provider', 'pi', '--model', 'cliproxy/deepseek-v4.1-flash', '--effort', 'medium'], /不支持 effort medium/);
  const accepted = JSON.parse(run(['--provider', 'pi', '--model', 'cliproxy/deepseek-v4.1-flash', '--effort', 'high']));
  assert.equal(accepted.roles.merger.effort, 'high');
  assert.equal(accepted.roles.merger.model, 'cliproxy/deepseek-v4.1-flash');
});

// 拼写错误的模型在目录可证明完整时必须启动即失败。本机 Pi 有 packages 配置，
// 无法证明目录完整性，因此这里只断言「绝不静默通过」——要么拒绝，要么给出
// 显式的未验证告警。两种行为都不允许 exit 0 且无任何提示。
test('Pi 未知模型要么启动即失败，要么显式告警', { skip: realPiCatalogue() === undefined ? '本机无可用真实 Pi 声明式目录' : false }, () => {
  let output, code = 0;
  try { output = command(process.execPath, [script, 'resolve-selection', '--repo', process.cwd(), '--provider', 'pi', '--model', 'cliproxy/no-such-model', '--effort', 'high'], { timeout: 30_000 }); }
  catch (error) { code = 1; output = `${error.stderr || ''}${error.stdout || ''}`; }
  if (code !== 0) { assert.match(output, /不存在模型|无法证明/); return; }
  const selection = JSON.parse(output);
  assert.equal(selection.roles.merger.capabilityVerified, false, '未知模型不得标记为能力已验证');
  assert.match(selection.roles.merger.capabilityNote, /无法证明/, '未知模型必须显式告警，不能静默通过');
});

// Codex 硬编码表曾腐坏（含 CLI 不支持的 none/minimal、缺 CLI 支持的 max）。
// 本机 codex debug models 的真实档位为 low/medium/high/xhigh/max。
test('Codex max 被接受，none/minimal 被拒（腐坏表已修正）', async () => {
  const fixture = createFixture();
  try {
    const selection = resolveSelection(fixture, ['--provider', 'codex', '--effort', 'max', '--model', 'gpt-5.6-luna']);
    assert.equal(selection.roles.merger.effort, 'max');
    assert.equal(selection.roles.merger.provider, 'codex');
    for (const level of ['low', 'medium', 'high', 'xhigh']) {
      assert.equal(resolveSelection(fixture, ['--provider', 'codex', '--effort', level]).effort, level, `Codex 应接受 ${level}`);
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// Pi 自动意图与 per-Role 显式指定共存且互不污染。自动路径能否成功取决于本机
// Pi 目录；不论成功还是 fail-closed，用户写下的显式 per-Role 配置都不得丢失。
// 这一条也依赖本机真实 Pi 安装（受控 pi 会遮蔽它）。
test('Pi 自动意图失败不影响显式 per-Role 指定', { skip: realPiCatalogue() === undefined ? '本机无可用真实 Pi 声明式目录' : false }, () => {
  const run = args => command(process.execPath, [script, 'resolve-selection', '--repo', process.cwd(), ...args], { timeout: 30_000 });
  // 显式 per-Role 不受自动路径结果影响。
  const selection = JSON.parse(run(['--provider', 'claude', '--implementer-provider', 'pi', '--implementer-model', 'cliproxy/deepseek-v4.1-flash', '--implementer-effort', 'high']));
  assert.equal(selection.roles.implementer.provider, 'pi');
  assert.equal(selection.roles.implementer.model, 'cliproxy/deepseek-v4.1-flash');
  assert.equal(selection.roles.implementer.effort, 'high');
  assert.equal(selection.roles.reviewer.provider, 'claude', '未指定的 Role 不得被 Pi 污染');
  assert.equal(selection.roles.reviewer.selectionSource, 'role-inherited-default');
  // 自动路径：要么给出可解析的 Pi 意图结果，要么 fail-closed 并说明原因。
  // 不允许既返回一个非 Pi 的结果又不说明。
  try {
    const auto = JSON.parse(run(['--provider', 'pi']));
    assert.equal(auto.roles.merger.provider, 'pi');
    assert.ok(auto.roles.merger.model, 'Pi 自动意图必须给出准确模型');
    assert.equal(auto.roles.merger.selectionSource, 'pi-declarative-intent');
  } catch (error) {
    assert.match(`${error.stderr || ''}${error.stdout || ''}${error.message}`, /动态来源|luna|无匹配|歧义/);
  }
});

// 启动期校验覆盖去重后的全部 harness：若某个 Role 的 CLI 缺失，必须在
// start 握手期就失败，而不是拖到该角色真正被派发时。
test('start 启动期检查全部用到的 harness 可执行文件', async () => {
  const fixture = createFixture({ omit: ['codex'] });
  try {
    addBranchCommit(fixture, 9);
    const args = [
      script, 'start', '--repo', fixture.repo, '--issues', '9',
      '--implementer-provider', 'pi', '--implementer-model', 'cliproxy/deepseek-v4.1-flash', '--implementer-effort', 'high',
      '--reviewer-provider', 'claude', '--reviewer-model', 'opus', '--reviewer-effort', 'high',
      '--merger-provider', 'codex', '--merger-effort', 'max',
    ];
    // 收窄 PATH：本机真实安装的 codex 不能让缺项检查被绕过。
    const env = { ...fixture.env, PATH: `${join(fixture.root, 'bin')}:/usr/bin:/bin` };
    assert.throws(
      () => command(process.execPath, args, { env, timeout: 30_000 }),
      error => /codex/.test(`${error.stderr || ''}${error.stdout || ''}${error.message}`),
      '缺少 codex 可执行文件应在启动期失败而不是拖到 Merger 启动',
    );
    // pi 在 codex 之前被探针检查，证明检查是按实际用到的 provider 逐个进行，
    // 而不是只检查顶层默认的那一个。
    assert.match(providerLog(fixture).join('\n'), /pi --version/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 启动输出必须逐角色反映该 Role 实际使用的 harness/模型/来源，
// 否则用户在派发前无法发现自己填错了哪一格。
test('启动输出逐角色展示 harness/模型/effort/来源', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = JSON.parse(command(process.execPath, [
      script, 'start', '--repo', fixture.repo, '--issues', '9',
      '--provider', 'claude', '--model', 'sonnet', '--effort', 'medium',
      '--implementer-provider', 'pi', '--implementer-model', 'cliproxy/deepseek-v4.1-flash', '--implementer-effort', 'high',
    ], { env: fixture.env, timeout: 15_000 }));
    runDir = started.logDir;
    assert.deepEqual(
      { ...started.roles.implementer, capability: undefined },
      { harness: 'pi', model: 'cliproxy/deepseek-v4.1-flash', effort: 'high', source: '显式指定（认证未验证）', capability: undefined },
    );
    // 受控 pi 遮蔽真实 Pi 安装，因此能力结论必然是显式的「未验证」，
    // 不允许静默留空或声称已验证。
    assert.match(started.roles.implementer.capability, /能力未验证/);
    // 未指定 Role 明确标注继承，不静默等同于显式。
    for (const role of ['reviewer', 'merger']) {
      assert.deepEqual(
        { ...started.roles[role], capability: undefined },
        { harness: 'claude', model: 'sonnet', effort: 'medium', source: '继承顶层默认', capability: undefined },
        `${role} 应显示继承顶层默认`,
      );
    }
    // selection.json 完整记录每角色 provider/model/effort/来源，供事后审计。
    const selection = JSON.parse(readFileSync(join(runDir, 'selection.json'), 'utf8'));
    assert.deepEqual(Object.keys(selection.roles).sort(), ['implementer', 'merger', 'reviewer']);
    assert.deepEqual(
      Object.fromEntries(['implementer', 'reviewer', 'merger'].map(role => [role, selection.roles[role].selectionSource])),
      { implementer: 'explicit-unverified', reviewer: 'role-inherited-default', merger: 'role-inherited-default' },
    );
    assert.equal(selection.roles.implementer.provider, 'pi');
    assert.equal(selection.roles.merger.model, 'sonnet');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 混 harness 时每个被用到的 harness 都必须被启动期探针检查，且该 Role 的
// 观测标签反映它实际使用的 harness，而不是 run 级单值。
test('混 harness 时每个用到的 harness 都被检查，观测标签逐角色区分', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    addBranchCommit(fixture, 9);
    const started = JSON.parse(command(process.execPath, [
      script, 'start', '--repo', fixture.repo, '--issues', '9',
      // 受控 pi 会遮蔽真实 Pi 安装，因此这里用显式模型（跳过自动发现，
      // 能力结论降级为未验证），只验证混 harness 的检查与标签。
      '--implementer-provider', 'pi', '--implementer-model', 'cliproxy/deepseek-v4.1-flash', '--implementer-effort', 'high',
      '--reviewer-provider', 'codex', '--reviewer-model', 'gpt-5.6-luna', '--reviewer-effort', 'max',
      '--merger-provider', 'claude', '--merger-effort', 'high',
    ], { env: fixture.env, timeout: 15_000 }));
    runDir = started.logDir;
    const probes = providerLog(fixture).filter(line => line.endsWith('--version'));
    assert.ok(probes.some(line => line.startsWith('pi ')), `pi 未被启动期检查：${probes.join('；')}`);
    assert.ok(probes.some(line => line.startsWith('codex ')), `codex 未被启动期检查：${probes.join('；')}`);
    // 观测标签以该 Role 实际使用的 harness 命名，三个 Role 各不相同。
    assert.equal(started.roles.implementer.harness, 'pi');
    assert.equal(started.roles.reviewer.harness, 'codex');
    assert.equal(started.roles.merger.harness, 'claude');
    const selection = JSON.parse(readFileSync(join(runDir, 'selection.json'), 'utf8'));
    assert.deepEqual(
      Object.fromEntries(['implementer', 'reviewer', 'merger'].map(role => [role, selection.roles[role].provider])),
      { implementer: 'pi', reviewer: 'codex', merger: 'claude' },
    );
    await stopRun(runDir, fixture.env);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
