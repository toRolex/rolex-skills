// 改编自 https://github.com/mattpocock/sandcastle
// e99f832f26dc9d245c019a9ddd19fa5dee792427 的 src/templates/parallel-planner-with-review/main.mts。
// MIT，Copyright (c) 2026 Matt Pocock；完整许可见同目录 LICENSE.sandcastle，分发时一并保留。
// 保留逐票 execute→review、Promise.allSettled 屏障与单 Merger，替换 LLM 规划器、Docker 和有轮次上限的外层循环。
// 仓库维护研究（运行及许可不依赖）：../../../../docs/research/afk-local-cli-source-provenance.md。
import { createConnection, createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { realpathSync, existsSync, lstatSync, readFileSync, readlinkSync, readdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { buildInvocation, roleSelection } from './providers.mjs';
import { ROLES } from './model-selection.mjs';
import { loadTemplates, renderPrompt } from './prompts.mjs';

const permission = /permission denied|permission.*denied|not permitted|unauthorized|forbidden|HTTP 40[13]|requires? approval|cannot prompt for approval|权限拒绝|未经授权/i;
const unsafeTermination = /终止未确认|禁止交接|进程组.*(?:EPERM|not permitted)|EPERM.*(?:终止|quarantine)/i;
const configurationFailure = /not logged in|authentication|auth_unavailable|no auth available|invalid.{0,20}(?:api.?key|model)|(?:unknown|unsupported|not found).{0,20}model|model.{0,40}(?:not found|not supported|does not exist)|nested.*session|cannot be launched inside|login required|missing.{0,20}(?:credential|api.?key)|登录|模型.*不支持/i;
const workspaceFailure = /现场分支改变|角色离开绑定|现场不属于|运行日志被暂存|运行日志被提交|归属未经确认|活跃写者|候选写者|role-start|写锁.*(?:无法|占用|确认)|worktree 已锁定|not a git repository/i;
// 仅 writer ownership 造成的阻碍可以在重检后自动清除；其他阻碍（权限、
// 依赖、锁定、Git 冲突）属于不同原因，不能被 writer 重检路径一并抹掉。
const writerBlocking = /活跃写者|写锁|活跃 writer|ownership/i;
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const isSpec = issue => (issue.labels || []).some(label => /^spec$/i.test(typeof label === 'string' ? label : label.name)) || /^spec$/i.test(issue.type?.name || '') || /^(?:\[spec\]|spec\s*[:：])/i.test(issue.title || '');

function worktreeRecords(text) {
  return text.split('\0\0').filter(Boolean).map(record => {
    const fields = Object.fromEntries(record.split('\0').filter(Boolean).map(line => {
      const space = line.indexOf(' ');
      return space < 0 ? [line, true] : [line.slice(0, space), line.slice(space + 1)];
    }));
    return { cwd: fields.worktree, branch: fields.branch?.replace(/^refs\/heads\//, ''), locked: fields.locked, prunable: fields.prunable };
  });
}

// Socket 不保存任务状态，仅在本进程生命周期内持有。
// 新 run 只依据当前连接事实区分活跃写者与崩溃遗留，不使用历史 PID。
async function writerSocketState(path) {
  return new Promise((resolveState, reject) => {
    const socket = createConnection(path);
    let response = '';
    const timer = setTimeout(() => socket.destroy(new Error('writer socket 探测超时')), 500);
    socket.on('data', chunk => { response += chunk; });
    socket.on('end', () => {
      clearTimeout(timer);
      resolveState(response.startsWith('AFK workspace in use\n') ? 'active' : 'unknown');
    });
    socket.on('error', error => {
      clearTimeout(timer);
      if (['ECONNREFUSED', 'ENOENT', 'ENOTSOCK'].includes(error.code)) resolveState('stale');
      else reject(error);
    });
  });
}

function acquireRecoveryGuard(path, branch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      symlinkSync(String(process.pid), path);
      const owned = lstatSync(path);
      return () => {
        try {
          const current = lstatSync(path);
          if (current.dev === owned.dev && current.ino === owned.ino && readlinkSync(path) === String(process.pid)) unlinkSync(path);
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = Number(readlinkSync(path)); }
      catch (readError) { throw new Error(`现场恢复 guard 状态无法确认：${branch} (${path})：${readError.message}`); }
      if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error(`现场恢复 guard 身份无效：${branch} (${path})`);
      try {
        process.kill(owner, 0);
        throw new Error(`现场写锁正在由另一运行核实：${branch} (${path})；等待后重试`);
      } catch (probeError) {
        if (probeError.code === 'EPERM') throw new Error(`EPERM：现场恢复 guard 进程 ${owner} 无法确认终止；${branch} 保持 quarantine`);
        if (probeError.code !== 'ESRCH') throw probeError;
      }
      let observed;
      try { observed = lstatSync(path); } catch (statError) { if (statError.code === 'ENOENT') continue; throw statError; }
      try {
        const current = lstatSync(path);
        if (current.dev === observed.dev && current.ino === observed.ino && readlinkSync(path) === String(owner)) unlinkSync(path);
      } catch (unlinkError) { if (unlinkError.code !== 'ENOENT') throw unlinkError; }
    }
  }
  throw new Error(`现场恢复 guard 在核实后再次被占用：${branch} (${path})`);
}

async function writerLock(common, branch, probe = () => {}) {
  const key = createHash('sha256').update(`${common}\0${branch}`).digest('hex').slice(0, 32);
  const path = join(tmpdir(), `afk-writer-${key}.sock`);
  const recoveryPath = `${path}.recovery`;
  let releaseRecoveryGuard;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const server = createServer(socket => socket.end('AFK workspace in use\n'));
      try {
        await new Promise((accept, reject) => {
          server.once('error', reject);
          server.listen(path, accept);
        });
        probe({ branch, path, socketState: 'vacant' });
        let releasePromise;
        return function releaseWriterLock() {
          releasePromise ??= new Promise((accept, reject) => {
            server.close(error => error ? reject(error) : accept());
          });
          return releasePromise;
        };
      } catch (error) {
        if (error.code !== 'EADDRINUSE') throw error;
        releaseRecoveryGuard ??= acquireRecoveryGuard(recoveryPath, branch);
        let observed;
        try { observed = lstatSync(path); }
        catch (statError) { if (statError.code === 'ENOENT') continue; throw statError; }
        let socketState;
        try { socketState = await writerSocketState(path); }
        catch (probeError) {
          // unreachable 不是正向活跃证明：记录 probe 事实后继续恢复。
          probe({ branch, path, socketState: 'unreachable', reason: probeError.message });
          socketState = 'stale';
        }
        if (socketState === 'active') {
          probe({ branch, path, socketState: 'active', active: true });
          throw new Error(`现场仍有活跃写者：${branch} (${path})；等待原运行结束，不并发接管`);
        }
        // Liveness-first：只有 ownership channel 的明确 active 响应才阻止派发。
        // stale、unreachable、未知响应和历史 PID 都作为 Recovery 观察事实，不再推测仍有 writer。
        probe({ branch, path, socketState, active: false });
        try {
          const current = lstatSync(path);
          if (current.dev !== observed.dev || current.ino !== observed.ino) continue;
          unlinkSync(path);
        } catch (unlinkError) {
          if (unlinkError.code !== 'ENOENT') throw new Error(`遗留现场写锁无法安全移除：${branch} (${path})：${unlinkError.message}；保留现场，禁止并发接管`);
        }
      }
    }
    throw new Error(`现场写锁在探测后再次被占用：${branch} (${path})；保留现场，禁止并发接管`);
  } finally {
    releaseRecoveryGuard?.();
  }
}

export async function createEngine(config, processes, event = () => {}, observations) {
  const command = (name, args, cwd = config.repo, options) => processes.command(name, args, cwd, options);
  const git = (args, cwd = config.repo) => command('git', args, cwd);
  const gh = args => command('gh', args);
  // Recovery 的完整 Git/Worktrunk 命令与 stdout/stderr 归入 engine/recovery，
  // 使接管行为可诊断，且不冒充 provider/assistant 输出。
  async function recoveryCommand(name, args, cwd, scope) {
    try {
      const stdout = await command(name, args, cwd);
      observations?.observe('engine/recovery', 'recovery-command', scope, { command: name, args, cwd, code: 0, stdout });
      return stdout;
    } catch (error) {
      observations?.observe('engine/recovery', 'recovery-command', scope, { command: name, args, cwd, error: error.message });
      throw error;
    }
  }
  const recoveryGit = (args, cwd, scope) => recoveryCommand('git', args, cwd, scope);
  // Issue #10 Recovery completeness：布尔值本身无法说明现场为何被分类为
  // recovered 或 merged-unverified，OID、commits ahead、ancestry、dirty 与
  // in-progress 的判定依据全部落盘。
  const oid = async (rev, cwd) => {
    try { return await git(['rev-parse', rev], cwd); } catch { return undefined; }
  };
  async function recoveryFacts(scope, branch, cwd, targetBranch = target, workspace = cwd) {
    const facts = { branch, cwd, target: targetBranch };
    try {
      facts.branchOid = await oid(branch, config.repo);
      facts.targetOid = await oid(targetBranch, config.repo);
      // ancestry 与 commits ahead 是 merged-unverified 分类的直接依据。
      try {
        await recoveryGit(['merge-base', '--is-ancestor', branch, targetBranch], workspace, scope);
        facts.ancestorOfTarget = true;
      } catch { facts.ancestorOfTarget = false; }
      facts.commitsAhead = Number(await recoveryGit(['rev-list', '--count', `${targetBranch}..${branch}`], workspace, scope));
      facts.dirty = Boolean(await dirty(workspace));
      facts.inProgress = await inProgress(workspace);
      facts.head = await oid('HEAD', workspace);
    } catch (error) { facts.error = error.message; }
    observations?.observe('engine/recovery', 'recovery-facts', scope, facts);
    return facts;
  }
  const json = async args => JSON.parse(await gh(args));
  const pages = async endpoint => {
    const result = await json(['api', '--paginate', '--slurp', endpoint]);
    if (!Array.isArray(result) || !result.every(Array.isArray)) throw new Error(`GitHub 分页响应无效：${endpoint}`);
    return result.flat();
  };
  const retryRead = async operation => {
    let failure;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (processes.stopping) throw new Error('用户停止');
      try { return await operation(); }
      catch (error) {
        failure = error;
        if (permission.test(error.message) || unsafeTermination.test(error.message)) throw error;
        if (attempt < 2) await delay(250 * (attempt + 1));
      }
    }
    throw failure;
  };

  // 完成前置检查并固定初始范围后才确认启动成功。
  // 启动握手不等待角色，也不在确认启动前派角色。
  // 模板随 skill 安装；在握手及任何外部命令前加载本运行的固定快照。
  const templates = loadTemplates();
  // 启动期校验覆盖本次 Run 实际用到的全部 Role 配置组合（去重后的 harness），
  // 不只校验顶层那一组：否则混 harness 时会拖到某个角色启动才发现缺 CLI。
  // provider 名同时就是该 harness 的可执行文件名（claude/codex/pi）。
  const selections = Object.fromEntries(ROLES.map(role => [role, roleSelection(config, role)]));
  for (const selection of Object.values(selections)) buildInvocation({ ...selection, cwd: config.repo, prompt: '启动参数校验，不执行角色' });
  const harnesses = [...new Set([...ROLES.map(role => selections[role].provider), config.provider])].filter(Boolean);
  for (const executable of ['git', 'wt', 'gh', ...harnesses]) await command(executable, ['--version']);
  await gh(['auth', 'status']);
  const root = realpathSync(await git(['rev-parse', '--show-toplevel']));
  if (root !== realpathSync(config.repo)) throw new Error('--repo 必须为目标仓库 worktree 根目录');
  const common = realpathSync(await git(['rev-parse', '--path-format=absolute', '--git-common-dir']));
  const repository = (await json(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('无法确定 GitHub owner/repo');
  const localBranches = (await git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/'])).split('\n');
  const target = config.target || (localBranches.includes('develop') ? 'develop' : 'main');
  if (target.startsWith('-') || !localBranches.includes(target)) throw new Error(`目标本地分支不存在：${target}；不自动 fetch/pull`);
  await git(['check-ref-format', '--branch', target]);
  const specs = new Set(config.specs || []);
  const scope = new Set();
  const tickets = new Map();
  const blocks = new Map();
  const recovery = new Map();
  const workspaces = new Map();
  const releases = new Set();
  // planned Attempt 与实际 spawn 的 Invocation 分别记录，供观测关联。
  const attemptCounters = new Map();
  let attemptIds = 0;
  const mergeQueue = [];
  // 全局最大轮次是 run 有界性的唯一机制（上游 MAX_ITERATIONS 语义，
  // 默认 10，可经 --max-rounds 配置）。网络抖动、瞬时失败只会重试到
  // 轮次上限，不再被定性为业务死结。
  const maxRounds = Number(config.maxRounds) > 0 ? Math.floor(Number(config.maxRounds)) : 10;
  let targetCwd, targetReason, targetPreexisting = [], pending, batch = 0, attempt = 0;
  let running = false, finished = false, quarantined = false, abandonedReleasePromise;
  // 目标现场的用户未提交改动不是阻塞 Merger 的理由。Git merge 自身对会丢失
  // 工作区改动的场景 fail-closed：本地修改与合并内容重叠、或未跟踪文件将被
  // 合并覆盖时，git 拒绝并中止且不改动用户文件；而非重叠的脏改动可以安全
  // 合并、合入后原样保留。因此只有「未完成的 merge/rebase/冲突」这类引擎
  // 无法安全接续的现场才阻止 Merger。
  const targetInProgressReason = '目标现场存在未完成的 merge/rebase/冲突；保留现场等待用户处理';

  async function releaseOwnedLocks(onFailure) {
    const failures = [];
    for (const release of [...releases].reverse()) {
      try {
        await release();
        releases.delete(release);
      } catch (error) {
        if (onFailure) onFailure(error);
        else failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, failures.map(error => error.message).join('\n'));
    return releases.size === 0;
  }

  async function releaseAbandonedLocks() {
    if (!finished) return false;
    const releasePromise = abandonedReleasePromise ??= releaseOwnedLocks();
    try {
      return await releasePromise;
    } finally {
      if (abandonedReleasePromise === releasePromise) abandonedReleasePromise = undefined;
    }
  }

  function writerEventMatches(event, branch) {
    if (!Array.isArray(event.tickets)) return false;
    if (branch === target) return event.role === 'merger';
    const match = /^afk\/issue-(\d+)$/.exec(branch);
    return Boolean(match) && event.role !== 'merger' && event.tickets.includes(Number(match[1]));
  }
  // 历史 writer/PID 事实只作为 Recovery 观察记录。
  // liveness-first：不完整历史事件、历史 PID/PGID 或 EPERM 都不单独阻止派发；
  // 只有当前 ownership channel 的明确 active 响应才阻止同 worktree 的写者。
  async function observeAbandonedWriter(branch, scope = {}) {
    const logsRoot = join(root, '.afk', 'logs');
    if (!existsSync(logsRoot)) {
      observations?.observe('engine/recovery', 'recovery-writer-probe', { role: 'merger', tickets: scope.tickets, ...scope }, { branch, candidates: [], unknownIncomplete: false, note: '无历史运行日志' });
      return;
    }
    const candidates = new Set();
    let unknownWriter = false;
    let directories;
    try { directories = readdirSync(logsRoot, { withFileTypes: true }); }
    catch (error) {
      observations?.observe('engine/recovery', 'recovery-writer-probe', scope, { branch, error: error.message, note: '历史日志不可读；按未检测到 active writer 处理' });
      return;
    }
    for (const directory of directories) {
      if (!directory.isDirectory() || directory.name === config.run) continue;
      const eventsPath = join(logsRoot, directory.name, 'events.jsonl');
      if (!existsSync(eventsPath)) continue;
      const active = new Map();
      let lines;
      try { lines = readFileSync(eventsPath, 'utf8').split('\n'); }
      catch { continue; }
      for (const line of lines) {
        if (!line) continue;
        let record;
        try { record = JSON.parse(line); } catch { continue; }
        if (!writerEventMatches(record, branch)) continue;
        // 这个 key 只用于「同一 Role 是否还有未确认终止的写者」的配对，不是
        // 配置查找表——它**有意**不含 provider：每个角色的 harness 由
        // selection.json 冻结并按角色取（ADR 0008），写者存活判断与用哪个
        // harness 无关，把 provider 并进来只会让 key 随配置漂移。
        const key = `${record.role}:${record.tickets.join(',')}`;
        if (record.type === 'role-start') active.set(key, null);
        if (record.type === 'role-process' && Number.isSafeInteger(record.managedPid)) active.set(key, record.managedPid);
        if (record.type === 'role-end' && record.terminationConfirmed === true) active.delete(key);
      }
      for (const pid of active.values()) {
        if (pid === null) unknownWriter = true;
        else candidates.add(pid);
      }
    }
    const probed = [];
    for (const pid of candidates) {
      try {
        process.kill(-pid, 0);
        probed.push({ pid, groupExists: true });
      } catch (error) {
        if (error.code === 'ESRCH') probed.push({ pid, groupExists: false });
        else if (error.code === 'EPERM') probed.push({ pid, groupExists: 'unknown', errno: 'EPERM' });
        else probed.push({ pid, groupExists: 'unknown', errno: error.code });
      }
    }
    observations?.observe('engine/recovery', 'recovery-writer-probe', scope, {
      branch,
      historicalPids: probed,
      unknownIncomplete: unknownWriter,
      note: '历史 PID/PGID 与不完整事件仅作观察事实；未检测到 active ownership channel 即恢复现场',
    });
  }

  async function readIssue(number) {
    const issue = await retryRead(() => json(['api', `repos/${repository}/issues/${number}`]));
    if (!Number.isSafeInteger(issue.number) || !['open', 'closed'].includes(issue.state)) throw new Error(`Issue #${number} 响应字段无效`);
    return issue;
  }
  async function readContext(number) {
    const issue = await readIssue(number);
    const comments = await retryRead(() => pages(`repos/${repository}/issues/${number}/comments?per_page=100`));
    return { ...issue, comments: comments.map(comment => ({ author: comment.user?.login, body: comment.body })) };
  }
  async function relatedSpecs(issue, cache) {
    const parents = new Set(specs);
    // GitHub 原生父关系；404 表示没有可见父关系。其他读取错误只影响本票。
    let parent;
    try {
      parent = await retryRead(() => json(['api', `repos/${repository}/issues/${issue.number}/parent`]));
      if (!parent || !Number.isSafeInteger(parent.number) || !['open', 'closed'].includes(parent.state)) throw new Error(`Issue #${issue.number} 原生父关系响应未知`);
    }
    catch (error) { if (!/\bHTTP\s+404\b/.test(error.message)) throw error; }
    if (parent?.number && isSpec(parent)) {
      if (parent.repository_url && !parent.repository_url.endsWith(`/repos/${repository}`)) throw new Error(`父 SPEC 跨仓库，需显式确认：${parent.html_url || parent.repository_url}`);
      parents.add(parent.number);
    }
    for (const match of (issue.body || '').matchAll(/(?:父\s*SPEC|parent\s*(?:SPEC|issue)|SPEC|需求)\s*[:：]?\s*#(\d+)/gi)) parents.add(Number(match[1]));
    for (const match of (issue.body || '').matchAll(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)/g)) {
      if (match[1] === repository) {
        const referenced = await readIssue(Number(match[2]));
        if (isSpec(referenced)) parents.add(referenced.number);
      }
    }
    return Promise.all([...parents].map(async number => {
      if (!cache.has(number)) cache.set(number, readContext(number));
      const context = await cache.get(number);
      if (context.pull_request) throw new Error(`父 SPEC #${number} 不能是 PR`);
      return context;
    }));
  }
  if (config.issues?.length) {
    for (const number of config.issues) {
      if (specs.has(number)) continue;
      try {
        const issue = await readIssue(number);
        if (issue.state === 'closed') {
          const skipped = { ticket: number, branch: `afk/issue-${number}`, state: 'skipped-closed', ownership: 'preserved' };
          recordRecovery(number, 'recovery-classified', skipped);
          event('scope-excluded', { ticket: number, reason: 'closed' });
          continue;
        }
        if (issue.pull_request || isSpec(issue)) { event('scope-excluded', { ticket: number, reason: 'PR/SPEC' }); continue; }
        scope.add(number);
        tickets.set(number, issue);
      } catch (error) {
        if (unsafeTermination.test(error.message)) throw error;
        scope.add(number);
        tickets.set(number, { number, state: 'unknown', readError: error.message });
      }
    }
  } else {
    const initial = await retryRead(() => pages(`repos/${repository}/issues?state=open&labels=ready-for-agent&per_page=100`));
    for (const issue of initial) {
      if (issue.pull_request || issue.state !== 'open' || specs.has(issue.number) || isSpec(issue)) continue;
      scope.add(issue.number);
      tickets.set(issue.number, issue);
    }
  }
  if ([...scope].some(number => target === `afk/issue-${number}`)) throw new Error('目标分支不能同时是本轮 Ticket 工作分支');
  async function refresh() {
    const contextCache = new Map();
    for (const number of scope) {
      if (processes.stopping) return;
      try {
        const issue = await readIssue(number);
        if (issue.pull_request || isSpec(issue)) {
          blocks.set(number, '范围内项目变成 PR/SPEC，需用户确认范围');
          tickets.set(number, { ...issue, state: 'unknown' });
          continue;
        }
        if (issue.state === 'closed') {
          tickets.set(number, issue);
          continue;
        }
        const comments = await retryRead(() => pages(`repos/${repository}/issues/${number}/comments?per_page=100`));
        const dependencies = await retryRead(() => pages(`repos/${repository}/issues/${number}/dependencies/blocked_by?per_page=100`));
        if (dependencies.some(dep => !Number.isSafeInteger(dep.number) || !['open', 'closed'].includes(dep.state) || typeof dep.repository_url !== 'string')) throw new Error(`Issue #${number} blocked_by 响应字段未知`);
        let parents = [], specError;
        try { parents = await relatedSpecs(issue, contextCache); }
        catch (error) { if (unsafeTermination.test(error.message)) throw error; specError = `相关父 SPEC 读取失败：${error.message}`; }
        tickets.set(number, { ...issue, comments: comments.map(comment => ({ author: comment.user?.login, body: comment.body })), dependencies, specs: parents, specError });
      } catch (error) {
        if (unsafeTermination.test(error.message)) throw error;
        tickets.set(number, { ...tickets.get(number), number, state: 'unknown', readError: error.message });
        if (permission.test(error.message)) blocks.set(number, `GitHub 权限拒绝：${error.message}`);
        event('read-blocked', { ticket: number, reason: error.message });
      }
    }
    const groups = [pending, ...mergeQueue].filter(Boolean);
    mergeQueue.length = 0;
    for (const group of groups) {
      group.tickets = group.tickets.filter(item => tickets.get(item.ticket.number)?.state !== 'closed');
      if (group.tickets.length) mergeQueue.push(group);
    }
    pending = mergeQueue.shift();
  }

  function waitingReasons(includeMergeGroups = true) {
    const reasons = new Map();
    for (const [number, issue] of tickets) {
      if (issue.state === 'closed') continue;
      if (blocks.has(number)) reasons.set(number, blocks.get(number));
      else if (issue.specError) reasons.set(number, issue.specError);
      else if (issue.state === 'unknown' || !Array.isArray(issue.dependencies)) reasons.set(number, `上下文/原生依赖未知：${issue.readError || '尚未读取'}`);
      else {
        const outside = issue.dependencies.filter(dep => dep.state === 'open' && (!dep.repository_url.endsWith(`/repos/${repository}`) || !scope.has(dep.number)));
        if (outside.length) reasons.set(number, `范围外开放前置：${outside.map(dep => dep.html_url || `${dep.repository_url}#${dep.number}`).join(', ')}`);
      }
    }
    if (includeMergeGroups) for (const group of [pending, ...mergeQueue].filter(Boolean)) {
      const reason = targetReason || group.blockedReason;
      if (reason) for (const item of group.tickets) if (tickets.get(item.ticket.number)?.state !== 'closed') reasons.set(item.ticket.number, `本批交付等待用户：${reason}`);
    }
    // 范围外前置阻碍传递到所有受影响的范围内下游，
    // 但不扩大初始 Ticket 集合。
    let changed;
    do {
      changed = false;
      for (const [number, issue] of tickets) {
        if (issue.state === 'closed' || reasons.has(number)) continue;
        const upstream = issue.dependencies?.find(dep => dep.state === 'open' && dep.repository_url.endsWith(`/repos/${repository}`) && reasons.has(dep.number));
        if (upstream) { reasons.set(number, `等待范围内前置 #${upstream.number}：${reasons.get(upstream.number)}`); changed = true; }
      }
    } while (changed);
    return reasons;
  }
  const priority = issue => {
    const labels = (issue.labels || []).map(label => typeof label === 'string' ? label : label.name);
    const index = (config.priorityLabels || []).findIndex(label => labels.includes(label));
    return index < 0 ? (config.priorityLabels || []).length : index;
  };
  const ordered = (a, b) => priority(a) - priority(b) || a.number - b.number;
  function selectBatch() {
    const reasons = waitingReasons();
    const pendingNumbers = new Set([pending, ...mergeQueue].filter(Boolean).flatMap(group => group.tickets.map(item => item.ticket.number)));
    const candidates = [...tickets.values()].filter(issue => issue.state === 'open' && !reasons.has(issue.number) && !pendingNumbers.has(issue.number));
    const internal = issue => issue.dependencies.filter(dep => dep.state === 'open' && dep.repository_url.endsWith(`/repos/${repository}`) && scope.has(dep.number));
    const ready = candidates.filter(issue => internal(issue).length === 0).sort(ordered);
    return ready;
  }

  const trees = async () => worktreeRecords(await git(['worktree', 'list', '--porcelain', '-z']));
  async function dirty(cwd) {
    // 运行日志保持未跟踪；不改 .gitignore 或全局排除配置，
    // 此检查不得隐藏其他用户修改。
    return git(['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude).afk/logs', ':(exclude).afk/logs/**'], cwd);
  }
  async function trackedDirty(cwd) {
    // 交付判据只看可合并内容：未跟踪文件永远不进入 merge，也不能被交付。
    // 若用 --untracked-files=all 否决提交，角色在纯 Skill/文档仓库里留下的
    // 合法残留（安装产物、笔记）会让每次尝试都被判“现场不干净”而永不关票。
    // 已跟踪文件的未提交改动（staged/unstaged/删除/冲突/submodule）仍是硬拒。
    return git(['status', '--porcelain', '--untracked-files=no', '--', '.', ':(exclude).afk/logs', ':(exclude).afk/logs/**'], cwd);
  }
  async function dirtyPaths(cwd) {
    // 用 -z 取路径：默认 porcelain 会按 core.quotePath 把非 ASCII 路径转义成
    // \xxx 八进制，且路径里含 " -> " 时无法与重命名的双字段记录区分（实测会把
    // `a -> b.md` 截成 `b.md"`）。-z 给出未转义、NUL 分隔、字段边界明确的路径，
    // 使解析不依赖仓库配置与文件名内容。
    const status = await git(['status', '--porcelain', '-z', '--untracked-files=all', '--', '.', ':(exclude).afk/logs', ':(exclude).afk/logs/**'], cwd);
    if (!status) return [];
    const fields = status.split('\0').filter(Boolean);
    const paths = [];
    // 每条记录是 `XY <path>`；重命名/复制在 -z 下把**新**路径放在状态字段后、
    // 旧路径作为独立的下一字段，因此跳过紧随其后的旧路径字段。
    for (let index = 0; index < fields.length; index++) {
      const line = fields[index];
      paths.push(line.slice(3));
      if (/^[RC]/.test(line)) index++;
    }
    return paths;
  }
  async function committedPaths(cwd) {
    // 与 dirtyPaths 同一渲染方式，保证可直接做字符串比较。
    const listed = await git(['show', '--name-only', '-z', '--format=', 'HEAD'], cwd);
    return listed ? listed.split('\0').filter(Boolean) : [];
  }
  async function correctWorkspace(workspace) {
    if (realpathSync(await git(['rev-parse', '--show-toplevel'], workspace.cwd)) !== realpathSync(workspace.cwd)) throw new Error('角色离开绑定根目录');
    if (await git(['symbolic-ref', '--short', 'HEAD'], workspace.cwd) !== workspace.branch) throw new Error(`现场分支改变：${workspace.branch}`);
    if (realpathSync(await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], workspace.cwd)) !== common) throw new Error('现场不属于目标 Git 仓库');
    const staged = await git(['diff', '--cached', '--name-only', '--', '.afk/logs'], workspace.cwd);
    if (staged) throw new Error('运行日志被暂存；保留现场等待用户，禁止提交日志');
  }
  async function inProgress(cwd) {
    if (await git(['diff', '--name-only', '--diff-filter=U'], cwd)) return true;
    for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
      if (existsSync(resolve(cwd, await git(['rev-parse', '--git-path', name], cwd)))) return true;
    }
    return false;
  }
  async function prepareTarget() {
    try {
      releases.add(await writerLock(common, target, probe => {
        if (probe.socketState === 'vacant') return;
        observations?.observe('engine/recovery', 'recovery-writer-probe', { role: 'merger' }, { branch: target, ...probe });
        void observeAbandonedWriter(target, { role: 'merger' });
      }));
      const existing = (await trees()).find(tree => tree.branch === target);
      if (existing?.locked || existing?.prunable) throw new Error('目标 worktree 已锁定或不可用');
      if (existing) targetCwd = realpathSync(existing.cwd);
      else {
        await command('wt', ['switch', '--no-cd', target]);
        const created = (await trees()).find(tree => tree.branch === target);
        if (!created) throw new Error('Worktrunk 未返回目标分支现场');
        targetCwd = realpathSync(created.cwd);
      }
      await correctWorkspace({ cwd: targetCwd, branch: target });
      // 快照用户既有未提交现场：允许带着它推进合并，但本批 summary 不得吞并它。
      targetPreexisting = await dirtyPaths(targetCwd);
      if (await inProgress(targetCwd)) throw new Error(targetInProgressReason);
    } catch (error) {
      if (unsafeTermination.test(error.message)) throw error;
      targetReason = error.message;
      event('target-blocked', { target, cwd: targetCwd, reason: targetReason });
    }
  }
  function detectedRecoveryState(existing, branchExists) {
    if (existing) return 'detected-worktree';
    if (branchExists) return 'detected-branch';
    return 'absent';
  }
  function observedCwd(tree) {
    if (!tree) return undefined;
    if (tree.prunable) return tree.cwd;
    try { return realpathSync(tree.cwd); }
    catch { return tree.cwd; }
  }
  function adoptedRecoveryState(existing, branchExists, mergedIntoTarget) {
    if (mergedIntoTarget) return 'merged-unverified';
    if (existing) return 'recovered-worktree';
    if (branchExists) return 'recovered-branch';
    return 'created';
  }
  function recordRecovery(number, eventType, state) {
    recovery.set(number, state);
    event(eventType, state);
    return state;
  }
  async function observeRecovery(ticket, reason) {
    const number = ticket.number;
    const branch = `afk/issue-${number}`;
    const matchingTrees = (await trees()).filter(tree => tree.branch === branch);
    const existing = matchingTrees.length === 1 ? matchingTrees[0] : undefined;
    const branches = (await recoveryCommand('git', ['for-each-ref', '--format=%(refname:short)', `refs/heads/${branch}`], config.repo, { ticket: number, tickets: [number] })).split('\n');
    const branchExists = branches.includes(branch);
    const ambiguity = matchingTrees.length > 1 ? `${branch} 存在多个 worktree，无法唯一恢复` : undefined;
    const waitingReason = ambiguity || reason;
    const site = ambiguity ? 'ambiguous-worktrees' : detectedRecoveryState(existing, branchExists);
    const detected = {
      ticket: number,
      branch,
      cwd: observedCwd(existing),
      state: waitingReason ? 'waiting' : site,
      site,
      ownership: existing || branchExists ? 'recovered-standard' : 'created-by-run',
      explicitReuse: (config.reuse || []).includes(number),
      ...(waitingReason ? { reason: waitingReason } : {}),
    };
    if (existing && !existing.locked && !existing.prunable) {
      try {
        detected.dirty = Boolean(await dirty(existing.cwd));
        detected.inProgress = await inProgress(existing.cwd);
      } catch (error) { detected.observationError = error.message; }
    }
    recordRecovery(number, 'recovery-detected', detected);
    return { branch, matchingTrees, existing, branchExists, detected };
  }
  async function prepareTicket(ticket) {
    const number = ticket.number;
    if (workspaces.has(number)) {
      const workspace = workspaces.get(number);
      await correctWorkspace(workspace);
      return workspace;
    }
    const { branch, matchingTrees, existing, branchExists, detected } = await observeRecovery(ticket);
    if (matchingTrees.length > 1) {
      recordRecovery(number, 'recovery-blocked', detected);
      throw new Error(detected.reason);
    }
    if (existing?.locked || existing?.prunable) {
      const blocked = { ...detected, state: 'waiting', reason: `${branch} worktree 已锁定或不可用` };
      recordRecovery(number, 'recovery-blocked', blocked);
      throw new Error(blocked.reason);
    }

    let release;
    try {
      release = await writerLock(common, branch, probe => {
        if (probe.socketState === 'vacant') return;
        observations?.observe('engine/recovery', 'recovery-writer-probe', { ticket: number, tickets: [number] }, { branch, ...probe });
        void observeAbandonedWriter(branch, { ticket: number, tickets: [number] });
      });
    } catch (error) {
      const blocked = { ...detected, state: 'waiting-writer', reason: error.message };
      recordRecovery(number, 'recovery-blocked', blocked);
      throw error;
    }
    releases.add(release);
    try {
      // 串行准备现场。不使用 --yes、不写审批、不 clobber、不用 Git 修改 worktree；
      // 未获批准的 hook 交给用户处理，不能自动绕过。
      if (!existing) {
        const args = ['switch', '--no-cd'];
        if (!branchExists) args.push('--create', '--base', target);
        args.push(branch);
        await recoveryCommand('wt', args, config.repo, { ticket: number, tickets: [number] });
      }
      const tree = (await trees()).find(item => item.branch === branch);
      if (!tree) throw new Error(`Worktrunk 未创建 ${branch} 的现场`);
      const workspace = { branch, cwd: realpathSync(tree.cwd), release };
      if (workspace.cwd === targetCwd) throw new Error('Ticket 与目标不得共享现场');
      await correctWorkspace(workspace);
      const taskDirty = Boolean(await dirty(workspace.cwd));
      const taskInProgress = await inProgress(workspace.cwd);
      if (branchExists && !taskDirty && !taskInProgress) {
        let reflog, reflogKnown = true;
        try { reflog = await git(['reflog', 'show', '--format=%gs', branch], workspace.cwd); }
        catch (error) { if (unsafeTermination.test(error.message)) throw error; reflogKnown = false; }
        const hasBranchWork = !reflogKnown || reflog.split('\n').some(entry => entry && !entry.startsWith('branch: Created'));
        if (hasBranchWork) {
          try { await git(['merge-base', '--is-ancestor', branch, target], workspace.cwd); workspace.mergedIntoTarget = true; }
          catch (error) { if (!/: 1$/.test(error.message)) throw error; }
        }
      }
      workspaces.set(number, workspace);
      // 分类为 recovered / merged-unverified 的完整依据（OID、commits ahead、
      // ancestry、dirty、in-progress）随结论一起进入 Recovery timeline。
      const facts = await recoveryFacts({ ticket: number, tickets: [number] }, branch, workspace.cwd, target, workspace.cwd);
      const recoveryState = {
        ...detected,
        ...facts,
        cwd: workspace.cwd,
        state: adoptedRecoveryState(existing, branchExists, workspace.mergedIntoTarget),
        dirty: taskDirty,
        inProgress: taskInProgress,
      };
      recordRecovery(number, 'recovery-adopted', recoveryState);
      event('workspace', { ticket: number, ...workspace, reused: branchExists });
      return workspace;
    } catch (error) {
      const blocked = { ...recovery.get(number), state: 'waiting', reason: error.message };
      recordRecovery(number, 'recovery-blocked', blocked);
      if (!processes.hasUnsafeWriters && !unsafeTermination.test(error.message)) {
        try { await release(); releases.delete(release); }
        catch (cleanup) { event('lock-release-failed', { ticket: number, reason: cleanup.message }); }
      }
      throw error;
    }
  }

  async function closeWorkspace(ticket, workspace) {
    if (processes.hasUnsafeWriters || quarantined) return;
    try {
      await correctWorkspace(workspace);
      event('workspace-retained', { ticket: ticket.number, cwd: workspace.cwd, reason: '现场清理与核心交付分离；分支和 worktree 保留' });
    } catch (error) {
      if (unsafeTermination.test(error.message) || processes.hasUnsafeWriters) quarantined = true;
      event('workspace-cleanup-failed', { ticket: ticket.number, reason: error.message });
    } finally {
      if (!quarantined && !processes.hasUnsafeWriters) {
        try { await workspace.release(); releases.delete(workspace.release); }
        catch (error) { event('lock-release-failed', { ticket: ticket.number, reason: error.message }); }
        workspaces.delete(ticket.number);
      }
    }
  }

  const resultContract = {
    common: { run: config.run, attempt: '由本次 prompt 提供的整数', role: 'implementer|reviewer|merger', status: 'passed|failed|blocked', summary: '交付说明', tests: [{ command: '实际验证命令或具体人工检查', status: 'passed|failed|not-run', summary: '实际结果' }], remaining: ['未完成问题；无则空数组'] },
    ticket: { ticket: '整数编号', branch: 'afk/issue-N', cwd: '绑定绝对路径', commits: ['可交付提交的文字摘要，非 SHA；可包含复用历史提交'] },
    merger: { branch: target, cwd: '绑定目标绝对路径', summaryCreated: 'boolean：本批 summary 已完成（含上次已完成）', summarySubject: 'summaryCreated 为 true 时为实际中文 Conventional Commit 标题，否则 null', tickets: [{ ticket: '整数编号', branch: 'afk/issue-N', merged: 'boolean', verified: 'boolean', closed: 'boolean：实际 GitHub 状态' }] },
  };
  async function prompt(role, context) {
    const related = context.ticket?.specs || [...new Map((context.items || []).flatMap(item => item.ticket.specs || []).map(spec => [spec.number, spec])).values()];
    const input = { context, repository, target, specs: related, verify: config.verify || null };
    const text = await renderPrompt(templates[role], {
      TASK_ID: context.ticket ? String(context.ticket.number) : '',
      ISSUE_TITLE: context.ticket?.title || '',
      VIEW_TASK_COMMAND: `gh issue view ${context.ticket?.number || ''} --repo ${repository} --comments`,
      BRANCH: context.branch,
      TARGET_BRANCH: target,
      BRANCHES: (context.items || []).map(item => `- ${item.workspace.branch}`).join('\n'),
      CLOSE_TASK_COMMAND: `gh issue close --repo ${repository}`,
      ISSUES: (context.items || []).map(item => `- ${item.ticket.number}: ${item.ticket.title}`).join('\n'),
      CONTEXT: JSON.stringify(input),
      VALIDATION_COMMANDS: config.verify || '按项目约定运行实际测试与类型检查，记录具体命令及结果。',
    }, { cwd: context.cwd, command });
    return `${text}\n` +
      (config.verify ? `验证要求（配置）：${config.verify}\n` : '') +
      `最后仅返回一个 <afk-result>JSON</afk-result> 结构化结果；退出码/完成字符串不是业务成功。身份必须逐字匹配本次 context 的 run/attempt/role。所有字段必填，布尔与整数用 JSON 原生类型。\n` +
      `输出必须是平铺对象：顶层直接包含 run、attempt、role、status、summary、tests、remaining、branch、cwd 及当前角色字段。把下方 contract 的字段替换为实际值后输出；contract/context/repository/target/specs 是输入包装，绝不作为输出的外层键，也不回显整个输入。\n` +
      JSON.stringify({ contract: { ...resultContract.common, ...(role === 'merger' ? resultContract.merger : resultContract.ticket) }, ...input }, null, 2);
  }
  function validTests(result) {
    return Array.isArray(result.tests) && result.tests.every(test => test && typeof test.command === 'string' && test.command.trim() && ['passed', 'failed', 'not-run'].includes(test.status) && typeof test.summary === 'string');
  }
  // 分支上是否真有提交（Git 事实，与角色自报的 commits 摘要对照）。
  async function branchAhead(workspace) {
    try { return Number(await git(['rev-list', '--count', `${target}..${workspace.branch}`], workspace.cwd)) > 0; }
    catch { return false; }
  }
  function validateCommon(result, context) {
    if (result.run !== config.run || result.attempt !== context.attempt || result.role !== context.role || !['passed', 'failed', 'blocked'].includes(result.status) || typeof result.summary !== 'string' || !validTests(result) || !strings(result.remaining)) throw new Error('角色业务结果通用字段无效');
    if (result.branch !== context.branch || typeof result.cwd !== 'string' || !result.cwd.startsWith('/') || realpathSync(result.cwd) !== realpathSync(context.cwd)) throw new Error('角色业务结果 branch/cwd 与绑定不符');
  }
  async function runRole(role, context, onDispatch = () => {}) {
    if (processes.stopping) return { status: 'stopped', reason: '用户停止' };
    // Attempt 是作用域内的 cycle 序号：Implementer/Reviewer 按 Ticket/Role，
    // Merger 按 Batch/Role。同一作用域重新开始完整 cycle 才递增；
    // 被动 inventory、probe 与 SSE 重连都不经过这里，因此不会污染计数。
    const scopeKey = role === 'merger'
      ? `merger|batch:${context.batch}|${context.mode}`
      : `${role}|ticket:${context.ticket?.number}`;
    const ordinal = (attemptCounters.get(scopeKey) || 0) + 1;
    attemptCounters.set(scopeKey, ordinal);
    // 内部唯一 id 只用于把 planned Attempt 与后来的 Invocation 对齐；
    // 不同 Ticket 的 ordinal 可以相同，不能用它做键。
    const attemptId = ++attemptIds;
    const identity = { ...context, run: config.run, attempt: ordinal, role };
    // planned Attempt 先于 spawn 存在；Invocation/PID 只在实际 spawn 成功后补齐。
    let invocation;
    observations?.observe('engine', 'attempt-planned', { role, attempt: ordinal, tickets: context.tickets, ...(Number.isSafeInteger(context.batch) ? { batch: context.batch } : {}) }, { phase: context.mode || role, state: 'planned' });
    const logPath = join(config.logDir, `${String(attemptId).padStart(5, '0')}-${role}-${context.tickets.join('-')}.stdout.log`);
    await correctWorkspace(context);
    const rendered = await prompt(role, identity);
    if (processes.stopping) return { status: 'stopped', reason: '用户停止' };
    await correctWorkspace(context);
    onDispatch();
    const result = await processes.role(config, { ...identity, prompt: rendered }, logPath, event, observations, value => { invocation = value; });
    // Invocation 随结果返回，供观测关联；不同 Ticket 的 Attempt ordinal
    // 可以相同，不能用它做跨票反查。
    result.invocation = invocation;
    event('role-result', { role, attempt: identity.attempt, tickets: context.tickets, result });
    // Provider 层的失败/权限结果不含业务封套，
    // 不能将其解读为成功的结构化交付结果。
    if (!Object.hasOwn(result, 'run')) {
      if (!['failed', 'blocked', 'stopped'].includes(result.status)) throw new Error('Provider 返回未知状态');
      if (result.status === 'failed' && configurationFailure.test(result.reason || '')) return { ...result, status: 'blocked' };
      return result;
    }
    validateCommon(result, identity);
    // commits 是“本角色新增提交”的摘要，不是“分支必须由本角色追加”的证明：
    // 上游 reviewer 模板明确允许“合格则无需新 commit”，纯 Skill/文档仓库里
    // 常见的一次审查不产生提交。因此只校验字段形状，不再要求非空。
    if (role !== 'merger' && (result.ticket !== context.ticket.number || !strings(result.commits))) throw new Error('逐票结果 ticket/commits 字段无效');
    return result;
  }
  // 提取 main.mts:123–160 的 try/run→commits 门→review→累计 commits→finally。
  // sandbox.run/close 替换本机 runRole/closeWorkspace；AFK 加平铺结果与实际交付检查。
  async function pipeline(ticket, workspace) {
    const context = { ticket, tickets: [ticket.number], ...workspace, target, targetCwd };
    // 上游门语义：推进只看角色结果里的 commits 摘要与 Git 事实。
    const blockedReason = result => {
      if (result.status === 'blocked') {
        const reason = [result.reason || result.summary, ...(result.tests || []).filter(test => test.status !== 'passed').map(test => `${test.command}：${test.summary}`), ...(result.remaining || [])].filter(Boolean).join('; ');
        blocks.set(ticket.number, reason);
        return reason;
      }
      if (result.status !== 'passed') return [result.reason || result.summary, ...(result.tests || []).filter(test => test.status !== 'passed').map(test => `${test.command}：${test.summary}`), ...(result.remaining || [])].filter(Boolean).join('; ');
      return undefined;
    };
    let queuedForMerge = false;
    try {
      if (workspace.mergedIntoTarget) {
        event('merge-already-present', { ticket: ticket.number, branch: workspace.branch, target, action: 'verify-close' });
        queuedForMerge = true;
        return {
          status: 'passed', summary: '分支提交已在目标中，跳过重复实现与 merge，继续验证和关闭',
          tests: [], remaining: [], commits: ['已成为目标分支祖先的既有提交'],
          ticket, workspace, review: null,
        };
      }
      const implement = await runRole('implementer', context);
      if (implement.status === 'stopped' || processes.stopping) return implement;
      // Implementer 有提交摘要才进 Reviewer，没有就直接归入本轮结果。
      if (blockedReason(implement) || !implement.commits.length) return;
      const review = await runRole('reviewer', { ...context, previous: implement });
      if (review.status === 'stopped' || processes.stopping) return review;
      // Reviewer 结果直接与 Implementer 提交合并进入待合集。
      if (blockedReason(review)) return;
      queuedForMerge = true;
      return {
        ...review,
        commits: [...implement.commits, ...review.commits],
        ticket, workspace, review,
      };
    } catch (error) {
      if (unsafeTermination.test(error.message) || processes.hasUnsafeWriters) quarantined = true;
      throw error;
    } finally {
      if (!queuedForMerge) await closeWorkspace(ticket, workspace);
      else event('workspace-retained', { ticket: ticket.number, cwd: workspace.cwd, reason: '已审查成果排队期间保留 writer lock 和现场' });
    }
  }

  function mergerCandidates(group) {
    if (group.uncertain) return [];
    const reasons = waitingReasons(false);
    if (group.phase !== 'close') return group.tickets.some(item => reasons.has(item.ticket.number)) ? [] : group.tickets;
    return group.tickets.filter(item => !blocks.has(item.ticket.number) && tickets.get(item.ticket.number)?.state === 'open');
  }
  function mergerReady(group) {
    const ready = mergerCandidates(group);
    group.blockedReason = group.uncertain || (ready.length ? undefined : group.tickets.map(item => `#${item.ticket.number}：${waitingReasons(false).get(item.ticket.number) || 'GitHub 状态未知'}`).join('; '));
    return ready.length > 0;
  }
  function prioritizeCloseGroup() {
    if (!pending || targetReason || pending.phase !== 'close' || mergerReady(pending)) return;
    // 一个未知的仅待关闭票不占用唯一 Merger；不可跨越未完成合并现场。
    for (let index = 0; index < mergeQueue.length; index++) {
      const next = mergeQueue[index];
      if (mergerReady(next)) {
        mergeQueue.splice(index, 1);
        mergeQueue.unshift(pending);
        pending = next;
        return;
      }
      if (next.phase !== 'close') return;
    }
  }
  async function inspectMerger(group, reason) {
    // 坏最终封套不能回放旧 passed。只读取普通 Git/GitHub 事实，不建立快照/HEAD 协议。
    const evidence = { reason, tickets: [] };
    try {
      await correctWorkspace({ cwd: targetCwd, branch: target });
      // dirty 不再是交付判据（用户既有未提交改动不阻塞 Merger）。仍记录相对
      // 准备阶段基线的新增路径作为观察事实，便于人工核实过程中是否有新改动。
      evidence.newChanges = (await dirtyPaths(targetCwd)).filter(path => !targetPreexisting.includes(path));
      evidence.inProgress = await inProgress(targetCwd);
      evidence.history = await git(['log', '-10', '--format=%s%n%b'], targetCwd);
      for (const item of group.tickets) {
        let merged = false, state = 'unknown', error;
        try { await git(['merge-base', '--is-ancestor', item.workspace.branch, target], targetCwd); merged = true; }
        catch (failure) { if (unsafeTermination.test(failure.message)) throw failure; }
        try { state = (await readIssue(item.ticket.number)).state; }
        catch (failure) { if (unsafeTermination.test(failure.message)) throw failure; error = failure.message; }
        evidence.tickets.push({ ticket: item.ticket.number, merged, state, error });
      }
    } catch (error) {
      if (unsafeTermination.test(error.message)) throw error;
      evidence.error = error.message;
    }
    event('merge-reconciled', { batch: group.id, ...evidence });
    group.uncertain = `Merger 最终结果不可用：${reason}；已读取现场/历史/GitHub，仍需核实验证是否完成，禁止盲目重做`;
    targetReason = group.uncertain;
  }
  async function recheckTarget() {
    // 仅 in-progress 目标可自动恢复；其他阻碍需要用户核实，绝不自动清除。
    if (targetReason !== targetInProgressReason || processes.stopping || processes.hasUnsafeWriters || quarantined) return;
    try {
      const tree = (await trees()).find(item => item.branch === target);
      if (!tree || tree.locked || tree.prunable || realpathSync(tree.cwd) !== targetCwd) throw new Error('目标 worktree 归属未经确认或已锁定');
      await correctWorkspace({ cwd: targetCwd, branch: target });
      if (await inProgress(targetCwd)) return;
      targetReason = undefined;
      event('target-unblocked', { target, cwd: targetCwd });
    } catch (error) {
      if (unsafeTermination.test(error.message)) throw error;
      targetReason = error.message;
      event('target-blocked', { target, cwd: targetCwd, reason: targetReason });
    }
  }
  async function mergePending() {
    await recheckTarget();
    prioritizeCloseGroup();
    if (!pending || targetReason || processes.stopping || !mergerReady(pending)) return;
    const group = pending;
    const items = mergerCandidates(group).map(item => ({ ...item, ticket: tickets.get(item.ticket.number) || item.ticket }));
    let dispatched = false;
    try {
      await correctWorkspace({ cwd: targetCwd, branch: target });
      if (!group.started && await inProgress(targetCwd)) {
        targetReason = targetInProgressReason;
        return;
      }
      // 提取 main.mts:208–221 的单次 merger 调用及 BRANCHES/ISSUES 参数（见 prompt）。
      // 本机接线 runRole 替代 sandcastle.run；本运行 started/previous/phase 是 D7 续作薄适配。
      const result = await runRole('merger', { cwd: targetCwd, branch: target, target, tickets: items.map(item => item.ticket.number), mode: group.phase, batch: group.id, items, previous: group.previous, summarySubject: group.summarySubject || null }, () => {
        // 可信预展开完成、实际调用载体前才进入可能有副作用的边界。
        dispatched = true;
        group.started = true;
      });
      if (result.status === 'stopped' || processes.stopping) return;
      if (!Object.hasOwn(result, 'run')) {
        await inspectMerger(group, result.reason || '最终结果缺少合法业务封套');
        if (result.status === 'blocked') {
          if (group.phase === 'close') for (const item of items) blocks.set(item.ticket.number, result.reason || 'Merger 权限阻碍');
          else targetReason = result.reason || 'Merger 权限阻碍';
        }
        return;
      }
      // 引擎只做形状与血缘的事实核验：身份逐票对应、分支已成为目标祖先。
      // verified / summary 不再作为关闭前置阻断；“说关就关”的责任在 Merger。
      if (!Array.isArray(result.tickets) || result.tickets.length !== items.length) throw new Error('Merger 结果缺少逐票状态');
      const expected = new Map(items.map(item => [item.ticket.number, item]));
      for (const item of result.tickets) {
        const original = expected.get(item.ticket);
        if (!original || original.workspace.branch !== item.branch || ['merged', 'verified', 'closed'].some(key => typeof item[key] !== 'boolean')) throw new Error('Merger 逐票结果与固定批次不符');
        expected.delete(item.ticket);
        if (item.merged) await git(['merge-base', '--is-ancestor', item.branch, target], targetCwd);
      }
      await correctWorkspace({ cwd: targetCwd, branch: target });
      // 用户既有未提交改动必须原样留在工作区：summary commit 不得把基线脏文件
      // 卷进提交（那会让用户改动凭空消失在工作区、变成别人的提交）。
      const swallowed = (await committedPaths(targetCwd)).filter(path => targetPreexisting.includes(path));
      if (swallowed.length) throw new Error(`summary 提交包含了目标原有的未提交改动：${swallowed.join(', ')}；用户改动必须保留在工作区`);
      if (typeof result.summaryCreated === 'boolean' && result.summaryCreated) {
        if (group.phase === 'close') {
          if (result.summarySubject !== group.summarySubject) throw new Error('close-only 不得重写 summary');
        } else {
          group.phase = 'close';
          group.summarySubject = result.summarySubject;
        }
      }
      group.previous = result;
      if (result.status === 'blocked') {
        const blockedReason = group.phase === 'close' ? `关闭受阻：${result.summary}；${result.remaining.join('; ')}` : result.summary || 'Merger 权限/现场阻碍';
        if (group.phase === 'close') {
          for (const item of result.tickets) if (!item.closed) blocks.set(item.ticket, blockedReason);
        } else targetReason = blockedReason;
      }
      // 合并失败可接续；关闭失败逐票保留，下一轮仅关闭，绝不重跑 merge/test/summary。
      event('merge-progress', { batch: group.id, phase: group.phase, summarySubject: group.summarySubject, tickets: result.tickets });
      // 看板逐票状态从 Merger 逐票结果推导：每票独立发布一条观测事实。
      for (const item of result.tickets) {
        observations?.observe('engine', 'merger-result', { ticket: item.ticket, tickets: [item.ticket], batch: group.id, role: 'merger' }, { merged: item.merged, verified: item.verified, closed: item.closed, phase: group.phase });
      }
    } catch (error) {
      if (unsafeTermination.test(error.message)) throw error;
      if (dispatched && !processes.stopping) await inspectMerger(group, error.message);
      else if ([permission, configurationFailure, workspaceFailure].some(pattern => pattern.test(error.message))) targetReason = error.message;
      event('merge-failed', { batch: group.id, reason: error.message });
    }
  }

  // 握手只等待前置检查及固定范围；逐票上下文读取留在可观察、可取消的运行阶段。
  event('scope', { repository, target, tickets: [...scope], specs: [...specs], waiting: Object.fromEntries(waitingReasons()) });
  return {
    describe: () => ({ repository, repo: root, target, targetCwd, tickets: [...scope], specs: [...specs], batch, pending: pending && { phase: pending.phase, tickets: pending.tickets.map(item => item.ticket.number) }, queued: mergeQueue.map(group => ({ batch: group.id, tickets: group.tickets.map(item => item.ticket.number) })), recovery: Object.fromEntries(recovery), waiting: Object.fromEntries(waitingReasons()), targetBlocked: targetReason, quarantined }),
    releaseAbandonedLocks,
    async run() {
      if (running || finished) throw new Error('Engine 实例只允许运行一次；新 run 由当前 Git/GitHub 事实重新恢复');
      running = true;
      try {
        await refresh();
        if (processes.stopping) return { state: 'stopped', tickets: [...scope], batches: batch };
        const initialReasons = waitingReasons(false);
        for (const number of scope) {
          const ticket = tickets.get(number);
          if (ticket?.state === 'open') await observeRecovery(ticket, initialReasons.get(number));
        }
        event('recovery-plan', { tickets: Object.fromEntries(recovery) });
        event('context-ready', { tickets: [...scope], waiting: Object.fromEntries(waitingReasons()) });
        await prepareTarget();
        while (!processes.stopping) {
          const open = [...scope].filter(number => tickets.get(number)?.state !== 'closed');
          if (!open.length) {
            return { state: 'completed', tickets: [...scope], batches: batch };
          }
          batch++;
          // 全局最大轮次兜底：达到即正常结束当前 run，不无限烧钱。
          if (batch > maxRounds) return { state: 'completed', tickets: [...scope], batches: batch, roundsCapped: true, maxRounds };
          if (pending) await recheckTarget();
          prioritizeCloseGroup();
          // 待合并或 close-only 始终由单个 Merger 继续；
          // 不重派实现/审查，也不让新批次改变该组 summary。
          if (pending && !targetReason && mergerReady(pending)) {
            await mergePending();
          } else {
            const selected = selectBatch();
            event('batch-selected', { batch, tickets: selected.map(issue => issue.number), fixed: true });
            if (!selected.length) {
              // 某票等待 active writer 时其余独立票继续；此处定期重新做正向活跃检测，
              // 一旦不再检测到 active writer 就自动恢复并派发，无需重新调用 skill。
              const waitingWriter = open.filter(number => {
                if (recovery.get(number)?.state !== 'waiting-writer') return false;
                // 该票若还带着非 writer 阻碍（权限、依赖、锁定等），不清除它：
                // 交给 waitingReasons 报告真实原因，避免重检路径误派发。
                const block = blocks.get(number);
                return !block || writerBlocking.test(block);
              });
              if (waitingWriter.length) {
                for (const number of waitingWriter) blocks.delete(number);
                event('writer-recheck', { tickets: waitingWriter });
                for (let i = 0; i < 20 && !processes.stopping; i++) await delay(100);
                continue;
              }
              const reasons = waitingReasons();
              if (pending && targetReason) for (const item of pending.tickets) reasons.set(item.ticket.number, `目标等待用户：${targetReason}`);
              // 同时解释因目标尚待交付而阻塞的下游。
              for (const number of open) if (!reasons.has(number)) {
                const dependencies = tickets.get(number)?.dependencies?.filter(dep => dep.state === 'open') || [];
                reasons.set(number, dependencies.length ? `原生 blocked-by 尚未关闭：${dependencies.map(dep => dep.html_url || `#${dep.number}`).join(', ')}` : targetReason ? `等待目标交付：${targetReason}` : '当前范围没有可安全派发的 Ticket，需用户核实现场');
              }
              return { state: 'waiting-user', tickets: open, waiting: Object.fromEntries(reasons), targetBlocked: targetReason, batches: batch };
            }
            const prepared = [];
            for (const ticket of selected) {
              if (processes.stopping) break;
              try { prepared.push({ ticket, workspace: await prepareTicket(ticket) }); }
              catch (error) {
                if (unsafeTermination.test(error.message)) throw error;
                if ([permission, configurationFailure, workspaceFailure].some(pattern => pattern.test(error.message))) blocks.set(ticket.number, error.message);
                event('workspace-blocked', { ticket: ticket.number, reason: error.message });
              }
            }
            // main.mts:114–162 提取：sandbox 创建移到串行 prepareTicket，
            // 内联 try/finally 提为 pipeline；allSettled 不取消同批其他票。
            const settled = await Promise.allSettled(
              prepared.map(async ({ ticket, workspace }) => pipeline(ticket, workspace)),
            );
            for (const [index, outcome] of settled.entries()) {
              if (outcome.status === 'rejected') {
                if (unsafeTermination.test(outcome.reason?.message || '')) throw outcome.reason;
                const number = prepared[index].ticket.number;
                if ([permission, configurationFailure, workspaceFailure].some(pattern => pattern.test(outcome.reason?.message || ''))) blocks.set(number, outcome.reason.message);
                event('pipeline-failed', { ticket: number, reason: String(outcome.reason?.message || outcome.reason) });
              }
            }
            // 上游 main.mts:175–182 的 fulfilled + commits.length > 0 门：
            // 待合集只收“正常完成且提交非空”的结果。
            const successful = [];
            for (const [index, outcome] of settled.entries()) {
              if (outcome.status !== 'fulfilled' || !outcome.value?.commits?.length) continue;
              // 已是目标祖先的分支无 ahead 提交，但仍需进 Merger 验证关闭。
              if (!prepared[index].workspace.mergedIntoTarget && !await branchAhead(prepared[index].workspace)) continue;
              successful.push(outcome.value);
            }
            if (successful.length) {
              const group = { id: batch, phase: 'merge', tickets: successful };
              if (pending) mergeQueue.push(group);
              else pending = group;
            }
            await mergePending();
          }
          if (processes.stopping) break;
          await refresh();
          event('batch-settled', { batch, open: [...scope].filter(number => tickets.get(number)?.state !== 'closed'), waiting: Object.fromEntries(waitingReasons()) });
          // 短暂且可中断的退避，避免空结果、格式错误或 CLI 持续失败导致忙循环。
          for (let i = 0; i < 10 && !processes.stopping; i++) await delay(100);
        }
        return { state: 'stopped', tickets: [...scope].filter(number => tickets.get(number)?.state !== 'closed'), batches: batch };
      } catch (error) {
        quarantined = Boolean(processes.hasUnsafeWriters) || unsafeTermination.test(error.message);
        if (quarantined) event('writers-quarantined', { reason: error.message, note: '终止未确认：保留现场写锁，不交接；需用户处理原运行' });
        throw error;
      } finally {
        running = false;
        finished = true;
        // 未入队管线已释放现场锁；已审查／待验证成果持锁到 run 结束。
        // 未确认终止的写者保留 socket；单个释放失败不阻止其余自身锁释放。
        if (!quarantined && !processes.hasUnsafeWriters) {
          await releaseOwnedLocks(error => event('lock-release-failed', { reason: error.message }));
        }
      }
    },
  };
}
