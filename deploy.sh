#!/usr/bin/env bash
# deploy.sh — Build and restart Sagittarius in one step
set -euo pipefail

cd "$(dirname "$0")"

echo "▸ Building production bundle..."
npx vite build

echo "▸ Restarting sagittarius service..."
sudo systemctl restart sagittarius.service

sleep 2
# Issue #7: /health now returns 503 + status "degraded" when the JMAP
# backend is unreachable, so this gate fails at deploy time instead of
# reporting a healthy deployment over a dead mail backend.
HEALTH=$(curl -sf --max-time 10 http://localhost:8081/health 2>/dev/null || echo "")
if [ -n "$HEALTH" ]; then
  STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('status','FAIL'))" 2>/dev/null || echo "FAIL")
  BACKEND=$(echo "$HEALTH" | python3 -c "import sys,json; b=json.loads(sys.stdin.read()).get('backend') or {}; print('ok' if b.get('reachable') else 'FAIL')" 2>/dev/null || echo "FAIL")
else
  STATUS="FAIL"
  BACKEND="FAIL"
fi

if [ "$STATUS" = "ok" ] && [ "$BACKEND" = "ok" ]; then
  echo "✓ Deploy complete — service healthy, backend reachable"
  systemctl status sagittarius.service --no-pager | head -6
else
  echo "✗ Deploy FAILED — service or backend not healthy (status=$STATUS, backend=$BACKEND)"
  sudo journalctl -u sagittarius -n 20 --no-pager
  exit 1
fi
