#!/bin/bash

set -u

PROJECT="/root/algonaid-api"
API="algonaid-api-api-1"
DB="algonaid-api-db-1"
BACKUP_DIR="$PROJECT/db-backups"

cd "$PROJECT" || exit 1

echo "=================================================="
echo " ALGONAID API / DATABASE REPAIR"
echo " $(date)"
echo "=================================================="

echo
echo "### 1. BACKUP .env"
cp .env ".env.backup-$(date +%Y%m%d-%H%M%S)"
echo "OK"

echo
echo "### 2. FIX .env LINE ENDINGS"
sed -i 's/\r$//' .env
file .env

echo
echo "### 3. LOAD ENV"
set -a
source .env
set +a

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "ERROR: POSTGRES_PASSWORD is empty"
    exit 1
fi

echo "POSTGRES_USER=${POSTGRES_USER:-missing}"
echo "POSTGRES_DB=${POSTGRES_DB:-missing}"

echo
echo "### 4. DATABASE HEALTH"
docker exec "$DB" pg_isready -U postgres

if [ $? -ne 0 ]; then
    echo "ERROR: PostgreSQL is not healthy"
    exit 1
fi

echo
echo "### 5. DATABASE AUTHENTICATION TEST"
docker exec \
    -e PGPASSWORD="$POSTGRES_PASSWORD" \
    "$DB" \
    psql -h 127.0.0.1 \
         -U postgres \
         -d algonaid \
         -v ON_ERROR_STOP=1 \
         -c "SELECT current_database(), current_user;"

if [ $? -ne 0 ]; then
    echo
    echo "ERROR: .env password does not authenticate against PostgreSQL."
    echo "STOPPING. No containers were recreated."
    exit 1
fi

echo
echo "### 6. DATABASE BACKUP"
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/algonaid-before-api-repair-$(date +%Y%m%d-%H%M%S).dump"

docker exec "$DB" \
    pg_dump -U postgres -d algonaid -Fc \
    > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo "ERROR: Database backup failed."
    exit 1
fi

echo "Backup created:"
ls -lh "$BACKUP_FILE"

echo
echo "### 7. CURRENT API ENV"
docker inspect "$API" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep '^DATABASE_URL=' \
    | sed -E 's#(postgresql://[^:]+:)[^@]+@#\1****@'

echo
echo "### 8. RECREATE API ONLY"
echo "PostgreSQL will NOT be recreated."
echo "PostgreSQL volume will NOT be deleted."

docker compose up -d --build --no-deps --force-recreate api

if [ $? -ne 0 ]; then
    echo "ERROR: API recreation failed."
    exit 1
fi

echo
echo "### 9. WAIT FOR API"
sleep 8

echo
echo "### 10. CONTAINER STATUS"
docker compose ps

echo
echo "### 11. NEW API ENV"
docker inspect "$API" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep '^DATABASE_URL=' \
    | sed -E 's#(postgresql://[^:]+:)[^@]+@#\1****@'

echo
echo "### 12. API -> DATABASE NETWORK"
docker exec "$API" getent hosts db

echo
echo "### 13. DATABASE PORT"
docker exec "$API" sh -c '
if command -v nc >/dev/null 2>&1; then
    nc -vz db 5432
else
    echo "nc not installed; skipping port test"
fi
' 2>&1

echo
echo "### 14. LOCAL API TEST"
curl -sS -i --max-time 15 \
    http://127.0.0.1:3000/api/v1/courses \
    | head -50

echo
echo "### 15. API DATABASE ERRORS"
docker logs --tail=100 "$API" 2>&1 \
    | grep -E \
      'P1000|28P01|AuthenticationFailed|password authentication failed|PrismaClient|ERROR|Exception' \
    | tail -50

echo
echo "### 16. POSTGRES ERRORS AFTER REPAIR"
docker logs --since=2m "$DB" 2>&1 \
    | grep -E \
      'FATAL|password authentication failed|ERROR' \
    | tail -30

echo
echo "### 17. FINAL STATUS"
docker compose ps

echo
echo "=================================================="
echo " REPAIR COMPLETE"
echo "=================================================="
echo
echo "Database backup:"
echo "$BACKUP_FILE"
echo
echo "IMPORTANT:"
echo "PostgreSQL volume was NOT deleted."
echo "=================================================="
