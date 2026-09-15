// Extracted from mattpocock/sandcastle e99f832f26dc9d245c019a9ddd19fa5dee792427.
// MIT, Copyright (c) 2026 Matt Pocock; keep LICENSE.sandcastle.
// no-sandbox.ts:57-135 (exec), Orchestrator.ts:22-244 (invokeAgent).
// D2/D4/D8/D9 adaptations: native Promise/timers instead of Effect, explicit
// final-result presence, bounded diagnostics, actual local cancellation below.
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { buildInvocation, parseLine, explicitRefusal, authorizationError, roleSelection } from './providers.mjs';
import { BoundedTail, MAX_TAIL_CHARS } from './bounded-tail.mjs';
import { findLastTagContent, unwrapFences } from './structured-output.mjs';

export const IDLE_MS = 600_000;
export const COMPLETION_MS = 60_000;
const COMMAND_TIMEOUT_MS = 30_000;
const COMPLETION_SIGNALS = ['<promise>COMPLETE</promise>'];
const TERM_WAIT_MS = 2_000;
const KILL_WAIT_MS = 3_000;
const PIPE_WAIT_MS = 1_500;
// Shell 包装器惯例用 128 + 信号编号返回退出码，而非 exit.signal。
// 这里只作窄兼容，不把任意退出码或同码竞态当作已证明的信号因果。
const SIGNAL_EXIT_CODES = { SIGTERM: 143, SIGKILL: 137 };

// macOS 在进程组长已退出但尚未被 reap（本进程是其父进程）时，对 -pgid 发信号 0
// 会返回 EPERM，而不是 ESRCH；组长被回收后同一调用才返回 ESRCH。这个约 25ms 的
// 窗口是正常的退出竞态，不是「无权终止」。把它误判为不可自愈的终止失败会让每次
// 用户停止都可能把 run 判 failed 并隔离现场，因此这里按语义分类：
// 探测时 EPERM 视为「组仍存在」（僵尸组长终将被回收），发送信号时 EPERM 视为
// 「无成员可收、信号未投递」，与 ESRCH 同样返回 false。其余错误码仍然抛出。
function groupExists(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (error) {
    if (error.code === 'ESRCH') return false;
    if (error.code === 'EPERM') return true;
    throw error;
  }
}
function signalGroup(pid, signal) {
  try { process.kill(-pid, signal); return true; }
  catch (error) {
    if (error.code === 'ESRCH' || error.code === 'EPERM') return false;
    throw error;
  }
}
async function waitFor(predicate, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= end) return false;
    await delay(25);
  }
  return true;
}

// invokeAgent keeps upstream's raw -> parse -> completion -> resetTimer order.
// Only framework/emitter/session wiring is replaced. No business fields are
// validated here. A timeout requests termination, never just cancels a Promise.
// provider/model/effort 来自该次调用所属 Role 的冻结配置（roleSelection），
// 不是 run 级单值——不同 harness 的 stream-json 格式完全不同（ADR 0008）。
async function invokeAgent(processes, selection, context, onRawLine, onStderr, onProcessStart, onProviderRaw, onProviderEvent) {
  let resultText, replyText;
  let currentReply = new BoundedTail(MAX_TAIL_CHARS);
  const accumulatedOutput = new BoundedTail(MAX_TAIL_CHARS);
  let completionDetected = false;
  let timeout, entry;
  let providerError, terminalError, cancelled = false, permissionDenied = false;
  // issue #12：终局成功是清除过程性拒绝记录（权限 / 鉴权）的唯一依据。
  let finalSuccess = false;
  const resetTimer = () => {
    clearTimeout(timeout);
    if (!entry || entry.reason || entry.exited) return;
    timeout = setTimeout(() => {
      processes.terminate(entry, completionDetected ? 'grace' : 'idle').catch(entry.fail);
    }, completionDetected ? COMPLETION_MS : IDLE_MS);
  };
  const printCmd = buildInvocation({ ...selection, prompt: context.prompt, cwd: context.cwd });
  try {
    const execResult = await processes.execute(printCmd.command, printCmd.args, {
      onLine: line => {
        onProviderRaw?.(line);
        // Unlike upstream's swallowed forwarding error, failed disk logging
        // must stop this execution (D9). Still parse before propagating it.
        let forwardingError;
        try { onRawLine(line); } catch (error) { forwardingError = error; }
        const parsedLine = parseLine(selection.provider, line);
        // A newer complete reply/start invalidates old finals. Completion
        // scanning remains cumulative, but business extraction never is.
        if (parsedLine.replyStart || parsedLine.replyText !== undefined) {
          resultText = undefined;
          replyText = parsedLine.replyText;
          currentReply = new BoundedTail(MAX_TAIL_CHARS);
          if (replyText !== undefined) {
            providerError = undefined;
            if (!terminalError) cancelled = false;
          }
        }
        // 已识别事件作为附加 Observation 结构化发布；原始行已先入库，
        // 这里只补充 UI 可以逐行增长的 typed 视图，不替代原始负载。
        for (const parsed of parsedLine.events) onProviderEvent?.(parsed);
        for (const parsed of parsedLine.events) {
          if (parsed.type === 'text') {
            currentReply.push(parsed.text);
            accumulatedOutput.push(parsed.text);
          } else if (parsed.type === 'result') {
            resultText = parsed.result;
            accumulatedOutput.push(parsed.result);
            providerError = undefined;
          }
        }
        if (parsedLine.error) providerError = parsedLine.error;
        if (parsedLine.terminal) terminalError = parsedLine.error;
        cancelled ||= Boolean(parsedLine.cancelled);
        permissionDenied ||= Boolean(parsedLine.permissionDenied);
        // issue #12：成功终局（有结果文本、无终局错误，claude/codex/pi 对等）清除
        // 过程中累积的权限拒绝标志，使恢复机制对权限拒绝与其它错误对称。中途鉴权
        // 字样不在此处判定，统一由下面终局裁定处理。后来行若出现终局失败则清掉
        // 已累积的成功，避免中间成功洗掉终局失败。
        if (parsedLine.finalSuccess) {
          permissionDenied = false;
          finalSuccess = true;
        } else if (parsedLine.terminal) {
          finalSuccess = false;
        }
        if (!completionDetected && COMPLETION_SIGNALS.some(sig => accumulatedOutput.toString().includes(sig))) {
          completionDetected = true;
        }
        resetTimer();
        if (forwardingError) throw forwardingError;
      },
      onStderr,
      cwd: context.cwd,
      input: printCmd.input,
      onStart: (pid, current) => { entry = current; onProcessStart(pid); resetTimer(); },
    });
    // Upstream final result and incremental output remain separate. Presence,
    // not truthiness, is authoritative: an empty final cannot revive old passed.
    // 终局裁定（issue #12）：宽泛鉴权正则只作用于最终抵达调用方的终局错误文本。中途
    // 出现过 unauthorized 字样、随后被成功终局清掉 providerError，就不再置位。成功的
    // 终局不产生任何终局错误，因此该判定天然被排除。
    const finalAuthorizationDenied = finalSuccess ? false
      : authorizationError(terminalError || providerError || '');
    return {
      ...execResult,
      result: resultText === undefined ? (replyText ?? currentReply.toString()) : resultText,
      completionDetected, providerError, terminalError, cancelled, finalSuccess,
      permissionDenied: permissionDenied || finalAuthorizationDenied,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export class Processes {
  children = new Set();
  stopping = false;
  hasUnsafeWriters = false;
  stopRequested = false;
  // 最近一次 stop 的逐 entry 终止确认结果；用户停止不因单条未确认而失败整轮。
  terminationResults = [];
  failure;
  invocation = 0;

  async halt(error, reason) {
    this.failure ??= error;
    this.stopping = true;
    // Loss of reliable IO stops the run, not just one attempt. Do not label
    // this an explicit user stop, and attempt every managed termination.
    const results = await Promise.allSettled([...this.children].map(entry => this.terminate(entry, reason)));
    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, failures.map(item => item.message).join('\n'));
  }

  async terminate(entry, reason = 'unknown-cancellation') {
    if (reason === 'user-stop') entry.userStopped = true;
    // Preserve the initiating cause; external signals are recorded by exit.
    entry.reason ??= reason;
    if (entry.termination) return entry.termination;
    entry.termination = (async () => {
      const pid = entry.child.pid;
      if (!pid) return;
      entry.terminationStarted = performance.now();
      entry.sentSignals = [];
      // 不从一次无保护的探测决定是否发信号：探测本身也会遇到 EPERM/竞态。
      // 直接发 SIGTERM，空组或不可达时 signalGroup 返回 false，随后进入继承管道
      // 确认；仍存活的组则由下面的轮询探测（每 25ms）负责收敛。
      entry.terminationStage = 'send-SIGTERM';
      entry.signalled = signalGroup(pid, 'SIGTERM');
      if (entry.signalled) entry.sentSignals.push('SIGTERM');
      entry.terminationStage = 'wait-SIGTERM-group-probe';
      if (!await waitFor(() => !groupExists(pid), TERM_WAIT_MS)) {
        entry.terminationStage = 'send-SIGKILL';
        if (signalGroup(pid, 'SIGKILL')) entry.sentSignals.push('SIGKILL');
        entry.terminationStage = 'wait-SIGKILL-group-probe';
        if (!await waitFor(() => !groupExists(pid), KILL_WAIT_MS)) {
          throw new Error(`进程组 ${pid} 终止未确认`);
        }
      }
      // Parent exit / original group disappearance does NOT prove all children
      // exited. An escaped child holding inherited pipes prevents confirmation.
      // This is deliberately not a guarantee about escaped, closed-pipe writers.
      entry.terminationStage = 'wait-inherited-pipes-close';
      if (!await waitFor(() => entry.closed, PIPE_WAIT_MS)) {
        throw new Error(`进程 ${pid} 已退但继承管道未结束；脱组写者终止未确认`);
      }
    })().catch(error => {
      this.hasUnsafeWriters = true;
      this.stopping = true;
      const termination = {
        managedPid: entry.child.pid, processGroup: entry.child.pid,
        groupSource: 'spawn-detached', stage: entry.terminationStage,
        reason: entry.reason, signalled: entry.signalled === true, sentSignals: entry.sentSignals,
        elapsedMs: performance.now() - entry.terminationStarted,
        exited: entry.exited, naturalClose: entry.closed,
        code: error.code, errno: error.errno, syscall: error.syscall,
      };
      // Release local stream handles only AFTER marking the workspace unsafe;
      // never turn the resulting close event into proof of child termination.
      entry.child.stdin?.destroy();
      entry.child.stdout?.destroy();
      entry.child.stderr?.destroy();
      const failure = new Error(`${error.message}；PID/PGID ${termination.managedPid}；${termination.stage}；${termination.reason}；禁止交接现场`, { cause: error });
      failure.termination = termination;
      throw failure;
    });
    return entry.termination;
  }

  async stop() {
    this.stopRequested = true;
    this.stopping = true;
    const results = await Promise.allSettled([...this.children].map(entry => this.terminate(entry, 'user-stop')));
    // 用户主动停止是尽力而为的收敛路径，不是失败判定：某次终止未确认不应把
    // stopped 终态改写成 failed。逐条保留确认结果供 status/Dashboard 判断；
    // terminate 的 catch 已置 hasUnsafeWriters/stopping，afk.mjs 仍会据此
    // 保留 writer lock 并报告 failed（绝不交接现场）。
    this.terminationResults = results.map(result => result.status === 'fulfilled'
      ? { status: 'confirmed' }
      : { status: 'unconfirmed', error: result.reason, termination: result.reason?.termination });
  }

  async execute(command, args, opts = {}) {
    if (this.stopping) throw new Error('运行已停止，不再派发');
    if (opts.timeoutMs !== undefined && (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0)) throw new Error('timeoutMs 必须是正数');
    const cwd = opts.cwd;
    const processEnv = process.env;
    const maxOutputTailChars = MAX_TAIL_CHARS;
    let entry, timer, idleTimer, rl;
    // Body extracted from no-sandbox exec's spawn / streamed and buffered
    // branches. argv + detached groups replace its shell/platform wiring.
    try {
      return await new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
          cwd,
          env: processEnv,
          detached: true,
          stdio: [opts.input !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
        });
        entry = { child: proc, closed: false, exited: false };
        this.children.add(entry);
        let failure, settled = false;
        const stdoutTail = new BoundedTail(maxOutputTailChars, '\n');
        const stderrTail = new BoundedTail(maxOutputTailChars, '');
        const stdoutChunks = [];
        const fail = error => {
          failure ??= error;
          if (!settled) { settled = true; reject(failure); }
        };
        entry.fail = fail;
        const cancel = (error, reason) => {
          failure ??= error;
          this.halt(error, reason).then(() => fail(failure), fail);
        };
        const resetIdle = () => {
          clearTimeout(idleTimer);
          if (opts.idleMs && !entry.exited && !entry.reason) idleTimer = setTimeout(() => {
            this.terminate(entry, 'idle').catch(fail);
          }, opts.idleMs);
        };
        proc.on('error', error => {
          cancel(new Error(`exec failed: ${error.message}`, { cause: error }), 'spawn-error');
        });
        proc.once('exit', (code, signal) => {
          entry.exited = true;
          entry.code = code;
          entry.signal = signal;
          clearTimeout(timer);
          clearTimeout(idleTimer);
          // Start bounded cleanup on exit, not close: inherited pipes may keep
          // close pending forever. Even code 0 must pass this confirmation.
          this.terminate(entry, 'exit-cleanup').catch(fail);
        });
        proc.once('close', async (code, signal) => {
          entry.closed = true;
          clearTimeout(timer);
          clearTimeout(idleTimer);
          try {
            await this.terminate(entry, 'exit-cleanup');
            if (failure) throw failure;
            if (!settled) {
              settled = true;
              resolve({
                stdout: opts.onLine ? stdoutTail.toString() : stdoutChunks.join(''),
                stderr: stderrTail.toString(),
                code, signal,
                idle: entry.reason === 'idle',
                timedOut: entry.reason === 'command-timeout',
                grace: entry.reason === 'grace' && entry.signalled === true &&
                  (signal ? entry.sentSignals.includes(signal) : code === 0 || entry.sentSignals.some(sent => SIGNAL_EXIT_CODES[sent] === code)),
                stopped: Boolean(entry.userStopped || this.stopRequested),
                cancellation: entry.reason,
                terminationConfirmed: true,
                terminationScope: 'original-process-group-and-inherited-pipes',
              });
            }
          } catch (error) { fail(error); }
        });
        if (opts.onLine || opts.idleMs) {
          const onLine = opts.onLine;
          rl = createInterface({ input: proc.stdout });
          rl.on('line', line => {
            stdoutTail.push(line);
            try {
              if (onLine) onLine(line);
              else stdoutChunks.push(`${line}\n`);
              resetIdle();
            } catch (error) { cancel(error, 'stdout-handler-error'); }
          });
        } else {
          proc.stdout.on('data', chunk => { stdoutChunks.push(chunk.toString()); });
        }
        proc.stderr.on('data', chunk => {
          stderrTail.push(chunk.toString());
          try { opts.onStderr?.(chunk); }
          catch (error) { cancel(error, 'stderr-handler-error'); }
        });
        if (proc.stdin) proc.stdin.on('error', error => {
          if (error.code !== 'EPIPE') cancel(error, 'stdin-error');
        });
        if (opts.timeoutMs) timer = setTimeout(() => {
          this.terminate(entry, 'command-timeout').catch(fail);
        }, opts.timeoutMs);
        resetIdle();
        try {
          opts.onStart?.(proc.pid, entry);
          if (opts.input !== undefined) {
            proc.stdin.write(opts.input);
            proc.stdin.end();
          }
        } catch (error) { cancel(error, 'start-handler-error'); }
      });
    } finally {
      clearTimeout(timer);
      clearTimeout(idleTimer);
      rl?.close();
      // Unsafe entries remain registered; callers must retain workspace locks.
      if (entry && !this.hasUnsafeWriters && (entry.closed || !entry.child.pid)) this.children.delete(entry);
    }
  }

  async command(command, args, cwd, { timeoutMs = COMMAND_TIMEOUT_MS } = {}) {
    const result = await this.execute(command, args, { cwd, timeoutMs });
    if (result.code !== 0 || result.signal || result.stopped || result.timedOut) {
      throw new Error(`${command} ${args.join(' ')}: ${result.timedOut ? `${timeoutMs}ms 前置命令超时，已终止` : result.stopped ? '用户停止' : result.stderr || result.signal || result.code}`);
    }
    return result.stdout.trim();
  }

  async role(config, context, logPath, event, observations, onInvocation) {
    const started = Date.now();
    // 该 Role 本 Run 固定使用的 harness/模型/effort；观测标签与流解析器都用它，
    // 不用 run 级单值，使混 harness 的 Dashboard 与排障不误导（ADR 0008）。
    const selection = roleSelection(config, context.role);
    let invocation;
    const scope = () => ({ role: context.role, attempt: context.attempt, invocation, tickets: context.tickets, ...(Number.isSafeInteger(context.batch) ? { batch: context.batch } : {}) });
    let result, failure, stderrDenied = false;
    // issue #12：stderr 里出现过的拒绝字样同样受终局信号裁定，不由累积值直接否决。
    // 与 permissionDenied 保持同一判据：仅当最终没有成功终局时才生效。
    const stderrDeniedFinal = () => stderrDenied && !result?.finalSuccess;
    const stderrBoundary = new BoundedTail(2_048);
    try {
      event('role-start', { role: context.role, tickets: context.tickets, log: logPath, provider: selection.provider, model: selection.model, effort: selection.effort });
      result = await invokeAgent(this, selection, context,
        line => appendFileSync(logPath, `${line}\n`, { mode: 0o600 }),
        data => {
          observations?.observe('process/stderr', 'stderr', scope(), data.toString());
          appendFileSync(`${logPath}.stderr`, data, { mode: 0o600 });
          stderrBoundary.push(data.toString());
          stderrDenied ||= explicitRefusal(stderrBoundary.toString());
        },
        pid => {
          // spawn 失败时 pid 为 undefined（error 事件稍后到达）；此时不得分配或
          // 公开 Invocation，也不消耗序号。planned Attempt 不冒充运行中的进程。
          if (!Number.isSafeInteger(pid)) return;
          invocation = ++this.invocation;
          onInvocation?.(invocation);
          const payload = { role: context.role, attempt: context.attempt, invocation, tickets: context.tickets, managedPid: pid, processGroup: pid, groupSource: 'spawn-detached', daemonPid: process.pid, provider: selection.provider, model: selection.model, effort: selection.effort };
          observations?.observe('process', 'invocation-started', scope(), payload);
          event('role-process', payload);
        },
        // T4 journal 源头减量：raw-payload 由 ObservationJournal 按同 invocation 连续行
        // 批量合并为一条 '\n' 拼接的字符串 payload 记录（AFK_JOURNAL_BATCH=0 退回逐条旧行为）。
        // text-delta 明确不合并：只占 ~1.5MB，且前端有折叠逻辑（foldLines）与测试
        // （重放逐条 text 拼接断言）依赖逐条形态，合并收益小而风险高。
        line => observations?.observe(`provider/${selection.provider}`, 'raw-payload', scope(), line),
        parsed => observations?.observe(`provider/${selection.provider}`, parsed.type === 'text' ? 'text-delta' : parsed.type, scope(), parsed));
    } catch (error) {
      failure = error;
      try { await this.halt(error, 'role-io-error'); }
      catch (stopError) { failure = stopError; }
    }
    try {
      const ended = {
        role: context.role, attempt: context.attempt, invocation, tickets: context.tickets, code: result?.code,
        signal: result?.signal, idle: result?.idle, grace: result?.grace,
        cancellation: result?.cancellation, terminationConfirmed: result?.terminationConfirmed,
        terminationScope: result?.terminationScope, error: failure?.message,
        termination: failure?.termination || failure?.errors?.find(error => error.termination)?.termination,
        durationMs: Date.now() - started,
      };
      // 进程结束是独立的 Process 层事实：Role 退出不代表已交付，
      // 但页面必须能看出进程已不再运行。
      observations?.observe('process', 'role-end', scope(), ended);
      event('role-end', ended);
    } catch (error) {
      failure ??= error;
      try { await this.halt(error, 'event-log-error'); }
      catch (stopError) { failure = stopError; }
    }
    if (failure || this.failure) throw failure || this.failure;
    if (result.stopped) return { status: 'stopped', reason: '用户停止' };
    if (result.permissionDenied || stderrDeniedFinal()) return { status: 'blocked', reason: result.providerError || 'CLI 明确权限/授权拒绝；见原始日志' };
    if (result.cancelled) return { status: 'blocked', reason: result.terminalError || 'CLI aborted，取消来源未知，需用户确认' };
    if (result.idle) return { status: 'failed', reason: '600 秒 stdout idle，已终止' };
    if (result.terminalError || result.providerError) return { status: 'failed', reason: result.terminalError || result.providerError };
    if (result.cancellation === 'unknown-cancellation') return { status: 'blocked', reason: '取消来源未知；不能接受角色结果' };
    // A scheduler-initiated, confirmed grace termination is only a candidate.
    // External signals and unrelated nonzero exits cannot take this exception.
    if (!result.grace && (result.code !== 0 || result.signal)) {
      return { status: 'failed', reason: result.signal ? `外部信号 ${result.signal}` : result.stderr || `退出 ${result.code}` };
    }
    const raw = findLastTagContent(result.result, 'afk-result');
    if (raw === undefined) return { status: 'failed', reason: '最终结果缺少结构化 afk-result' };
    try { return JSON.parse(unwrapFences(raw.trim())); }
    catch (error) { return { status: 'failed', reason: `结果 JSON 错误：${error.message}` }; }
  }
}
