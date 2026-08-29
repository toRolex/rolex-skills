#!/usr/bin/env bash
# watchdog.sh <worktree> [idle秒=600]
# 盯 worktree 文件系统活性（文件 mtime + git reflog 时间，取最新），静默循环零输出；
# idle 超过阈值才 exit 1 + 一行死因。职责边界：只防挂死——正常结束/报错由系统通知接管，
# 控制者在 agent 正常完成时杀掉本脚本。
set -u

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

start=$(date +%s)
while :; do
  now=$(date +%s)
  # 最新文件 mtime（排除 .git 目录；worktree 的 .git 是指针文件，reflog 走 git 命令取）
  newest=$(find "$worktree" -type f -not -path '*/.git/*' -exec stat -f %m {} + 2>/dev/null | sort -rn | head -1)
  # HEAD reflog 最后活动时间（worktree 的 reflog 在主仓库 .git/worktrees/<name>/ 下，git -C 自动解析）
  reflog=$(git -C "$worktree" log -g -1 --format=%ct 2>/dev/null || true)
  last=$start  # 空目录兜底：从脚本启动时刻起算，避免分派瞬间误判
  for t in $newest $reflog; do
    if [ -n "$t" ] && [ "$t" -gt "$last" ]; then
      last=$t
    fi
  done
  age=$((now - last))
  if [ "$age" -ge "$idle" ]; then
    echo "AgentIdleTimeoutError: worktree $worktree idle ${age}s（>= ${idle}s 阈值）"
    exit 1
  fi
  sleep 10
done
