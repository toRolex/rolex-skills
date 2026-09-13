#!/usr/bin/env bash
set -euo pipefail

# Maintainer utility: link repository skills into local skill directories.
#
# Links all skills in the repository into one or more skill directories.
# With no arguments, links into the local directories used by:
#   - ~/.claude/skills  — Claude Code
#   - ~/.agents/skills  — pi and other Agent-Skills-standard harnesses
# Pass destination directories to override those defaults, for example:
#   scripts/link-skills.sh "$HOME/.config/.skills-manager/skills"
# Each entry is a symlink into this repo, so a `git pull` is all that's needed
# to keep installed skills up to date.

REPO="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--replace-existing] [DEST ...]

Link every repository skill into each destination directory.
With no DEST, defaults to:
  $HOME/.claude/skills
  $HOME/.agents/skills

Options:
  --replace-existing  Replace same-name files or directories with symlinks.
  -h, --help          Show this help.

Examples:
  $(basename "$0") "$HOME/.config/.skills-manager/skills"
  $(basename "$0") --replace-existing "$HOME/.config/.skills-manager/skills"
  $(basename "$0") "$HOME/.claude/skills" "$HOME/.codex/skills"
EOF
}

REPLACE_EXISTING=false
DESTS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --replace-existing)
      REPLACE_EXISTING=true
      ;;
    --)
      shift
      while [ "$#" -gt 0 ]; do
        DESTS+=("$1")
        shift
      done
      break
      ;;
    -*)
      echo "error: unknown option $1." >&2
      usage >&2
      exit 1
      ;;
    *)
      DESTS+=("$1")
      ;;
  esac
  shift
done

if [ "${#DESTS[@]}" -eq 0 ]; then
  DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")
fi

normalize_dest() {
  path="$1"
  case "$path" in
    /*) ;;
    *) path="$PWD/$path" ;;
  esac

  old_ifs="$IFS"
  IFS='/'
  set -f
  set -- $path
  set +f
  IFS="$old_ifs"

  normalized=""
  for part in "$@"; do
    case "$part" in
      ''|.) ;;
      ..)
        normalized="${normalized%/*}"
        ;;
      *)
        normalized="$normalized/$part"
        ;;
    esac
  done

  [ -n "$normalized" ] || normalized="/"
  printf '%s\n' "$normalized"
}

# Collect the repo's skills once, link into every destination.
names=()
srcs=()
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done < <(find "$REPO/skills" -name SKILL.md -not -path '*/node_modules/*' -not -path '*/deprecated/*' -print0)

# Normalize destinations before validation so later writes use the same paths.
NORMALIZED_DESTS=()
for DEST in "${DESTS[@]}"; do
  if [ -z "$DEST" ]; then
    echo "error: destination must not be empty." >&2
    exit 1
  fi
  NORMALIZED_DESTS+=("$(normalize_dest "$DEST")")
done
DESTS=("${NORMALIZED_DESTS[@]}")

# Validate every destination before changing any of them.
for DEST in "${DESTS[@]}"; do
  existing="$DEST"
  suffix=""
  while [ ! -e "$existing" ] && [ ! -L "$existing" ]; do
    part="$(basename "$existing")"
    suffix="/$part$suffix"
    parent="$(dirname "$existing")"
    if [ "$parent" = "$existing" ]; then
      echo "error: cannot resolve destination $DEST." >&2
      exit 1
    fi
    existing="$parent"
  done

  if [ ! -d "$existing" ]; then
    echo "error: destination parent is not a directory ($existing)." >&2
    exit 1
  fi

  resolved="$(cd "$existing" && pwd -P)$suffix"
  case "$resolved" in
    "$REPO"|"$REPO"/*)
      echo "error: destination resolves inside this repo ($resolved)." >&2
      exit 1
      ;;
  esac

  for OTHER_DEST in "${DESTS[@]}"; do
    for name in "${names[@]}"; do
      case "$OTHER_DEST" in
        "$DEST/$name"|"$DEST/$name"/*)
          echo "error: destination $OTHER_DEST falls below generated link $DEST/$name." >&2
          exit 1
          ;;
      esac
    done
  done

  for i in "${!names[@]}"; do
    target="$DEST/${names[$i]}"
    if [ -e "$target" ] && [ ! -L "$target" ] && [ "$REPLACE_EXISTING" = false ]; then
      echo "error: refusing to replace non-symlink target $target." >&2
      echo "Re-run with --replace-existing to replace same-name files and directories." >&2
      exit 1
    fi
  done
done

for DEST in "${DESTS[@]}"; do
  mkdir -p "$DEST"
  resolved="$(cd "$DEST" && pwd -P)"
  case "$resolved" in
    "$REPO"|"$REPO"/*)
      echo "error: destination changed to resolve inside this repo ($resolved)." >&2
      exit 1
      ;;
  esac

  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$DEST/$name"

    resolved_parent="$(cd "$(dirname "$target")" && pwd -P)"
    case "$resolved_parent" in
      "$REPO"|"$REPO"/*)
        echo "error: target parent resolves inside this repo ($resolved_parent)." >&2
        exit 1
        ;;
    esac

    if [ -e "$target" ] && [ ! -L "$target" ]; then
      if [ "$REPLACE_EXISTING" = false ]; then
        echo "error: refusing to replace non-symlink target $target." >&2
        exit 1
      fi
      rm -rf "$target"
    fi

    ln -sfn "$src" "$target"
    echo "linked $name -> $src ($DEST)"
  done
done
