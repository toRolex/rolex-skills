#!/bin/bash
# Hook: PreToolUse (matcher: Edit|Write)
# restricted 模式下阻止代码文件写入

INPUT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TTY_ID=$(tty 2>/dev/null | tr -c 'a-zA-Z0-9' '_' || echo "unknown")
MODE_FILE="$SCRIPT_DIR/current-mode-$TTY_ID"
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$MODE_FILE" ] && exit 0

MODE=$(cat "$MODE_FILE")
[ "$MODE" != "restricted" ] && exit 0

EXT="${FILE_PATH##*.}"
case "$EXT" in
  py|pyw|pyx|ts|tsx|js|jsx|mjs|cjs|go|rs|java|kt|c|cpp|h|hpp|rb|php|swift|vue|svelte)
    echo "Blocked by skill guard: cannot write code files during this skill." >&2
    exit 2
    ;;
esac

exit 0
