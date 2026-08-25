# SwiftCart — production image.
#
# syntax=docker/dockerfile:1.6
#
# Debian slim rather than Alpine: Prisma's query engine is built against glibc,
# and while it can be coaxed onto musl it is not worth the debugging when the
# size difference is ~40MB on an image we deploy a handful of times a week.
FROM node:20-bookworm-slim AS base
# openssl is required at runtime by Prisma's query engine; ca-certificates for
# outbound TLS to the Shopify Admin API.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
# Pin the pnpm store to a known path so BuildKit cache mounts can target it
# directly (the default lives under $HOME, which moves with USER directives).
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN pnpm config set store-dir /pnpm/store
WORKDIR /app

# ---- deps (full, includes devDependencies — needed to build) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
# `--prod=false` forces devDependencies even when Coolify injects
# NODE_ENV=production as a build ARG, which otherwise silently skips them and
# fails the build at `next: not found`.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod=false || pnpm install --prod=false

# ---- prod-deps (production-only, for the runtime stage) ----
# Built FROM deps and pruned, rather than a second parallel install: two
# concurrent installs of the same tree is a reliable way to OOM a small VPS.
FROM deps AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod

# ---- build ----
FROM base AS builder

# Next evaluates route modules at build time for metadata. Those modules import
# lib/env.ts, which validates with Zod. lib/env.ts returns a typed stub during
# phase-production-build so real secrets are NOT required here — but Coolify
# passes env as build ARGs anyway, and declaring them lets the build use real
# values when they are present (notably SHOPIFY_API_KEY, which is baked into
# the App Bridge script tag in app/layout.tsx).
ARG SHOPIFY_API_KEY
ARG SHOPIFY_API_SECRET
ARG SHOPIFY_APP_URL
ARG SHOPIFY_SCOPES
ARG DATABASE_URL
ARG SESSION_SECRET
ARG SHOPIFY_APP_HANDLE
ARG SWIFTCART_DISPLAY_AMOUNT
ARG SWIFTCART_DISPLAY_CURRENCY
ARG SWIFTCART_PLAN_NAME
ARG SUPPORT_EMAIL
ARG NODE_ENV=production

ENV SHOPIFY_API_KEY=$SHOPIFY_API_KEY \
    SHOPIFY_API_SECRET=$SHOPIFY_API_SECRET \
    SHOPIFY_APP_URL=$SHOPIFY_APP_URL \
    SHOPIFY_SCOPES=$SHOPIFY_SCOPES \
    DATABASE_URL=$DATABASE_URL \
    SESSION_SECRET=$SESSION_SECRET \
    SHOPIFY_APP_HANDLE=$SHOPIFY_APP_HANDLE \
    SWIFTCART_DISPLAY_AMOUNT=$SWIFTCART_DISPLAY_AMOUNT \
    SWIFTCART_DISPLAY_CURRENCY=$SWIFTCART_DISPLAY_CURRENCY \
    SWIFTCART_PLAN_NAME=$SWIFTCART_PLAN_NAME \
    SUPPORT_EMAIL=$SUPPORT_EMAIL \
    NODE_ENV=$NODE_ENV

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
# A permission to grow, not a reservation: V8 defers aggressive GC until it
# nears the ceiling, so setting this too high on a busy host gets the process
# OOM-killed by the kernel before it ever collects.
#
# The deployment host runs ~80 containers, and 2048 was already too generous —
# the first build died at the type-check phase with exit 255 and no message.
# 1536 makes V8 collect sooner; if the build genuinely needs more it now fails
# with an explicit JS heap error instead of a silent kill.
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm next build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Debian's shadow tools, not Alpine's busybox addgroup/adduser.
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m -s /bin/sh nextjs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs

# Regenerate the Prisma client against the pruned node_modules. The client
# generated in the builder lives under that stage's tree; running generate again
# here is ~2s and idempotent, and beats hunting the output with fragile globs.
RUN ./node_modules/.bin/prisma generate

COPY --from=builder --chown=nextjs:nodejs /app/scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER nextjs
EXPOSE 3000

CMD ["/app/entrypoint.sh"]
