#!/bin/bash
set -e

cd /root/algonaid-api

echo "=== 1. تنظيف .env ==="
sed -i 's/\r$//' .env

set -a
source .env
set +a

echo "=== 2. ضبط PostgreSQL password ==="

docker exec \
  -e NEW_PASSWORD="$POSTGRES_PASSWORD" \
  algonaid-api-db-1 \
  sh -c 'psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '\''$NEW_PASSWORD'\'';"'

echo "=== 3. اختبار كلمة المرور ==="

docker exec \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  algonaid-api-db-1 \
  psql -h 127.0.0.1 -U postgres -d algonaid \
  -c "SELECT current_database(), current_user;"

echo "=== 4. إعادة إنشاء API ==="

docker compose up -d --build --force-recreate --no-deps api

echo "=== 5. انتظار API ==="
sleep 15

echo "=== 6. الحالة ==="
docker compose ps

echo "=== 7. API LOGS ==="
docker logs --tail=80 algonaid-api-api-1 2>&1

echo "=== 8. اختبار API ==="
curl -i --max-time 15 \
  http://127.0.0.1:3000/api/v1/courses || true

echo
echo "=== DONE ==="
