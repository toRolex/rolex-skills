#!/bin/bash
# Hook: UserPromptExpansion
# 根据命令名设置 skill 保护模式
# 受限命令（wayfinder/grilling/grill-me/grill-with-docs）→ restricted
# 其他任何命令 → normal

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.command_name // empty')
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TTY_ID=$(tty 2>/dev/null | tr -c 'a-zA-Z0-9' '_' || echo "unknown")
MODE_FILE="$SCRIPT_DIR/current-mode-$TTY_ID"

[ -z "$CMD" ] && exit 0

case "$CMD" in
  wayfinder|grilling|grill-me|grill-with-docs)
    echo -n "restricted" > "$MODE_FILE"
    ;;
  *)
    echo -n "normal" > "$MODE_FILE"
    ;;
esac

exit 0
