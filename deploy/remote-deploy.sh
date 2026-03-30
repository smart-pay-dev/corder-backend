#!/usr/bin/env bash
# Sunucuda çalıştırılır (GitHub Action SSH ile tetikler).
# Depo kökü: bu repo (backend tek başına; alt klasörde backend/ yok).
set -euo pipefail

REPO_ROOT="${DEPLOY_REPO_ROOT:-/opt/corder}"
BRANCH="${DEPLOY_BRANCH:-main}"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-corder}"

cd "$REPO_ROOT"

if [ ! -d .git ]; then
  echo "HATA: $REPO_ROOT bir git deposu değil."
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

if [ ! -f .env ]; then
  echo "HATA: $REPO_ROOT/.env yok. Önce .env.production.example'dan oluşturun."
  exit 1
fi

docker compose build --pull
docker compose up -d --remove-orphans

docker image prune -f >/dev/null 2>&1 || true

echo "OK: $(date -Iseconds) backend güncel."
