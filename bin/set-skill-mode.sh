#!/bin/bash
# Hook: UserPromptExpansion
# 根据命令名设置 skill 保护模式
# 受限命令（wayfinder/grilling/grill-me/grill-with-docs）→ restricted
# 其他任何命令 → normal

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.command_name // empty')
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODES_DIR="$SCRIPT_DIR/modes"
MODE_FILE="$MODES_DIR/current-mode-$$"

mkdir -p "$MODES_DIR"

# 清理上次残留状态，再重新写入
rm -f "$MODE_FILE"

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
