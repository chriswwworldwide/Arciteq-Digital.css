#!/bin/zsh

set -euo pipefail

KEY_FILE="$HOME/.pawsense/admin_api_key.txt"
if [ ! -f "$KEY_FILE" ]; then
  echo "Missing key file at $KEY_FILE" >&2
  exit 1
fi

ADMIN_API_KEY=$(cat "$KEY_FILE" | tr -d '\r' | tr -d '\n' | tr -d '"')
if [ -z "${ADMIN_API_KEY}" ]; then
  echo "ADMIN_API_KEY missing in $KEY_FILE" >&2
  exit 1
fi

curl -s -X POST "http://127.0.0.1:3000/admin/run-import" \
  -H "x-admin-key: ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  --data "{}"

echo ""
