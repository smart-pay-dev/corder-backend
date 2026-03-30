#!/usr/bin/env bash
# Geliştirme ortamında önce PostgreSQL'i, sonra API'yi başlatır.
# PostgreSQL için Docker gerekir: Docker Desktop'ı açın, sonra bu script'i çalıştırın.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "→ CORDER Backend - Geliştirme"
echo ""

# Port 5432'de PostgreSQL var mı?
if command -v nc >/dev/null 2>&1; then
  if nc -z localhost 5432 2>/dev/null; then
    echo "→ PostgreSQL zaten çalışıyor (localhost:5432)."
  else
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      echo "→ PostgreSQL Docker ile başlatılıyor..."
      docker compose -f docker-compose.dev.yml up -d
      echo "→ Birkaç saniye bekleniyor..."
      sleep 5
    else
      echo "HATA: PostgreSQL çalışmıyor ve Docker erişilemiyor."
      echo "  - Docker Desktop'ı açın"
      echo "  - Veya yerel PostgreSQL kurun (port 5432, kullanıcı: corder, şifre: corder_secret, DB: corder)"
      echo "  - Sonra: docker compose -f docker-compose.dev.yml up -d"
      exit 1
    fi
  fi
else
  echo "→ (nc yok, PostgreSQL kontrolü atlanıyor; hata alırsanız DB'yi başlatın.)"
fi

echo "→ Backend başlatılıyor (port 4000)..."
echo ""
exec pnpm run start:dev
