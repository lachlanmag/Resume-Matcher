#!/usr/bin/env bash
# Stop the local cursor-api-proxy (http://127.0.0.1:8765).
#
# Usage:
#   ./scripts/stop-cursor-proxy.sh
#
# Pair with start-cursor-proxy.sh or dev-with-cursor.sh (which leave the proxy running).

set -euo pipefail

CURSOR_PROXY_URL="${CURSOR_PROXY_URL:-http://127.0.0.1:8765}"
CURSOR_PROXY_PORT="${CURSOR_PROXY_PORT:-8765}"

log() {
  printf '[stop-cursor-proxy] %s\n' "$*"
}

proxy_running() {
  curl -fsS "${CURSOR_PROXY_URL}/health" >/dev/null 2>&1
}

listeners_on_port() {
  lsof -ti "tcp:${CURSOR_PROXY_PORT}" -sTCP:LISTEN 2>/dev/null || true
}

stop_listeners() {
  local signal="$1"
  local pids
  pids="$(listeners_on_port)"

  if [[ -n "$pids" ]]; then
    local pid
    for pid in $pids; do
      if kill "-${signal}" "$pid" 2>/dev/null; then
        log "Sent SIG${signal} to PID ${pid}"
      fi
    done
    return 0
  fi

  if pkill "-${signal}" -f 'cursor-api-proxy' 2>/dev/null; then
    log "Sent SIG${signal} to cursor-api-proxy process(es)"
  fi
}

if ! proxy_running; then
  log "cursor-api-proxy is not running (${CURSOR_PROXY_URL})"
  exit 0
fi

log "Stopping cursor-api-proxy on port ${CURSOR_PROXY_PORT} ..."
stop_listeners TERM

for _ in $(seq 1 10); do
  if ! proxy_running; then
    log "cursor-api-proxy stopped"
    exit 0
  fi
  sleep 1
done

log "Proxy still running; force stopping ..."
stop_listeners KILL

sleep 1
if proxy_running; then
  log "ERROR: Failed to stop cursor-api-proxy"
  log "  Check: lsof -i tcp:${CURSOR_PROXY_PORT}"
  log "  Logs:  tail -30 /tmp/resume-matcher-cursor-proxy.log"
  exit 1
fi

log "cursor-api-proxy stopped"
