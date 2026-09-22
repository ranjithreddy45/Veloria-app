#!/bin/bash
# ============================================================
# Deploy to production. Run from a clean checkout of `main`.
#
# Two rules, both learned the hard way in September 2026:
#
#  1. Deploy MAIN, and only main. This script copies your local checkout to
#     the server with --delete, so anything on the server that is not in your
#     checkout is erased. Three times in one week a feature that had reached
#     production from another branch was wiped by a deploy of main (the
#     customer app, the Push API that CallVibe uses, a BD change). The check
#     below refuses to run from any other branch or with uncommitted changes.
#
#  2. The database client must be regenerated and the schema pushed. A build
#     that skips `prisma generate` runs with a stale client that does not know
#     new columns — that is why the API keys page and the CallVibe settings
#     page went blank on 21 Sep. `prisma db push` is additive here; production
#     runs it without --accept-data-loss on purpose, so a destructive schema
#     change is refused rather than applied.
#
# The build happens on the server via /root/vg-safe-deploy.sh, which builds
# ASIDE (the live app keeps serving), test-starts the new build, then swaps and
# rolls back on failure. The previous version of this script rebuilt in place
# and deleted the pm2 processes, which meant minutes of errors every deploy.
# ============================================================
set -euo pipefail

HOST=theveloriagrand@43.225.53.88
DEST=~/veloria-app-prod

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
  echo "✗ You are on '$branch'. Production is deployed from main only — merge first, then: git checkout main && git pull" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ Uncommitted changes in this checkout. Commit or discard them; production must match a commit on main." >&2
  exit 1
fi
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "✗ Local main is not origin/main. Run: git pull --ff-only" >&2
  exit 1
fi

echo "🚀 Deploying main @ $(git rev-parse --short HEAD)"

echo "Syncing files..."
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude '.env' --exclude '.env.*' \
  --exclude .claude --exclude test-results --exclude playwright-report --exclude id_rsa \
  --exclude 'tests/e2e/visual-tour-shots' \
  -e "ssh -i ./id_rsa" ./ "$HOST:$DEST/"

echo "🔨 Building aside on the server (the live app keeps serving)..."
# vg-safe-deploy.sh: install → prisma db push (additive) + prisma generate →
# build in a separate directory → test-start on a spare port → swap → rolling
# pm2 reload pinned to 127.0.0.1:3010 → live check → automatic rollback.
ssh -i ./id_rsa "$HOST" 'sudo /root/vg-safe-deploy.sh'

echo "Deployment complete."
