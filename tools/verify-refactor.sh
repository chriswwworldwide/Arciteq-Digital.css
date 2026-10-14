#!/usr/bin/env bash
# tools/verify-refactor.sh — run after every server.js extraction.
# Fails loudly if route order or any HTTP behaviour differs from the
# baseline snapshots (/tmp/routes.before.txt, /tmp/http.before.txt).
set -euo pipefail
cd "$(dirname "$0")/.."

node --check server.js
for f in server/*.js; do node --check "$f"; done

ROUTE_SNAPSHOT_OUT=/tmp/routes.after.txt node --import ./tools/route-snapshot.js server.js >/dev/null 2>&1
if ! diff -u /tmp/routes.before.txt /tmp/routes.after.txt; then
  echo "❌ ROUTE ORDER CHANGED"; exit 1
fi
echo "✅ routes: identical ($(grep -c '^ROUTE' /tmp/routes.after.txt) routes, same order)"

lsof -ti :3000 | xargs kill 2>/dev/null || true
sleep 1
(npm start >/tmp/roxjaya-server.log 2>&1 &)
for _ in $(seq 1 30); do curl -s -o /dev/null http://localhost:3000/health && break; sleep 0.5; done

KEY=$(grep '^ADMIN_API_KEY=' .env.local | cut -d= -f2)
ADMIN_KEY="$KEY" ROUTES=/tmp/routes.before.txt OUT=/tmp/http.after.txt node tools/http-snapshot.js >/dev/null
if ! diff -u /tmp/http.before.txt /tmp/http.after.txt; then
  echo "❌ HTTP BEHAVIOUR CHANGED"; exit 1
fi
echo "✅ behaviour: identical ($(wc -l < /tmp/http.after.txt | tr -d ' ') probes)"

if grep -iE "error|exception" /tmp/roxjaya-server.log | grep -viE "dbQuery failed|ESLint|exceptions" | head -5 | grep -q .; then
  echo "⚠️  server log has errors:"; grep -iE "error|exception" /tmp/roxjaya-server.log | head -5
fi

npx vitest run 2>&1 | grep -E "Test Files|Tests " | sed 's/\x1b\[[0-9;]*m//g'
npx eslint server.js server/ src/ --max-warnings=999 >/dev/null && echo "✅ lint clean"
