#!/usr/bin/env bash
# Pull latest image and restart Literary Studio container (data volume preserved).
#
# Usage (on server, from repo root):
#   ./deploy/docker/upgrade.sh
#   IMAGE_TAG=2.6.0 ./deploy/docker/upgrade.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_TAG

echo "==> Pull image literarycraft/studio:${IMAGE_TAG}"
docker compose pull studio

echo "==> Recreate container (volume unchanged)"
docker compose up -d --no-build studio

echo "==> Status"
docker compose ps

PORT="${PORT:-8765}"
echo "==> Health check http://127.0.0.1:${PORT}/api/health"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    echo "OK"
    exit 0
  fi
  sleep 3
done

echo "Health check failed — see: docker compose logs -f studio" >&2
exit 1
