#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/release.sh <tag> [message] [--skip-changelog]

Examples:
  ./scripts/release.sh v0.1.0-beta.2 "Beta iteration"
  ./scripts/release.sh v0.1.0 --skip-changelog
USAGE
}

if [ ${#} -lt 1 ]; then
  usage
  exit 1
fi

tag=""
msg=""
skip_changelog=false

for arg in "$@"; do
  case "$arg" in
    --skip-changelog)
      skip_changelog=true
      ;;
    *)
      if [ -z "$tag" ]; then
        tag="$arg"
      elif [ -z "$msg" ]; then
        msg="$arg"
      else
        msg="$msg $arg"
      fi
      ;;
  esac
done

if [ -z "$tag" ]; then
  usage
  exit 1
fi

if [ -z "$msg" ]; then
  msg="Release $tag"
fi

if ! [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-((alpha|beta|rc)\.[0-9]+))?$ ]]; then
  echo "Invalid tag format: $tag" >&2
  echo "Expected: vMAJOR.MINOR.PATCH[-(alpha|beta|rc).N]" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit or stash changes first." >&2
  exit 1
fi

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "Tag already exists: $tag" >&2
  exit 1
fi

if [ -f "CHANGELOG.md" ] && [ "$skip_changelog" = false ]; then
  if command -v rg >/dev/null 2>&1; then
    check_cmd=(rg -n "^## \\[$tag\\]" CHANGELOG.md)
  else
    check_cmd=(grep -E "^## \\[$tag\\]" CHANGELOG.md)
  fi
  if ! "${check_cmd[@]}" >/dev/null 2>&1; then
    echo "Missing entry in CHANGELOG.md for $tag." >&2
    echo "Add it or use --skip-changelog." >&2
    exit 1
  fi
fi

git tag -a "$tag" -m "$msg"
git push origin "$tag"

echo "Tagged and pushed: $tag"
