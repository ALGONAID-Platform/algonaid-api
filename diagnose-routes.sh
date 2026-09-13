#!/bin/bash

API="algonaid-api-api-1"

echo "=================================================="
echo " ALGONAID ROUTES CHECK"
echo "=================================================="

echo
echo "### 1. COURSES"
curl -sS -i --max-time 10 \
  https://api.exchangemangement.online/api/v1/courses | head -20

echo
echo "### 2. MODULES"
curl -sS -i --max-time 10 \
  https://api.exchangemangement.online/api/v1/modules | head -20

echo
echo "### 3. EXAMS"
curl -sS -i --max-time 10 \
  https://api.exchangemangement.online/api/v1/exams | head -20

echo
echo "### 4. LESSONS"
curl -sS -i --max-time 10 \
  https://api.exchangemangement.online/api/v1/lessons | head -20

echo
echo "### 5. NEST ROUTES FROM LOGS"
docker logs "$API" 2>&1 \
 | grep -E 'Mapped|RouterExplorer|routesResolver' \
 | tail -150

echo
echo "### 6. MODULE/EXAM CONTROLLERS IN SOURCE"
grep -RniE \
  '@Controller|ModulesController|ExamsController' \
  src \
  --include='*.ts' \
  | grep -E 'module|exam|Controller' \
  | head -100

echo
echo "### 7. APP MODULE IMPORTS"
if [ -f src/app.module.ts ]; then
    sed -n '1,260p' src/app.module.ts
fi

echo
echo "### 8. CURRENT API STATUS"
docker compose ps

echo
echo "=================================================="
echo " END"
echo "=================================================="
