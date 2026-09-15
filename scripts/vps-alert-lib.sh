#!/usr/bin/env bash
# ============================================================
# Shared helpers for the VPS host-cron scripts (vps-uptime.sh, vps-backup.sh).
# SOURCED, never executed:
#
#   . "$(dirname "$0")/vps-alert-lib.sh"
#   load_env_file /opt/veloria/.env.production
#   send_alert "subject" "multi-line body"
#
# Secrets never appear in output or in `ps`: credentials reach curl through a
# config file on stdin (-K -), never argv, and nothing here echoes an env value.
#
# Channels (each used only when BOTH of its variables are set):
#   WhatsApp  WEFLUX_API_KEY (fallback WEFLUX_CRM_SECRET) + ALERT_WHATSAPP_TO
#             POST {WEFLUX_API_BASE}/messages  {"phone":"91…","text":"…"}
#             — the same request src/lib/integrations/weflux.ts makes.
#   Email     RESEND_API_KEY + ALERT_EMAIL_TO
#             POST https://api.resend.com/emails
# With neither configured, send_alert just logs — the caller never fails
# because alerting is unavailable.
# ============================================================

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# ---- safe .env loader ------------------------------------------------------
# Accepts ONLY `KEY=value`, `KEY="value"`, `KEY='value'` (optionally prefixed
# with `export `). Comments, blank lines and anything else are skipped, so the
# file is never executed as shell: a stray `$(…)` inside a value cannot run.
# Variables already present in the environment win (so a cron line can
# override e.g. APP_URL, and the file cannot clobber PATH).
load_env_file() {
  local file="$1" line key val
  [ -r "$file" ] || { log "env file not readable: $file"; return 1; }
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in ''|'#'*) continue ;; esac
    line="${line#export }"
    [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"; val="${BASH_REMATCH[2]}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ "$val" == \"*\" && ${#val} -ge 2 ]]; then
      val="${val:1:${#val}-2}"
    elif [[ "$val" == \'*\' && ${#val} -ge 2 ]]; then
      val="${val:1:${#val}-2}"
    else
      val="${val%%[[:space:]]#*}"        # unquoted: drop a trailing " # comment"
      val="${val%"${val##*[![:space:]]}"}"
    fi
    [ -n "${!key+x}" ] || export "$key=$val"
  done < "$file"
}

# ---- JSON string literal (no jq on a cPanel host) ---------------------------
json_str() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '"%s"' "$s"
}

# Weflux keys the recipient by digits-with-country-code (no "+"), mirroring
# toPhone() in src/lib/integrations/weflux.ts: strip non-digits and leading
# zeros; a bare 10-digit Indian mobile gets a 91 prefix.
wa_phone() {
  local d
  d="$(printf '%s' "$1" | tr -cd '0-9' | sed 's/^0*//')"
  if [[ "$d" =~ ^[6-9][0-9]{9}$ ]]; then d="91$d"; fi
  printf '%s' "$d"
}

# POST a JSON body with a bearer token. The token goes to curl via a config
# file on stdin, the body via a 0600 temp file — neither is ever in argv.
# Prints the HTTP status; the (secret-free) response body lands in
# $ALERT_LAST_BODY for diagnostics.
ALERT_LAST_BODY=""
_post_json() {
  local url="$1" auth="$2" body="$3" tmp out code
  tmp="$(mktemp)" || return 1
  out="$(mktemp)" || { rm -f "$tmp"; return 1; }
  chmod 600 "$tmp" "$out"
  printf '%s' "$body" > "$tmp"
  code="$(curl -sS -o "$out" -w '%{http_code}' --max-time 20 \
    -X POST -H 'Content-Type: application/json' --data-binary "@$tmp" \
    -K - "$url" <<CURLCFG
header = "Authorization: Bearer $auth"
CURLCFG
  )" || code="000"
  ALERT_LAST_BODY="$(head -c 300 "$out" 2>/dev/null | tr -d '\n')"
  rm -f "$tmp" "$out"
  printf '%s' "$code"
}

# send_alert <subject> <body>  — tries every configured channel; returns 0 if
# at least one accepted the message, 1 otherwise (after logging why).
send_alert() {
  local subject="$1" body="$2" sent=0 code
  local host; host="$(hostname -s 2>/dev/null || echo vps)"
  local text="$subject"$'\n'"$body"$'\n'"— $host, $(TZ=Asia/Kolkata date '+%d %b %Y %H:%M IST')"

  local wa_key="${WEFLUX_API_KEY:-${WEFLUX_CRM_SECRET:-}}"
  if [ -n "$wa_key" ] && [ -n "${ALERT_WHATSAPP_TO:-}" ]; then
    local base="${WEFLUX_API_BASE:-https://app.weflux.in/api/public/v1}"
    base="${base%/}"
    local to
    for to in ${ALERT_WHATSAPP_TO//,/ }; do
      code="$(_post_json "$base/messages" "$wa_key" \
        "{\"phone\":$(json_str "$(wa_phone "$to")"),\"text\":$(json_str "$text")}")"
      if [[ "$code" == 2* ]] && [[ "$ALERT_LAST_BODY" != *window_closed* ]]; then
        log "alert: whatsapp accepted (HTTP $code)"; sent=1
      elif [[ "$ALERT_LAST_BODY" == *window_closed* ]]; then
        log "alert: whatsapp NOT delivered — 24h window closed for the recipient (free text needs a recent inbound message; rely on email)"
      else
        log "alert: whatsapp FAILED (HTTP $code) ${ALERT_LAST_BODY:+— $ALERT_LAST_BODY}"
      fi
    done
  fi

  if [ -n "${RESEND_API_KEY:-}" ] && [ -n "${ALERT_EMAIL_TO:-}" ]; then
    local from="${ALERT_EMAIL_FROM:-${EMAIL_FROM:-Veloria Alerts <alerts@${EMAIL_DOMAIN:-theveloriagrand.com}>}}"
    local to_json="" t
    for t in ${ALERT_EMAIL_TO//,/ }; do
      to_json="$to_json${to_json:+,}$(json_str "$t")"
    done
    code="$(_post_json "https://api.resend.com/emails" "$RESEND_API_KEY" \
      "{\"from\":$(json_str "$from"),\"to\":[$to_json],\"subject\":$(json_str "$subject"),\"text\":$(json_str "$text")}")"
    if [[ "$code" == 2* ]]; then
      log "alert: email accepted (HTTP $code)"; sent=1
    else
      log "alert: email FAILED (HTTP $code) ${ALERT_LAST_BODY:+— $ALERT_LAST_BODY}"
    fi
  fi

  if [ "$sent" = 1 ]; then return 0; fi
  log "alert: NOT SENT (no channel configured or all failed) — $subject"
  return 1
}
