#!/usr/bin/env bash
set -euo pipefail

TEMPLATE="$(cd "$(dirname "$0")" && pwd)/template.sh"
TEST_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/wizard-test.XXXXXX")
trap 'chmod -R u+rwX "$TEST_ROOT"; rm -rf "$TEST_ROOT"' EXIT
export TMPDIR="$TEST_ROOT/tmp"
mkdir -p "$TMPDIR"

# Load the real library from the checked-in template, excluding only its sample stages.
awk '/^# STAGES: author this section/ { exit } { print }' "$TEMPLATE" > "$TEST_ROOT/library.sh"
# shellcheck source=template.sh
source "$TEST_ROOT/library.sh"

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
assert_eq() { [[ "$1" == "$2" ]] || fail "$3 (expected <$2>, got <$1>)"; }
file_mode() {
  if [[ "$(uname -s)" == Darwin ]]; then stat -f '%Lp' "$1"; else stat -c '%a' "$1"; fi
}

# Round-trip spaces, quotes, dollar signs, backslashes and UTF-8 via real functions.
ENV_FILE="$TEST_ROOT/special.env"
expected='space "double" $dollar \\backslash 雪'
write_env SPECIAL_KEY "$expected"
assert_eq "$SPECIAL_KEY" "$expected" 'write_env updates the caller shell variable'
actual=$(_existing SPECIAL_KEY) || fail 'quoted dotenv value did not parse'
assert_eq "$actual" "$expected" 'special characters round trip'
line=$(grep '^SPECIAL_KEY=' "$ENV_FILE")
[[ "$line" == SPECIAL_KEY=\'* && "${line: -1}" == "'" ]] || fail 'value is not stored as a single-quoted dotenv literal'
node -e 'const fs = require("node:fs"); const {parseEnv} = require("node:util"); if (parseEnv(fs.readFileSync(process.argv[1], "utf8")).SPECIAL_KEY !== process.argv[2]) process.exit(1)' "$ENV_FILE" "$expected" || fail 'Node dotenv parser changed the value'
before=$(<"$ENV_FILE")
if write_env SPECIAL_KEY "it's" 2>"$TEST_ROOT/apostrophe-error.log"; then fail 'write_env accepted an unsupported apostrophe'; fi
assert_eq "$(<"$ENV_FILE")" "$before" 'rejected value preserves existing data'
[[ -s "$TEST_ROOT/apostrophe-error.log" ]] || fail 'unsupported value did not report an error'

# Exact-key upsert removes all duplicate definitions without touching other keys.
ENV_FILE="$TEST_ROOT/duplicates.env"
printf 'KEEP=left\nDUP_KEY=old\nDUP_KEY=older\nKEEP2=right\n' > "$ENV_FILE"
assert_eq "$(_existing DUP_KEY)" older 'last duplicate value is the current value'
assert_eq "$(_existing DUP_KEY_SUFFIX)" '' 'key lookup does not match prefixes'
write_env DUP_KEY 'new value'
assert_eq "$(grep -c '^DUP_KEY=' "$ENV_FILE")" 1 'duplicate key count'
assert_eq "$(grep -c '^KEEP=' "$ENV_FILE")" 1 'unrelated first key preserved'
assert_eq "$(grep -c '^KEEP2=' "$ENV_FILE")" 1 'unrelated second key preserved'
assert_eq "$(_existing DUP_KEY)" 'new value' 'upsert value'
write_env DUP_KEY 'newer value'
assert_eq "$(grep -c '^DUP_KEY=' "$ENV_FILE")" 1 'repeated upsert stays idempotent'
assert_eq "$(_existing DUP_KEY)" 'newer value' 'repeated upsert updates value'

# Existing modes remain untouched; new env files are private (0600).
chmod 640 "$ENV_FILE"
write_env DUP_KEY 'mode preserved'
assert_eq "$(file_mode "$ENV_FILE")" 640 'existing mode preserved'
ENV_FILE="$TEST_ROOT/new.env"
write_env NEW_KEY value
assert_eq "$(file_mode "$ENV_FILE")" 600 'new file mode is 0600'

# Failed writes report failure and do not create or change data (root bypasses chmod).
if [[ "$EUID" -eq 0 ]]; then
  printf 'SKIP: permission-denial checks (root bypasses file mode restrictions)\n'
else
  mkdir "$TEST_ROOT/readonly-dir"
  chmod 500 "$TEST_ROOT/readonly-dir"
  ENV_FILE="$TEST_ROOT/readonly-dir/.env"
  if write_env BLOCKED value 2>"$TEST_ROOT/permission-error.log"; then fail 'write_env accepted an unwritable directory'; fi
  [[ ! -e "$ENV_FILE" ]] || fail 'failed creation left an env file'
  [[ -s "$TEST_ROOT/permission-error.log" ]] || fail 'failed creation did not report an error'
  chmod 700 "$TEST_ROOT/readonly-dir"
  ENV_FILE="$TEST_ROOT/read-only.env"
  printf 'KEEP=original\n' > "$ENV_FILE"
  chmod 440 "$ENV_FILE"
  if write_env KEEP changed 2>"$TEST_ROOT/permission-error.log"; then fail 'write_env accepted a read-only existing file'; fi
  assert_eq "$(<"$ENV_FILE")" 'KEEP=original' 'failed overwrite preserves existing data'
  [[ -s "$TEST_ROOT/permission-error.log" ]] || fail 'failed overwrite did not report an error'
  chmod 600 "$ENV_FILE"
fi

# Relative symlinks stay symlinks and writes reach their targets without mode changes.
mkdir -p "$TEST_ROOT/project" "$TEST_ROOT/config"
printf 'LINKED=old\n' > "$TEST_ROOT/config/secrets.env"
chmod 640 "$TEST_ROOT/config/secrets.env"
ln -s ../config/secrets.env "$TEST_ROOT/project/.env"
(
  cd "$TEST_ROOT/project"
  ENV_FILE=.env
  write_env LINKED 'through relative link'
  [[ -L .env ]] || fail 'relative symlink was replaced'
  assert_eq "$(readlink .env)" '../config/secrets.env' 'relative symlink text preserved'
  assert_eq "$(grep -c '^LINKED=' ../config/secrets.env)" 1 'target upserted once'
  assert_eq "$(file_mode ../config/secrets.env)" 640 'symlink target mode preserved'
)

# Read plain and supported quoted dotenv values.
ENV_FILE="$TEST_ROOT/parse.env"
printf '%s\n' 'PLAIN=plain value' 'DOUBLE="plain double value"' 'AMBIG="a\$b"' > "$ENV_FILE"
write_env SINGLE 'literal $x \y' >/dev/null
assert_eq "$(_existing PLAIN)" 'plain value' 'plain dotenv value'
assert_eq "$(_existing DOUBLE)" 'plain double value' 'plain double-quoted dotenv value'
assert_eq "$(_existing SINGLE)" 'literal $x \y' 'single-quoted literal decoding'
if _existing AMBIG >/dev/null; then fail 'ambiguous escaped double-quoted value accepted'; fi
if write_env MULTILINE $'one\ntwo' 2>/dev/null; then fail 'write_env accepted a multiline value'; fi
if write_env CARRIAGE_RETURN $'one\rtwo' 2>/dev/null; then fail 'write_env accepted a carriage return'; fi

# Input helpers preserve existing values and fail rather than accepting EOF/cancellation.
ENV_FILE="$TEST_ROOT/input.env"
printf 'CURRENT=kept\n' > "$ENV_FILE"
ask CURRENT 'Prompt' </dev/null && fail 'ask accepted EOF with no input'
ask CURRENT 'Prompt' < <(printf '\n') || fail 'ask should retain current value on Enter'
assert_eq "$CURRENT" kept 'ask Enter keeps parsed value'
ask CURRENT 'Prompt' < <(printf 'updated\n') || fail 'ask rejected supplied value'
assert_eq "$CURRENT" updated 'ask updates caller variable'
printf 'NEW_KEY=partial' > "$TEST_ROOT/no-newline.env"
ENV_FILE="$TEST_ROOT/no-newline.env"
assert_eq "$(_existing NEW_KEY)" partial 'existing value without trailing newline is readable'
NEW_KEY=unchanged
ask NEW_KEY 'Prompt' < <(printf 'partial') && fail 'ask accepted partial EOF'
assert_eq "$NEW_KEY" unchanged 'ask does not commit partial input on EOF'
NEW_SECRET=unchanged
ask_secret NEW_SECRET 'Secret' < <(printf 'partial') && fail 'ask_secret accepted partial EOF'
assert_eq "$NEW_SECRET" unchanged 'ask_secret does not commit partial input on EOF'
ask_secret NEW_SECRET 'Secret' </dev/null && fail 'ask_secret accepted EOF'
ask_secret NEW_SECRET 'Secret' < <(printf 'dummy-secret\n') || fail 'ask_secret rejected supplied value'
assert_eq "$NEW_SECRET" 'dummy-secret' 'ask_secret updates caller variable'
pause 'Pause' </dev/null && fail 'pause accepted EOF'
confirm 'Continue?' </dev/null && fail 'confirm accepted EOF as yes'
confirm 'Continue?' < <(printf 'no\n') && fail 'confirm accepted a negative answer'
confirm 'Continue?' < <(printf 'yes\n') || fail 'confirm rejected yes'
if ask 'NOT-A-SHELL-KEY' 'Prompt' </dev/null; then fail 'ask accepted invalid shell key'; else [[ $? == 2 ]] || fail 'invalid key did not return status 2'; fi

# Missing browser launchers produce an actionable manual fallback.
no_browser_output=$(PATH="$TEST_ROOT/no-browser" open_url 'https://example.invalid' 2>&1)
[[ "$no_browser_output" == *"visit it manually: https://example.invalid"* ]] || fail 'open_url omitted its manual fallback'

# Sourcing the actual template defines run_wizard but does not run prompts or stages.
source_output=$(bash -c 'source "$1"; declare -F run_wizard >/dev/null' _ "$TEMPLATE" 2>&1) || fail 'template could not be sourced'
assert_eq "$source_output" '' 'sourcing does not invoke the wizard'

# Exercise source invocation and direct execution with fake browser/gh commands and disposable values only.
mkdir -p "$TEST_ROOT/fake-bin"
for command in wslview explorer.exe xdg-open open; do
  printf '#!/bin/sh\nexit 0\n' > "$TEST_ROOT/fake-bin/$command"
  chmod +x "$TEST_ROOT/fake-bin/$command"
done
printf '#!/bin/sh\nexit 1\n' > "$TEST_ROOT/fake-bin/gh"
chmod +x "$TEST_ROOT/fake-bin/gh"
ENV_FILE="$TEST_ROOT/sourced.env"
printf '\nPK_test_dummy\nSK_test_dummy\n' |
  ENV_FILE="$ENV_FILE" PATH="$TEST_ROOT/fake-bin:/usr/bin:/bin" bash -c 'source "$1"; run_wizard "$@"' _ "$TEMPLATE" --source-argument > "$TEST_ROOT/sourced.log" 2>&1 || fail 'sourced run_wizard did not complete'
assert_eq "$(grep -c '^STRIPE_PUBLISHABLE_KEY=' "$ENV_FILE")" 1 'sourced run_wizard persisted public value'
assert_eq "$(grep -c '^STRIPE_SECRET_KEY=' "$ENV_FILE")" 1 'sourced run_wizard persisted secret dummy'
ENV_FILE="$TEST_ROOT/direct.env"
printf '\nPK_test_dummy\nSK_test_dummy\n' |
  ENV_FILE="$ENV_FILE" PATH="$TEST_ROOT/fake-bin:/usr/bin:/bin" bash "$TEMPLATE" --test-argument > "$TEST_ROOT/direct.log" 2>&1 || fail 'direct execution with forwarded argument did not complete'
assert_eq "$(grep -c '^STRIPE_PUBLISHABLE_KEY=' "$ENV_FILE")" 1 'direct run persisted public value'
assert_eq "$(grep -c '^STRIPE_SECRET_KEY=' "$ENV_FILE")" 1 'direct run persisted secret dummy'
if ENV_FILE="$TEST_ROOT/cancelled.env" PATH="$TEST_ROOT/fake-bin:/usr/bin:/bin" bash "$TEMPLATE" </dev/null >/dev/null 2>&1; then
  fail 'direct run continued after input EOF'
fi
[[ ! -e "$TEST_ROOT/cancelled.env" ]] || fail 'cancelled run wrote env data'

# With a PTY, a failing tput clear must emit the ANSI fallback rather than silently failing.
if command -v expect >/dev/null 2>&1; then
  printf '#!/bin/sh\nprintf "%%s\\n" "$*" >> "$CLEAR_TPUT_LOG"\nexit 1\n' > "$TEST_ROOT/fake-bin/tput"
  chmod +x "$TEST_ROOT/fake-bin/tput"
  printf 'source "%s"\n_clear\n' "$TEST_ROOT/library.sh" > "$TEST_ROOT/clear.sh"
  export CLEAR_TPUT_LOG="$TEST_ROOT/tput.log" CLEAR_SCRIPT="$TEST_ROOT/clear.sh"
  export CLEAR_PATH="$TEST_ROOT/fake-bin:/usr/bin:/bin" CLEAR_OUTPUT="$TEST_ROOT/clear.output"
  expect <<'EXPECT_SCRIPT'
log_file -noappend $env(CLEAR_OUTPUT)
spawn -noecho /usr/bin/env PATH=$env(CLEAR_PATH) /bin/bash $env(CLEAR_SCRIPT)
expect eof
EXPECT_SCRIPT
  grep -Fxq clear "$CLEAR_TPUT_LOG" || fail 'tput clear was not attempted'
  grep -Fq "$(printf '\033[2J\033[3J\033[H')" "$CLEAR_OUTPUT" || fail 'ANSI clear fallback was not emitted'
else
  printf 'SKIP: clear fallback PTY check (expect unavailable)\n'
fi

printf 'PASS: wizard template behavior tests\n'
