import { PrismaClient } from '@prisma/client';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

// Next.js dev server hot-reloads modules on every edit. Without this the
// PrismaClient constructor runs again on each reload and the connection pool
// grows until Postgres refuses new connections.
if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
