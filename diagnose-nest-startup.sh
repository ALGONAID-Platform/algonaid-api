#!/bin/bash

API="algonaid-api-api-1"

echo "=================================================="
echo " ALGONAID NESTJS STARTUP DIAGNOSTIC"
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
FinishedAt={{.State.FinishedAt}}
'

echo
echo "### 2. CURRENT PROCESSES"
docker exec "$API" sh -c 'ps aux' 2>&1 || true

echo
echo "### 3. LISTENING PORTS"
docker exec "$API" sh -c '
if command -v ss >/dev/null 2>&1; then
    ss -lntp
else
    cat /proc/net/tcp
fi
' 2>&1 || true

echo
echo "### 4. LAST 250 API LOGS"
docker logs --tail=250 "$API" 2>&1

echo
echo "### 5. LOGS FROM LAST 3 MINUTES"
docker logs --since=3m "$API" 2>&1

echo
echo "### 6. PACKAGE SCRIPTS"
docker exec "$API" node -e '
const p=require("/usr/src/app/package.json");
console.log(JSON.stringify(p.scripts,null,2));
' 2>&1 || true

echo
echo "### 7. NEST MAIN FILE"
if [ -f src/main.ts ]; then
    sed -n '1,240p' src/main.ts
else
    echo "src/main.ts not found"
fi

echo
echo "### 8. DOCKER COMPOSE API COMMAND"
grep -n -A20 -B3 '^  api:' docker-compose.yml

echo
echo "### 9. DOCKERFILE"
sed -n '1,220p' Dockerfile

echo
echo "### 10. NODE / NPM / PRISMA"
docker exec "$API" sh -c '
node --version
npm --version
npx prisma --version
' 2>&1 || true

echo
echo "### 11. TYPESCRIPT CONFIG"
for f in tsconfig.json tsconfig.build.json nest-cli.json; do
    if [ -f "$f" ]; then
        echo "--- $f ---"
        cat "$f"
    fi
done

echo
echo "### 12. PORT ENVIRONMENT"
docker exec "$API" sh -c '
env | grep -E "^(PORT|HOST|NODE_ENV|DATABASE_URL)=" \
| sed -E "s#(DATABASE_URL=postgresql://[^:]+:)[^@]+@#\1****@"
' 2>&1 || true

echo
echo "### 13. DIRECT LOCAL TEST"
curl -v --max-time 5 http://127.0.0.1:3000/ 2>&1

echo
echo "### 14. DATABASE"
docker exec algonaid-api-db-1 pg_isready -U postgres

echo
echo "=================================================="
echo " END"
echo "=================================================="
