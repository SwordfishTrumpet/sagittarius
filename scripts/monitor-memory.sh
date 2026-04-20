#!/bin/bash
# Monitor server.js memory usage over time
# Usage: ./scripts/monitor-memory.sh [duration_seconds] [interval_seconds]

PID=$(pgrep -f "server.js" | head -1)
DURATION=${1:-300}      # Default 5 minutes
INTERVAL=${2:-10}       # Default 10 seconds

if [ -z "$PID" ]; then
    echo "Error: server.js process not found"
    echo "Make sure the server is running: node server.js"
    exit 1
fi

LOGFILE="/tmp/server-memory-$(date +%Y%m%d-%H%M%S).log"
echo "Monitoring server.js (PID: $PID) for ${DURATION}s, sampling every ${INTERVAL}s"
echo "Log file: $LOGFILE"
echo "---"

# Header
echo "timestamp,pid,rss_mb,vsz_mb,heap_total_mb,heap_used_mb,external_mb,uptime_seconds" > "$LOGFILE"

# Monitor loop
END_TIME=$((SECONDS + DURATION))
INITIAL_RSS=0
MAX_RSS=0
TOTAL_RSS=0
SAMPLE_COUNT=0

while [ $SECONDS -lt $END_TIME ]; do
    # Get memory info from /proc
    if [ -f "/proc/$PID/status" ]; then
        RSS_KB=$(grep VmRSS "/proc/$PID/status" | awk '{print $2}')
        VSZ_KB=$(grep VmSize "/proc/$PID/status" | awk '{print $2}')
        RSS_MB=$((RSS_KB / 1024))
        VSZ_MB=$((VSZ_KB / 1024))
        
        # Get Node.js heap info via health endpoint if available
        HEAP_INFO=$(curl -s http://localhost:8081/health 2>/dev/null | grep -o '"heapUsed":[0-9]*' | cut -d: -f2)
        HEAP_TOTAL=$(curl -s http://localhost:8081/health 2>/dev/null | grep -o '"heapTotal":[0-9]*' | cut -d: -f2)
        EXTERNAL=$(curl -s http://localhost:8081/health 2>/dev/null | grep -o '"external":[0-9]*' | cut -d: -f2)
        UPTIME=$(curl -s http://localhost:8081/health 2>/dev/null | grep -o '"uptime":[0-9]*' | cut -d: -f2)
        
        HEAP_INFO=${HEAP_INFO:-0}
        HEAP_TOTAL=${HEAP_TOTAL:-0}
        EXTERNAL=${EXTERNAL:-0}
        UPTIME=${UPTIME:-0}
        
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
        
        # Track stats
        if [ $SAMPLE_COUNT -eq 0 ]; then
            INITIAL_RSS=$RSS_MB
        fi
        [ $RSS_MB -gt $MAX_RSS ] && MAX_RSS=$RSS_MB
        TOTAL_RSS=$((TOTAL_RSS + RSS_MB))
        SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
        
        # Log and display
        echo "$TIMESTAMP,$PID,$RSS_MB,$VSZ_MB,$HEAP_TOTAL,$HEAP_INFO,$EXTERNAL,$UPTIME" >> "$LOGFILE"
        printf "\r[%s] RSS: %4d MB | VSZ: %5d MB | Heap: %4d MB | Trend: %+4d MB" \
            "$TIMESTAMP" "$RSS_MB" "$VSZ_MB" "$HEAP_INFO" "$((RSS_MB - INITIAL_RSS))"
    else
        echo "Process $PID not found (may have exited)"
        break
    fi
    
    sleep $INTERVAL
done

echo ""
echo "---"
echo "Monitoring complete. Summary:"
echo "  Initial RSS: ${INITIAL_RSS} MB"
echo "  Max RSS:     ${MAX_RSS} MB"
echo "  Avg RSS:     $((TOTAL_RSS / SAMPLE_COUNT)) MB"
echo "  Growth:      $((MAX_RSS - INITIAL_RSS)) MB"
echo "  Samples:     ${SAMPLE_COUNT}"
echo ""
echo "Log saved to: $LOGFILE"

# Quick leak detection
GROWTH=$((MAX_RSS - INITIAL_RSS))
if [ $GROWTH -gt 100 ]; then
    echo "⚠️  WARNING: Memory grew by ${GROWTH} MB - possible leak detected!"
elif [ $GROWTH -gt 50 ]; then
    echo "⚡ CAUTION: Memory grew by ${GROWTH} MB - monitor closely"
else
    echo "✅ Memory stable - no significant growth detected"
fi
