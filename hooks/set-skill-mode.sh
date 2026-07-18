#!/bin/bash
# Hook: UserPromptExpansion
# 根据命令名设置 skill 保护模式
# 受限命令（wayfinder/grilling/grill-me/grill-with-docs）→ restricted
# 其他任何命令 → normal

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.command_name // empty')
MODE_FILE="$HOME/.claude/hooks/current-mode"

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
