import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

export function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

export function openJournal(journalPath) {
  const stats = { fullReads: 0, incrementalReads: 0, bytesRead: 0, parsedLines: 0, badLines: 0 };
  const subscribers = new Set();
  let lastNotifySize = -1;

  // 增量 tail 状态：records 为已解析缓存，byteOffset 为已消费字节数，
  // leftover 为末尾无 \n 的残片（文本层，已解码）。decoder 保证多字节
  // UTF-8 字符被 chunk 切半时不损坏（不完整字节留在 decoder 内部等下次）。
  let records = [];
  let byteOffset = 0;
  let leftover = '';
  let decoder = new StringDecoder('utf8');
  let initialized = false;

  function parseCompleteLines(lines) {
    for (const line of lines) {
      if (!line) continue;
      const record = parseLine(line);
      if (record === undefined) stats.badLines++;
      else {
        stats.parsedLines++;
        records.push(record);
      }
    }
  }

  function fullRead(size) {
    stats.fullReads++;
    let text;
    try {
      text = readFileSync(journalPath, 'utf8');
    } catch {
      records = [];
      byteOffset = 0;
      leftover = '';
      decoder = new StringDecoder('utf8');
      initialized = true;
      return;
    }
    // 关键：offset 必须用实际读到的字节数，不能用 statSync 的 size。
    // journal 在读取期间仍被 daemon 追加，size 可能小于实际读到的长度；
    // 若按 size 推进 offset，下一次增量读会从 size 处重读已被解析的字节，
    // 导致记录重复。readFileSync 读到的是同一瞬间的一致快照，故以其长度为准。
    const actualBytes = Buffer.byteLength(text, 'utf8');
    stats.bytesRead += actualBytes;
    records = [];
    decoder = new StringDecoder('utf8');
    // leftover 处理：末尾无 \n 的残片留待下次，不解析、不计 badLines
    let lines = text.split('\n');
    if (text.length > 0 && !text.endsWith('\n')) {
      leftover = lines.pop();
    } else {
      leftover = '';
      // 以 \n 结尾时 split 会多出末尾 ''，parseCompleteLines 本就跳过空行
    }
    parseCompleteLines(lines);
    byteOffset = actualBytes;
    initialized = true;
  }

  function incrementalRead(size) {
    const n = size - byteOffset;
    if (n <= 0) return;
    let fd;
    try {
      fd = openSync(journalPath, 'r');
    } catch {
      return;
    }
    try {
      const buf = Buffer.allocUnsafe(n);
      let read = 0;
      while (read < n) {
        const r = readSync(fd, buf, read, n - read, byteOffset + read);
        if (r <= 0) break;
        read += r;
      }
      const chunk = decoder.write(buf.subarray(0, read));
      stats.incrementalReads++;
      stats.bytesRead += read;
      byteOffset += read;
      const text = leftover + chunk;
      leftover = '';
      let lines = text.split('\n');
      // chunk 末尾无 \n → 最后一段是残片（可能含上次 leftover），留缓冲
      // 注意：若 chunk 以 \n 结尾，split 末尾 '' 会被跳过
      // 判据必须看拼接后 text 是否以 \n 结尾
      if (!text.endsWith('\n')) {
        leftover = lines.pop();
      }
      parseCompleteLines(lines);
    } finally {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }

  function ensureSynced() {
    let size;
    try {
      size = statSync(journalPath).size;
    } catch {
      records = [];
      byteOffset = 0;
      leftover = '';
      decoder = new StringDecoder('utf8');
      initialized = true;
      return;
    }
    if (initialized && size === byteOffset) return; // size 未变：不做任何 read 与 parse
    if (!initialized || size < byteOffset) {
      fullRead(size);
    } else {
      incrementalRead(size);
    }
  }

  return {
    all() {
      ensureSynced();
      return records.slice();
    },
    readRange(after, limit) {
      ensureSynced();
      return records.filter(record => record.seq > after).slice(0, limit);
    },
    // 广播热路径专用：游标 after 通常就在尾部附近，从尾部反向扫描，
    // 遇到第一条 seq <= after 即停止，复杂度为 O(新增条数) 而非 O(总条数)。
    // 依赖 journal 的 seq 单调（daemon 是唯一 writer 且按序分配）。
    tailAfter(after, limit) {
      ensureSynced();
      let start = records.length;
      while (start > 0 && Number(records[start - 1].seq) > after) start--;
      const tail = records.slice(start);
      return tail.length > limit ? tail.slice(0, limit) : tail;
    },
    total() {
      ensureSynced();
      return records.length;
    },
    lastSeq() {
      ensureSynced();
      let max = 0;
      for (const record of records) {
        const seq = Number(record.seq) || 0;
        if (seq > max) max = seq;
      }
      return max;
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    // 轮询驱动的增量唤醒：journal 的 size 变化时（或首次出现）通知订阅者，
    // 并返回是否发生了变化。调用方可据此跳过 all()（需拷贝整个记录数组），
    // 使空闲 run 的轮询成本从 O(记录数) 降为一次 stat。
    // 保守轮询而非 fs.watch：跨平台与大批量追加下丢事件风险更低。
    notify() {
      let info;
      try { info = statSync(journalPath); }
      catch { return false; }
      if (info.size === lastNotifySize) return false;
      lastNotifySize = info.size;
      for (const cb of [...subscribers]) { try { cb(); } catch { /* 订阅者异常不影响 store。 */ } }
      return true;
    },
    stats,
  };
}
