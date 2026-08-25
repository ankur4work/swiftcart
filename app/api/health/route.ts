import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { checkAppIdentity } from '@/lib/shopify/app-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness + readiness probe.
 *
 * Always 200 with a diagnostic body by default, so an uptime monitor can alert
 * on ANY non-200 (meaning the process itself is down). Pass `?strict=1` — which
 * is what Coolify's rolling-deploy health check should use — to get a 503 when
 * a dependency is unreachable or the app is pointed at the wrong Shopify app.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const strict = new URL(request.url).searchParams.get('strict') === '1';

  // Config drift is only meaningful in prod — dev uses a throwaway tunnel URL
  // that intentionally won't match shopify.app.toml.
  const configIssues = env.NODE_ENV === 'production' ? checkAppIdentity(env) : [];
  const configOk = configIssues.length === 0;

  const dbOk = await pingPostgres();
  const ok = dbOk && configOk;

  return NextResponse.json(
    {
      ok,
      degraded: !ok,
      checks: { postgres: dbOk, config: configOk },
      ...(configIssues.length > 0 ? { config_issues: configIssues } : {}),
      uptime_sec: Math.round(process.uptime()),
    },
    { status: !ok && strict ? 503 : 200 },
  );
}

async function pingPostgres(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
