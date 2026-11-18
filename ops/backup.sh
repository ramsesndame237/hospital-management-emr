#!/usr/bin/env bash
# Sauvegarde logique de la base (pg_dump, format « custom » compressé) dans ./backups, avec empreinte SHA-256, puis purge des anciennes.
#   ops/backup.sh                    # sauvegarde et purge (14 jours par défaut)
#   BACKUP_KEEP_DAYS=30 ops/backup.sh
#   BACKUP_DIR=/mnt/nas/sanjeevani ops/backup.sh
# À planifier chaque nuit (cron) ET avant chaque mise à jour. La copie HORS du serveur reste à votre charge (docs/deployment/EXPLOITATION.md).
# Ne contient PAS SECRET_ENCRYPTION_KEY : à conserver à part, sinon les comptes à double authentification ne se connectent plus après restauration.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_db
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true
umask 077

stamp="$(date +%Y%m%d-%H%M%S)"
final="$BACKUP_DIR/sanjeevani-$stamp.dump"
partial="$final.partial"

# Écrit dans un fichier provisoire : une sauvegarde interrompue ne ressemble jamais à une sauvegarde valide.
if ! dbx pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --compress=6 --no-owner > "$partial"; then
  rm -f "$partial"
  die "pg_dump a échoué."
fi

# Relecture de la table des matières : détecte un fichier tronqué ou corrompu avant de s'y fier.
if ! docker compose exec -T db pg_restore --list < "$partial" > /dev/null; then
  rm -f "$partial"
  die "la sauvegarde produite est illisible (pg_restore --list a échoué)."
fi

mv "$partial" "$final"
printf '%s  %s\n' "$(sha256_of "$final")" "$(basename "$final")" > "$final.sha256"
echo "Sauvegarde : $final ($(du -h "$final" | cut -f1))"

# Purge : seulement les fichiers de ce dispositif, plus vieux que BACKUP_KEEP_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'sanjeevani-*.dump' -o -name 'sanjeevani-*.dump.sha256' \) -mtime +"$BACKUP_KEEP_DAYS" -print -delete | sed 's/^/Purgée : /'

echo "Rappel : copier ce fichier hors du serveur, et garder SECRET_ENCRYPTION_KEY à part."
