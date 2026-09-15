#!/usr/bin/env bash
# ============================================================
# Uptime probe for the Veloria app — run every 5 minutes from host cron
# (scripts/vps-uptime-cron.txt). Hits ${APP_URL}/api/health end-to-end
# (DNS → TLS → reverse proxy → container → database), keeps a tiny state
# file, and alerts ONLY on a transition:
#
#   UP  → DOWN   after FAIL_THRESHOLD consecutive failures (2 = ~10 minutes,
#                so a single slow response or a deploy restart stays quiet)
#   DOWN → UP    on the first healthy probe, with the outage duration
#
# Config comes from /opt/veloria/.env.production via load_env_file (only
# KEY=value lines are read — the file is never executed). Nothing here prints
# a secret. Alert channels: see scripts/vps-alert-lib.sh.
#
# Overrides (env or cron line): APP_URL, ENV_FILE, STATE_DIR, FAIL_THRESHOLD.
# ============================================================
set -uo pipefail   # not -e: a failing curl is data, not a crash

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=vps-alert-lib.sh
. "$HERE/vps-alert-lib.sh" || { echo "vps-alert-lib.sh missing next to $0" >&2; exit 1; }

ENV_FILE="${ENV_FILE:-/opt/veloria/.env.production}"
if [ -r "$ENV_FILE" ]; then load_env_file "$ENV_FILE"; else log "note: $ENV_FILE not readable — probing with defaults, alerts disabled"; fi

APP_URL="${APP_URL:-https://app.theveloriagrand.com}"
URL="${APP_URL%/}/api/health"
STATE_DIR="${STATE_DIR:-/var/lib/veloria}"
STATE="$STATE_DIR/uptime.state"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-2}"
TIMEOUT=15

mkdir -p "$STATE_DIR" 2>/dev/null || { log "cannot create $STATE_DIR (run as root or set STATE_DIR)"; exit 1; }

# ---- previous state (parsed, not sourced) ----------------------------------
STATUS=UP; FAILS=0; SINCE="$(date +%s)"
if [ -f "$STATE" ]; then
  s="$(sed -n 's/^STATUS=//p' "$STATE" | head -1)"; [ -n "$s" ] && STATUS="$s"
  f="$(sed -n 's/^FAILS=//p'  "$STATE" | head -1)"; [[ "$f" =~ ^[0-9]+$ ]] && FAILS="$f"
  t="$(sed -n 's/^SINCE=//p'  "$STATE" | head -1)"; [[ "$t" =~ ^[0-9]+$ ]] && SINCE="$t"
fi

# ---- probe -----------------------------------------------------------------
body="$(mktemp)"; err="$(mktemp)"
trap 'rm -f "$body" "$err"' EXIT
result="$(curl -sS -o "$body" -w '%{http_code} %{time_total}' --max-time "$TIMEOUT" \
  -A "veloria-uptime/1.0" "$URL" 2>"$err")" || true
code="${result%% *}"; secs="${result#* }"
[ -n "$code" ] || code="000"
ms="$(awk -v s="${secs:-0}" 'BEGIN { printf "%d", s * 1000 }')"

ok=0; reason=""
if [ "$code" = "200" ]; then
  if grep -q '"ok":true' "$body"; then ok=1; else reason="HTTP 200 but /api/health reports ok:false (database unreachable?)"; fi
elif [ "$code" = "000" ]; then
  reason="no response within ${TIMEOUT}s — $(head -c 160 "$err" | tr -d '\n')"
else
  reason="HTTP $code"
fi

# ---- transitions -----------------------------------------------------------
now="$(date +%s)"
fmt_dur() { local s=$1; if [ "$s" -ge 3600 ]; then printf '%dh %dm' $((s/3600)) $(((s%3600)/60)); else printf '%dm' $((s/60)); fi; }

if [ "$ok" = 1 ]; then
  if [ "$STATUS" = DOWN ]; then
    send_alert "[UP] Veloria app recovered" \
      "$URL is healthy again (HTTP 200, ${ms} ms). Outage lasted $(fmt_dur $((now - SINCE)))." || true
    SINCE="$now"
  fi
  STATUS=UP; FAILS=0
  log "UP   HTTP $code ${ms}ms $URL"
else
  FAILS=$((FAILS + 1))
  log "FAIL #$FAILS $reason $URL"
  if [ "$STATUS" = UP ] && [ "$FAILS" -ge "$FAIL_THRESHOLD" ]; then
    STATUS=DOWN; SINCE="$now"
    send_alert "[DOWN] Veloria app is not responding" \
      "$URL failed $FAILS consecutive probes (every 5 min). Last result: $reason."$'\n'"Check: docker logs veloria-app --tail 100 · systemctl status nginx · Neon status." || true
  fi
fi

printf 'STATUS=%s\nFAILS=%s\nSINCE=%s\nCHECKED=%s\nURL=%s\n' "$STATUS" "$FAILS" "$SINCE" "$now" "$URL" > "$STATE.tmp" \
  && mv -f "$STATE.tmp" "$STATE"
