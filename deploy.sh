#!/usr/bin/env bash
# Canliya alma. Sunucuda calistirilir: ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

WEB_PORT="${WEB_PORT:-$(grep -E '^WEB_PORT=' .env 2>/dev/null | cut -d= -f2 || true)}"
WEB_PORT="${WEB_PORT:-3006}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${WEB_PORT}/api/health}"

echo "==> Calisma alani kontrolu"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "HATA: commit'siz degisiklik var. Once onu cozun:" >&2
  git status --short >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "HATA: .env yok. 'cp .env.example .env && chmod 600 .env' ile olusturun." >&2
  exit 1
fi

echo "==> Kod cekiliyor"
git pull --ff-only

echo "==> Imajlar derleniyor"
docker compose build

echo "==> Servisler kaldiriliyor"
docker compose up -d --remove-orphans

echo "==> Saglik kontrolu ($HEALTH_URL)"
for _ in $(seq 1 45); do
  if curl -fsS -m 5 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "OK: $HEALTH_URL yanit veriyor"
    docker image prune -f >/dev/null
    echo "==> Deploy tamam"
    exit 0
  fi
  sleep 2
done

echo "HATA: saglik kontrolu gecmedi. Son loglar:" >&2
docker compose logs --tail=50 >&2
exit 1
