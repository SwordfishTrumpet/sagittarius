#!/usr/bin/env bash
# deploy.sh — Build and restart Sagittarius in one step
set -euo pipefail

cd "$(dirname "$0")"

echo "▸ Building production bundle..."
npx vite build

echo "▸ Restarting sagittarius service..."
sudo systemctl restart sagittarius.service

sleep 2
STATUS=$(curl -sf http://localhost:8081/health | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['status'])" 2>/dev/null || echo "FAIL")

if [ "$STATUS" = "ok" ]; then
  echo "✓ Deploy complete — service healthy"
  systemctl status sagittarius.service --no-pager | head -6
else
  echo "✗ Deploy FAILED — service not healthy"
  sudo journalctl -u sagittarius -n 20 --no-pager
  exit 1
fi
