#!/bin/bash

set -Eeuo pipefail

PROJECT="/root/algonaid-api"
COMPOSE="$PROJECT/docker-compose.yml"
API="algonaid-api-api-1"
DB="algonaid-api-db-1"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/algonaid-repair-backups/storage-repair-$STAMP"

mkdir -p "$BACKUP"

echo "============================================================"
echo " ALGONAID SAFE STORAGE REPAIR"
echo "============================================================"
echo "Date: $(date)"
echo "Backup: $BACKUP"
echo

cd "$PROJECT"

# ------------------------------------------------------------
# 1. PRE-CHECK
# ------------------------------------------------------------

echo "============================================================"
echo "1. PRE-CHECK"
echo "============================================================"

if [ ! -f "$COMPOSE" ]; then
    echo "ERROR: docker-compose.yml not found."
    exit 1
fi

mkdir -p "$PROJECT/uploads"

echo "--- Current uploads ---"
UPLOAD_SIZE_BEFORE="$(du -sh "$PROJECT/uploads" | awk '{print $1}')"
UPLOAD_COUNT_BEFORE="$(find "$PROJECT/uploads" -type f 2>/dev/null | wc -l)"

echo "Path: $PROJECT/uploads"
echo "Size: $UPLOAD_SIZE_BEFORE"
echo "Files: $UPLOAD_COUNT_BEFORE"

echo
echo "--- Containers ---"
docker compose ps

# ------------------------------------------------------------
# 2. BACKUP COMPOSE
# ------------------------------------------------------------

echo
echo "============================================================"
echo "2. BACKUP COMPOSE"
echo "============================================================"

cp -a "$COMPOSE" "$BACKUP/docker-compose.yml"

echo "Compose backup created."

# ------------------------------------------------------------
# 3. BACKUP UPLOADS
# ------------------------------------------------------------

echo
echo "============================================================"
echo "3. BACKUP UPLOADS"
echo "============================================================"

tar -czf "$BACKUP/uploads.tar.gz" -C "$PROJECT" uploads

echo "Uploads backup:"
ls -lh "$BACKUP/uploads.tar.gz"

# Verify archive
echo
echo "--- Upload archive test ---"
tar -tzf "$BACKUP/uploads.tar.gz" >/dev/null

echo "Uploads archive verified."

# ------------------------------------------------------------
# 4. DATABASE BACKUP
# ------------------------------------------------------------

echo
echo "============================================================"
echo "4. DATABASE BACKUP"
echo "============================================================"

DB_PASSWORD="$(
    docker compose exec -T db sh -c 'printf "%s" "$POSTGRES_PASSWORD"'
)"

if [ -z "$DB_PASSWORD" ]; then
    echo "ERROR: PostgreSQL password is empty."
    exit 1
fi

docker compose exec -T \
    -e PGPASSWORD="$DB_PASSWORD" \
    db \
    pg_dump \
    -U postgres \
    -d algonaid \
    -Fc \
    > "$BACKUP/database.dump"

if [ ! -s "$BACKUP/database.dump" ]; then
    echo "ERROR: Database backup is empty."
    exit 1
fi

echo "Database backup created:"
ls -lh "$BACKUP/database.dump"

# ------------------------------------------------------------
# 5. DATABASE SIZE / TABLE COUNT BEFORE
# ------------------------------------------------------------

echo
echo "============================================================"
echo "5. DATABASE SNAPSHOT"
echo "============================================================"

docker compose exec -T \
    -e PGPASSWORD="$DB_PASSWORD" \
    db \
    psql -U postgres -d algonaid -c \
    "SELECT pg_size_pretty(pg_database_size('algonaid')) AS database_size;"

docker compose exec -T \
    -e PGPASSWORD="$DB_PASSWORD" \
    db \
    psql -U postgres -d algonaid -c \
    "SELECT COUNT(*) AS table_count
     FROM information_schema.tables
     WHERE table_schema='public'
     AND table_type='BASE TABLE';"

# ------------------------------------------------------------
# 6. ENSURE EXPLICIT UPLOADS MOUNT
# ------------------------------------------------------------

echo
echo "============================================================"
echo "6. ENSURE EXPLICIT UPLOADS MOUNT"
echo "============================================================"

python3 <<'PY'
from pathlib import Path
import re

compose = Path("/root/algonaid-api/docker-compose.yml")
text = compose.read_text()

# Already present?
if re.search(
    r'^\s*-\s*[\'"]?\.\/uploads:/usr/src/app/uploads[\'"]?\s*$',
    text,
    re.MULTILINE
):
    print("Explicit uploads mount already exists.")
    raise SystemExit(0)

# Add explicit mount immediately after the project mount.
pattern = r'(^\s*-\s*\.:/usr/src/app\s*$)'

replacement = r'\1\n      - ./uploads:/usr/src/app/uploads'

new_text, count = re.subn(
    pattern,
    replacement,
    text,
    count=1,
    flags=re.MULTILINE
)

if count != 1:
    print("ERROR: Could not safely locate project volume.")
    raise SystemExit(1)

compose.write_text(new_text)

print("Added explicit uploads bind mount.")
PY

echo
echo "--- New API volumes ---"
awk '
/^[[:space:]]*api:/ {inside=1}
inside && /^[[:space:]]*db:/ {inside=0}
inside {print}
' docker-compose.yml | grep -A8 "volumes:" || true

# ------------------------------------------------------------
# 7. COMPOSE CONFIG VALIDATION
# ------------------------------------------------------------

echo
echo "============================================================"
echo "7. VALIDATE COMPOSE"
echo "============================================================"

docker compose config >/dev/null

echo "Compose configuration is valid."

# ------------------------------------------------------------
# 8. RECREATE API ONLY
# ------------------------------------------------------------

echo
echo "============================================================"
echo "8. RECREATE API ONLY"
echo "============================================================"

docker compose up -d --build api

echo
echo "Waiting for API..."
sleep 10

# ------------------------------------------------------------
# 9. CONTAINER STATUS
# ------------------------------------------------------------

echo
echo "============================================================"
echo "9. CONTAINER STATUS"
echo "============================================================"

docker compose ps

# ------------------------------------------------------------
# 10. VERIFY UPLOADS ON HOST
# ------------------------------------------------------------

echo
echo "============================================================"
echo "10. VERIFY HOST UPLOADS"
echo "============================================================"

UPLOAD_SIZE_AFTER="$(du -sh "$PROJECT/uploads" | awk '{print $1}')"
UPLOAD_COUNT_AFTER="$(find "$PROJECT/uploads" -type f 2>/dev/null | wc -l)"

echo "Before:"
echo "  Size : $UPLOAD_SIZE_BEFORE"
echo "  Files: $UPLOAD_COUNT_BEFORE"

echo
echo "After:"
echo "  Size : $UPLOAD_SIZE_AFTER"
echo "  Files: $UPLOAD_COUNT_AFTER"

if [ "$UPLOAD_COUNT_BEFORE" != "$UPLOAD_COUNT_AFTER" ]; then
    echo
    echo "WARNING: File count changed!"
    echo "STOPPING verification."
    exit 1
fi

echo "Upload file count preserved."

# ------------------------------------------------------------
# 11. VERIFY UPLOADS INSIDE CONTAINER
# ------------------------------------------------------------

echo
echo "============================================================"
echo "11. VERIFY CONTAINER UPLOADS"
echo "============================================================"

docker compose exec -T api sh -c '
echo "Upload directory:"
ls -ld /usr/src/app/uploads

echo
echo "Size:"
du -sh /usr/src/app/uploads

echo
echo "Files:"
find /usr/src/app/uploads -type f 2>/dev/null | head -50
'

# ------------------------------------------------------------
# 12. VERIFY MOUNT
# ------------------------------------------------------------

echo
echo "============================================================"
echo "12. VERIFY DOCKER MOUNT"
echo "============================================================"

docker inspect "$API" \
    --format '{{range .Mounts}}TYPE={{.Type}} SOURCE={{.Source}} DESTINATION={{.Destination}}{{"\n"}}{{end}}'

# ------------------------------------------------------------
# 13. VERIFY DATABASE
# ------------------------------------------------------------

echo
echo "============================================================"
echo "13. VERIFY DATABASE"
echo "============================================================"

docker compose exec -T \
    -e PGPASSWORD="$DB_PASSWORD" \
    db \
    pg_isready -U postgres -d algonaid

docker compose exec -T \
    -e PGPASSWORD="$DB_PASSWORD" \
    db \
    psql -U postgres -d algonaid -c \
    "SELECT COUNT(*) AS lesson_count FROM \"Lesson\";"

# ------------------------------------------------------------
# 14. VERIFY API
# ------------------------------------------------------------

echo
echo "============================================================"
echo "14. VERIFY API"
echo "============================================================"

echo "--- API root ---"
curl -sS -i --max-time 10 \
    http://127.0.0.1:3000/ \
    | head -30 || true

echo
echo "--- API lessons ---"
curl -sS -i --max-time 10 \
    http://127.0.0.1:3000/api/v1/lessons \
    | head -40 || true

# ------------------------------------------------------------
# 15. API LOGS
# ------------------------------------------------------------

echo
echo "============================================================"
echo "15. API LOGS"
echo "============================================================"

docker logs --tail 60 "$API" 2>&1

# ------------------------------------------------------------
# 16. BACKUP HASHES
# ------------------------------------------------------------

echo
echo "============================================================"
echo "16. BACKUP INTEGRITY"
echo "============================================================"

sha256sum \
    "$BACKUP/docker-compose.yml" \
    "$BACKUP/uploads.tar.gz" \
    "$BACKUP/database.dump"

# ------------------------------------------------------------
# 17. FINAL RESULT
# ------------------------------------------------------------

echo
echo "============================================================"
echo " REPAIR COMPLETED"
echo "============================================================"

echo "Backup directory:"
echo "$BACKUP"

echo
echo "Current uploads:"
echo "Path : $PROJECT/uploads"
echo "Size : $UPLOAD_SIZE_AFTER"
echo "Files: $UPLOAD_COUNT_AFTER"

echo
echo "IMPORTANT:"
echo "Database backup: $BACKUP/database.dump"
echo "Uploads backup : $BACKUP/uploads.tar.gz"
echo "Compose backup : $BACKUP/docker-compose.yml"

echo
echo "============================================================"
