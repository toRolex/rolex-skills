#!/usr/bin/env bash
# afk-issue-loop scripts 黑盒测试：给定输入文件/目录，断言 exit code 与 stdout。
# 用法：bash scripts/tests.sh（在 skill 目录内或任意目录均可）
set -u

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0
FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ok()   { PASS=$((PASS+1)); echo "ok   - $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL - $1"; }

# assert_exit <描述> <期望code> <实际code>
assert_exit() {
  if [ "$2" -eq "$3" ]; then ok "$1 (exit $3)"; else bad "$1 (期望 exit $2，实际 $3)"; fi
}

# assert_out_contains <描述> <实际输出> <期望子串>
assert_out_contains() {
  case "$2" in
    *"$3"*) ok "$1" ;;
    *) bad "$1（期望包含 [$3]，实际输出：$2）" ;;
  esac
}

# ---------- validate-plan.sh ----------

cat > "$TMP/valid.json" <<'EOF'
{"issues": [
  {"number": 42, "title": "a", "branch": "afk/issue-42", "blocked_by": []},
  {"number": 43, "title": "b", "branch": "afk/issue-43", "blocked_by": [42]},
  {"number": 44, "title": "c", "branch": "afk/issue-44", "blocked_by": [42, 43], "status": "pending"}
]}
EOF
bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/valid.json" >/dev/null 2>&1
assert_exit "validate-plan: 合法 plan" 0 $?

cat > "$TMP/missing-field.json" <<'EOF'
{"issues": [{"number": 42, "branch": "afk/issue-42", "blocked_by": []}]}
EOF
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/missing-field.json" 2>&1); code=$?
assert_exit "validate-plan: 缺字段" 1 $code
assert_out_contains "validate-plan: 缺字段错误行指明问题" "$out" "title"

cat > "$TMP/bad-branch.json" <<'EOF'
{"issues": [{"number": 42, "title": "a", "branch": "feature/42", "blocked_by": []}]}
EOF
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/bad-branch.json" 2>&1); code=$?
assert_exit "validate-plan: 分支名非法" 1 $code
assert_out_contains "validate-plan: 分支名错误行指明问题" "$out" "afk/issue-42"

cat > "$TMP/dangling-ref.json" <<'EOF'
{"issues": [
  {"number": 42, "title": "a", "branch": "afk/issue-42", "blocked_by": []},
  {"number": 43, "title": "b", "branch": "afk/issue-43", "blocked_by": [99]}
]}
EOF
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/dangling-ref.json" 2>&1); code=$?
assert_exit "validate-plan: blocked_by 引用不存在" 1 $code
assert_out_contains "validate-plan: 引用错误行指明问题" "$out" "99"

cat > "$TMP/cycle.json" <<'EOF'
{"issues": [
  {"number": 42, "title": "a", "branch": "afk/issue-42", "blocked_by": [43]},
  {"number": 43, "title": "b", "branch": "afk/issue-43", "blocked_by": [42]},
  {"number": 44, "title": "c", "branch": "afk/issue-44", "blocked_by": []}
]}
EOF
out=$(bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/cycle.json" 2>&1); code=$?
assert_exit "validate-plan: 有环" 1 $code
assert_out_contains "validate-plan: 环错误行指出成环节点" "$out" "42"

bash "$SCRIPTS_DIR/validate-plan.sh" "$TMP/nonexistent.json" >/dev/null 2>&1
assert_exit "validate-plan: 文件不存在" 1 $?

# ---------- watchdog.sh ----------

# 活性新鲜 → 短阈值内不退出
mkdir -p "$TMP/wt-fresh"
echo x > "$TMP/wt-fresh/f.txt"
bash "$SCRIPTS_DIR/watchdog.sh" "$TMP/wt-fresh" 2 > "$TMP/wd-fresh.out" 2>&1 &
wd_pid=$!
sleep 3
if kill -0 "$wd_pid" 2>/dev/null; then
  ok "watchdog: 活性新鲜时不退出"
  kill "$wd_pid" 2>/dev/null; wait "$wd_pid" 2>/dev/null
else
  bad "watchdog: 活性新鲜时不退出（已提前退出）"
fi
if [ -s "$TMP/wd-fresh.out" ]; then
  bad "watchdog: 运行期间零输出（实际有输出：$(cat "$TMP/wd-fresh.out")）"
else
  ok "watchdog: 运行期间零输出"
fi

# 全陈旧文件 → 超时 exit 1 + 一行死因
mkdir -p "$TMP/wt-stale"
echo x > "$TMP/wt-stale/f.txt"
touch -t 202001010000 "$TMP/wt-stale/f.txt" "$TMP/wt-stale"
out=$(bash "$SCRIPTS_DIR/watchdog.sh" "$TMP/wt-stale" 2 2>&1); code=$?
assert_exit "watchdog: 全陈旧时超时退出" 1 $code
assert_out_contains "watchdog: 死因含 worktree 路径" "$out" "$TMP/wt-stale"
assert_out_contains "watchdog: 死因含错误类型" "$out" "AgentIdleTimeoutError"

# 缺少参数 → 用法报错
bash "$SCRIPTS_DIR/watchdog.sh" >/dev/null 2>&1
assert_exit "watchdog: 缺参数报错" 1 $?

# ---------- dispatched-count.sh ----------

cat > "$TMP/count.json" <<'EOF'
{"issues": [
  {"number": 42, "status": "dispatched"},
  {"number": 43, "status": "done"},
  {"number": 44, "status": "dispatched"},
  {"number": 45, "status": "pending"},
  {"number": 46, "status": "failed"}
]}
EOF
out=$(bash "$SCRIPTS_DIR/dispatched-count.sh" "$TMP/count.json" 2>&1); code=$?
assert_exit "dispatched-count: 正常运行" 0 $code
assert_out_contains "dispatched-count: 计数正确" "$out" "2"

echo
echo "通过 ${PASS}，失败 ${FAIL}"
[ "$FAIL" -eq 0 ]
