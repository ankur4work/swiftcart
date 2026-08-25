#!/bin/sh
set -e

# Apply pending migrations before the server accepts traffic.
#
# `migrate deploy` only applies migrations that already exist in prisma/migrations
# — it never generates one and never prompts, which is what makes it safe to run
# unattended on every container start. If it fails we exit rather than starting
# a server against a schema it doesn't match; Coolify's health check then rolls
# the deploy back instead of serving 500s.
echo "[swiftcart] applying database migrations…"
./node_modules/.bin/prisma migrate deploy

echo "[swiftcart] starting Next.js on port ${PORT:-3000}"
exec ./node_modules/.bin/next start -p "${PORT:-3000}"
