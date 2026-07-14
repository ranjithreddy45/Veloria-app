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
  # One-shot: import the Vendor Rate Card into the catalog (idempotent upsert by
  # vendor name / vendor+package name). Non-fatal so a data hiccup can't fail deploy.
  if [ -f scripts/vendor-import.json ]; then
    echo "▲ [vercel-build] Importing vendor rate card…"
    DATABASE_URL="$DDL_URL" pnpm tsx scripts/import-vendor-rate-card.ts || echo "⚠ [vercel-build] vendor rate-card import failed (non-fatal)"
  fi
else
  echo "⚠ [vercel-build] No database URL found — skipping schema sync."
fi

echo "▲ [vercel-build] Building Next.js…"
pnpm next build
