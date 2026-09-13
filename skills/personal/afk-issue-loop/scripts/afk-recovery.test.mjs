import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'afk-recovery-'));
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  const roleLog = join(root, 'roles.log');
  const issueStateDir = join(root, 'issues');
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
  issue)
    [ "\${2:-}" = 'close' ] || exit 1
    printf '%s' 'closed' > "$AFK_ISSUE_STATE_DIR/$3"
    ;;
  api)
    endpoint=''
    for arg in "$@"; do case "$arg" in repos/*) endpoint="$arg" ;; esac; done
    case "$endpoint" in
      repos/owner/repo/issues/*/comments*) printf '%s\\n' '[[]]' ;;
      repos/owner/repo/issues/10/dependencies/blocked_by*)
        if [ "\${AFK_ISSUE_10_BLOCKED_BY_9:-0}" = '1' ]; then printf '%s\\n' '[[{"number":9,"state":"open","repository_url":"https://api.github.com/repos/owner/repo","html_url":"https://github.com/owner/repo/issues/9"}]]'
        else printf '%s\\n' '[[]]'; fi
        ;;
      repos/owner/repo/issues/*/dependencies/blocked_by*) printf '%s\\n' '[[]]' ;;
      repos/owner/repo/issues/*/parent) printf '%s\\n' 'HTTP 404' >&2; exit 1 ;;
      repos/owner/repo/issues/*)
        number="\${endpoint##*/}"
        state="$(cat "$AFK_ISSUE_STATE_DIR/$number")"
        case "$number" in
          9) state="\${AFK_ISSUE_9_STATE:-$state}" ;;
          10) state="\${AFK_ISSUE_10_STATE:-$state}" ;;
          *) printf 'unknown issue: %s\\n' "$number" >&2; exit 1 ;;
        esac
        printf '{"number":%s,"state":"%s","title":"恢复现场 %s","body":"","labels":[{"name":"ready-for-agent"}]}\\n' "$number" "$state" "$number"
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
  const fakeClaude = join(root, 'fake-claude.mjs');
  writeFileSync(fakeClaude, `
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
const jsonStart = prompt.lastIndexOf('\\n{');
const input = JSON.parse(prompt.slice(jsonStart + 1));
const context = input.context;
appendFileSync(process.env.AFK_ROLE_LOG, JSON.stringify({ role: context.role, ticket: context.ticket?.number, mode: context.mode, cwd: process.cwd() }) + '\\n');
const behavior = process.env.AFK_ROLE_BEHAVIOR || 'hang';
// 原始 transport 负载先于 provider-specific 解析进入 Observation journal。
// 未识别事件、完整 tool-call 参数、stdout/stderr 都必须被忠实保留。
process.stdout.write(JSON.stringify({ type: 'assistant', message: { content: [
  { type: 'text', text: '正在检查现场\\n完整原文 <b>不脱敏</b> & 不截断：' + 'x'.repeat(300) },
  { type: 'tool_use', name: 'Bash', input: { command: 'git status --porcelain --untracked-files=all', otherField: '必须保留' } },
] } }) + '\\n');
process.stdout.write(JSON.stringify({ type: 'afk-fixture-unknown-event', subtype: 'not-recognised', payload: { nested: [1, 2, 3], text: '未知事件 <完整保留>' } }) + '\\n');
process.stderr.write('fixture stderr：完整错误原文\\n');
if (behavior === 'merge-verification-fails' && context.role === 'merger') {
  for (const item of context.items) execFileSync('git', ['merge', '--no-edit', item.workspace.branch], { cwd: context.cwd });
  const result = {
    run: context.run, attempt: context.attempt, role: context.role,
    status: 'failed', summary: '目标验证失败', tests: [{ command: 'fixture verify', status: 'failed', summary: 'fixture failure' }], remaining: ['修复目标验证'],
    branch: context.branch, cwd: context.cwd, summaryCreated: false, summarySubject: null,
    tickets: context.items.map(item => ({ ticket: item.ticket.number, branch: item.workspace.branch, merged: true, verified: false, closed: false })),
  };
  process.stdout.write(JSON.stringify({ type: 'result', result: '<afk-result>' + JSON.stringify(result) + '</afk-result>' }) + '\\n');
} else if (behavior === 'full-delivery' && context.role === 'merger') {
  const subject = 'chore(afk): 完成恢复交付';
  if (context.mode === 'merge') {
    for (const item of context.items) execFileSync('git', ['merge', '--no-edit', item.workspace.branch], { cwd: context.cwd });
    execFileSync('git', ['commit', '--allow-empty', '-m', subject], { cwd: context.cwd });
  } else {
    for (const item of context.items) execFileSync('gh', ['issue', 'close', String(item.ticket.number), '--repo', input.repository]);
  }
  const result = {
    run: context.run, attempt: context.attempt, role: context.role,
    status: 'passed', summary: context.mode === 'merge' ? '合并验证完成，等待持久化后关闭' : 'Issue 已关闭',
    tests: [], remaining: [], branch: context.branch, cwd: context.cwd,
    summaryCreated: true, summarySubject: subject,
    tickets: context.items.map(item => ({ ticket: item.ticket.number, branch: item.workspace.branch, merged: true, verified: true, closed: context.mode === 'close' })),
  };
  process.stdout.write(JSON.stringify({ type: 'result', result: '<afk-result>' + JSON.stringify(result) + '</afk-result>' }) + '\\n');
} else {
  const shouldPass = (behavior === 'implement-pass-review-hang' && context.role === 'implementer')
    || (behavior === 'ir-pass-merger-hang' && context.role !== 'merger')
    || (behavior === 'full-delivery' && context.role !== 'merger')
    || (behavior === 'merge-verification-fails' && context.role !== 'merger');
  if (shouldPass) {
    const result = {
      run: context.run, attempt: context.attempt, role: context.role,
      status: 'passed', summary: '复用已有实现，无需新增提交', tests: [], remaining: [],
      branch: context.branch, cwd: context.cwd, ticket: context.ticket.number,
      commits: ['已有可交付提交'],
    };
    process.stdout.write(JSON.stringify({ type: 'result', result: '<afk-result>' + JSON.stringify(result) + '</afk-result>' }) + '\\n');
  } else {
    while (true) await delay(1_000);
  }
}
`);
  writeExecutable(join(bin, 'claude'), `
if [ "\${1:-}" = '--version' ]; then printf '%s\\n' 'claude fixture'; exit 0; fi
exec "${process.execPath}" "$AFK_FAKE_CLAUDE" "$@"`);

  // 测试不打开真实浏览器；只验证 URL 与 server 行为。
  const env = { ...process.env, AFK_DASHBOARD_OPEN: '0', PATH: `${bin}:${process.env.PATH}`, AFK_ROLE_LOG: roleLog, AFK_FAKE_CLAUDE: fakeClaude, AFK_ISSUE_STATE_DIR: issueStateDir };
  return { root, repo, roleLog, env };
}

async function waitUntil(predicate, message, timeoutMs = 6_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  assert.fail(typeof message === 'function' ? message() : message);
}

async function stopRun(runDir, env) {
  if (!runDir || existsSync(join(runDir, 'result.json'))) return;
  try { command(process.execPath, [script, 'stop', '--run', runDir], { env }); } catch {}
  await waitUntil(() => existsSync(join(runDir, 'result.json')), 'AFK stop 后未写入最终结果');
}

async function startAndWaitForRole(fixture, issues = '9') {
  const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', issues], { env: fixture.env, timeout: 15_000 }));
  await waitUntil(
    () => existsSync(fixture.roleLog) || existsSync(join(started.logDir, 'result.json')),
    () => ['AFK 未派发角色也未结束', 'events:', existsSync(join(started.logDir, 'events.jsonl')) ? readFileSync(join(started.logDir, 'events.jsonl'), 'utf8') : '(none)', 'daemon:', existsSync(join(started.logDir, 'daemon.log')) ? readFileSync(join(started.logDir, 'daemon.log'), 'utf8') : '(none)'].join('\n'),
  );
  return started;
}

function roleEntries(fixture) {
  if (!existsSync(fixture.roleLog)) return [];
  return readFileSync(fixture.roleLog, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function addBranchCommit(fixture, number, keepWorktree) {
  const branch = `afk/issue-${number}`;
  const worktree = join(fixture.root, `prepared-${number}`);
  command('git', ['-C', fixture.repo, 'branch', branch]);
  command('git', ['-C', fixture.repo, 'worktree', 'add', '-q', worktree, branch]);
  writeFileSync(join(worktree, `issue-${number}.txt`), 'implemented\n');
  command('git', ['-C', worktree, 'add', `issue-${number}.txt`]);
  command('git', ['-C', worktree, 'commit', '-q', '-m', `feat: issue ${number}`]);
  if (!keepWorktree) command('git', ['-C', fixture.repo, 'worktree', 'remove', worktree]);
  return { branch, worktree };
}

test('已有标准 worktree 时默认在原现场恢复且保留 dirty 修改', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    const branch = 'afk/issue-9';
    const worktree = join(fixture.root, 'existing-worktree');
    command('git', ['-C', fixture.repo, 'branch', branch]);
    command('git', ['-C', fixture.repo, 'worktree', 'add', '-q', worktree, branch]);
    writeFileSync(join(worktree, 'implemented.txt'), 'committed\n');
    command('git', ['-C', worktree, 'add', 'implemented.txt']);
    command('git', ['-C', worktree, 'commit', '-q', '-m', 'feat: 已有成果']);
    writeFileSync(join(worktree, 'interrupted.txt'), 'dirty progress\n');

    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;

    const roles = roleEntries(fixture);
    assert.equal(roles[0]?.cwd, realpathSync(worktree), existsSync(join(runDir, 'result.json')) ? readFileSync(join(runDir, 'result.json'), 'utf8') : 'Implementer 未在原 worktree 启动');
    assert.equal(readFileSync(join(worktree, 'interrupted.txt'), 'utf8'), 'dirty progress\n');
    assert.equal(command('git', ['-C', worktree, 'branch', '--show-current']), branch);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('只有标准分支时为同一分支恢复 worktree', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    const { branch } = addBranchCommit(fixture, 9, false);
    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;

    const roleCwd = roleEntries(fixture)[0].cwd;
    assert.equal(command('git', ['-C', roleCwd, 'branch', '--show-current']), branch);
    assert.notEqual(roleCwd, realpathSync(fixture.repo));
    const status = JSON.parse(command(process.execPath, [script, 'status', '--run', runDir], { env: fixture.env }));
    assert.equal(status.recovery['9'].state, 'recovered-branch');
    const records = command('git', ['-C', fixture.repo, 'worktree', 'list', '--porcelain']);
    assert.equal(records.split('\n').filter(line => line === `branch refs/heads/${branch}`).length, 1);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('没有标准现场时才创建 afk/issue-N', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;
    const roleCwd = roleEntries(fixture)[0].cwd;
    assert.equal(command('git', ['-C', roleCwd, 'branch', '--show-current']), 'afk/issue-9');
    const status = JSON.parse(command(process.execPath, [script, 'status', '--run', runDir], { env: fixture.env }));
    assert.equal(status.recovery['9'].state, 'created');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('已关闭 Issue 不创建现场或派发角色', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ISSUE_9_STATE = 'closed';
  try {
    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    await waitUntil(() => existsSync(join(started.logDir, 'result.json')), 'closed Issue 运行未结束');
    const result = JSON.parse(readFileSync(join(started.logDir, 'result.json'), 'utf8'));
    assert.equal(result.state, 'completed');
    assert.deepEqual(result.tickets, []);
    assert.equal(result.recovery['9'].state, 'skipped-closed');
    assert.equal(existsSync(fixture.roleLog), false);
    assert.equal(command('git', ['-C', fixture.repo, 'branch', '--list', 'afk/issue-9']), '');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Implementer 复用已有提交且不新增提交时仍交给 Reviewer', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'implement-pass-review-hang';
  let runDir;
  try {
    const { worktree } = addBranchCommit(fixture, 9, true);
    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;
    await waitUntil(() => roleEntries(fixture).length >= 2 || existsSync(join(runDir, 'result.json')), 'Implementer 完成后未派发 Reviewer');

    const roles = roleEntries(fixture);
    assert.deepEqual(roles.slice(0, 2).map(entry => entry.role), ['implementer', 'reviewer']);
    assert.equal(roles[0].cwd, realpathSync(worktree));
    assert.equal(roles[1].cwd, realpathSync(worktree));
    assert.equal(command('git', ['-C', worktree, 'rev-list', '--count', 'main..afk/issue-9']), '1');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('遗留 writer socket 不冒充活跃写者并允许恢复', async () => {
  const fixture = createFixture();
  let runDir;
  let socketPath;
  try {
    addBranchCommit(fixture, 9, true);
    const common = realpathSync(command('git', ['-C', fixture.repo, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
    const key = createHash('sha256').update(`${common}\0afk/issue-9`).digest('hex').slice(0, 32);
    socketPath = join(tmpdir(), `afk-writer-${key}.sock`);
    writeFileSync(socketPath, 'stale');

    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;
    assert.equal(roleEntries(fixture)[0]?.role, 'implementer');
  } finally {
    await stopRun(runDir, fixture.env);
    if (socketPath) rmSync(socketPath, { force: true });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('recoverer 崩溃留下的 recovery guard 可按当前 PID 事实恢复', async () => {
  const fixture = createFixture();
  let runDir;
  let socketPath;
  try {
    addBranchCommit(fixture, 9, true);
    const common = realpathSync(command('git', ['-C', fixture.repo, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
    const key = createHash('sha256').update(`${common}\0afk/issue-9`).digest('hex').slice(0, 32);
    socketPath = join(tmpdir(), `afk-writer-${key}.sock`);
    writeFileSync(socketPath, 'stale');
    symlinkSync('2147483646', `${socketPath}.recovery`);

    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;
    assert.equal(roleEntries(fixture)[0]?.role, 'implementer');
    assert.equal(existsSync(`${socketPath}.recovery`), false);
  } finally {
    await stopRun(runDir, fixture.env);
    if (socketPath) {
      rmSync(socketPath, { force: true });
      rmSync(`${socketPath}.recovery`, { force: true });
    }
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('历史 role-start 不完整不冒充 active writer，liveness-first 继续恢复', async () => {
  const fixture = createFixture();
  let socketPath;
  try {
    addBranchCommit(fixture, 9, true);
    const common = realpathSync(command('git', ['-C', fixture.repo, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
    const key = createHash('sha256').update(`${common}\0afk/issue-9`).digest('hex').slice(0, 32);
    socketPath = join(tmpdir(), `afk-writer-${key}.sock`);
    writeFileSync(socketPath, 'stale');
    const oldLog = join(fixture.repo, '.afk', 'logs', 'interrupted-run');
    mkdirSync(oldLog, { recursive: true });
    writeFileSync(join(oldLog, 'events.jsonl'), `${JSON.stringify({ type: 'role-start', role: 'implementer', tickets: [9] })}\n`);

    const started = await startAndWaitForRole(fixture);
    assert.equal(roleEntries(fixture)[0]?.role, 'implementer');
    await stopRun(started.logDir, fixture.env);
  } finally {
    if (socketPath) rmSync(socketPath, { force: true });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('未知 writer socket 响应不冒充 active ownership，继续恢复', async () => {
  const fixture = createFixture();
  let server;
  let socketPath;
  try {
    addBranchCommit(fixture, 9, true);
    const common = realpathSync(command('git', ['-C', fixture.repo, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
    const key = createHash('sha256').update(`${common}\0afk/issue-9`).digest('hex').slice(0, 32);
    socketPath = join(tmpdir(), `afk-writer-${key}.sock`);
    server = createServer(socket => socket.end('unknown writer\n'));
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(socketPath, resolveListen);
    });

    const started = await startAndWaitForRole(fixture);
    assert.equal(roleEntries(fixture)[0]?.role, 'implementer');
    await stopRun(started.logDir, fixture.env);
  } finally {
    if (server) await new Promise(resolveClose => server.close(resolveClose));
    if (socketPath) rmSync(socketPath, { force: true });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('分支提交已在目标中时跳过重复实现和 merge，直接继续验证关闭', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    const { branch } = addBranchCommit(fixture, 9, true);
    command('git', ['-C', fixture.repo, 'merge', '-q', '--no-edit', branch]);

    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;
    const firstRole = roleEntries(fixture)[0];
    assert.equal(firstRole?.role, 'merger');
    assert.equal(firstRole?.cwd, realpathSync(fixture.repo));
    const status = JSON.parse(command(process.execPath, [script, 'status', '--run', runDir], { env: fixture.env }));
    assert.equal(status.recovery['9'].state, 'merged-unverified');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('原现场有活跃写者时该票等待，其他安全票继续', async () => {
  const fixture = createFixture();
  let firstRun;
  let secondRun;
  try {
    addBranchCommit(fixture, 9, true);
    addBranchCommit(fixture, 10, true);
    firstRun = await startAndWaitForRole(fixture, '9');
    assert.deepEqual(roleEntries(fixture).map(entry => entry.ticket), [9]);

    secondRun = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9,10'], { env: fixture.env, timeout: 15_000 }));
    await waitUntil(
      () => roleEntries(fixture).some(entry => entry.ticket === 10) || existsSync(join(secondRun.logDir, 'result.json')),
      '活跃写者阻塞一票时，独立票未继续',
    );
    const roles = roleEntries(fixture);
    assert.equal(roles.filter(entry => entry.ticket === 9).length, 1);
    assert.equal(roles.filter(entry => entry.ticket === 10).length, 1);
    const status = JSON.parse(command(process.execPath, [script, 'status', '--run', secondRun.logDir], { env: fixture.env }));
    assert.equal(status.recovery['9'].state, 'waiting-writer');
    assert.equal(status.recovery['10'].state, 'recovered-worktree');
  } finally {
    await stopRun(secondRun?.logDir, fixture.env);
    await stopRun(firstRun?.logDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('旧 daemon ownership channel 消失后不凭历史 PID 阻止新 run', async () => {
  const fixture = createFixture();
  let oldRun;
  let newRun;
  let rolePid;
  let writerPath;
  try {
    addBranchCommit(fixture, 9, true);
    oldRun = await startAndWaitForRole(fixture);
    const control = JSON.parse(readFileSync(join(oldRun.logDir, 'control.json'), 'utf8'));
    const oldEvents = readFileSync(join(oldRun.logDir, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    rolePid = oldEvents.find(event => event.type === 'role-process' && event.role === 'implementer').managedPid;
    const common = realpathSync(command('git', ['-C', fixture.repo, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
    const key = createHash('sha256').update(`${common}\0afk/issue-9`).digest('hex').slice(0, 32);
    writerPath = join(tmpdir(), `afk-writer-${key}.sock`);

    process.kill(control.pid, 'SIGKILL');
    await waitUntil(() => {
      try { process.kill(control.pid, 0); return false; } catch (error) { return error.code === 'ESRCH'; }
    }, '旧 daemon 未退出');
    writeFileSync(join(oldRun.logDir, 'events.jsonl'), `${JSON.stringify({ type: 'role-end', role: 'implementer', tickets: [9], terminationConfirmed: false })}\n`, { flag: 'a' });

    // liveness-first：没有明确 active ownership channel 响应时，
    // 历史 PID/PGID 与不完整事件只作为 Recovery 观察事实，不阻止接管。
    newRun = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    await waitUntil(
      () => roleEntries(fixture).filter(entry => entry.ticket === 9).length >= 2 || existsSync(join(newRun.logDir, 'result.json')),
      '新 run 未在 ownership channel 消失后接管并派发',
    );
    assert.equal(roleEntries(fixture).filter(entry => entry.ticket === 9).length, 2);
    const status = JSON.parse(command(process.execPath, [script, 'status', '--run', newRun.logDir], { env: fixture.env }));
    assert.notEqual(status.recovery['9'].state, 'waiting-writer');
  } finally {
    await stopRun(newRun?.logDir, fixture.env);
    if (rolePid) {
      try { process.kill(-rolePid, 'SIGTERM'); } catch {}
      await waitUntil(() => {
        try { process.kill(-rolePid, 0); return false; } catch (error) { return error.code === 'ESRCH'; }
      }, '旧角色进程组未结束');
    }
    if (oldRun) {
      const controlPath = join(oldRun.logDir, 'control.json');
      if (existsSync(controlPath)) {
        const control = JSON.parse(readFileSync(controlPath, 'utf8'));
        rmSync(control.socket, { force: true });
      }
    }
    if (writerPath) rmSync(writerPath, { force: true });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('目标 dirty 时保留已审查队列，恢复 clean 后不重跑 I/R 直接派 Merger', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'ir-pass-merger-hang';
  let runDir;
  let competingRun;
  const targetDirty = join(fixture.repo, 'user-change.txt');
  try {
    addBranchCommit(fixture, 9, true);
    writeFileSync(targetDirty, 'user change\n');
    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;
    await waitUntil(() => roleEntries(fixture).filter(entry => entry.ticket === 9).length >= 2, 'dirty 目标下 I/R 未完成');
    assert.deepEqual(roleEntries(fixture).map(entry => entry.role), ['implementer', 'reviewer']);

    competingRun = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    // liveness-first：active writer 仍在运行时该票保持 waiting-writer，
    // 竞争 run 保持存活并定期重新做正向活跃检测，直到原 run 结束。
    await waitUntil(() => {
      try {
        const status = JSON.parse(command(process.execPath, [script, 'status', '--run', competingRun.logDir], { env: fixture.env }));
        return status.recovery?.['9']?.state === 'waiting-writer';
      } catch { return false; }
    }, 'active writer 未使竞争 run 进入 waiting-writer', 15_000);
    assert.deepEqual(roleEntries(fixture).map(entry => entry.role), ['implementer', 'reviewer']);

    rmSync(targetDirty);
    await waitUntil(() => roleEntries(fixture).some(entry => entry.role === 'merger'), '目标恢复 clean 后未派发 Merger', 10_000);
    assert.deepEqual(roleEntries(fixture).map(entry => entry.role), ['implementer', 'reviewer', 'merger']);
  } finally {
    await stopRun(competingRun?.logDir, fixture.env);
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('依赖未交付时保留既有现场并公开等待分类', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ISSUE_10_BLOCKED_BY_9 = '1';
  try {
    const { worktree } = addBranchCommit(fixture, 10, true);
    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '10'], { env: fixture.env, timeout: 15_000 }));
    await waitUntil(() => existsSync(join(started.logDir, 'result.json')), '依赖等待运行未结束');
    const result = JSON.parse(readFileSync(join(started.logDir, 'result.json'), 'utf8'));
    assert.equal(result.state, 'waiting-user');
    assert.equal(result.recovery['10'].state, 'waiting');
    assert.equal(result.recovery['10'].site, 'detected-worktree');
    assert.equal(result.recovery['10'].cwd, realpathSync(worktree));
    assert.equal(existsSync(fixture.roleLog), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('已合并但目标验证失败时保持 Issue open', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'merge-verification-fails';
  let runDir;
  try {
    addBranchCommit(fixture, 9, true);
    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;
    await waitUntil(() => roleEntries(fixture).some(entry => entry.role === 'merger'), '验证失败场景未派发 Merger');
    await waitUntil(() => {
      if (!existsSync(join(runDir, 'events.jsonl'))) return false;
      return readFileSync(join(runDir, 'events.jsonl'), 'utf8').includes('目标验证失败');
    }, 'Merger 验证失败结果未记录');
    assert.equal(readFileSync(join(fixture.env.AFK_ISSUE_STATE_DIR, '9'), 'utf8'), 'open');
    assert.equal(roleEntries(fixture).some(entry => entry.mode === 'close'), false);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('公开 start/status 提供 localhost 只读 Dashboard，页面关闭不影响 run', async () => {
  const fixture = createFixture();
  let runDir;
  try {
    const started = await startAndWaitForRole(fixture);
    runDir = started.logDir;
    assert.equal(started.dashboard.state, 'available');
    assert.match(started.dashboard.url, /^http:\/\/127\.0\.0\.1:\d+\/?\?token=[^&]+$/);
    assert.match(started.dashboard.reopenCommand, /['"]dashboard['"] ['"]--run['"]/);
    assert.equal(started.dashboard.url.includes(JSON.parse(readFileSync(join(runDir, 'control.json'), 'utf8')).token), false);

    const response = await fetch(started.dashboard.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const html = await response.text();
    assert.match(html, /Ticket Kanban/);
    assert.match(html, /Output Inspector/);
    assert.doesNotMatch(html, /https?:\/\/(?!127\.0\.0\.1)/);

    const status = JSON.parse(command(process.execPath, [script, 'status', '--run', runDir], { env: fixture.env }));
    assert.equal(status.dashboard.url, started.dashboard.url);
    assert.equal(status.dashboard.completeness, 'complete');
    assert.equal(existsSync(join(runDir, 'observations.jsonl')), true);
    assert.equal((await import('node:fs')).statSync(join(runDir, 'observations.jsonl')).mode & 0o777, 0o600);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('先持久化合并验证结果，再用 close-only 关闭 Issue', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'full-delivery';
  try {
    addBranchCommit(fixture, 9, true);
    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    await waitUntil(() => existsSync(join(started.logDir, 'result.json')), '完整恢复交付未结束', 15_000);
    const result = JSON.parse(readFileSync(join(started.logDir, 'result.json'), 'utf8'));
    assert.equal(result.state, 'completed');
    assert.equal(readFileSync(join(fixture.env.AFK_ISSUE_STATE_DIR, '9'), 'utf8'), 'closed');
    assert.deepEqual(roleEntries(fixture).map(entry => entry.role), ['implementer', 'reviewer', 'merger', 'merger']);

    const events = readFileSync(join(started.logDir, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const persisted = events.findIndex(event => event.type === 'merge-progress' && event.phase === 'close' && event.tickets.every(ticket => ticket.closed === false));
    const mergerStarts = events.map((event, index) => event.type === 'role-start' && event.role === 'merger' ? index : -1).filter(index => index >= 0);
    assert.ok(persisted >= 0);
    assert.ok(mergerStarts[1] > persisted);
    command('git', ['-C', fixture.repo, 'merge-base', '--is-ancestor', 'afk/issue-9', 'main']);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
