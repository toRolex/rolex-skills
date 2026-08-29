#!/usr/bin/env bash
# validate-plan.sh [--expected-run-id ID] [--expected-roots N,N] [--live] <plan.json>
# 离线校验 plan schema/拓扑；--live 同时核对 GitHub 原生 parent、labels 与 open blockers。
set -uo pipefail

live=0
expected_run_id=""
expected_roots=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --live)
      live=1
      shift
      ;;
    --expected-run-id)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        echo "validate-plan: --expected-run-id 缺少非空参数" >&2
        exit 1
      fi
      expected_run_id="$2"
      shift 2
      ;;
    --expected-roots)
      if [ "$#" -lt 2 ]; then
        echo "validate-plan: --expected-roots 缺少参数" >&2
        exit 1
      fi
      expected_roots="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "validate-plan: 未知参数: $1" >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

plan="${1:-}"
if [ -z "$plan" ]; then
  echo "用法: validate-plan.sh [--expected-run-id ID] [--expected-roots N,N] [--live] <plan.json>" >&2
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

if ! errors=$(jq -r '
  def positive_integer: type == "number" and . > 0 and floor == .;
  def issue_numbers: [.issues[].number];
  def duplicate_values: group_by(.) | map(select(length > 1) | .[0]);
  def valid_status: . == "pending" or . == "dispatched" or . == "recovering" or . == "done";
  def valid_stage: . == "implement" or . == "review" or . == "merge";
  def walk_blockers($by_number; $seen; $frontier):
    ($frontier | map(. as $n | select(($seen | index($n)) == null)) | unique) as $new
    | if ($new | length) == 0 then $seen
      else walk_blockers(
        $by_number;
        ($seen + $new | unique);
        [$new[] as $n | ($by_number[$n | tostring].blocked_by // [])[]]
      )
      end;

  if type != "object" then "plan 顶层必须是 object"
  elif (.version != 1) then "version 必须是 1"
  elif (.run_id | type) != "string" or (.run_id | length) == 0 then "run_id 缺失或不是非空字符串"
  elif (.target_branch != "main" and .target_branch != "develop") then "target_branch 必须是 main 或 develop"
  elif (.roots | type) != "array" then "roots 缺失或不是数组"
  elif (.specs | type) != "array" then "specs 缺失或不是数组"
  elif (.issues | type) != "array" then "issues 缺失或不是数组"
  else
    (.issues | map({key: (.number | tostring), value: .}) | from_entries) as $by_number
    | (issue_numbers) as $numbers
    | ([.specs[].number]) as $spec_numbers
    | (
        [
          (if (.roots | all(positive_integer) | not) then "roots 含非正整数元素" else empty end),
          (if (.roots | duplicate_values | length) > 0 then "roots 含重复 issue: \(.roots | duplicate_values | join(", "))" else empty end),
          (if ($numbers | duplicate_values | length) > 0 then "issues.number 重复: \($numbers | duplicate_values | join(", "))" else empty end),
          (if ($spec_numbers | duplicate_values | length) > 0 then "specs.number 重复: \($spec_numbers | duplicate_values | join(", "))" else empty end),
          (.roots[] | select(($numbers | index(.)) == null) | "root issue \(.) 不在 issues 中"),
          ($spec_numbers[] as $s | select(($numbers | index($s)) != null) | "SPEC \($s) 同时出现在执行节点中"),
          (.specs | to_entries[] | .key as $k | .value as $s |
            if ($s.number | positive_integer | not) then "specs[\($k)]: number 缺失或不是正整数"
            elif ($s.title | type) != "string" then "specs[\($k)]（number \($s.number)）: title 缺失或不是字符串"
            else empty end),
          (.issues | to_entries[] | .key as $k | .value as $i |
            if ($i.number | positive_integer | not) then "issues[\($k)]: number 缺失或不是正整数"
            elif ($i.title | type) != "string" then "issue \($i.number): title 缺失或不是字符串"
            elif ($i.branch | type) != "string" or $i.branch != "afk/issue-\($i.number)" then "issue \($i.number): branch 必须是 afk/issue-\($i.number)"
            elif (($i.spec == null) | not) and ($i.spec | positive_integer | not) then "issue \($i.number): spec 必须是正整数或 null"
            elif ($i.spec != null and ($spec_numbers | index($i.spec)) == null) then "issue \($i.number): spec \($i.spec) 不在 specs 中"
            elif ($i.blocked_by | type) != "array" then "issue \($i.number): blocked_by 缺失或不是数组"
            elif ($i.blocked_by | all(positive_integer) | not) then "issue \($i.number): blocked_by 含非正整数元素"
            elif ($i.blocked_by | duplicate_values | length) > 0 then "issue \($i.number): blocked_by 含重复引用"
            elif ($i.blocked_by | index($i.number)) != null then "issue \($i.number): blocked_by 包含自环"
            elif ($i.status | valid_status | not) then "issue \($i.number): status 非法"
            elif ($i.stage | valid_stage | not) then "issue \($i.number): stage 非法"
            elif ($i.status == "pending" and $i.stage != "implement") then "issue \($i.number): pending 节点的 stage 必须是 implement"
            elif ($i.status == "done" and $i.stage != "merge") then "issue \($i.number): done 节点的 stage 必须是 merge"
            else empty end),
          (.issues[] | .number as $n | .blocked_by[]? as $b | select(($numbers | index($b)) == null) | "issue \($n): blocked_by 引用不存在的 issue \($b)"),
          (walk_blockers($by_number; []; .roots) as $reachable | $numbers[] as $n | select(($reachable | index($n)) == null) | "issue \($n) 不在 roots 的依赖闭包中"),
          ({remaining: .issues, done: []}
            | until((.remaining | length) == 0;
                .done as $done
                | (.remaining | map(select((.blocked_by // []) | all(. as $b | $done | index($b) != null)))) as $ready
                | if ($ready | length) == 0
                  then .cycle = (.remaining | map(.number)) | .remaining = []
                  else .done += ($ready | map(.number)) | .remaining -= $ready
                  end)
            | .cycle // []
            | if length > 0 then "plan 有环或不可消除依赖，节点: \(join(", "))" else empty end)
        ] | .[]
      )
  end
' "$plan"); then
  echo "validate-plan: jq 校验失败" >&2
  exit 1
fi

if [ -n "$errors" ]; then
  echo "$errors" >&2
  exit 1
fi

if [ -n "$expected_run_id" ]; then
  plan_run_id=$(jq -r '.run_id' "$plan")
  if [ "$plan_run_id" != "$expected_run_id" ]; then
    echo "validate-plan: run_id 与本次运行不一致（expected=${expected_run_id}, plan=${plan_run_id}）" >&2
    exit 1
  fi
fi

if [ -n "$expected_roots" ]; then
  if ! expected_json=$(printf '%s\n' "$expected_roots" | jq -Rcs '
      split("\n")
      | map(select(length > 0))
      | map(split(","))
      | add // []
      | map(gsub("^[[:space:]]+|[[:space:]]+$"; ""))
      | map(select(length > 0) | tonumber)
      | if all(. > 0 and floor == .) then . else error("issue number 必须是正整数") end
      | unique
      | sort
    ' 2>/dev/null); then
    echo "validate-plan: --expected-roots 必须是逗号分隔的正整数 issue numbers" >&2
    exit 1
  fi
  plan_roots=$(jq -c '.roots | unique | sort' "$plan")
  if [ "$expected_json" != "$plan_roots" ]; then
    echo "validate-plan: roots 与显式输入不一致（expected=${expected_json}, plan=${plan_roots}）" >&2
    exit 1
  fi
fi

if [ "$live" -eq 0 ]; then
  exit 0
fi

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner) || {
  echo "validate-plan: 无法读取 GitHub 仓库" >&2
  exit 1
}

live_errors=""
append_error() {
  live_errors="${live_errors}${live_errors:+$'\n'}$1"
}

if [ -z "$expected_roots" ]; then
  if ! roots_pages=$(gh api --method GET --paginate --slurp "repos/$repo/issues" -f state=open -f labels=ready-for-agent -f per_page=100); then
    echo "validate-plan: 无法读取默认 ready-for-agent roots" >&2
    exit 1
  fi
  live_roots=$(jq -c 'add // [] | map(select(has("pull_request") | not) | .number) | unique | sort' <<<"$roots_pages")
  plan_roots=$(jq -c '.roots | unique | sort' "$plan")
  if [ "$live_roots" != "$plan_roots" ]; then
    append_error "默认 roots 与 GitHub 不一致（plan=${plan_roots}, GitHub=${live_roots}）"
  fi
fi

while IFS= read -r number; do
  if ! issue_json=$(gh api "repos/$repo/issues/$number"); then
    append_error "issue $number: 无法从 GitHub 读取"
    continue
  fi
  if ! jq -e '
      type == "object"
      and (.number | type == "number")
      and (.state == "open" or .state == "closed")
      and (.labels | type == "array")
    ' >/dev/null <<<"$issue_json"; then
    append_error "issue $number: GitHub Issue 响应结构非法"
    continue
  fi
  if jq -e 'has("pull_request")' >/dev/null <<<"$issue_json"; then
    append_error "issue $number: 是 Pull Request，不是 Ticket"
    continue
  fi

  state=$(jq -er .state <<<"$issue_json") || {
    append_error "issue $number: 无法解析 state"
    continue
  }
  status=$(jq -r --argjson n "$number" '.issues[] | select(.number == $n) | .status' "$plan")
  if [ "$state" = "closed" ] && [ "$status" != "done" ]; then
    append_error "issue $number: GitHub 已关闭但 status 不是 done"
  elif [ "$state" = "open" ] && [ "$status" = "done" ]; then
    append_error "issue $number: GitHub 仍开放但 status 是 done"
  fi

  if [ "$state" = "open" ] && ! jq -e '[.labels[].name] | index("ready-for-agent") != null' >/dev/null <<<"$issue_json"; then
    append_error "issue $number: open 节点缺少 ready-for-agent"
  fi

  if parent_json=$(gh api "repos/$repo/issues/$number/parent" 2>&1); then
    live_parent=$(jq -r '.number' <<<"$parent_json")
  else
    case "$parent_json" in
      *"HTTP 404"*|*"No parent issue found"*) live_parent=null ;;
      *)
        append_error "issue $number: 无法读取 parent SPEC"
        continue
        ;;
    esac
  fi
  expected_parent=$(jq -r --argjson n "$number" '.issues[] | select(.number == $n) | (.spec // "null")' "$plan")
  if [ "$live_parent" != "$expected_parent" ]; then
    append_error "issue $number: parent SPEC 不匹配（plan=$expected_parent, GitHub=$live_parent）"
  fi

  blockers_json='[]'
  if [ "$state" = "open" ]; then
    blockers_json=$(gh api --paginate --slurp "repos/$repo/issues/$number/dependencies/blocked_by?per_page=100") || {
      append_error "issue $number: 无法读取 blocked_by"
      continue
    }
  fi
  live_blockers=$(jq -c 'add // [] | map(select(.state == "open") | .number) | unique | sort' <<<"$blockers_json")
  expected_blockers=$(jq -c --argjson n "$number" '.issues[] | select(.number == $n) | .blocked_by | unique | sort' "$plan")
  if [ "$live_blockers" != "$expected_blockers" ]; then
    append_error "issue ${number}: open blocked_by 不匹配（plan=${expected_blockers}, GitHub=${live_blockers}）"
  fi
done < <(jq -r '.issues[].number' "$plan")

live_specs=$(jq -c '[.issues[].spec | select(. != null)] | unique | sort' "$plan")
plan_specs=$(jq -c '[.specs[].number] | unique | sort' "$plan")
if [ "$live_specs" != "$plan_specs" ]; then
  append_error "specs 集合与 issues[].spec 不一致"
fi

if [ -n "$live_errors" ]; then
  echo "$live_errors" >&2
  exit 1
fi
