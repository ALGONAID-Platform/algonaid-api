#!/bin/bash

echo "=================================================="
echo " ALGONAID FINAL DIAGNOSTIC"
echo " $(date)"
echo "=================================================="

echo
echo "### 1. ENV FILE FORMAT"
file .env

echo
echo "### 2. DATABASE CONFIG (PASSWORD HIDDEN)"
grep -E '^(DATABASE_URL|POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' .env \
| sed -E 's#(postgresql://[^:]+:)[^@]+@#\1****@#; s#(POSTGRES_PASSWORD=).*#\1****#'

echo
echo "### 3. DOCKER STATUS"
docker compose ps

echo
echo "### 4. API DATABASE_URL (PASSWORD HIDDEN)"
docker inspect algonaid-api-api-1 \
--format '{{range .Config.Env}}{{println .}}{{end}}' \
| grep '^DATABASE_URL=' \
| sed -E 's#(postgresql://[^:]+:)[^@]+@#\1****@#'

echo
echo "### 5. POSTGRES HEALTH"
docker exec algonaid-api-db-1 pg_isready -U postgres

echo
echo "### 6. TEST DATABASE USING .ENV PASSWORD"
set -a
source .env
set +a

docker exec \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  algonaid-api-db-1 \
  sh -c 'psql -h 127.0.0.1 -U postgres -d algonaid -c "SELECT current_database(), current_user;"'

echo
echo "### 7. API -> DATABASE NETWORK"
docker exec algonaid-api-api-1 getent hosts db

echo
echo "### 8. DATABASE PORT FROM API"
docker exec algonaid-api-api-1 sh -c '
if command -v nc >/dev/null 2>&1; then
    nc -vz db 5432
else
    echo "nc not installed"
fi
' 2>&1

echo
echo "### 9. LOCAL API TEST"
curl -sS -i --max-time 10 \
http://127.0.0.1:3000/api/v1/courses | head -40

echo
echo "### 10. LOCAL API ROOT"
curl -sS -i --max-time 10 \
http://127.0.0.1:3000/ | head -30

echo
echo "### 11. API ERRORS"
docker logs --tail=100 algonaid-api-api-1 2>&1 \
| grep -E 'P1000|28P01|AuthenticationFailed|password authentication failed|ERROR|Exception' \
| tail -50

echo
echo "### 12. POSTGRES ERRORS"
docker logs --tail=100 algonaid-api-db-1 2>&1 \
| grep -E 'FATAL|password authentication failed|ERROR' \
| tail -30

echo
echo "### 13. DATABASES"
docker exec algonaid-api-db-1 \
psql -U postgres -d postgres -tAc \
"SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;"

echo
echo "### 14. DISK"
df -h /

echo
echo "### 15. MEMORY"
free -h

echo
echo "### 16. VOLUME"
docker volume inspect algonaid-api_postgres_data \
--format '{{.Name}} -> {{.Mountpoint}}'

echo
echo "=================================================="
echo " END OF DIAGNOSTIC"
echo "=================================================="
