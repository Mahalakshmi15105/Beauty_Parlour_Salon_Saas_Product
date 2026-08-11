#!/usr/bin/env bash
# ============================================================
# SmartGoNext Salon - Backend Wake Script
#
# Manually "wakes" the backend if it is asleep by making a
# single health request. systemd automatically restarts the
# service on connection, so this just triggers it.
#
# Usage:
#   bash deploy/wake.sh
# ============================================================
set -euo pipefail

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5000}"
URL="http://${HOST}:${PORT}/api/v1/health"

echo "Waking SmartGoNext Salon backend at ${URL} ..."

# The first request may fail with connection refused while systemd
# is restarting; loop a few times with short delays.
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf --max-time 5 "$URL" >/dev/null 2>&1; then
        echo "✅ Backend is awake and healthy."
        exit 0
    fi
    echo "  ...attempt $i/10 (backend starting) ..."
    sleep 2
done

echo "❌ Backend did not wake. Check: journalctl -u salon-backend"
exit 1