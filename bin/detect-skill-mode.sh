#!/bin/bash
# Hook: UserPromptSubmit (fallback)
# 从 prompt 文本 grep 关键词，只 SET 不清除
# 覆盖自然语言触发场景（如 "grill my plan"）

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE_FILE="$SCRIPT_DIR/current-mode"

[ -z "$PROMPT" ] && exit 0

echo "$PROMPT" | grep -qiE '(^|[^a-zA-Z])(wayfinder|grill)([^a-zA-Z]|$)' && {
  echo -n "restricted" > "$MODE_FILE"
  exit 0
}

exit 0
