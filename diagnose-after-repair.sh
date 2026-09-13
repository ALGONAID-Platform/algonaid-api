#!/bin/bash

PROJECT="/root/algonaid-api"
API="algonaid-api-api-1"
DB="algonaid-api-db-1"

cd "$PROJECT" || exit 1

echo "=================================================="
echo " ALGONAID POST-REPAIR DIAGNOSTIC"
echo " $(date)"
echo "=================================================="

echo
echo "### 1. CONTAINER STATUS"
docker ps -a --filter "name=algonaid-api"

echo
echo "### 2. API STATE"
docker inspect "$API" --format='
Status={{.State.Status}}
Running={{.State.Running}}
Paused={{.State.Paused}}
Restarting={{.State.Restarting}}
OOMKilled={{.State.OOMKilled}}
ExitCode={{.State.ExitCode}}
Error={{.State.Error}}
StartedAt={{.State.StartedAt}}
FinishedAt={{.State.FinishedAt}}
RestartCount={{.RestartCount}}
'

echo
echo "### 3. API PORT"
docker port "$API"

echo
echo "### 4. API LISTENING PORTS"
docker exec "$API" sh -c '
echo "--- process ---"
ps aux 2>/dev/null || true
echo "--- ports ---"
if command -v ss >/dev/null 2>&1; then
    ss -lntp
elif command -v netstat >/dev/null 2>&1; then
    netstat -lntp
else
    echo "ss/netstat not installed"
fi
'

echo
echo "### 5. API LOGS - LAST 200"
docker logs --tail=200 "$API" 2>&1

echo
echo "### 6. API LOGS - SINCE LAST 5 MINUTES"
docker logs --since=5m "$API" 2>&1

echo
echo "### 7. DATABASE STATUS"
docker inspect "$DB" --format='
Status={{.State.Status}}
Running={{.State.Running}}
Health={{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}
RestartCount={{.RestartCount}}
'

echo
echo "### 8. DATABASE HEALTH"
docker exec "$DB" pg_isready -U postgres

echo
echo "### 9. DATABASE AUTH TEST"
ENV_DB_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '\r')

if [ -n "$ENV_DB_PASSWORD" ]; then
    docker exec \
        -e PGPASSWORD="$ENV_DB_PASSWORD" \
        "$DB" \
        psql -h 127.0.0.1 -U postgres -d algonaid \
        -c "SELECT current_database(), current_user, now();" \
        2>&1
else
    echo "Could not read POSTGRES_PASSWORD"
fi

echo
echo "### 10. DATABASE RECENT LOGS"
docker logs --since=5m "$DB" 2>&1

echo
echo "### 11. API -> DB DNS"
docker exec "$API" getent hosts db 2>&1

echo
echo "### 12. API -> DB PORT"
docker exec "$API" sh -c '
if command -v nc >/dev/null 2>&1; then
    nc -vz db 5432
else
    echo "nc not installed"
fi
' 2>&1

echo
echo "### 13. LOCAL API ROOT"
curl -v --max-time 10 \
    http://127.0.0.1:3000/ \
    2>&1 | tail -40

echo
echo "### 14. LOCAL COURSES API"
curl -v --max-time 10 \
    http://127.0.0.1:3000/api/v1/courses \
    2>&1 | tail -60

echo
echo "### 15. LOCAL API HEALTH ENDPOINTS"
for path in \
    /health \
    /api \
    /api/v1 \
    /api/v1/health
do
    echo "--- $path ---"
    curl -sS -i --max-time 5 \
        "http://127.0.0.1:3000$path" \
        2>&1 | head -20
done

echo
echo "### 16. ENV DATABASE URL - STRUCTURE ONLY"
grep '^DATABASE_URL=' .env \
| sed -E 's#postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+).*#user=\1 host=\3 port=\4 database=\5#'

echo
echo "### 17. API DATABASE URL - STRUCTURE ONLY"
docker inspect "$API" \
--format '{{range .Config.Env}}{{println .}}{{end}}' \
| grep '^DATABASE_URL=' \
| sed -E 's#postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+).*#user=\1 host=\3 port=\4 database=\5#'

echo
echo "### 18. DOCKER COMPOSE CONFIG"
docker compose ps

echo
echo "### 19. RESOURCE USAGE"
docker stats --no-stream "$API" "$DB"

echo
echo "### 20. RECENT POSTGRES AUTH FAILURES"
docker logs --since=10m "$DB" 2>&1 \
| grep -E 'password authentication failed|FATAL|ERROR' \
| tail -50

echo
echo "=================================================="
echo " DIAGNOSTIC FINISHED"
echo "=================================================="
