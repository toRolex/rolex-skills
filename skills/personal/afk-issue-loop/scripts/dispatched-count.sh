#!/usr/bin/env bash
# dispatched-count.sh <plan.json>
# 输出 active Ticket 槽位数：status 为 dispatched 或 recovering。
set -uo pipefail

plan="${1:-}"
if [ -z "$plan" ]; then
  echo "用法: dispatched-count.sh <plan.json>" >&2
  exit 1
fi
if [ ! -f "$plan" ]; then
  echo "dispatched-count: 文件不存在: $plan" >&2
  exit 1
fi
if ! jq -e '
    (.issues | type == "array")
    and (.issues | all(
      (.status == "pending" or .status == "dispatched" or .status == "recovering" or .status == "done")
      and (.stage == "implement" or .stage == "review" or .stage == "merge")
    ))
  ' "$plan" >/dev/null 2>&1; then
  echo "dispatched-count: plan 的 issues/status/stage 非法" >&2
  exit 1
fi

count=$(jq '[.issues[] | select(.status == "dispatched" or .status == "recovering")] | length' "$plan") || exit 1
if [ "$count" -gt 4 ]; then
  printf 'dispatched-count: Ticket 槽位超过 4（实际 %s）\n' "$count" >&2
  exit 1
fi
printf '%s\n' "$count"
