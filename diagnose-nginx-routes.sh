#!/bin/bash

DOMAIN="api.exchangesmangement.online"

echo "=================================================="
echo " ALGONAID NGINX / ROUTES DIAGNOSTIC"
echo " $(date)"
echo "=================================================="

echo
echo "### 1. EXACT PUBLIC COURSES"
curl -sS -i --max-time 15 \
  "https://$DOMAIN/api/v1/courses" | head -25

echo
echo "### 2. EXACT PUBLIC MODULES"
curl -sS -i --max-time 15 \
  "https://$DOMAIN/api/v1/modules" | head -30

echo
echo "### 3. EXACT PUBLIC EXAMS"
curl -sS -i --max-time 15 \
  "https://$DOMAIN/api/v1/exams" | head -30

echo
echo "### 4. EXACT PUBLIC LESSONS"
curl -sS -i --max-time 15 \
  "https://$DOMAIN/api/v1/lessons" | head -30

echo
echo "### 5. LOCAL MODULES"
curl -sS -i --max-time 10 \
  "http://127.0.0.1:3000/api/v1/modules" | head -30

echo
echo "### 6. LOCAL EXAMS"
curl -sS -i --max-time 10 \
  "http://127.0.0.1:3000/api/v1/exams" | head -30

echo
echo "### 7. NGINX CONFIG"
nginx -T 2>&1 \
  | grep -nE \
  'server_name|proxy_pass|location /api|location /|exchangesmangement' \
  | head -150

echo
echo "### 8. NGINX ERROR LOG"
tail -80 /var/log/nginx/error.log 2>/dev/null || true

echo
echo "### 9. NGINX ACCESS LOG - MODULES"
grep -E '/api/v1/(modules|exams|courses|lessons)' \
  /var/log/nginx/access.log 2>/dev/null \
  | tail -50

echo
echo "### 10. API LOG - MODULES / EXAMS"
docker logs --since=10m algonaid-api-api-1 2>&1 \
  | grep -E '/modules|/exams|404|401|403|500' \
  | tail -80

echo
echo "=================================================="
echo " END"
echo "=================================================="
