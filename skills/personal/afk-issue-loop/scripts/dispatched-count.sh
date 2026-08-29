#!/usr/bin/env bash
# dispatched-count.sh <plan.json>
# 输出 status=="dispatched" 的节点数，控制者比对 ≤4 并行信号量。
set -u

plan="${1:-}"
if [ -z "$plan" ]; then
  echo "用法: dispatched-count.sh <plan.json>" >&2
  exit 1
fi
if [ ! -f "$plan" ]; then
  echo "dispatched-count: 文件不存在: $plan" >&2
  exit 1
fi
jq '[.issues[] | select(.status == "dispatched")] | length' "$plan"
