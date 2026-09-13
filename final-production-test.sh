#!/bin/bash

echo "=================================================="
echo " ALGONAID PRODUCTION FINAL TEST"
echo " $(date)"
echo "=================================================="

echo
echo "### 1. CONTAINER"
docker compose ps

echo
echo "### 2. LOCAL API ROOT"
curl -sS -i --max-time 10 \
  http://127.0.0.1:3000/ | head -20

echo
echo "### 3. COURSES API"
curl -sS -i --max-time 15 \
  http://127.0.0.1:3000/api/v1/courses | head -40

echo
echo "### 4. MODULES API"
curl -sS -i --max-time 15 \
  http://127.0.0.1:3000/api/v1/modules | head -40

echo
echo "### 5. API BASE"
curl -sS -i --max-time 10 \
  http://127.0.0.1:3000/api/v1 | head -30

echo
echo "### 6. PUBLIC DOMAIN"
curl -sS -i --max-time 15 \
  https://api.exchangesmangement.online/api/v1/courses | head -40

echo
echo "### 7. RECENT API ERRORS"
docker logs --since=5m algonaid-api-api-1 2>&1 \
  | grep -Ei 'ERROR|Exception|P1000|28P01|fatal|crash' \
  | tail -30

echo
echo "=================================================="
echo " FINAL TEST COMPLETE"
echo "=================================================="
