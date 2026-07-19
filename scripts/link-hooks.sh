#!/usr/bin/env bash
set -euo pipefail

# Links skill-guard hook scripts from this repo into ~/.claude/hooks/.
# Uses per-file symlinks so other hooks from other sources can coexist.
# A `git pull` keeps installed hooks up to date.
#
# For plugin install (via `/plugin marketplace add`), this step is optional —
# the hooks load automatically from the plugin's `hooks/hooks.json`.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/bin"
DEST="$HOME/.claude/hooks"
SCRIPTS=(set-skill-mode.sh detect-skill-mode.sh block-code-files.sh)

mkdir -p "$DEST"

for script in "${SCRIPTS[@]}"; do
  target="$DEST/$script"
  source="$SRC/$script"

  # Remove existing entry if it's a symlink into this repo
  if [ -L "$target" ]; then
    resolved="$(readlink "$target")"
    case "$resolved" in
      "$SRC"|"$SRC"/*)
        rm "$target"
        ;;
    esac
  fi

  ln -sfn "$source" "$target"
  echo "linked $target -> $source"
done
