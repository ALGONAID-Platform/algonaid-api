#!/bin/bash
set -e

cd /root/algonaid-api

echo "=== BACKUP COMPOSE ==="
cp docker-compose.yml "docker-compose.yml.backup-$(date +%Y%m%d-%H%M%S)"

echo "=== CURRENT API COMMAND ==="
grep -n -A15 -B3 'api:' docker-compose.yml

echo
echo "=== REMOVE OLD ENTRYPOINT COMMAND IF PRESENT ==="

python3 - <<'PY'
from pathlib import Path

p = Path("docker-compose.yml")
s = p.read_text()

# Remove an existing command under the API service if it exists.
lines = s.splitlines()
out = []
in_api = False
skip_command = False

for line in lines:
    if line.startswith("  api:"):
        in_api = True
        skip_command = False
        out.append(line)
        continue

    if in_api and line.startswith("  db:"):
        in_api = False
        skip_command = False
        out.append(line)
        continue

    if in_api and line.startswith("    command:"):
        skip_command = True
        continue

    if in_api and skip_command:
        # Skip continuation lines belonging to a YAML list/string command.
        if line.startswith("      ") or line.strip() == "":
            continue
        skip_command = False

    out.append(line)

# Add a clean command directly after the API environment section.
# If the compose already has an API environment block, insert before volumes.
text = "\n".join(out) + "\n"

needle = "    volumes:\n"
if "    command: npm run start:dev\n" not in text:
    text = text.replace(
        needle,
        "    command: npm run start:dev\n" + needle,
        1
    )

p.write_text(text)
PY

echo "=== NEW API COMMAND ==="
grep -n -A12 -B3 'api:' docker-compose.yml

echo
echo "=== RECREATE API ==="
docker compose up -d --build --force-recreate --no-deps api

echo
echo "=== WAIT ==="
sleep 12

echo
echo "=== STATUS ==="
docker compose ps

echo
echo "=== API STATE ==="
docker inspect algonaid-api-api-1 --format='
Status={{.State.Status}}
Running={{.State.Running}}
Restarting={{.State.Restarting}}
RestartCount={{.RestartCount}}
ExitCode={{.State.ExitCode}}
Error={{.State.Error}}
'

echo
echo "=== API LOGS ==="
docker logs --tail=120 algonaid-api-api-1 2>&1

echo
echo "=== PORT 3000 ==="
curl -i --max-time 10 http://127.0.0.1:3000/ || true

echo
echo "=== COURSES ==="
curl -i --max-time 10 \
  http://127.0.0.1:3000/api/v1/courses || true

echo
echo "=== DATABASE ==="
docker exec algonaid-api-db-1 pg_isready -U postgres

echo
echo "=== DONE ==="
