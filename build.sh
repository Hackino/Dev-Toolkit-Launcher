#!/usr/bin/env bash
# build.sh — build + package Taqqsit Dev Launcher into a Windows .exe.
# Output lands under Taqqsit-DevLauncher/release/.
#
# Usage:
#   ./build.sh           # full build + package
#   ./build.sh clean     # wipe out/ and release/ before building
#
# Requirements: Node 18+, npm 9+. Run from anywhere — the script cd's to its
# own directory so relative paths work regardless of cwd.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── pretty logging ──────────────────────────────────────────────────────────
log()  { printf '\033[36m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ── sanity ──────────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || die "node not found on PATH"
command -v npm  >/dev/null 2>&1 || die "npm not found on PATH"

NODE_VER="$(node --version)"
NPM_VER="$(npm --version)"
log "node ${NODE_VER}, npm ${NPM_VER}"

# ── optional clean ──────────────────────────────────────────────────────────
if [[ "${1:-}" == "clean" ]]; then
    log "cleaning out/ and release/"
    rm -rf out release
fi

# ── deps ────────────────────────────────────────────────────────────────────
if [[ ! -d node_modules ]] || [[ package.json -nt node_modules ]]; then
    log "installing dependencies"
    npm install
    ok "deps installed"
else
    log "node_modules up to date (skip install)"
fi

# ── typecheck ───────────────────────────────────────────────────────────────
log "typechecking"
npm run typecheck
ok "typecheck clean"

# ── vite build (main + preload + renderer) ──────────────────────────────────
log "building (electron-vite)"
npm run build
ok "vite build done"

# ── electron-builder package ────────────────────────────────────────────────
# `npm run package` re-runs the vite build internally too, but invoking the
# builder directly here keeps the script's log readable.
log "packaging Windows installer (electron-builder)"
npx electron-builder --win --x64
ok "package built"

# ── report ──────────────────────────────────────────────────────────────────
RELEASE_DIR="$SCRIPT_DIR/release"
if [[ -d "$RELEASE_DIR" ]]; then
    echo
    log "artifacts in: $RELEASE_DIR"
    find "$RELEASE_DIR" -maxdepth 1 \( -name '*.exe' -o -name '*.msi' -o -name '*.zip' \) -print 2>/dev/null \
        | sort \
        | sed 's/^/  /'
    echo
    ok "done"
else
    die "release/ folder missing — electron-builder did not produce output"
fi
