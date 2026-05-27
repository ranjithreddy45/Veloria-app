#!/usr/bin/env bash
# ============================================================
# Veloria Grand — Production Deployment Script
# ============================================================
# Usage: ./scripts/deploy.sh
#
# This script:
#   1. Validates the local .env has correct production values
#   2. Builds the Next.js app
#   3. Creates a deploy tarball (excluding .next/cache)
#   4. Uploads to production server
#   5. Extracts, copies static/public/prisma assets
#   6. PRESERVES the production .env (never overwrites it)
#   7. Restarts PM2 and verifies the app is healthy
# ============================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────
SERVER="43.225.53.88"
SERVER_USER="root"
APP_DIR="/opt/veloria-app"
PM2_APP="veloria"
TARBALL="/tmp/veloria-deploy.tar.gz"
DEPLOY_FILES=".next/standalone .next/static public prisma"
HEALTH_URL="http://localhost:3000/sign-in"
HEALTH_RETRIES=10
HEALTH_DELAY=3

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1" >&2; exit 1; }

# ── Pre-flight Checks ────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Veloria Grand — Production Deployment"
echo "═══════════════════════════════════════════════════"
echo ""

# 1. Check we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "prisma" ]; then
  error "Run this script from the VeloriaApp project root."
fi

# 2. Validate .env exists
if [ ! -f ".env" ]; then
  error ".env file not found."
fi

# 3. Validate DATABASE_URL — must NOT contain 'veloria_db' (common mistake)
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1)
if echo "$DB_URL" | grep -q 'veloria_db'; then
  error "DATABASE_URL in .env contains 'veloria_db' — the correct database name is 'veloria'.\n   Fix: DATABASE_URL=\"postgresql://veloria:veloria_secret@localhost:5432/veloria\""
fi

if [ -z "$DB_URL" ]; then
  error "DATABASE_URL is missing from .env"
fi

log "Pre-flight checks passed"

# ── Build ─────────────────────────────────────────────────────

echo ""
echo "Building Next.js app..."
pnpm build || error "Build failed"
log "Build succeeded"

# ── Package ───────────────────────────────────────────────────

echo ""
echo "Creating deployment tarball..."
rm -f "$TARBALL"
tar czf "$TARBALL" --exclude='.next/cache' $DEPLOY_FILES
TARBALL_SIZE=$(du -sh "$TARBALL" | cut -f1)
log "Tarball created: $TARBALL ($TARBALL_SIZE)"

# ── Upload ────────────────────────────────────────────────────

echo ""
echo "Uploading to $SERVER..."
scp "$TARBALL" "${SERVER_USER}@${SERVER}:/tmp/" || error "SCP upload failed"
log "Upload complete"

# ── Deploy on Server ──────────────────────────────────────────

echo ""
echo "Deploying on server..."

# NOTE: We intentionally do NOT copy .env to the server.
# The production .env is managed separately on the server.
# This prevents accidentally overwriting production credentials.

ssh "${SERVER_USER}@${SERVER}" bash -s << 'REMOTE_SCRIPT'
set -euo pipefail

APP_DIR="/opt/veloria-app"
PM2_APP="veloria"

echo "[server] Extracting tarball..."
cd "$APP_DIR"
tar xzf /tmp/veloria-deploy.tar.gz 2>/dev/null

echo "[server] Copying static assets..."
\cp -rf .next/static .next/standalone/.next/
\cp -rf public .next/standalone/
\cp -rf prisma .next/standalone/

# IMPORTANT: Always use .env.production — NEVER overwrite with dev .env
if [ -f "$APP_DIR/.env.production" ]; then
  \cp -f "$APP_DIR/.env.production" .next/standalone/.env
  echo "[server] ✓ Production .env applied from .env.production"
elif [ -f ".next/standalone/.env" ]; then
  echo "[server] ⚠ No .env.production found — keeping existing standalone .env"
else
  echo "[server] ✗ ERROR: No .env found! Create /opt/veloria-app/.env.production first."
  exit 1
fi

echo "[server] Restarting PM2..."
cd .next/standalone
HOSTNAME=0.0.0.0 PORT=3000 pm2 restart "$PM2_APP" --update-env

echo "[server] Waiting for app to start..."
for i in $(seq 1 10); do
  sleep 3
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/sign-in 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "[server] ✓ App is healthy (HTTP 200)"
    exit 0
  fi
  echo "[server] Attempt $i/10 — HTTP $HTTP_CODE, retrying..."
done

echo "[server] ✗ App did not become healthy after 10 attempts"
pm2 logs "$PM2_APP" --lines 20 --nostream
exit 1
REMOTE_SCRIPT

if [ $? -eq 0 ]; then
  echo ""
  log "Deployment successful! 🚀"
  echo ""
  echo "  App URL:  https://app.theveloriagrand.com"
  echo "  Server:   $SERVER"
  echo ""
else
  error "Deployment failed — check server logs"
fi

# ── Cleanup ───────────────────────────────────────────────────
rm -f "$TARBALL"
