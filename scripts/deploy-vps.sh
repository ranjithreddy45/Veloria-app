#!/usr/bin/env bash
# ============================================================
# Deploy Veloria Grand to the VPS — run from THIS machine (the server needs
# no GitHub credentials): rsync the checkout → build the image on the server
# → sync the DB schema (additive, same as the old Vercel build step)
# → restart the container → health check.
#
#   bash scripts/deploy-vps.sh            # deploy current checkout
#   SSH_HOST=billionevents APP_DIR=/opt/veloria bash scripts/deploy-vps.sh
#
# The server keeps .env.production in $APP_DIR (never committed, never synced
# from here — it is copied once by hand). The old container keeps serving
# while the new image builds; the swap itself takes a few seconds.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

SSH_HOST="${SSH_HOST:-billionevents}"
APP_DIR="${APP_DIR:-/opt/veloria}"
PORT="${APP_PORT:-3100}"

echo "▲ Syncing code to $SSH_HOST:$APP_DIR …"
ssh "$SSH_HOST" "mkdir -p '$APP_DIR'"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude '.env*' --exclude .claude --exclude 'scripts/*.local.*' \
  ./ "$SSH_HOST:$APP_DIR/"

ssh "$SSH_HOST" bash -s <<REMOTE
set -euo pipefail
cd '$APP_DIR'
[ -f .env.production ] || { echo "✗ $APP_DIR/.env.production missing on the server"; exit 1; }
set -a; . ./.env.production; set +a

echo "▲ Building image on the server…"
DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build app

# Prefer the direct/unpooled URL for DDL (Neon's pooler can't run schema ops).
DDL_URL="\${DATABASE_URL_UNPOOLED:-\${POSTGRES_URL_NON_POOLING:-\${DATABASE_URL:-}}}"
if [ -z "\$DDL_URL" ]; then
  echo "! DATABASE_URL is empty in .env.production — skipping schema sync (app will start but cannot reach the database)"
else
  echo "▲ Syncing database schema (additive)…"
  # Throwaway Prisma CLI container (host network: this box's docker bridge has no DNS).
  docker run --rm --network host -e DATABASE_URL="\$DDL_URL" \
    -v "\$PWD/prisma:/work/prisma:ro" -w /work node:22-alpine \
    sh -c "npx --yes prisma@6.19.2 db push --skip-generate 2>&1 | tail -4" \
    || { echo "✗ schema sync failed — container NOT restarted"; exit 1; }
fi

echo "▲ Starting…"
docker compose -f docker-compose.prod.yml up -d app
docker image prune -f >/dev/null 2>&1 || true

echo "▲ Waiting for health on :$PORT …"
for i in \$(seq 1 40); do
  if curl -fsS http://127.0.0.1:$PORT/api/health >/dev/null 2>&1; then echo "✓ healthy"; exit 0; fi
  sleep 3
done
echo "✗ app did not become healthy — check: docker logs veloria-app"; exit 1
REMOTE
