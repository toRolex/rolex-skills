import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Processes } from './processes.mjs';

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
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
const jsonStart = prompt.lastIndexOf('\\n{');
const input = JSON.parse(prompt.slice(jsonStart + 1));
const context = input.context;
appendFileSync(process.env.AFK_ROLE_LOG, JSON.stringify({ role: context.role, ticket: context.ticket?.number, mode: context.mode, cwd: process.cwd() }) + '\\n');
const behavior = process.env.AFK_ROLE_BEHAVIOR || 'hang';
// 载体层失败：中途只给出失败的 provider 结果与文本，没有任何 <afk-result> 封套，
// 进程正常退出 => role 返回 failed 且不带 run 键（引擎无法据此做业务判断）。
// 用于证明「载体层失败不计入停滞」与「引擎业务判断连续失败仍会停滞」的区别。
if (behavior === 'carrier-failure') {
  process.stdout.write(JSON.stringify({ type: 'result', result: '载体层失败：provider 返回 500 EOF，未产生结构化结果', is_error: true, subtype: 'error_during_execution', permission_denials: [] }) + '\\n');
  process.exit(0);
}
if (behavior === 'escaped-writer') {
  const escaped = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: true,
    stdio: ['ignore', process.stdout, process.stderr],
  });
  appendFileSync(process.env.AFK_ESCAPED_PID_LOG, String(escaped.pid) + '\\n');
  escaped.unref();
}
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
} else if (behavior === 'swallow-baseline' && context.role === 'merger') {
  const subject = 'chore(afk): 违规吞并用户改动';
  if (context.mode === 'merge') {
    for (const item of context.items) execFileSync('git', ['merge', '--no-edit', item.workspace.branch], { cwd: context.cwd });
    // 违规：管理员契约要求 summary 用空提交承载，这里故意把工作区里的用户改动
    // 一并提交，模拟「用户改动凭空消失、变成别人的提交」。
    execFileSync('git', ['add', '-A'], { cwd: context.cwd });
    execFileSync('git', ['commit', '-m', subject], { cwd: context.cwd });
  } else {
    for (const item of context.items) execFileSync('gh', ['issue', 'close', String(item.ticket.number), '--repo', input.repository]);
  }
  const result = {
    run: context.run, attempt: context.attempt, role: context.role,
    status: 'passed', summary: '合并验证完成，等待持久化后关闭',
    tests: [], remaining: [], branch: context.branch, cwd: context.cwd,
    summaryCreated: true, summarySubject: subject,
    tickets: context.items.map(item => ({ ticket: item.ticket.number, branch: item.workspace.branch, merged: true, verified: true, closed: context.mode === 'close' })),
  };
  process.stdout.write(JSON.stringify({ type: 'result', result: '<afk-result>' + JSON.stringify(result) + '</afk-result>' }) + '\\n');
} else if (behavior === 'pure-skill-delivery' && context.role === 'merger') {
  const subject = 'chore(afk): 纯 skill 仓库交付';
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
  // Reviewer 带封套业务拒绝的停滞覆盖：Implementer 每轮通过（自报 passed +
  // commits 非空，分支真实提交由 addBranchCommit 预置），Reviewer 每轮返回
  // 逐字相同的 failed 封套。failed 不会首轮直接 blocks.set（只有 blocked 会），
  // 因此走 gateReject 计数，同因 3 轮后转入等待用户。
  if (behavior === 'reviewer-failed-stagnation') {
    if (context.role !== 'implementer' && context.role !== 'reviewer') {
      while (true) await delay(1_000);
    }
    const result = context.role === 'implementer'
      ? {
        run: context.run, attempt: context.attempt, role: context.role,
        status: 'passed', summary: '实现完成', tests: [], remaining: [],
        branch: context.branch, cwd: context.cwd, ticket: context.ticket.number,
        commits: ['已有可交付提交'],
      }
      : {
        run: context.run, attempt: context.attempt, role: context.role,
        status: 'failed', summary: '审查不通过：缺少必要的回归验证', tests: [], remaining: [],
        branch: context.branch, cwd: context.cwd, ticket: context.ticket.number,
        commits: [],
      };
    writeSync(1, JSON.stringify({ type: 'result', result: '<afk-result>' + JSON.stringify(result) + '</afk-result>' }) + '\\n');
    process.exit(0);
  }
  // 权限误判回归（issue #12）：Reviewer 过程中试过一次被本机 hook 拦截的工具
  // （user tool_result is_error，内容含 approval rejected），随后自己改道完成任务
  // 并给出合法封套。过程性拒绝记录不得有否决权：终局成功会清掉它。
  // 注意终局 result 仍带非空 permission_denials——按新语义它只在失败终局才被采信。
  if (behavior === 'permission-recovered') {
    const blocked = JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', is_error: true, content: 'Error: the tool call was rejected by user approval settings; this request is blocked by the local security hook.' }] } });
    // 最终序列必须是「一次被拦截的工具结果」紧接「成功终局」：过程中没有任何
    // 结构化封套，因此终局结果就是引擎唯一可采信的业务信号。成功终局仍带非空
    // permission_denials ——按新语义它只在失败终局才被采信。
    if (context.role === 'reviewer') {
      const denied = JSON.stringify({ type: 'result', result: '<afk-result>' + JSON.stringify({
        run: context.run, attempt: context.attempt, role: context.role,
        status: 'passed', summary: '工具被拦截后改道完成审查，tests 对复核者不适用', tests: [], remaining: [],
        branch: context.branch, cwd: context.cwd, ticket: context.ticket.number,
        commits: ['已有可交付提交'],
      }) + '</afk-result>', is_error: false, subtype: 'success', permission_denials: ['Bash'] });
      // 两次同步写：把「先被看到 vs 先被解析」的时序偶发性降到最低。
      writeSync(1, blocked + '\\n');
      writeSync(1, denied + '\\n');
      process.exit(0);
    }
    // Implementer 保持正常成功终局，使流程确实走到 Reviewer。
    const done = JSON.stringify({ type: 'result', result: '<afk-result>' + JSON.stringify({
      run: context.run, attempt: context.attempt, role: context.role,
      status: 'passed', summary: '实现完成', tests: [], remaining: [],
      branch: context.branch, cwd: context.cwd, ticket: context.ticket.number,
      commits: ['已有可交付提交'],
    }) + '</afk-result>', is_error: false, subtype: 'success', permission_denials: [] });
    writeSync(1, done + '\\n');
    process.exit(0);
  }
  // 纯 Skill 仓库形状：无 tests/、无类型检查。Implementer 会留下真实的未跟踪
  // 安装产物；Reviewer 无改动可交付（commits 为空）。
  if (behavior === 'pure-skill-delivery' && context.role === 'implementer') {
    mkdirSync(join(process.cwd(), '.agents', 'skills', 'demo-skill'), { recursive: true });
    writeFileSync(join(process.cwd(), '.agents', 'skills', 'demo-skill', 'SKILL.md'), 'installed residue\\n');
    writeFileSync(join(process.cwd(), 'skills-lock.json'), '{"version":1}\\n');
  }
  const shouldPass = (behavior === 'implement-pass-review-hang' && context.role === 'implementer')
    || (behavior === 'ir-pass-merger-hang' && context.role !== 'merger')
    || (behavior === 'full-delivery' && context.role !== 'merger')
    || (behavior === 'merge-verification-fails' && context.role !== 'merger')
    || (behavior === 'pure-skill-delivery' && context.role !== 'merger')
    || (behavior === 'swallow-baseline' && context.role !== 'merger')
    || (behavior === 'gate-stagnation' && context.role !== 'merger')
    || (behavior === 'permission-recovered' && context.role === 'implementer');
  if (shouldPass) {
    const pureSkill = behavior === 'pure-skill-delivery';
    const noCommits = behavior === 'gate-stagnation';
    const result = {
      run: context.run, attempt: context.attempt, role: context.role,
      status: 'passed',
      summary: pureSkill ? '本票只改 Markdown 指令；仓库无 tests/ 与类型检查，确无适用自动化检查，依据见摘要。' : '复用已有实现，无需新增提交',
      tests: [],
      remaining: [],
      branch: context.branch, cwd: context.cwd, ticket: context.ticket.number,
      // 纯 skill 场景下 Reviewer 通常没有新提交可交（合格即无需改动）。
      // gate-stagnation 场景下 Implementer 反复不报告任何提交摘要。
      commits: (pureSkill && context.role === 'reviewer') || (noCommits && context.role === 'implementer') ? [] : ['已有可交付提交'],
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
  const escapedPidLog = join(root, 'escaped-pids.log');
  const env = {
    ...process.env,
    AFK_DASHBOARD_OPEN: '0',
    PATH: `${bin}:${process.env.PATH}`,
    AFK_ROLE_LOG: roleLog,
    AFK_FAKE_CLAUDE: fakeClaude,
    AFK_ISSUE_STATE_DIR: issueStateDir,
    AFK_ESCAPED_PID_LOG: escapedPidLog,
  };
  return { root, repo, roleLog, escapedPidLog, env };
}

async function waitUntil(predicate, message, timeoutMs = 6_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  assert.fail(typeof message === 'function' ? message() : message);
}

function processOrGroupExists(target) {
  try {
    process.kill(target, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function forceKill(target) {
  try {
    process.kill(target, 'SIGKILL');
  } catch {}
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

// 只在失败诊断里读取的部分产物：不参与断言，仅让失败原因可直接定位。
function readTail(path) {
  if (!existsSync(path)) return '(none)';
  const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-15).join('\n');
}

function roleGateRecords(runDir) {
  const path = join(runDir, 'observations.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    .filter(record => record.source === 'engine/gate')
    .map(record => ({ kind: record.kind, role: record.scope.role, attempt: record.scope.attempt, reason: record.payload?.reason }));
}

function readTailInLogDir(runDir) {
  if (!existsSync(runDir)) return '(none)';
  const file = readdirSync(runDir).find(name => name.endsWith('.stdout.log'));
  return file ? readTail(join(runDir, file)) : '(none)';
}

function writerSocketPath(fixture, branch) {
  const common = realpathSync(command('git', ['-C', fixture.repo, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
  const key = createHash('sha256').update(`${common}\0${branch}`).digest('hex').slice(0, 32);
  return join(tmpdir(), `afk-writer-${key}.sock`);
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

test('run 现场被移除后 daemon 终止受管角色并自行退出', async () => {
  const fixture = createFixture();
  let daemonPid;
  let rolePid;
  try {
    addBranchCommit(fixture, 9, true);
    const { logDir } = await startAndWaitForRole(fixture);
    const eventsPath = join(logDir, 'events.jsonl');
    daemonPid = JSON.parse(readFileSync(join(logDir, 'control.json'), 'utf8')).pid;
    await waitUntil(() => {
      if (!existsSync(eventsPath)) return false;
      const events = readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      rolePid = events.find(event => event.type === 'role-process')?.managedPid;
      return Number.isSafeInteger(rolePid);
    }, 'AFK 未公开受管角色 PID');

    // 模拟测试宿主或外部清理器移除运行中的 fixture。daemon 必须发现现场消失，
    // 先终止受管角色，再自行退出。
    rmSync(fixture.root, { recursive: true, force: true });
    await waitUntil(() => {
      const daemonExists = processOrGroupExists(daemonPid);
      const roleGroupExists = processOrGroupExists(-rolePid);
      assert.equal(daemonExists || !roleGroupExists, true, 'daemon 不得先于受管角色进程组退出');
      return !daemonExists && !roleGroupExists;
    }, 'run 现场消失后 daemon 或受管角色进程组未退出', 10_000);
  } finally {
    if (rolePid) forceKill(-rolePid);
    if (daemonPid) forceKill(daemonPid);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('终止未确认时保留 writer lock，现场删除后释放锁并退出 daemon', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'escaped-writer';
  let daemonPid;
  let escapedPid;
  let writerPath;
  try {
    addBranchCommit(fixture, 9, true);
    const { logDir } = await startAndWaitForRole(fixture);
    daemonPid = JSON.parse(readFileSync(join(logDir, 'control.json'), 'utf8')).pid;
    writerPath = writerSocketPath(fixture, 'afk/issue-9');
    await waitUntil(() => {
      if (!existsSync(fixture.escapedPidLog)) return false;
      escapedPid = Number(readFileSync(fixture.escapedPidLog, 'utf8').trim().split('\n')[0]);
      return Number.isSafeInteger(escapedPid);
    }, '未启动受控脱组写者');

    command(process.execPath, [script, 'stop', '--run', logDir], { env: fixture.env });
    await waitUntil(() => existsSync(join(logDir, 'result.json')), '终止未确认后未写入失败终态', 12_000);
    assert.equal(processOrGroupExists(daemonPid), true, '现场仍存在时 daemon 必须保留 writer ownership');
    assert.equal(existsSync(writerPath), true, '现场仍存在时不得释放 writer lock');

    rmSync(fixture.root, { recursive: true, force: true });
    await waitUntil(() => !processOrGroupExists(daemonPid), '现场删除后隔离 daemon 未退出', 12_000);
    assert.equal(existsSync(writerPath), false, '现场删除后 writer lock 必须释放');
    assert.equal(processOrGroupExists(-escapedPid), true, '测试必须确实覆盖终止未确认的脱组写者');
  } finally {
    if (escapedPid) forceKill(-escapedPid);
    if (daemonPid) forceKill(daemonPid);
    if (writerPath) rmSync(writerPath, { force: true });
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

// Git merge 自身对会丢失工作区改动的场景 fail-closed：本地修改与合并内容重叠、
// 或未跟踪文件将被合并覆盖时，git 拒绝并中止且不动用户文件。因此目标工作区
// 未提交的改动不构成阻塞 Merger 的理由——引擎若在此预检阻塞，就会把「git 能
// 安全推进的局部情况」升级为「整个 run 永不关票」。这里既验证 Merger 照常
// 推进，也验证用户的未提交改动原样留在工作区、不被 summary 提交吞并。
test('目标有未提交改动时 Merger 照常合并关闭，且用户改动原样保留', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'full-delivery';
  try {
    const { worktree } = addBranchCommit(fixture, 9, true);
    // 已跟踪文件的未提交改动；与待合并分支（新增 issue-9.txt）不重叠。
    writeFileSync(join(fixture.repo, 'README.md'), 'fixture\n用户本地修改\n');
    // 未跟踪文件同样不得阻止合并。
    writeFileSync(join(fixture.repo, 'user-notes.txt'), 'user notes\n');

    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    await waitUntil(() => existsSync(join(started.logDir, 'result.json')), '目标 dirty 下交付未结束', 15_000);
    const result = JSON.parse(readFileSync(join(started.logDir, 'result.json'), 'utf8'));

    assert.equal(result.state, 'completed');
    assert.equal(result.targetBlocked, undefined);
    assert.equal(readFileSync(join(fixture.env.AFK_ISSUE_STATE_DIR, '9'), 'utf8'), 'closed');
    assert.deepEqual(roleEntries(fixture).map(entry => entry.role), ['implementer', 'reviewer', 'merger', 'merger']);
    command('git', ['-C', fixture.repo, 'merge-base', '--is-ancestor', 'afk/issue-9', 'main']);

    // 用户改动必须原样留在工作区。
    assert.equal(readFileSync(join(fixture.repo, 'README.md'), 'utf8'), 'fixture\n用户本地修改\n');
    assert.equal(readFileSync(join(fixture.repo, 'user-notes.txt'), 'utf8'), 'user notes\n');
    assert.equal(command('git', ['-C', fixture.repo, 'status', '--porcelain', '--untracked-files=no']).trim(), 'M README.md');
    // 且不得被卷进本批 summary 提交。
    const summaryPaths = command('git', ['-C', fixture.repo, 'show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean);
    assert.equal(summaryPaths.includes('README.md'), false, `summary 提交吞并了用户改动：${summaryPaths.join(', ')}`);
    assert.ok(existsSync(worktree));
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// Merger 契约允许 summary 用空提交承载，不需要 git add。若它违规 add -A，用户的
// 基线未提交改动会被卷进 summary 提交——从工作区消失、变成别人的提交。这类改动
// 在真实仓库里常是中文路径，而 porcelain 默认会把非 ASCII 路径转义成 \xxx 八进制，
// 朴素的字符串比较会漏判；此处专门用中文路径锁住该核实。
test('Merger 把用户未提交改动卷进 summary 提交时被核实拒绝', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'swallow-baseline';
  try {
    addBranchCommit(fixture, 9, true);
    writeFileSync(join(fixture.repo, '中文笔记.md'), '用户未提交内容\n');
    writeFileSync(join(fixture.repo, 'README.md'), 'fixture\n用户本地修改\n');

    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    await waitUntil(
      () => existsSync(join(started.logDir, 'events.jsonl'))
        && readFileSync(join(started.logDir, 'events.jsonl'), 'utf8').includes('summary 提交包含了目标原有的未提交改动'),
      'Merger 吞并用户改动未被核实拒绝',
      15_000,
    );
    // 核实必须拒绝交付：Issue 不得被关闭。
    assert.equal(readFileSync(join(fixture.env.AFK_ISSUE_STATE_DIR, '9'), 'utf8'), 'open');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 目标处于未完成的 merge/rebase/冲突时，引擎无法安全接续现场：这必须继续硬拒，
// 否则会把别人的合并冲突当成自己的成果交出去。区别于「用户只是有未提交改动」。
test('目标存在未完成的 merge 冲突时仍保留现场并等待用户', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'ir-pass-merger-hang';
  try {
    addBranchCommit(fixture, 9, true);
    // 在 main 上制造一个真实的未完成合并：双方修改同一文件 → git 留下冲突与 MERGE_HEAD。
    writeFileSync(join(fixture.repo, 'shared.txt'), 'base\n');
    command('git', ['-C', fixture.repo, 'add', 'shared.txt']);
    command('git', ['-C', fixture.repo, 'commit', '-q', '-m', 'chore: shared']);
    command('git', ['-C', fixture.repo, 'checkout', '-q', '-b', 'conflict-side']);
    writeFileSync(join(fixture.repo, 'shared.txt'), 'side\n');
    command('git', ['-C', fixture.repo, 'commit', '-q', '-am', 'chore: side']);
    command('git', ['-C', fixture.repo, 'checkout', '-q', 'main']);
    writeFileSync(join(fixture.repo, 'shared.txt'), 'main\n');
    command('git', ['-C', fixture.repo, 'commit', '-q', '-am', 'chore: main']);
    assert.throws(() => command('git', ['-C', fixture.repo, 'merge', 'conflict-side', '--no-edit']));
    assert.ok(existsSync(join(fixture.repo, '.git', 'MERGE_HEAD')));

    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    await waitUntil(() => existsSync(join(started.logDir, 'result.json')), '未完成合并下 run 未结束', 15_000);
    const result = JSON.parse(readFileSync(join(started.logDir, 'result.json'), 'utf8'));

    // I/R 照常完成并进入队列，但 Merger 不得在别人的冲突上开工。
    assert.deepEqual(roleEntries(fixture).map(entry => entry.role), ['implementer', 'reviewer']);
    assert.equal(result.state, 'waiting-user');
    assert.match(result.targetBlocked, /未完成的 merge/);
    assert.equal(readFileSync(join(fixture.env.AFK_ISSUE_STATE_DIR, '9'), 'utf8'), 'open');
    assert.ok(existsSync(join(fixture.repo, '.git', 'MERGE_HEAD')), '引擎不得清除用户的合并现场');
  } finally {
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

// 纯 Skill 仓库形状：没有 tests/、没有类型检查，按契约在 summary 说明“确无适用
// 检查”而不填 tests。Implementer 会留下合法但未跟踪的安装/校验产物，Reviewer
// 无可交付改动（commits 为空）。这两者都不构成“交付未完成”，不得被 Gate 反复
// 拒绝——否则每轮重选同一批票形成死循环。
test('纯 Skill 仓库的未跟踪残留与 reviewer 零提交不阻塞 I→R→M 关票', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'pure-skill-delivery';
  let runDir;
  try {
    const { worktree } = addBranchCommit(fixture, 9, true);
    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    runDir = started.logDir;
    await waitUntil(() => existsSync(join(runDir, 'result.json')), '纯 Skill 仓库 run 未结束', 20_000);

    const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8'));
    assert.equal(result.state, 'completed', `纯 Skill 仓库应交付完成，实际 ${result.state}：${JSON.stringify(result.waiting)}`);
    assert.equal(readFileSync(join(fixture.env.AFK_ISSUE_STATE_DIR, '9'), 'utf8'), 'closed', 'Issue 必须被关闭');
    // I→R→M 全链路；Merger 至少派发一次（merge 与 close 两个阶段）。
    const roles = roleEntries(fixture).map(entry => entry.role);
    assert.deepEqual(roles, ['implementer', 'reviewer', 'merger', 'merger'], '纯 Skill 仓库必须走完 I→R→M 并关票');

    // 未跟踪残留确实存在，且不再是交付阻碍：现场保留，不被清理或改写。
    const residue = command('git', ['-C', worktree, 'status', '--porcelain', '--untracked-files=all']);
    assert.match(residue, /skills-lock\.json/, 'Implementer 未跟踪残留必须留在现场由用户处置');
    // 未跟踪残留不得被自动提交进交付分支。
    const tracked = command('git', ['-C', worktree, 'ls-tree', '-r', '--name-only', 'afk/issue-9']);
    assert.equal(tracked.split('\n').includes('skills-lock.json'), false, '未跟踪残留不得被自动提交');
    // 没有重复拒绝：同因 Gate 拒绝出现即视为回归。
    const events = readFileSync(join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(events.filter(event => event.type === 'pipeline-failed').length, 0, '纯 Skill 仓库不得再出现 pipeline-failed 死循环');
    assert.equal(events.filter(event => event.type === 'batch-selected').length, 1, '应在单一批次内交付，不重选同一批票');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// Gate 拒绝不能让同一批票被无退避地永远重选。Implementer 反复自称 passed 却
// 不报告任何提交摘要时，Gate 每次都独立拒绝；同因连续拒绝达到阈值后该票转入
// 等待用户，run 以 waiting-user 结束而不是空转烧钱（ADR 0005 禁止的是放弃交付
// 的总重试上限，不是这种停滞熔断）。
test('同因 Gate 拒绝连续多轮后转入等待用户，不再无限重选同一批票', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'gate-stagnation';
  let runDir;
  try {
    addBranchCommit(fixture, 9, true);
    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    runDir = started.logDir;
    await waitUntil(() => existsSync(join(runDir, 'result.json')), '停滞检测未终止 run', 40_000);

    const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8'));
    assert.equal(result.state, 'waiting-user', `同因停滞必须转等待用户，实际 ${result.state}`);
    assert.match(result.waiting['9'], /同一原因被 Gate 拒绝/, '停滞原因必须显式报告');
    // Gate 独立性未被削弱：每次仍是引擎独立发布的 Gate rejected。
    const records = readFileSync(join(runDir, 'observations.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const rejected = records.filter(record => record.kind === 'gate-rejected' && record.scope.role === 'implementer');
    assert.ok(rejected.length >= 3, '同因拒绝必须仍由 Gate 独立发布（fail-closed）');
    // 这是引擎自己的业务判断（带合法封套），必须计入停滞计数。
    assert.ok(rejected.every(record => record.payload.stagnationCounted === true), '业务拒绝必须计入停滞（issue #12）');
    assert.ok(rejected.every(record => record.payload.accepted === false && record.payload.reason), 'Gate rejected 必须带机器可判定 reason');
    assert.equal(records.some(record => record.kind === 'delivery-complete'), false, '停滞票不得显示为已交付');
    // 停滞是有界退出而非无限循环：重选次数被阈值封顶。
    const events = readFileSync(join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.ok(events.filter(event => event.type === 'batch-selected').length <= 5, '不得无界重选同一批票');
    // 退出是“等待用户”而非“放弃交付”：现场与分支保留。
    assert.equal(command('git', ['-C', fixture.repo, 'rev-parse', '--verify', 'afk/issue-9']).length > 0, true);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// Reviewer 带封套业务拒绝的停滞覆盖：Implementer 每轮通过，Reviewer 每轮返回
// 逐字相同的 failed 封套（failed 不首轮 blocks.set，只有 blocked 会）。Gate 每次
// 独立拒绝并计数，同因 3 轮后该票转入等待用户，run 以 waiting-user 结束。
test('Reviewer 同因业务拒绝连续多轮后转入等待用户', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'reviewer-failed-stagnation';
  let runDir;
  try {
    addBranchCommit(fixture, 9, true);
    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    runDir = started.logDir;
    await waitUntil(() => existsSync(join(runDir, 'result.json')), 'Reviewer 停滞检测未终止 run', 40_000);

    const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8'));
    assert.equal(result.state, 'waiting-user', `Reviewer 同因停滞必须转等待用户，实际 ${result.state}`);
    assert.match(result.waiting['9'], /同一原因被 Gate 拒绝/, '停滞原因必须显式报告');
    const records = readFileSync(join(runDir, 'observations.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const rejected = records.filter(record => record.kind === 'gate-rejected' && record.scope.role === 'reviewer');
    assert.ok(rejected.length >= 3, 'Reviewer 同因拒绝必须仍由 Gate 独立发布（fail-closed）');
    assert.ok(rejected.every(record => record.payload.stagnationCounted === true), 'Reviewer 业务拒绝必须计入停滞（issue #12）');
    assert.ok(rejected.every(record => record.payload.accepted === false && record.payload.reason), 'Gate rejected 必须带机器可判定 reason');
    assert.equal(records.some(record => record.kind === 'delivery-complete'), false, '停滞票不得显示为已交付');
    assert.equal(command('git', ['-C', fixture.repo, 'rev-parse', '--verify', 'afk/issue-9']).length > 0, true);
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// Issue #12 回归：Reviewer 过程中试过一次被本机 hook 拦截的工具（user tool_result
// is_error 含 approval rejected），随后自己改道完成任务并给出合法封套；终局是成功
// （is_error:false、subtype success）但仍带非空 permission_denials。过程信号不得
// 有否决权：该票不得 blocked，run 必须继续推进到 Merger/关票。
test('Reviewer 过程被拦截工具后成功终局不被误判为权限拒绝，run 继续推进', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'permission-recovered';
  let runDir;
  try {
    addBranchCommit(fixture, 9, true);
    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    runDir = started.logDir;
    // 推进证据：出现 Reviewer 的 Gate accepted 或（更下游的）Merger 已派发。
    await waitUntil(() => {
      if (!existsSync(join(runDir, 'observations.jsonl'))) return false;
      const records = readFileSync(join(runDir, 'observations.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      return records.some(record => record.kind === 'gate-accepted' && record.scope.role === 'reviewer')
        || roleEntries(fixture).some(entry => entry.role === 'merger');
    }, () => ['权限误判：Reviewer 成功终局后 run 未继续推进',
      'roles: ' + JSON.stringify(roleEntries(fixture).map(entry => entry.role)),
      'gates: ' + JSON.stringify(roleGateRecords(runDir)),
      'events: ' + readTail(join(runDir, 'events.jsonl')),
      'daemon: ' + readTail(join(runDir, 'daemon.log')),
    ].join('\n'));

    const records = readFileSync(join(runDir, 'observations.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    // 终局成功被采信：Reviewer 有 Gate accepted，且该 Attempt 无 Gate rejected。
    const accepted = records.filter(record => record.kind === 'gate-accepted' && record.scope.role === 'reviewer');
    assert.ok(accepted.length >= 1, '成功终局必须被独立发布为 Gate accepted');
    const selfReport = records.find(record => record.kind === 'self-report' && record.scope.role === 'reviewer');
    assert.equal(accepted[0].scope.attempt, selfReport.scope.attempt, 'Gate accepted 必须关联同一 Attempt');
    assert.equal(records.some(record => record.kind === 'gate-rejected' && record.scope.role === 'reviewer'), false, '过程中的拒绝记录不得翻转成功的终局判定');
    assert.equal(records.some(record => record.kind === 'delivery-blocked' && record.scope.role === 'reviewer'), false, '该票不得被判 blocked');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 停滞只统计引擎的业务判断，而不是载体层失败：Reviewer 连续多轮返回 failed 且
// 没有任何 <afk-result> 封套（无 run 键）。这类失败必须继续由重试处理，
// batch-selected 可以远超 3 轮阈值，run 不得因此进入 waiting-user 停滞。
test('角色只返回无封套的载体层失败时不计入停滞，run 不转入等待用户', async () => {
  const fixture = createFixture();
  fixture.env.AFK_ROLE_BEHAVIOR = 'carrier-failure';
  let runDir;
  try {
    addBranchCommit(fixture, 9, true);
    const started = JSON.parse(command(process.execPath, [script, 'start', '--repo', fixture.repo, '--issues', '9'], { env: fixture.env, timeout: 15_000 }));
    runDir = started.logDir;
    const eventsPath = join(runDir, 'events.jsonl');
    const batchCount = () => existsSync(eventsPath)
      ? readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(event => event.type === 'batch-selected').length
      : 0;
    // 跨过 3 轮停滞阈值：载体层失败必须继续重试，而不是被熔断。
    await waitUntil(() => batchCount() > 6, () => [`载体层失败被误判为停滞：batch-selected 只有 ${batchCount()} 轮；run 终态 ${existsSync(join(runDir, 'result.json')) ? JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8')).state : '仍在运行'}；roles ${JSON.stringify(roleEntries(fixture).map(entry => entry.role))}`,
      'gates: ' + JSON.stringify(roleGateRecords(runDir)),
      'events: ' + readTail(join(runDir, 'events.jsonl')),
      'daemon: ' + readTail(join(runDir, 'daemon.log')),
      'stdout: ' + readTailInLogDir(runDir),
    ].join('\n'), 45_000);

    // 重试不被 3 轮阈值封顶本身就是「未停滞」的证据：run 此刻仍在推进，
    // 载体层失败只是被重试，而不是把该票永久置为等待用户。
    assert.ok(batchCount() > 6, '载体层失败必须继续重试，不得被停滞熔断');
    assert.equal(existsSync(join(runDir, 'result.json')), false, '载体层失败不得把 run 终止在等待用户');
    const records = existsSync(join(runDir, 'observations.jsonl'))
      ? readFileSync(join(runDir, 'observations.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    const counted = records.filter(record => (record.kind === 'gate-rejected' || record.kind === 'delivery-blocked') && record.payload?.stagnationCounted !== undefined);
    assert.ok(counted.every(record => record.payload.stagnationCounted === false), '载体层失败不得计入停滞计数');
  } finally {
    await stopRun(runDir, fixture.env);
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// 与「载体层失败不计入停滞」成对的另一半由下面保留的 gate-stagnation 用例承担：
// 带合法封套的引擎业务拒绝（Implementer 反复自报 passed 却没有任何提交摘要）
// 仍必须由 Gate 独立拒绝、计入停滞并转入等待用户，防烧钱保护不得被本次对齐削弱。

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

// macOS 上进程组长退出但尚未被 reap（本进程是其父进程）时，kill(-pgid, 0) 返回
// EPERM 而非 ESRCH；这个约 25ms 的窗口在生产里是正常退出竞态。若把它当作不可自愈
// 的终止失败，每次用户停止都可能把 run 判 failed 并隔离现场。
// 该窗口在生产的事件循环下无法观测（第一次 await 就会 reap 组长），因此用同步
// 忙等保持在同一个 tick 内确定性地复现：spawn detached 子进程后不交出事件循环，
// 子进程保持僵尸组长，此时 terminate 必然遭遇 EPERM。
function busyWait(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* 故意阻塞事件循环以复现僵尸组长窗口 */ }
}
function trackTermination(child) {
  const entry = { child, closed: false, exited: false };
  child.once('close', () => { entry.closed = true; });
  return entry;
}

test('僵尸组长探测返回 EPERM 时不误判为终止失败', async () => {
  for (let round = 0; round < 3; round++) {
    const processes = new Processes();
    const child = spawn('/bin/sh', ['-c', 'exit 0'], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.resume();
    child.stderr.resume();
    const entry = trackTermination(child);
    busyWait(60);
    try {
      await processes.terminate(entry, 'user-stop');
      assert.equal(processes.hasUnsafeWriters, false, '僵尸组长窗口不得到标为终止未确认');
    } finally {
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
  }
});

test('用户停止时单条终止未确认不把整轮判失败，但保留现场保全标志', async () => {
  const processes = new Processes();
  const child = spawn('/bin/sh', ['-c', 'exec /bin/sh -c "sleep 30"'], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.resume();
  child.stderr.resume();
  // closed 永不置真：terminate 在 wait-inherited-pipes-close 阶段超时，
  // 确定性走到真实失败分支（不依赖 EPERM 时序）。
  const entry = { child, closed: false, exited: false };
  processes.children.add(entry);
  try {
    await processes.stop();
    assert.equal(processes.terminationResults.length, 1);
    assert.equal(processes.terminationResults[0].status, 'unconfirmed');
    assert.equal(processes.terminationResults[0].termination.stage, 'wait-inherited-pipes-close');
    assert.equal(processes.hasUnsafeWriters, true, '终止未确认必须保留 hasUnsafeWriters，禁止交接现场');
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
});
