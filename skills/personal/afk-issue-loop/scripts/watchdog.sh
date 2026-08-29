#!/usr/bin/env bash
# watchdog.sh <worktree> [idle秒=600]
# 盯 worktree 文件系统活性（文件 mtime + Git reflog 时间，取最新）；idle 超时输出死因。
set -uo pipefail

worktree="${1:-}"
idle="${2:-600}"
if [ -z "$worktree" ]; then
  echo "用法: watchdog.sh <worktree> [idle秒=600]" >&2
  exit 1
fi
if [ ! -d "$worktree" ]; then
  echo "watchdog: worktree 不存在: $worktree" >&2
  exit 1
fi
case "$idle" in
  ''|*[!0-9]*)
    echo "watchdog: idle 秒数必须是正整数: $idle" >&2
    exit 1
    ;;
esac
if [ "$idle" -le 0 ]; then
  echo "watchdog: idle 秒数必须是正整数: $idle" >&2
  exit 1
fi
if ! git -C "$worktree" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "WatchdogObservationError: 不是 Git worktree: $worktree" >&2
  exit 2
fi

start=$(date +%s)
while :; do
  now=$(date +%s)
  if ! newest=$(find "$worktree" -type f -not -path '*/.git/*' -exec stat -f %m {} + 2>/dev/null | sort -rn | head -1); then
    echo "WatchdogObservationError: 无法读取 worktree 文件活性: $worktree" >&2
    exit 2
  fi
  if ! reflog=$(git -C "$worktree" log -g -1 --format=%ct 2>/dev/null); then
    echo "WatchdogObservationError: 无法读取 Git reflog: $worktree" >&2
    exit 2
  fi
  last=$start
  for t in $newest $reflog; do
    case "$t" in
      ''|*[!0-9]*) continue ;;
    esac
    if [ "$t" -gt "$last" ]; then
      last=$t
    fi
  done
  age=$((now - last))
  if [ "$age" -ge "$idle" ]; then
    echo "AgentIdleTimeoutError: worktree ${worktree} idle ${age}s（>= ${idle}s 阈值）"
    exit 1
  fi
  sleep 10
done
