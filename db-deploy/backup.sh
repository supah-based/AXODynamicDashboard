#!/usr/bin/env bash
set -euo pipefail
umask 077
socket=/run/axo-streams-postgres
database=axo_streams
backup_dir=/var/backups/axo-streams-postgres
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup_dir"
tmp="$backup_dir/.axo-streams-$stamp.dump.tmp"
out="$backup_dir/axo-streams-$stamp.dump"
trap 'rm -f "$tmp"' EXIT
/usr/lib/postgresql/16/bin/pg_dump -h "$socket" -d "$database" --format=custom --no-owner --no-privileges --file="$tmp"
chmod 600 "$tmp"
mv "$tmp" "$out"
trap - EXIT
find "$backup_dir" -maxdepth 1 -type f -name 'axo-streams-*.dump' -mtime +7 -delete
/usr/lib/postgresql/16/bin/pg_restore --list "$out" >/dev/null
printf '%s\n' "$out"
