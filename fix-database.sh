#!/bin/bash
set -e

echo "=========================================="
echo " ALGONAID DATABASE SETUP"
echo "=========================================="

echo
echo "1) Checking database..."

DB_EXISTS=$(docker exec algonaid-api-db-1 \
  psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='algonaid';")

if [ "$DB_EXISTS" = "1" ]; then
    echo "Database 'algonaid' already exists."
else
    echo "Creating database 'algonaid'..."
    docker exec algonaid-api-db-1 \
      psql -U postgres -c "CREATE DATABASE algonaid;"
    echo "Database created successfully."
fi

echo
echo "2) Checking Prisma migrations..."
echo "Migration folders:"
find prisma/migrations -mindepth 1 -maxdepth 1 -type d | sort

echo
echo "3) Applying Prisma migrations..."
docker exec algonaid-api-api-1 npx prisma migrate deploy

echo
echo "4) Checking migration status..."
docker exec algonaid-api-api-1 npx prisma migrate status

echo
echo "5) Listing created tables..."
docker exec algonaid-api-db-1 \
  psql -U postgres -d algonaid -c '\dt'

echo
echo "6) Checking Prisma migration history..."
docker exec algonaid-api-db-1 \
  psql -U postgres -d algonaid \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;"

echo
echo "7) Restarting API..."
docker restart algonaid-api-api-1

echo
echo "8) Waiting for API..."
sleep 5

echo
echo "9) Testing API..."
curl -i http://localhost:3000/api/v1/courses

echo
echo "=========================================="
echo " DATABASE SETUP FINISHED"
echo "=========================================="
