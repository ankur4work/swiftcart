import { prisma } from './prisma';
import { env } from './env';
import { checkAppIdentity } from './shopify/app-identity';

export interface HealthReport {
  ok: boolean;
  degraded: boolean;
  checks: { postgres: boolean; config: boolean };
  config_issues?: string[];
  uptime_sec: number;
}

/**
 * The single implementation behind both health routes.
 *
 * Two routes exist because Coolify's health-check field rejects query strings
 * — `/api/health?strict=1` fails validation with "The health check path field
 * format is invalid." So the strict variant needs its own path, and the logic
 * lives here rather than being duplicated or re-exported between routes.
 */
export async function buildHealthReport(): Promise<HealthReport> {
  // Config drift is only meaningful in prod — dev uses a throwaway tunnel URL
  // that intentionally won't match shopify.app.toml.
  const configIssues = env.NODE_ENV === 'production' ? checkAppIdentity(env) : [];
  const configOk = configIssues.length === 0;
  const dbOk = await pingPostgres();
  const ok = dbOk && configOk;

  return {
    ok,
    degraded: !ok,
    checks: { postgres: dbOk, config: configOk },
    ...(configIssues.length > 0 ? { config_issues: configIssues } : {}),
    uptime_sec: Math.round(process.uptime()),
  };
}

async function pingPostgres(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
