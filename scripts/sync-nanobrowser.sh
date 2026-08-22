#!/bin/sh
set -eu

REPOSITORY=${1:-../nanobrowser}
REF=${2:-main}
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TARGET="$ROOT/vendor/nanobrowser"
METADATA="$ROOT/vendor/nanobrowser-upstream.json"
TEMP=$(mktemp -d)
CHECKSUM=$(mktemp)
trap 'rm -rf "$TEMP" "$CHECKSUM"' EXIT

if ! git -C "$REPOSITORY" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '%s\n' '上游目录不是 Git 工作树' >&2
  exit 1
fi
ORIGIN=$(git -C "$REPOSITORY" remote get-url origin 2>/dev/null || true)
case "$ORIGIN" in
  *nanobrowser/nanobrowser*) ;;
  *) printf '%s\n' "拒绝同步未知上游来源: ${ORIGIN:-<none>}" >&2; exit 1 ;;
esac
git -C "$REPOSITORY" rev-parse --verify "$REF^{commit}" >/dev/null

git -C "$REPOSITORY" archive "$REF" | tar -x -C "$TEMP"
COMMIT=$(git -C "$REPOSITORY" rev-parse "$REF")
VERSION=$(git -C "$REPOSITORY" show "$REF:package.json" | node --input-type=module -e "let s=''; process.stdin.on('data', c => s += c).on('end', () => process.stdout.write(JSON.parse(s).version))")

rm -rf "$TARGET"
mv "$TEMP" "$TARGET"
printf '{\n  "repository": "https://github.com/nanobrowser/nanobrowser.git",\n  "commit": "%s",\n  "version": "%s",\n  "license": "Apache-2.0"\n}\n' "$COMMIT" "$VERSION" > "$METADATA"

# Regenerate the bundler-friendly engine slice consumed by DPP.
SLICE="$ROOT/src/lib/browserEngine/upstream"
rm -rf "$SLICE"
mkdir -p "$SLICE/background"
cp -R "$TARGET/chrome-extension/src/background/browser" "$SLICE/background/"
# BrowserContext is replaced by DPP's own adapter; keep it out of the slice.
rm "$SLICE/background/browser/context.ts"
cp "$TARGET/chrome-extension/src/background/log.ts" "$SLICE/background/log.ts"
cp "$TARGET/LICENSE" "$SLICE/LICENSE"

# Static DOM-tree builder injected into pages via chrome.scripting.
cp "$TARGET/chrome-extension/public/buildDomTree.js" "$ROOT/public/buildDomTree.js"

# Record generated inputs so CI can detect a changed upstream slice.
node --input-type=module -e "import { createHash } from 'node:crypto'; import { readFileSync } from 'node:fs'; const p = process.argv[1]; const h = createHash('sha256').update(readFileSync(p)).digest('hex'); process.stdout.write(h)" "$ROOT/public/buildDomTree.js" > "$CHECKSUM"
node --input-type=module -e "import { readFileSync, writeFileSync } from 'node:fs'; const p = process.argv[1]; const m = JSON.parse(readFileSync(p, 'utf8')); m.buildDomTreeSha256 = readFileSync(process.argv[2], 'utf8').trim(); writeFileSync(p, JSON.stringify(m, null, 2) + '\n')" "$METADATA" "$CHECKSUM"
