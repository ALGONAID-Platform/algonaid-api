#!/bin/bash

API="algonaid-api-api-1"

echo "=================================================="
echo " ALGONAID API FINAL CHECK"
echo " $(date)"
echo "=================================================="

echo
echo "### 1. CONTAINER STATE"
docker inspect "$API" --format='
Status={{.State.Status}}
Running={{.State.Running}}
Restarting={{.State.Restarting}}
RestartCount={{.RestartCount}}
ExitCode={{.State.ExitCode}}
OOMKilled={{.State.OOMKilled}}
Error={{.State.Error}}
StartedAt={{.State.StartedAt}}
'

echo
echo "### 2. PROCESSES INSIDE API"
docker exec "$API" sh -c 'ps aux' 2>&1

echo
echo "### 3. LISTENING PORTS INSIDE API"
docker exec "$API" sh -c '
if command -v ss >/dev/null 2>&1; then
    ss -lntp
else
    cat /proc/net/tcp
fi
' 2>&1

echo
echo "### 4. FULL API LOGS - LAST 150 LINES"
docker logs --tail=150 "$API" 2>&1

echo
echo "### 5. API LOGS - LAST 60 SECONDS"
docker logs --since=60s "$API" 2>&1

echo
echo "### 6. LOCAL PORT 3000"
curl -v --max-time 10 http://127.0.0.1:3000/ 2>&1

echo
echo "### 7. COURSES ENDPOINT"
curl -v --max-time 10 \
http://127.0.0.1:3000/api/v1/courses 2>&1

echo
echo "### 8. DOCKER EVENTS"
docker events --since 2m --until 0s \
--filter container="$API" 2>&1 | tail -50

echo
echo "### 9. DATABASE STATUS"
docker exec algonaid-api-db-1 pg_isready -U postgres

echo
echo "=================================================="
echo " END"
echo "=================================================="
