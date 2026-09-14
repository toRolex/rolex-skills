import { appendFileSync, chmodSync, closeSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// state 文件写入节流间隔：Observation 来自 provider 输出热路径，
// 每条记录都重写 state 会给子进程 stdout 带来真实背压。
const STATE_THROTTLE_MS = 250;

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

  observe(source, kind, scope = {}, payload = null) {
    if (!this.#complete) return;
    const record = { seq: this.#seq + 1, observedAt: new Date().toISOString(), runId: this.#runId, source, kind, scope, payload };
    try {
      appendFileSync(this.#path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      this.#seq = record.seq;
      // 节流：完整性与 lastSeq 只需近似可见，journal 本身才是重放事实源。
      this.#scheduleState();
      return record;
    } catch (error) {
      // 首次失败后不再宣称记录完整，也不继续尝试写入。
      this.#complete = false;
      this.#reason = error.message;
      this.#saveState();
    }
  }

  // 终态冻结前把节流中的 state 落盘，使 lastSeq 与 journal 一致。
  flush() { this.#saveState(); }

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
