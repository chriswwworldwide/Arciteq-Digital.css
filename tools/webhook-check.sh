#!/usr/bin/env bash
# tools/webhook-check.sh OUTFILE — start a throwaway server on :3100 with
# test Stripe secrets, replay signed events, write the DB outcome to OUTFILE.
set -euo pipefail
cd "$(dirname "$0")/.."
lsof -ti :3100 | xargs kill 2>/dev/null || true
(PORT=3100 STRIPE_SECRET_KEY=sk_test_replay STRIPE_WEBHOOK_SECRET=whsec_replay RESEND_API_KEY= node server.js >/tmp/replay-server.log 2>&1 &)
for _ in $(seq 1 30); do curl -s -o /dev/null http://localhost:3100/health && break; sleep 0.5; done
BASE=http://localhost:3100 OUT="$1" node tools/webhook-replay.js
lsof -ti :3100 | xargs kill 2>/dev/null || true
