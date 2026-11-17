#!/usr/bin/env bash
# Fonctions communes aux scripts d'exploitation. À lancer depuis n'importe où : on se place à la racine du dépôt (là où est docker-compose.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Valeurs par défaut identiques à docker-compose.yml ; .env les surcharge. On ne « source » pas .env (un mot de passe peut contenir $ ou #) :
# on lit seulement les trois clés utiles.
env_value() {
  local key="$1" default="$2" line
  if [ -f .env ]; then
    line="$(grep -E "^${key}=" .env | tail -n 1 || true)"
    if [ -n "$line" ]; then
      line="${line#*=}"
      line="${line%\"}"; line="${line#\"}"
      [ -n "$line" ] && { printf '%s' "$line"; return; }
    fi
  fi
  printf '%s' "$default"
}

DB_USER="${DB_USER:-$(env_value DB_USER sanjeevani)}"
DB_NAME="${DB_NAME:-$(env_value DB_NAME sanjeevani)}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

# Les commandes de la base passent par le conteneur `db` : aucun client PostgreSQL n'est requis sur le serveur.
dbx() { docker compose exec -T db "$@"; }
psql_db() { dbx psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"; }

die() { echo "ERREUR : $*" >&2; exit 1; }

require_db() {
  docker compose ps --status running --services 2>/dev/null | grep -qx db || die "le conteneur « db » ne tourne pas (docker compose up -d)."
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}
