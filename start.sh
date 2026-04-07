#!/bin/bash
# Sagittarius startup script
# Set JMAP_SERVER to your JMAP backend URL

export JMAP_SERVER="${JMAP_SERVER:-http://localhost:8080}"
export PORT="${PORT:-8081}"

echo "Starting Sagittarius..."
echo "JMAP_SERVER: $JMAP_SERVER"
echo "PORT: $PORT"

node server.js
