#!/usr/bin/env bash
# afk-issue-loop scripts 黑盒测试。
set -uo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0
FAIL=0
TMP="$(mktemp -d "$SCRIPTS_DIR/.afk-tests.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

ok() { PASS=$((PASS + 1)); printf 'ok   - %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf 'FAIL - %s\n' "$1"; }

assert_exit() {
  if [ "$2" -eq "$3" ]; then ok "$1 (exit $3)"; else bad "$1（期望 exit $2，实际 $3）"; fi
}

assert_contains() {
  case "$2" in
    *"$3"*) ok "$1" ;;
    *) bad "$1（期望包含 [$3]，实际：$2）" ;;
  esac
}

write_valid_plan() {
  cat > "$1" <<'JSON'
{
  "version": 1,
  "run_id": "test-run-1",
  "target_branch": "main",
  "roots": [43, 44],
  "specs": [{"number": 10, "title": "SPEC"}],
  "issues": [
    {"number": 43, "title": "root a", "branch": "afk/issue-43", "spec": 10, "blocked_by": [], "status": "dispatched", "stage": "review"},
    {"number": 44, "title": "root b", "branch": "afk/issue-44", "spec": 10, "blocked_by": [], "status": "recovering", "stage": "implement"}
  ]
}
JSON
}

# validate-plan.sh
write_valid_plan "$TMP/valid.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/valid.json" >/dev/null 2>&1
assert_exit "validate-plan: 合法 plan" 0 $?

bash "$SCRIPTS_DIR/validate-plan.sh" --expected-run-id "test-run-1" "$TMP/valid.json" >/dev/null 2>&1
assert_exit "validate-plan: run_id 精确匹配" 0 $?

out=$(bash "$SCRIPTS_DIR/validate-plan.sh" --expected-run-id "old-run" "$TMP/valid.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝旧 run_id" 1 "$code"
assert_contains "validate-plan: 指出 run_id 不一致" "$out" "run_id 与本次运行不一致"

bash "$SCRIPTS_DIR/validate-plan.sh" --expected-roots "43,44" "$TMP/valid.json" >/dev/null 2>&1
assert_exit "validate-plan: 显式 roots 精确匹配" 0 $?

out=$(bash "$SCRIPTS_DIR/validate-plan.sh" --expected-roots "43,45" "$TMP/valid.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝遗漏显式 root" 1 "$code"
assert_contains "validate-plan: 指出 roots 不一致" "$out" "roots 与显式输入不一致"

jq '.issues[0].number = -1 | .issues[0].branch = "afk/issue--1" | .roots[0] = -1 | .issues[1].blocked_by = [-1]' "$TMP/valid.json" > "$TMP/negative.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/negative.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝负 issue number" 1 "$code"
assert_contains "validate-plan: 指出正整数" "$out" "正整数"

jq '.issues[0].number = 1.5 | .issues[0].branch = "afk/issue-1.5" | .roots[0] = 1.5 | .issues[1].blocked_by = [1.5]' "$TMP/valid.json" > "$TMP/fraction.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/fraction.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝小数 issue number" 1 "$code"
assert_contains "validate-plan: 小数错误明确" "$out" "正整数"

out=$(bash "$SCRIPTS_DIR/validate-plan.sh" --expected-roots "43,-1" "$TMP/valid.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝非法 expected roots" 1 "$code"
assert_contains "validate-plan: expected roots 错误明确" "$out" "正整数"

jq 'del(.issues[1].title)' "$TMP/valid.json" > "$TMP/missing.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/missing.json" 2>&1); code=$?
assert_exit "validate-plan: 缺字段" 1 "$code"
assert_contains "validate-plan: 指出 title" "$out" "title"

jq '.issues[0].branch = "afk/issue-99"' "$TMP/valid.json" > "$TMP/branch.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/branch.json" 2>&1); code=$?
assert_exit "validate-plan: branch 与 number 不符" 1 "$code"
assert_contains "validate-plan: 指出确定性 branch" "$out" "afk/issue-43"

jq '.issues += [.issues[1]]' "$TMP/valid.json" > "$TMP/duplicate.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/duplicate.json" 2>&1); code=$?
assert_exit "validate-plan: 重复 number" 1 "$code"
assert_contains "validate-plan: 指出重复" "$out" "重复"

jq '.issues[1].status = "failed"' "$TMP/valid.json" > "$TMP/status.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/status.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝旧 failed 状态" 1 "$code"
assert_contains "validate-plan: 指出 status" "$out" "status"

jq '.issues[1].blocked_by = [99]' "$TMP/valid.json" > "$TMP/dangling.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/dangling.json" 2>&1); code=$?
assert_exit "validate-plan: dangling blocker" 1 "$code"
assert_contains "validate-plan: 指出 99" "$out" "99"

jq '.issues[1].blocked_by = [44]' "$TMP/valid.json" > "$TMP/cycle.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/cycle.json" 2>&1); code=$?
assert_exit "validate-plan: 有环" 1 "$code"
assert_contains "validate-plan: 指出环" "$out" "有环"

jq '.issues += [{"number": 50, "title": "orphan", "branch": "afk/issue-50", "spec": 10, "blocked_by": [], "status": "pending", "stage": "implement"}]' "$TMP/valid.json" > "$TMP/orphan.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/orphan.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝闭包外节点" 1 "$code"
assert_contains "validate-plan: 指出依赖闭包" "$out" "依赖闭包"

jq '.issues[1].spec = 43' "$TMP/valid.json" > "$TMP/spec.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/spec.json" 2>&1); code=$?
assert_exit "validate-plan: SPEC 必须存在于 specs" 1 "$code"
assert_contains "validate-plan: 指出 spec" "$out" "spec"

bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/absent.json" >/dev/null 2>&1
assert_exit "validate-plan: 文件不存在" 1 $?

# --live 使用初始快照；活动状态仅用于离线和槽位用例。
jq '.issues |= map(.status = "pending" | .stage = "implement") | .issues[1].blocked_by=[43]' "$TMP/valid.json" > "$TMP/initial.json"
# --live 使用 gh stub 验证原生 parent / blockers 与 API 失败。
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
if [ "$1" = "repo" ]; then
  printf '%s\n' 'owner/repo'
  exit 0
fi
endpoint=""
for arg in "$@"; do
  case "$arg" in repos/*) endpoint="$arg" ;; esac
done
case "$endpoint" in
  repos/owner/repo/issues)
    printf '%s\n' '[[{"number":43},{"number":44},{"number":99,"pull_request":{}}]]'
    ;;
  repos/owner/repo/issues/43)
    printf '%s\n' '{"number":43,"state":"open","labels":[{"name":"ready-for-agent"}]}'
    ;;
  repos/owner/repo/issues/44)
    printf '%s\n' '{"number":44,"state":"open","labels":[{"name":"ready-for-agent"}]}'
    ;;
  repos/owner/repo/issues/43/parent|repos/owner/repo/issues/44/parent)
    printf '%s\n' '{"number":10,"title":"SPEC"}'
    ;;
  *issues/43/dependencies/blocked_by*)
    [ "${GH_FAIL_BLOCKERS:-0}" = "1" ] && exit 1
    printf '%s\n' '[[]]'
    ;;
  *issues/44/dependencies/blocked_by*)
    [ "${GH_FAIL_BLOCKERS:-0}" = "1" ] && exit 1
    printf '%s\n' '[[{"number":43,"state":"open"}]]'
    ;;
  *) exit 1 ;;
esac
GH
chmod +x "$TMP/bin/gh"

PATH="$TMP/bin:$PATH" bash "$SCRIPTS_DIR/validate-plan.sh" --expected-roots "43,44" --live "$TMP/initial.json" >/dev/null 2>&1
assert_exit "validate-plan live: 原生关系匹配" 0 $?

cat > "$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
if [ "$1" = "repo" ]; then printf '%s\n' 'owner/repo'; exit 0; fi
endpoint=""
for arg in "$@"; do case "$arg" in repos/*) endpoint="$arg" ;; esac; done
case "$endpoint" in
  repos/owner/repo/issues/43) printf '%s\n' '{"number":43,"state":"open","labels":[],"pull_request":{}}' ;;
  *) exit 1 ;;
esac
GH
chmod +x "$TMP/bin/gh"
out=$(PATH="$TMP/bin:$PATH" bash "$SCRIPTS_DIR/validate-plan.sh" --expected-roots "43,44" --live "$TMP/initial.json" 2>&1); code=$?
assert_exit "validate-plan live: 拒绝 PR root" 1 "$code"
assert_contains "validate-plan live: PR 错误明确" "$out" "Pull Request"

# 恢复标准 gh stub。
cat > "$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
if [ "$1" = "repo" ]; then printf '%s\n' 'owner/repo'; exit 0; fi
endpoint=""
for arg in "$@"; do case "$arg" in repos/*) endpoint="$arg" ;; esac; done
case "$endpoint" in
  repos/owner/repo/issues) printf '%s\n' '[[{"number":43},{"number":44},{"number":99,"pull_request":{}}]]' ;;
  repos/owner/repo/issues/43) printf '%s\n' '{"number":43,"state":"open","labels":[{"name":"ready-for-agent"}]}' ;;
  repos/owner/repo/issues/44) printf '%s\n' '{"number":44,"state":"open","labels":[{"name":"ready-for-agent"}]}' ;;
  repos/owner/repo/issues/43/parent|repos/owner/repo/issues/44/parent) printf '%s\n' '{"number":10}' ;;
  *issues/43/dependencies/blocked_by*) [ "${GH_FAIL_BLOCKERS:-0}" = "1" ] && exit 1; printf '%s\n' '[[]]' ;;
  *issues/44/dependencies/blocked_by*) [ "${GH_FAIL_BLOCKERS:-0}" = "1" ] && exit 1; printf '%s\n' '[[{"number":43,"state":"open"}]]' ;;
  *) exit 1 ;;
esac
GH
chmod +x "$TMP/bin/gh"

jq '.issues[1].blocked_by = []' "$TMP/initial.json" > "$TMP/live-mismatch.json"
out=$(PATH="$TMP/bin:$PATH" bash "$SCRIPTS_DIR/validate-plan.sh" --expected-roots "43,44" --live "$TMP/live-mismatch.json" 2>&1); code=$?
assert_exit "validate-plan live: blocker 不匹配" 1 "$code"
assert_contains "validate-plan live: mismatch 错误可读" "$out" "GitHub=[43]"

out=$(PATH="$TMP/bin:$PATH" GH_FAIL_BLOCKERS=1 bash "$SCRIPTS_DIR/validate-plan.sh" --expected-roots "43,44" --live "$TMP/initial.json" 2>&1); code=$?
assert_exit "validate-plan live: API 失败" 1 "$code"
assert_contains "validate-plan live: API 失败明确" "$out" "无法读取 blocked_by"

PATH="$TMP/bin:$PATH" bash "$SCRIPTS_DIR/validate-plan.sh" --live "$TMP/initial.json" >/dev/null 2>&1
assert_exit "validate-plan live: 默认 roots 完整" 0 $?

cat > "$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
if [ "$1" = "repo" ]; then printf '%s\n' 'owner/repo'; exit 0; fi
endpoint=""
for arg in "$@"; do
  case "$arg" in repos/*) endpoint="$arg" ;; esac
done
case "$endpoint" in
  repos/owner/repo/issues) printf '%s\n' '[[{"number":43},{"number":44},{"number":45}]]' ;;
  repos/owner/repo/issues/43) printf '%s\n' '{"number":43,"state":"open","labels":[{"name":"ready-for-agent"}]}' ;;
  repos/owner/repo/issues/44) printf '%s\n' '{"number":44,"state":"open","labels":[{"name":"ready-for-agent"}]}' ;;
  repos/owner/repo/issues/43/parent|repos/owner/repo/issues/44/parent) printf '%s\n' '{"number":10}' ;;
  *issues/43/dependencies/blocked_by*) printf '%s\n' '[[]]' ;;
  *issues/44/dependencies/blocked_by*) printf '%s\n' '[[{"number":43,"state":"open"}]]' ;;
  *) exit 1 ;;
esac
GH
chmod +x "$TMP/bin/gh"
out=$(PATH="$TMP/bin:$PATH" bash "$SCRIPTS_DIR/validate-plan.sh" --live "$TMP/initial.json" 2>&1); code=$?
assert_exit "validate-plan live: 默认 roots 遗漏" 1 "$code"
assert_contains "validate-plan live: 指出默认 roots" "$out" "默认 roots 与 GitHub 不一致"

# dispatched-count.sh
out=$(bash "$SCRIPTS_DIR/dispatched-count.sh" "$TMP/valid.json" 2>&1); code=$?
assert_exit "dispatched-count: 正常运行" 0 "$code"
if [ "$out" = "2" ]; then ok "dispatched-count: dispatched + recovering = 2"; else bad "dispatched-count: 期望 2，实际 $out"; fi

jq '.issues[0].status = "dispatchd"' "$TMP/valid.json" > "$TMP/bad-count-status.json"
out=$(bash "$SCRIPTS_DIR/dispatched-count.sh" "$TMP/bad-count-status.json" 2>&1); code=$?
assert_exit "dispatched-count: 拒绝非法 status" 1 "$code"
assert_contains "dispatched-count: status 错误明确" "$out" "status/stage 非法"

# 来源、roots 回归与四槽边界。
for status in dispatched recovering done; do
  jq --arg status "$status" '.issues[1].blocked_by=[43] | .issues[1].status=$status | if $status=="done" then .issues[1].stage="merge" | .issues[1].done_source="merged" else . end' "$TMP/valid.json" > "$TMP/blocked-active.json"
  bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/blocked-active.json" >/dev/null 2>&1
  assert_exit "validate-plan: 未完成 blocker 禁止下游 $status" 1 $?
done
jq '.roots += [99]' "$TMP/valid.json" > "$TMP/missing-root.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/missing-root.json" >/dev/null 2>&1
assert_exit "validate-plan: 离线拒绝不存在 root" 1 $?

jq '.issues[0] |= (.status="done" | .stage="merge" | .done_source="initial_closed")' "$TMP/initial.json" > "$TMP/closed.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/closed.json" >/dev/null 2>&1
assert_exit "validate-plan: 初始 CLOSED 来源" 0 $?
jq 'del(.issues[0].done_source)' "$TMP/closed.json" > "$TMP/legacy-done.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/legacy-done.json" >/dev/null 2>&1
assert_exit "validate-plan: 旧 done 须核实迁移" 1 $?
jq '.issues[0].done_source="merged"' "$TMP/closed.json" > "$TMP/merged.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/merged.json" >/dev/null 2>&1
assert_exit "validate-plan: 本次 merged 来源" 0 $?
bash "$SCRIPTS_DIR/validate-plan.sh" --live "$TMP/merged.json" >/dev/null 2>&1
assert_exit "validate-plan: live 拒绝运行中 merged" 1 $?
jq '.issues[1].done_source="initial_closed"' "$TMP/initial.json" > "$TMP/pending-source.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/pending-source.json" >/dev/null 2>&1
assert_exit "validate-plan: pending 不允许完成来源" 1 $?
jq '.roots=[44]' "$TMP/closed.json" > "$TMP/nonroot-closed.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/nonroot-closed.json" >/dev/null 2>&1
assert_exit "validate-plan: initial_closed 仅允许 root" 1 $?

for n in 4 5; do
  jq --argjson n "$n" '.issues=[range(1;$n+1) | {number:.,title:"slot",branch:("afk/issue-"+tostring),spec:null,blocked_by:[],status:"recovering",stage:"merge"}] | .roots=[.issues[].number] | .specs=[]' "$TMP/valid.json" > "$TMP/slots.json"
  expected=0; [ "$n" -eq 5 ] && expected=1
  bash "$SCRIPTS_DIR/dispatched-count.sh" "$TMP/slots.json" >/dev/null 2>&1
  assert_exit "dispatched-count: $n 个 recovering/merge 槽" "$expected" $?
  bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/slots.json" >/dev/null 2>&1
  assert_exit "validate-plan: $n 槽上限" "$expected" $?
done

# 真实 CLOSED live stub；默认扫描不能纳入 CLOSED roots。
cat > "$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
if [ "$1" = "repo" ]; then printf '%s\n' 'owner/repo'; exit 0; fi
for arg in "$@"; do case "$arg" in repos/*) endpoint="$arg" ;; esac; done
case "$endpoint" in
  repos/owner/repo/issues/43) printf '%s\n' '{"number":43,"state":"closed","labels":[]}' ;;
  repos/owner/repo/issues/44) printf '%s\n' '{"number":44,"state":"open","labels":[{"name":"ready-for-agent"}]}' ;;
  */parent) printf '%s\n' '{"number":10}' ;;
  *dependencies/blocked_by*) printf '%s\n' '[[{"number":43,"state":"closed"}]]' ;;
  *) exit 1 ;;
esac
GH
jq '.issues[1].blocked_by=[]' "$TMP/closed.json" > "$TMP/live-closed.json"
PATH="$TMP/bin:$PATH" bash "$SCRIPTS_DIR/validate-plan.sh" --expected-roots "43,44" --live "$TMP/live-closed.json" >/dev/null 2>&1
assert_exit "validate-plan live: CLOSED root 与已满足 blocker" 0 $?

# 文档 schema 示例也必须可执行校验。
for doc in "$SCRIPTS_DIR/../REFERENCE.md" "$SCRIPTS_DIR/../reference/planner-prompt.md" "$SCRIPTS_DIR/../EXAMPLES.md"; do
  ruby -e 's=File.read(ARGV[0]); puts s[/```json\n(.*?)\n```/m,1]' "$doc" > "$TMP/example.json"
  bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/example.json" >/dev/null 2>&1
  assert_exit "文档 JSON: $(basename "$doc")" 0 $?
done

# watchdog.sh
mkdir -p "$TMP/wt-fresh"
git -C "$TMP/wt-fresh" init -q
git -C "$TMP/wt-fresh" config user.name test
git -C "$TMP/wt-fresh" config user.email test@example.com
printf x > "$TMP/wt-fresh/f.txt"
git -C "$TMP/wt-fresh" add f.txt
git -C "$TMP/wt-fresh" commit -q -m fresh
bash "$SCRIPTS_DIR/watchdog.sh" "$TMP/wt-fresh" 2 > "$TMP/fresh.out" 2>&1 &
wd_pid=$!
sleep 3
if kill -0 "$wd_pid" 2>/dev/null; then
  ok "watchdog: 新鲜 worktree 保持运行"
  kill "$wd_pid" 2>/dev/null
  wait "$wd_pid" 2>/dev/null
else
  bad "watchdog: 新鲜 worktree 提前退出"
fi
if [ -s "$TMP/fresh.out" ]; then bad "watchdog: 运行时应静默"; else ok "watchdog: 运行时静默"; fi

mkdir -p "$TMP/wt-stale"
git -C "$TMP/wt-stale" init -q
git -C "$TMP/wt-stale" config user.name test
git -C "$TMP/wt-stale" config user.email test@example.com
printf x > "$TMP/wt-stale/f.txt"
git -C "$TMP/wt-stale" add f.txt
git -C "$TMP/wt-stale" commit -q -m stale
GIT_COMMITTER_DATE='2020-01-01T00:00:00Z' git -C "$TMP/wt-stale" commit --allow-empty -q -m old-reflog
touch -t 202001010000 "$TMP/wt-stale/f.txt" "$TMP/wt-stale"
bash "$SCRIPTS_DIR/watchdog.sh" "$TMP/wt-stale" 2 > "$TMP/stale.out" 2>&1 &
stale_pid=$!
deadline=$(( $(date +%s) + 15 ))
while kill -0 "$stale_pid" 2>/dev/null && [ "$(date +%s)" -lt "$deadline" ]; do
  sleep 1
done
if kill -0 "$stale_pid" 2>/dev/null; then
  kill "$stale_pid" 2>/dev/null
  wait "$stale_pid" 2>/dev/null
  code=124
else
  wait "$stale_pid"; code=$?
fi
out=$(<"$TMP/stale.out")
assert_exit "watchdog: 陈旧 worktree 超时" 1 "$code"
assert_contains "watchdog: 输出错误类型" "$out" "AgentIdleTimeoutError"
assert_contains "watchdog: 输出 worktree" "$out" "$TMP/wt-stale"

out=$(bash "$SCRIPTS_DIR/watchdog.sh" "$TMP/wt-stale" abc 2>&1); code=$?
assert_exit "watchdog: 拒绝非数字 idle" 1 "$code"
assert_contains "watchdog: 指出正整数" "$out" "正整数"

out=$(bash "$SCRIPTS_DIR/watchdog.sh" "$TMP/wt-stale" 0 2>&1); code=$?
assert_exit "watchdog: 拒绝零 idle" 1 "$code"
assert_contains "watchdog: 零值错误明确" "$out" "正整数"

mkdir -p "$TMP/not-git"
out=$(GIT_CEILING_DIRECTORIES="$TMP" bash "$SCRIPTS_DIR/watchdog.sh" "$TMP/not-git" 2 2>&1); code=$?
assert_exit "watchdog: 观测前验证 Git worktree" 2 "$code"
assert_contains "watchdog: 观测错误独立" "$out" "WatchdogObservationError"

printf '\n通过 %s，失败 %s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
