#!/usr/bin/env bash
# Restaure une sauvegarde dans la base de production : DESTRUCTIF (remplace tout le contenu actuel).
#   ops/restore.sh backups/sanjeevani-20261118-020000.dump --yes
# Sans --yes, le script s'arrête avant de toucher à quoi que ce soit. Pour répéter la procédure sans risque : ops/restore-test.sh.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

file="${1:-}"
confirm="${2:-}"
[ -n "$file" ] || die "usage : ops/restore.sh <fichier.dump> --yes"
[ -f "$file" ] || die "fichier introuvable : $file"
[ "$confirm" = "--yes" ] || die "restauration DESTRUCTIVE de la base « $DB_NAME » : relancer avec --yes pour confirmer."

if [ -f "$file.sha256" ]; then
  expected="$(cut -d' ' -f1 "$file.sha256")"
  [ "$(sha256_of "$file")" = "$expected" ] || die "l'empreinte SHA-256 ne correspond pas : fichier altéré ou incomplet."
  echo "Empreinte vérifiée."
else
  echo "Attention : pas de fichier .sha256 à côté de la sauvegarde, intégrité non vérifiée."
fi

require_db
# Plus personne n'écrit pendant la restauration : on arrête l'interface et l'API, et on se souvient de ce qui tournait.
was_running="$(docker compose ps --status running --services | grep -E '^(web|api)$' || true)"
[ -z "$was_running" ] || docker compose stop web api

echo "Restauration de « $DB_NAME »…"
# --clean --if-exists : supprime les objets avant de les recréer ; --single-transaction : tout ou rien.
docker compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --single-transaction --exit-on-error < "$file"

echo "Redémarrage (l'API rejoue le schéma et met la base à niveau si la sauvegarde est plus ancienne)…"
# shellcheck disable=SC2086
[ -z "$was_running" ] || docker compose start api web
echo "Restauration terminée. Vérifier : docker compose ps, puis se connecter."
echo "Rappel : SECRET_ENCRYPTION_KEY de .env doit être celle du serveur d'origine."
