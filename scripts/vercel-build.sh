#!/usr/bin/env bash
# ============================================================
# Production build for Vercel
# ============================================================
# Runs during deploy, where the real (sensitive) DATABASE_URL is
# injected by Vercel. Steps:
#   1. Generate Prisma client
#   2. Push schema to the DB using the DIRECT (unpooled) connection
#      — Neon's pooled endpoint can't run DDL reliably.
#   3. Bootstrap admin + pipeline stages (idempotent, non-destructive)
#   4. Build Next.js
set -euo pipefail

echo "▲ [vercel-build] Generating Prisma client…"
pnpm prisma generate

# Prefer the direct/unpooled URL for schema operations.
if [ -n "${DATABASE_URL_UNPOOLED:-}" ]; then
  DDL_URL="$DATABASE_URL_UNPOOLED"
elif [ -n "${POSTGRES_URL_NON_POOLING:-}" ]; then
  DDL_URL="$POSTGRES_URL_NON_POOLING"
else
  DDL_URL="${DATABASE_URL:-}"
fi

if [ -n "$DDL_URL" ]; then
  echo "▲ [vercel-build] Syncing database schema…"
  DATABASE_URL="$DDL_URL" pnpm prisma db push --skip-generate
  echo "▲ [vercel-build] Bootstrapping admin + pipeline stages…"
  DATABASE_URL="$DDL_URL" pnpm tsx prisma/bootstrap.ts
  # NOTE: the Vendor Rate Card was imported once at deploy 6755ef7 (6 vendors /
  # 37 packages). The one-shot build step was removed afterwards so re-deploys
  # never overwrite in-app edits. To re-import, run scripts/import-vendor-rate-card.ts
  # manually against the target DB (idempotent upsert).
else
  echo "⚠ [vercel-build] No database URL found — skipping schema sync."
fi

echo "▲ [vercel-build] Building Next.js…"
pnpm next build
