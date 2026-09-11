#!/usr/bin/env bash
# 保留的既有离线 schema/闭包测试；夹具适配批次记录。
# 旧恢复、Planner、watchdog 专属断言已退役。本次重构未运行本文件。
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
  "version": 2,
  "run_id": "test-run-1",
  "target_branch": "main",
  "roots": [43, 44],
  "specs": [{"number": 10, "title": "SPEC"}],
  "batch": {"id": 0, "phase": "idle", "tickets": []},
  "issues": [
    {"number": 43, "title": "root a", "branch": "afk/issue-43", "spec": 10, "blocked_by": [], "live_blocked_by": [], "status": "pending", "stage": "implement", "writer": "none"},
    {"number": 44, "title": "root b", "branch": "afk/issue-44", "spec": 10, "blocked_by": [], "live_blocked_by": [], "status": "pending", "stage": "implement", "writer": "none"}
  ]
}
JSON
}

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

jq '.issues[0].number = -1 | .issues[0].branch = "afk/issue--1" | .roots[0] = -1 | .issues[1].blocked_by = [-1] | .issues[1].live_blocked_by = [-1]' "$TMP/valid.json" > "$TMP/negative.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/negative.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝负 issue number" 1 "$code"
assert_contains "validate-plan: 指出正整数" "$out" "正整数"

jq '.issues[0].number = 1.5 | .issues[0].branch = "afk/issue-1.5" | .roots[0] = 1.5 | .issues[1].blocked_by = [1.5] | .issues[1].live_blocked_by = [1.5]' "$TMP/valid.json" > "$TMP/fraction.json"
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

jq '.issues[1].blocked_by = [99] | .issues[1].live_blocked_by = [99]' "$TMP/valid.json" > "$TMP/dangling.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/dangling.json" 2>&1); code=$?
assert_exit "validate-plan: dangling blocker" 1 "$code"
assert_contains "validate-plan: 指出 99" "$out" "99"

jq '.issues[1].blocked_by = [44] | .issues[1].live_blocked_by = [44]' "$TMP/valid.json" > "$TMP/cycle.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/cycle.json" 2>&1); code=$?
assert_exit "validate-plan: 有环" 1 "$code"
assert_contains "validate-plan: 指出环" "$out" "有环"

jq '.issues += [{"number": 50, "title": "orphan", "branch": "afk/issue-50", "spec": 10, "blocked_by": [], "live_blocked_by": [], "status": "pending", "stage": "implement", "writer": "none"}]' "$TMP/valid.json" > "$TMP/orphan.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/orphan.json" 2>&1); code=$?
assert_exit "validate-plan: 拒绝闭包外节点" 1 "$code"
assert_contains "validate-plan: 指出依赖闭包" "$out" "依赖闭包"

jq '.issues[1].spec = 43' "$TMP/valid.json" > "$TMP/spec.json"
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/spec.json" 2>&1); code=$?
assert_exit "validate-plan: SPEC 必须存在于 specs" 1 "$code"
assert_contains "validate-plan: 指出 spec" "$out" "spec"

bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/absent.json" >/dev/null 2>&1
assert_exit "validate-plan: 文件不存在" 1 $?

jq '.roots += [99]' "$TMP/valid.json" > "$TMP/missing-root.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/missing-root.json" >/dev/null 2>&1
assert_exit "validate-plan: 离线拒绝不存在 root" 1 $?

jq '.issues[0] |= (.status="done" | .stage="merge" | .done_source="initial_closed")' "$TMP/valid.json" > "$TMP/closed.json"
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
jq '.issues[1].done_source="initial_closed"' "$TMP/valid.json" > "$TMP/pending-source.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/pending-source.json" >/dev/null 2>&1
assert_exit "validate-plan: pending 不允许完成来源" 1 $?
jq '.roots=[44]' "$TMP/closed.json" > "$TMP/nonroot-closed.json"
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/nonroot-closed.json" >/dev/null 2>&1
assert_exit "validate-plan: initial_closed 仅允许 root" 1 $?

printf '\n通过 %s，失败 %s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
