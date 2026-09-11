#!/usr/bin/env bash
# dispatched-count.sh <plan.json>
# 输出当前未 settled 批次的固定成员数，不是进程数或可补位额度。
set -uo pipefail

plan="${1:-}"
if [ -z "$plan" ]; then
  printf '%s\n' '用法: dispatched-count.sh <plan.json>' >&2
  exit 1
fi
scripts_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || exit 1
bash "$scripts_dir/validate-plan.sh" "$plan" || exit 1
jq 'if .batch.phase == "pipelines" or .batch.phase == "merging"
    then .batch.tickets | length else 0 end' "$plan"
