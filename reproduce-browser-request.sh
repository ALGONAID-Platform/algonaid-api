#!/bin/bash

DOMAIN="https://api.exchangesmangement.online"

echo "=================================================="
echo " REPRODUCE BROWSER REQUEST"
echo "=================================================="

echo
echo "### 1. NORMAL CURL"
curl -sS -i --max-time 10 \
  "$DOMAIN/api/v1/modules" | head -30

echo
echo "### 2. BROWSER USER-AGENT"
curl -sS -i --max-time 10 \
  -A "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36" \
  "$DOMAIN/api/v1/modules" | head -30

echo
echo "### 3. BROWSER ORIGIN"
curl -sS -i --max-time 10 \
  -A "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36" \
  -H "Origin: http://localhost:5173" \
  -H "Referer: http://localhost:5173/" \
  "$DOMAIN/api/v1/modules" | head -30

echo
echo "### 4. PREFLIGHT"
curl -sS -i --max-time 10 \
  -X OPTIONS \
  -A "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  "$DOMAIN/api/v1/modules" | head -40

echo
echo "### 5. NGINX FULL SERVER BLOCK"
nginx -T 2>&1 \
 | sed -n '/server_name api.exchangesmangement.online;/,/^[[:space:]]*}/p' \
 | head -220

echo
echo "### 6. NGINX POSSIBLE CACHE / INTERCEPT RULES"
nginx -T 2>&1 \
 | grep -nE \
 'proxy_cache|proxy_intercept_errors|error_page|return 404|if \(|map |limit_req|rewrite ' \
 | head -150

echo
echo "### 7. LAST BROWSER REQUESTS"
grep -E \
'/api/v1/(modules|exams)' \
/var/log/nginx/access.log \
| tail -30

echo
echo "=================================================="
echo " END"
echo "=================================================="
