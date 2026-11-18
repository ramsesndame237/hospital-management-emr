#!/usr/bin/env bash
# Prouve qu'une sauvegarde se restaure, SANS toucher à la base de production : restaure dans une base temporaire du même serveur, compare
# le nombre de lignes de chaque table et la fin de la chaîne d'audit avec la base en service, puis supprime la base temporaire.
#   ops/restore-test.sh                      # la sauvegarde la plus récente de ./backups
#   ops/restore-test.sh backups/xxx.dump     # une sauvegarde précise
# À lancer après chaque nouvelle sauvegarde importante, et au moins une fois par mois (une sauvegarde jamais restaurée n'est pas une sauvegarde).
# Si la base a changé depuis la sauvegarde (nouvelles lignes), les écarts sont signalés : c'est normal pour une base vivante.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_db
file="${1:-}"
if [ -z "$file" ]; then
  file="$(ls -1t "$BACKUP_DIR"/sanjeevani-*.dump 2>/dev/null | head -n 1 || true)"
  [ -n "$file" ] || die "aucune sauvegarde dans $BACKUP_DIR (lancer ops/backup.sh)."
fi
[ -f "$file" ] || die "fichier introuvable : $file"
if [ -f "$file.sha256" ]; then
  [ "$(sha256_of "$file")" = "$(cut -d' ' -f1 "$file.sha256")" ] || die "l'empreinte SHA-256 ne correspond pas."
fi

scratch="${DB_NAME}_restore_test"
cleanup() { psql_db -d postgres -q -c "DROP DATABASE IF EXISTS \"$scratch\" WITH (FORCE)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Sauvegarde testée : $file"
psql_db -d postgres -q -c "DROP DATABASE IF EXISTS \"$scratch\" WITH (FORCE)" -c "CREATE DATABASE \"$scratch\""
docker compose exec -T db pg_restore -U "$DB_USER" -d "$scratch" --no-owner --exit-on-error < "$file"

# Une ligne par table : « table<TAB>nombre de lignes » (comptage exact, pas une estimation).
counts_sql="SELECT format('%s|%s', table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1"
live="$(psql_db -d "$DB_NAME" -At -c "$counts_sql" | tr -d '\r')"
restored="$(psql_db -d "$scratch" -At -c "$counts_sql" | tr -d '\r')"

tables="$(printf '%s\n' "$restored" | grep -c . || true)"
[ "$tables" -gt 0 ] || die "la base restaurée ne contient aucune table."

audit_sql="SELECT coalesce((SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1), 'vide')"
audit_live="$(psql_db -d "$DB_NAME" -At -c "$audit_sql" | tr -d '\r')"
audit_restored="$(psql_db -d "$scratch" -At -c "$audit_sql" | tr -d '\r')"

# Chaîne d'audit rejouée dans la base restaurée : chaque ligne doit pointer vers le hachage de la précédente.
broken="$(psql_db -d "$scratch" -At -c "SELECT count(*) FROM (SELECT prev_hash, lag(hash) OVER (ORDER BY id) AS before FROM audit_log) t WHERE before IS NOT NULL AND prev_hash <> before" | tr -d '\r')"
[ "$broken" = "0" ] || die "chaîne d'audit rompue dans la sauvegarde ($broken maillon(s))."

echo "Tables restaurées : $tables"
diff_out="$(diff <(printf '%s\n' "$live") <(printf '%s\n' "$restored") || true)"
if [ -z "$diff_out" ] && [ "$audit_live" = "$audit_restored" ]; then
  echo "Identique à la base en service (lignes de toutes les tables et fin de la chaîne d'audit)."
else
  echo "Différences avec la base en service (attendues si des données ont été saisies depuis la sauvegarde) :"
  printf '%s\n' "$diff_out" | sed 's/^/  /'
  [ "$audit_live" = "$audit_restored" ] || echo "  fin de la chaîne d'audit : différente"
fi
echo "Chaîne d'audit de la sauvegarde : intacte."
echo "Test de restauration réussi."
