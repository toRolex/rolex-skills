import { appendFileSync, chmodSync, closeSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// state 文件写入节流间隔：Observation 来自 provider 输出热路径，
// 每条记录都重写 state 会给子进程 stdout 带来真实背压。
const STATE_THROTTLE_MS = 250;

// T4 journal 源头减量：raw-payload 批量合并。同一 scope（同 invocation）内连续到达的
// provider 原始行在内存中合并为一条记录，payload 为原文行以 '\n' 拼接的字符串。
// 上游以 readline 逐行投递，行内不含换行符，因此 split('\n') 可逐行精确还原原文，
// 且顺序不变；payload 保持字符串类型，下游 payload.includes/join('\n') 消费方式不变。
// text-delta 明确不合并（见 processes.mjs 注释）。
// 逃生口：AFK_JOURNAL_BATCH=0 关闭合并，退回逐条写入旧行为。
const batchEnabled = () => process.env.AFK_JOURNAL_BATCH !== '0';
const BATCH_MAX_LINES = 200;
const BATCH_MAX_BYTES = 256 * 1024;
const BATCH_FLUSH_MS = 150;

// Dashboard Observation journal：append-only、best-effort 旁路事实源。
// AFK daemon 是运行期唯一 writer 与 seq 分配者；写入失败只降级为 incomplete，
// 绝不进入调度、Recovery 或核心失败路径。
export class ObservationJournal {
  #path;
  #statePath;
  #runId;
  #seq = 0;
  #complete = true;
  #reason;
  #lastStateWrite = 0;
  #stateDirty = false;
  #stateTimer;
  // raw-payload 合并缓冲：只为同 scope 下连续 raw-payload 行服务，确保 journal
  // 顺序语义（任何非 raw-payload、或 scope 变化，必先 flush 缓冲再写新记录）。
  #pending = null; // { source, scopeKey, scope, lines, bytes, timer }

  constructor(logDir, runId) {
    this.#statePath = join(logDir, 'observation-state.json');
    this.#runId = runId;
    // AFK_DASHBOARD_JOURNAL_PATH 是公开 start 的受控故障注入点，
    // 用于在不引入第二个 seam 的前提下验证 degraded 语义。
    this.#path = process.env.AFK_DASHBOARD_JOURNAL_PATH || join(logDir, 'observations.jsonl');
    try {
      const fd = openSync(this.#path, 'a', 0o600);
      closeSync(fd);
      chmodSync(this.#path, 0o600);
    } catch (error) {
      this.#complete = false;
      this.#reason = error.message;
    }
    this.#saveState();
  }

  get status() {
    return { completeness: this.#complete ? 'complete' : 'incomplete', ...(this.#reason ? { reason: this.#reason } : {}) };
  }

  // 合并记录展开为原始行：合并 payload 以 '\n' 拼接，与缓冲写入互逆，
  // split('\n') 逐行还原原文且顺序不变，供下游重放还原。
  static expandRawPayload(record) {
    if (record?.kind !== 'raw-payload') return [record?.payload];
    return String(record?.payload ?? '').split('\n');
  }

  observe(source, kind, scope = {}, payload = null) {
    if (!this.#complete) return;
    if (batchEnabled() && kind === 'raw-payload' && source?.startsWith('provider/') && typeof payload === 'string') {
      return this.#bufferRaw(source, scope, payload);
    }
    // 非 raw-payload：先落盘缓冲，保证顺序语义（缓冲行不得排到后续事件之后）。
    try {
      this.#flushPending();
    } catch { /* best-effort：落盘失败已在内部降级，继续写当前记录。 */ }
    return this.#writeRecord(source, kind, scope, payload);
  }

  // 终态冻结前先落盘合并缓冲（终态不得丢数据），再落盘 state，
  // 使 lastSeq 与 journal 一致。
  flush() { try { this.#flushPending(); } catch { /* best-effort，降级语义已内部处理。 */ } this.#saveState(); }

  #scopeKey(scope) {
    // invocation 是合并边界（同 invocation 内连续行才合并）；其余 scope 字段
    // （role/attempt/tickets/batch）一并参与，避免不同上下文串行。
    try {
      const s = scope && typeof scope === 'object' ? scope : {};
      return JSON.stringify([s.role ?? null, s.attempt ?? null, s.invocation ?? null, s.tickets ?? null, s.batch ?? null]);
    } catch { return null; }
  }

  #bufferRaw(source, scope, line) {
    try {
      const scopeKey = this.#scopeKey(scope);
      if (scopeKey === null) return this.#writeRecord(source, 'raw-payload', scope, line);
      if (this.#pending && (this.#pending.source !== source || this.#pending.scopeKey !== scopeKey)) {
        this.#flushPending();
      }
      if (!this.#pending) {
        this.#pending = { source, scopeKey, scope, lines: [], bytes: 0, timer: undefined };
        this.#pending.timer = setTimeout(() => { try { this.#flushPending(); } catch { /* best-effort */ } }, BATCH_FLUSH_MS);
        this.#pending.timer.unref?.();
      }
      this.#pending.lines.push(line);
      this.#pending.bytes += Buffer.byteLength(line, 'utf8');
      if (this.#pending.lines.length >= BATCH_MAX_LINES || this.#pending.bytes >= BATCH_MAX_BYTES) {
        this.#flushPending();
      }
      // 缓冲中：seq 尚未分配，返回 null（无调用点依赖返回值）。
      return null;
    } catch {
      // best-effort：合并路径任何异常不得让 run 失败，回退逐条写入。
      try { return this.#writeRecord(source, 'raw-payload', scope, line); } catch { return null; }
    }
  }

  #flushPending() {
    const pending = this.#pending;
    this.#pending = null;
    if (!pending) return;
    try { clearTimeout(pending.timer); } catch { /* 忽略计时器清理异常。 */ }
    if (!this.#complete) return;
    if (pending.lines.length === 0) return;
    // 降级语义：写入失败时 #writeRecord 置 incomplete，后续 observe 不再写入。
    // payload 保持字符串（join 还原），下游 includes/join 消费不变；单行批次与旧逐条形态完全一致。
    this.#writeRecord(pending.source, 'raw-payload', pending.scope, pending.lines.join('\n'));
  }

  #writeRecord(source, kind, scope, payload) {
    const record = { seq: this.#seq + 1, observedAt: new Date().toISOString(), runId: this.#runId, source, kind, scope, payload };
    try {
      appendFileSync(this.#path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      this.#seq = record.seq;
      // 节流：完整性与 lastSeq 只需近似可见，journal 本身才是重放事实源。
      // flush() 先落盘缓冲再 saveState，因此落盘后 lastSeq 与 journal 一致，不虚报。
      this.#scheduleState();
      return record;
    } catch (error) {
      // 首次失败后不再宣称记录完整，也不继续尝试写入。
      this.#complete = false;
      this.#reason = error.message;
      this.#saveState();
    }
  }

  #scheduleState() {
    const elapsed = Date.now() - this.#lastStateWrite;
    if (elapsed >= STATE_THROTTLE_MS) return this.#saveState();
    if (this.#stateDirty) return;
    this.#stateDirty = true;
    this.#stateTimer = setTimeout(() => { this.#stateDirty = false; this.#saveState(); }, STATE_THROTTLE_MS - elapsed);
    this.#stateTimer.unref?.();
  }

  #saveState() {
    try {
      clearTimeout(this.#stateTimer);
      this.#stateDirty = false;
      this.#lastStateWrite = Date.now();
      writeFileSync(this.#statePath, `${JSON.stringify({ lastSeq: this.#seq, ...this.status })}\n`, { mode: 0o600 });
      chmodSync(this.#statePath, 0o600);
    } catch { /* state 元数据不可写不影响 run 与 journal 本身。 */ }
  }
}
