#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
cd "$PROJECT_DIR"
PROJECT_DIR="$(pwd -P)"
PORT="${PORT:-3000}"
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] || { echo "PORT must be a valid TCP port." >&2; exit 1; }
(( PORT >= 1 && PORT <= 65535 )) || { echo "PORT must be between 1 and 65535." >&2; exit 1; }
META_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/home/runner/work/_temp}/omgithub-web}"
OUTPUT_JSON="$META_DIR/deployment-output.json"

run() { /usr/bin/time -p "$@"; }
run mkdir -p "$META_DIR"

BUILD_DONE=false
if [[ -f package.json ]]; then
  if [[ -f package-lock.json ]]; then
    run npm ci --no-audit --no-fund
  else
    run npm install --no-audit --no-fund
  fi
  if run node -e "process.exit(require('./package.json').scripts?.build ? 0 : 1)"; then
    run npm run build
    BUILD_DONE=true
  fi
fi

STATIC_DIR=""
if [[ "$BUILD_DONE" == true ]]; then
  for candidate in "$PROJECT_DIR/dist" "$PROJECT_DIR/build" "$PROJECT_DIR/out"; do
    if [[ -f "$candidate/index.html" ]]; then
      STATIC_DIR="$candidate"
      break
    fi
  done
fi

if [[ -f "$PROJECT_DIR/index.html" && "$BUILD_DONE" == false ]]; then
  STATIC_DIR="$PROJECT_DIR/dist"
  run mkdir -p "$STATIC_DIR"
  while IFS= read -r -d '' entry; do
    run cp -a "$entry" "$STATIC_DIR/"
  done < <(find "$PROJECT_DIR" -mindepth 1 -maxdepth 1 \
    ! -name dist ! -name build ! -name out ! -name node_modules ! -name .git \
    ! -name .omgithub ! -name .agents ! -name .opencode-web -print0)
fi

if [[ -z "$STATIC_DIR" ]]; then
  for candidate in "$PROJECT_DIR/dist" "$PROJECT_DIR/build" "$PROJECT_DIR/out"; do
    if [[ -f "$candidate/index.html" ]]; then
      STATIC_DIR="$candidate"
      break
    fi
  done
fi

if [[ -z "$STATIC_DIR" || ! -f "$STATIC_DIR/index.html" ]]; then
  echo "No built static site found. Add a package.json build script producing dist/index.html, or provide index.html." >&2
  exit 1
fi

STATIC_DIR="$(run realpath "$STATIC_DIR")"
case "$STATIC_DIR" in
  "$PROJECT_DIR"/*) ;;
  *) echo "Built static directory must be inside PROJECT_DIR: $STATIC_DIR" >&2; exit 1 ;;
esac

run env PROJECT_DIR="$PROJECT_DIR" STATIC_DIR="$STATIC_DIR" OUTPUT_JSON="$OUTPUT_JSON" \
  node -e 'const fs=require("node:fs"); const path=require("node:path"); const project=path.resolve(process.env.PROJECT_DIR); const directory=path.resolve(process.env.STATIC_DIR); fs.writeFileSync(process.env.OUTPUT_JSON, JSON.stringify({project,directory}));'

run python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$STATIC_DIR"
