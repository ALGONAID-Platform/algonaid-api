#!/bin/bash

set +e

API="algonaid-api-api-1"
DB="algonaid-api-db-1"

echo "=================================================="
echo " ALGONAID VPS / DOCKER DIAGNOSTIC REPORT"
echo " $(date)"
echo "=================================================="

echo
echo "### 1) HOST"
echo "Hostname:"
hostname

echo
echo "Disk:"
df -h /

echo
echo "Memory:"
free -h

echo
echo "Uptime:"
uptime

echo
echo "=================================================="
echo "### 2) DOCKER CONTAINERS"
echo "=================================================="
docker ps -a

echo
echo "=================================================="
echo "### 3) DOCKER COMPOSE"
echo "=================================================="
docker compose ps

echo
echo "Compose services:"
docker compose config --services

echo
echo "Compose images:"
docker compose config --images

echo
echo "=================================================="
echo "### 4) API CONTAINER"
echo "=================================================="
docker inspect "$API" --format \
'Name={{.Name}}
Status={{.State.Status}}
Running={{.State.Running}}
StartedAt={{.State.StartedAt}}
RestartCount={{.RestartCount}}
WorkingDir={{.Config.WorkingDir}}'

echo
echo "API Networks:"
docker inspect "$API" --format '{{json .NetworkSettings.Networks}}'

echo
echo "=================================================="
echo "### 5) API ENVIRONMENT (SECRETS MASKED)"
echo "=================================================="

docker inspect "$API" --format '{{range .Config.Env}}{{println .}}{{end}}' \
| sed -E \
-e 's#(DATABASE_URL=postgresql://[^:]+:)[^@]+@#\1****@#' \
-e 's#(DATABASE_URL=postgres://[^:]+:)[^@]+@#\1****@#' \
-e 's#(JWT_SECRET=).*#\1****#' \
-e 's#(JWT_ACCESS_SECRET=).*#\1****#' \
-e 's#(JWT_REFRESH_SECRET=).*#\1****#' \
-e 's#(PASSWORD=).*#\1****#' \
-e 's#(POSTGRES_PASSWORD=).*#\1****#'

echo
echo "=================================================="
echo "### 6) POSTGRES CONTAINER"
echo "=================================================="

docker inspect "$DB" --format \
'Name={{.Name}}
Status={{.State.Status}}
Health={{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}
StartedAt={{.State.StartedAt}}
RestartCount={{.RestartCount}}'

echo
echo "PostgreSQL environment (passwords masked):"

docker inspect "$DB" --format '{{range .Config.Env}}{{println .}}{{end}}' \
| sed -E \
-e 's#(POSTGRES_PASSWORD=).*#\1****#' \
-e 's#(PASSWORD=).*#\1****#'

echo
echo "=================================================="
echo "### 7) POSTGRES HEALTH"
echo "=================================================="

docker exec "$DB" pg_isready -U postgres

echo
echo "PostgreSQL version:"
docker exec "$DB" psql -U postgres -d postgres -tAc "SELECT version();"

echo
echo "PostgreSQL current user:"
docker exec "$DB" psql -U postgres -d postgres -tAc "SELECT current_user;"

echo
echo "Databases:"
docker exec "$DB" psql -U postgres -d postgres -tAc \
"SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;"

echo
echo "Postgres users:"
docker exec "$DB" psql -U postgres -d postgres -tAc \
"SELECT usename FROM pg_user ORDER BY usename;"

echo
echo "=================================================="
echo "### 8) API -> DATABASE DNS"
echo "=================================================="

docker exec "$API" sh -c '
echo "DATABASE hostname from environment:"
echo "$DATABASE_URL" | sed -E "s#(postgresql://[^:]+:)[^@]+@#\1****@#; s#(postgres://[^:]+:)[^@]+@#\1****@#"
'

echo
echo "API container DNS:"
docker exec "$API" getent hosts db 2>/dev/null || true
docker exec "$API" getent hosts postgres 2>/dev/null || true

echo
echo "=================================================="
echo "### 9) DATABASE PORT CONNECTIVITY FROM API"
echo "=================================================="

echo "Testing db:5432..."
docker exec "$API" sh -c '
if command -v nc >/dev/null 2>&1; then
    nc -vz db 5432
elif command -v wget >/dev/null 2>&1; then
    echo "nc not installed; wget available"
else
    echo "No nc/wget available"
fi
' 2>&1

echo
echo "=================================================="
echo "### 10) PRISMA"
echo "=================================================="

docker exec "$API" sh -c '
if [ -f /usr/src/app/prisma/schema.prisma ]; then
    echo "Prisma schema: FOUND"
else
    echo "Prisma schema: NOT FOUND"
fi

if [ -d /usr/src/app/node_modules/@prisma ]; then
    echo "Prisma package: FOUND"
else
    echo "Prisma package: NOT FOUND"
fi
'

echo
echo "=================================================="
echo "### 11) API LOGS - LAST 120 LINES"
echo "=================================================="

docker logs --tail=120 "$API" 2>&1

echo
echo "=================================================="
echo "### 12) DATABASE LOGS - LAST 80 LINES"
echo "=================================================="

docker logs --tail=80 "$DB" 2>&1

echo
echo "=================================================="
echo "### 13) API LOCAL TEST"
echo "=================================================="

curl -sS -i --max-time 10 \
http://127.0.0.1:3000/api/v1/courses \
| head -40

echo
echo "=================================================="
echo "### 14) PUBLIC API TEST"
echo "=================================================="

curl -sS -I --max-time 15 \
https://api.exchangemangement.online/api/v1/courses

echo
echo "=================================================="
echo "### 15) DOCKER VOLUMES"
echo "=================================================="

docker volume ls

echo
echo "=================================================="
echo "### 16) DOCKER NETWORKS"
echo "=================================================="

docker network ls

echo
echo "=================================================="
echo "### 17) PROJECT FILES"
echo "=================================================="

pwd
ls -lah

echo
echo "=================================================="
echo " DIAGNOSTIC COMPLETE"
echo "=================================================="
