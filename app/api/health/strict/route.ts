import { NextResponse } from 'next/server';
import { buildHealthReport } from '@/lib/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Readiness probe — 503 when anything is wrong. This is what Coolify's deploy
 * health check points at.
 *
 * It exists as a separate path rather than `/api/health?strict=1` purely
 * because Coolify's health-check field rejects query strings:
 *
 *   {"errors":{"health_check_path":["The health check path field format is invalid."]}}
 *
 * The distinction that matters: a failure here fails the DEPLOY and rolls it
 * back. That is deliberate — it means a container pointed at the wrong Shopify
 * app, the wrong domain, or a dead database never replaces a working one. The
 * alternative is an app that boots happily and then cannot authenticate a
 * single merchant, which presents as a blank embedded screen with nothing in
 * the logs.
 */
export async function GET(): Promise<NextResponse> {
  const report = await buildHealthReport();
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
