import { NextResponse } from 'next/server';
import { buildHealthReport } from '@/lib/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe — always 200 with a diagnostic body.
 *
 * An uptime monitor pointed here alerts on ANY non-200, which means the
 * process itself is down. Degraded dependencies show up as `ok: false` in the
 * body without changing the status code.
 *
 * `?strict=1` still works for humans and scripts. Coolify's deploy health check
 * cannot use it — that field rejects query strings — so it points at
 * /api/health/strict instead.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const strict = new URL(request.url).searchParams.get('strict') === '1';
  const report = await buildHealthReport();
  return NextResponse.json(report, { status: !report.ok && strict ? 503 : 200 });
}
