#!/usr/bin/env bash
set -euo pipefail

# Links skill-guard hook scripts from this repo into ~/.claude/hooks/.
# Each entry is a symlink into this repo, so a `git pull` keeps hooks up to date.
#
# For plugin install (via `/plugin marketplace add`), this step is optional —
# the hooks load automatically from the plugin's `hooks/hooks.json`.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/bin"
DEST="$HOME/.claude/hooks"

# Remove existing destination if it's a symlink into this repo
if [ -L "$DEST" ]; then
  resolved="$(readlink "$DEST")"
  case "$resolved" in
    "$REPO"|"$REPO"/*)
      echo "error: $DEST is already a symlink into this repo ($resolved)." >&2
      echo "Remove it (rm \"$DEST\") and re-run if you need to recreate it." >&2
      exit 1
      ;;
  esac
fi

# Remove real files (leftover from direct install)
if [ -d "$DEST" ] && [ ! -L "$DEST" ]; then
  echo "removing real directory $DEST (will replace with symlink)" >&2
  rm -rf "$DEST"
elif [ -f "$DEST" ]; then
  rm "$DEST"
fi

ln -sfn "$SRC" "$DEST"
echo "linked hooks -> $SRC"
