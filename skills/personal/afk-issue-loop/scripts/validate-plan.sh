#!/usr/bin/env bash
# validate-plan.sh <plan.json>
# 校验 Planner 落盘的 DAG：schema（number/title/branch/blocked_by）+ branch 匹配 afk/issue-\d+
# + blocked_by 引用存在 + 无环（Kahn 拓扑消除，剩余节点即成环节点）。exit 0 合法 / exit 1 + 错误行。
set -u

plan="${1:-}"
if [ -z "$plan" ]; then
  echo "用法: validate-plan.sh <plan.json>" >&2
  exit 1
fi
if [ ! -f "$plan" ]; then
  echo "validate-plan: 文件不存在: $plan" >&2
  exit 1
fi
if ! jq empty "$plan" 2>/dev/null; then
  echo "validate-plan: 不是合法 JSON: $plan" >&2
  exit 1
fi

errors=$(jq -r '
  if (.issues | type) != "array" then ".issues 缺失或不是数组"
  else
    (.issues | to_entries[] | .key as $k | .value as $i |
      [ (if ($i.number | type) != "number" then "issues[\($k)]: number 缺失或不是数字" else empty end),
        (if ($i.title | type) != "string" then "issues[\($k)]（number \($i.number // "?")）: title 缺失或不是字符串" else empty end),
        (if ($i.branch | type) != "string" then "issues[\($k)]（number \($i.number // "?")）: branch 缺失或不是字符串"
         elif ($i.branch | test("^afk/issue-[0-9]+$") | not) then "issues[\($k)]（number \($i.number // "?")）: branch 非法（期望 afk/issue-\($i.number // "N")，实际 \($i.branch)）"
         else empty end),
        (if ($i.blocked_by | type) != "array" then "issues[\($k)]（number \($i.number // "?")）: blocked_by 缺失或不是数组"
         elif ($i.blocked_by | all(type == "number") | not) then "issues[\($k)]（number \($i.number // "?")）: blocked_by 含非数字元素"
         else empty end)
      ] | .[]),
    # blocked_by 引用存在性
    ([.issues[].number] | unique) as $nums |
    (.issues[] | .number as $n | (.blocked_by // [])[] |
      select(. as $b | $nums | index($b) | not) |
      "issue \($n): blocked_by 引用不存在的 issue \(. )"),
    # 无环检测（Kahn：反复消除 blocked_by 全部已完成的节点，剩余即成环）
    ({ remaining: .issues, done: [] }
      | until((.remaining | length) == 0;
          .done as $done
          | (.remaining | map(select((.blocked_by // []) | all(. as $b | $done | index($b) != null)))) as $ready
          | if ($ready | length) == 0
            then .cycle = (.remaining | map(.number)) | .remaining = []
            else .done += ($ready | map(.number)) | .remaining -= $ready
            end)
      | .cycle // []
      | if length > 0 then "plan 有环，成环节点: \(join(", "))" else empty end)
  end
' "$plan")

if [ -n "$errors" ]; then
  echo "$errors" >&2
  exit 1
fi
exit 0
