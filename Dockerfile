# ============================================================
# Veloria Grand — production image (VPS / Docker)
# Multi-stage: deps → build → minimal runner (Next.js standalone output).
# Schema sync + bootstrap run at DEPLOY time (scripts/deploy-vps.sh), not at
# image build, so the image never needs a database to build.
# ============================================================

FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm && corepack prepare pnpm@10.30.3 --activate
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm && corepack prepare pnpm@10.30.3 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Public (browser) env vars are inlined at build time; pass them as build args.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BRAND_LOGO_URL
ARG NEXT_PUBLIC_GOOGLE_API_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_APP_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_BRAND_LOGO_URL=$NEXT_PUBLIC_BRAND_LOGO_URL \
    NEXT_PUBLIC_GOOGLE_API_KEY=$NEXT_PUBLIC_GOOGLE_API_KEY \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_GOOGLE_APP_ID=$NEXT_PUBLIC_GOOGLE_APP_ID
RUN NODE_OPTIONS=--max-old-space-size=6144 pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# The standalone output already traces in @prisma/client + its engine (pnpm
# keeps them under node_modules/.pnpm, so explicit copies would miss). Schema
# sync runs from a separate Prisma CLI container in scripts/deploy-vps.sh.
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
