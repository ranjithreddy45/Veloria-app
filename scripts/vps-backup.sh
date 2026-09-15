#!/usr/bin/env bash
# ============================================================
# Nightly Postgres backup of the Veloria database (Neon) from the VPS.
# Cron: scripts/vps-backup-cron.txt (03:30 IST).
#
#   pg_dump runs in a throwaway postgres container on the host network (this
#   box's Docker bridge has no DNS — same trick as scripts/deploy-vps.sh), is
#   gzipped to  $BACKUP_DIR/veloria-YYYY-MM-DD.sql.gz  (date in IST), verified
#   (gzip integrity + the dump's own "dump complete" trailer + a size floor),
#   then old files are pruned: keep the last 14 daily + 8 weekly (Sunday) dumps.
#   Any failure alerts through scripts/vps-alert-lib.sh and exits non-zero.
#
#   Restore: scripts/vps-restore.md
#
# Config (from /opt/veloria/.env.production, KEY=value lines only):
#   DATABASE_URL_UNPOOLED   direct Neon URL (falls back to POSTGRES_URL_NON_POOLING,
#                           then DATABASE_URL — the pooler works for pg_dump too)
#   BACKUP_DIR              default /var/backups/veloria
#   PG_IMAGE                default postgres:16-alpine. pg_dump's major version
#                           must be >= the server's: if the Neon project is
#                           PG17, set postgres:17-alpine or the dump refuses.
#   ENV_FILE                default /opt/veloria/.env.production
#
#   vps-backup.sh --prune-only   apply retention without dumping (safe to test)
# ============================================================
set -uo pipefail
umask 077   # dumps hold customer + financial data: owner-only

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=vps-alert-lib.sh
. "$HERE/vps-alert-lib.sh" || { echo "vps-alert-lib.sh missing next to $0" >&2; exit 1; }

ENV_FILE="${ENV_FILE:-/opt/veloria/.env.production}"
[ -r "$ENV_FILE" ] && load_env_file "$ENV_FILE"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/veloria}"
PG_IMAGE="${PG_IMAGE:-postgres:16-alpine}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
MIN_BYTES="${MIN_BYTES:-10240}"   # a real dump of this schema is far larger than 10 KB
BACKUP_TZ="Asia/Kolkata"
PRUNE_ONLY=0; [ "${1:-}" = "--prune-only" ] && PRUNE_ONLY=1

fail() {
  log "BACKUP FAILED: $*"
  send_alert "[BACKUP FAILED] Veloria database backup" "$*"$'\n'"Log: /var/log/veloria-backup.log" || true
  exit 1
}

# Calendar-date → epoch at local MIDNIGHT (explicit 00:00:00 so neither GNU
# nor BSD date fills in the current time of day); ages are then rounded to
# whole days, which also absorbs a DST hour. GNU date on the VPS; the BSD
# fallback keeps the script testable on a Mac.
epoch_of() {
  date -d "$1 00:00:00" +%s 2>/dev/null \
    || date -j -f '%Y-%m-%d %H:%M:%S' "$1 00:00:00" +%s
}
dow_of() {   # 7 = Sunday
  date -d "$1 00:00:00" +%u 2>/dev/null \
    || date -j -f '%Y-%m-%d %H:%M:%S' "$1 00:00:00" +%u
}

mkdir -p "$BACKUP_DIR" || fail "cannot create $BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

# Never let two runs overlap (a hung dump + the next night's cron).
if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_DIR/.lock"
  flock -n 9 || { log "another backup is still running — skipping"; exit 0; }
fi

today="$(TZ=$BACKUP_TZ date +%F)"

# ---- dump -------------------------------------------------------------------
if [ "$PRUNE_ONLY" = 0 ]; then
  URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL:-}}}"
  [ -n "$URL" ] || fail "no DATABASE_URL_UNPOOLED / DATABASE_URL in $ENV_FILE"
  command -v docker >/dev/null 2>&1 || fail "docker not found on PATH ($PATH)"

  out="$BACKUP_DIR/veloria-$today.sql.gz"
  tmp="$out.part"
  trap 'rm -f "$tmp"' EXIT

  docker image inspect "$PG_IMAGE" >/dev/null 2>&1 || docker pull -q "$PG_IMAGE" >/dev/null 2>&1 \
    || fail "could not pull $PG_IMAGE"

  log "dumping to $out via $PG_IMAGE …"
  start="$(date +%s)"
  # The URL is handed to the container from the environment (`-e NAME`, no
  # value) so it never appears in docker's argv / `ps`.
  export PGDUMP_URL="$URL"
  docker run --rm --network host -e PGDUMP_URL "$PG_IMAGE" \
      sh -c 'exec pg_dump --no-owner --no-privileges --format=plain --encoding=UTF8 --dbname="$PGDUMP_URL"' \
    2>"$BACKUP_DIR/.pg_dump.err" | gzip -6 > "$tmp"
  dump_rc="${PIPESTATUS[0]}"
  unset PGDUMP_URL
  if [ "$dump_rc" != 0 ]; then
    fail "pg_dump exited $dump_rc — $(head -c 400 "$BACKUP_DIR/.pg_dump.err" | tr '\n' ' ')"
  fi
  rm -f "$BACKUP_DIR/.pg_dump.err"

  # ---- verify ---------------------------------------------------------------
  gzip -t "$tmp" 2>/dev/null || fail "gzip integrity check failed for $tmp"
  bytes="$(stat -c %s "$tmp" 2>/dev/null || stat -f %z "$tmp")"
  [ "$bytes" -ge "$MIN_BYTES" ] || fail "dump is only $bytes bytes (< $MIN_BYTES) — almost certainly empty"
  gzip -dc "$tmp" | tail -n 5 | grep -q 'PostgreSQL database dump complete' \
    || fail "dump is missing the 'dump complete' trailer — pg_dump was cut off"

  mv -f "$tmp" "$out"
  trap - EXIT
  human="$(du -h "$out" | cut -f1)"
  log "OK $out ($human, $bytes bytes, $(( $(date +%s) - start ))s)"
fi

# ---- retention: 14 daily + 8 weekly (Sunday) ---------------------------------
today_epoch="$(epoch_of "$today")"
kept=0; pruned=0
for f in "$BACKUP_DIR"/veloria-????-??-??.sql.gz; do
  [ -e "$f" ] || continue
  d="${f##*/veloria-}"; d="${d%.sql.gz}"
  fe="$(epoch_of "$d" 2>/dev/null)" || { log "skip unparseable $f"; continue; }
  age=$(( (today_epoch - fe + 43200) / 86400 ))   # rounded whole days
  if [ "$age" -lt "$KEEP_DAILY" ]; then
    kept=$((kept + 1))
  elif [ "$(dow_of "$d")" = 7 ] && [ "$age" -lt $((KEEP_WEEKLY * 7)) ]; then
    kept=$((kept + 1))
  else
    rm -f "$f" && pruned=$((pruned + 1)) && log "pruned $f (${age}d old)"
  fi
done
log "retention: $kept kept, $pruned pruned; free space: $(df -h "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
