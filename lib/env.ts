import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SHOPIFY_API_KEY: z.string().min(1, 'SHOPIFY_API_KEY is required'),
  SHOPIFY_API_SECRET: z.string().min(1, 'SHOPIFY_API_SECRET is required'),
  SHOPIFY_APP_URL: z.string().url('SHOPIFY_APP_URL must be a valid URL'),
  SHOPIFY_SCOPES: z.string().min(1, 'SHOPIFY_SCOPES is required'),

  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),

  /** 32 bytes of hex. Encrypts stored Shopify access tokens (lib/crypto.ts). */
  SESSION_SECRET: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'SESSION_SECRET must be 64 hex characters (32 bytes)'),

  // ---------------------------------------------------------------------------
  // Billing — Shopify Managed Pricing.
  //
  // There is deliberately NO price, trial length, or test-mode flag driving the
  // charge here. Plans are defined in the Shopify dev dashboard, Shopify hosts
  // the plan-selection page and owns the charge, and it forces test mode on
  // development stores by itself. A price in env would silently disagree with
  // what Shopify actually bills the merchant.
  //
  // The app handle IS config, not pricing: it addresses the hosted plan page at
  // /store/:store_handle/charges/:app_handle/pricing_plans and must match the
  // handle in the dev dashboard (and shopify.app.toml).
  // ---------------------------------------------------------------------------
  SHOPIFY_APP_HANDLE: z.string().min(1).default('swiftcart'),

  /**
   * Display-only price for the paywall shown to a merchant who has NO
   * subscription yet.
   *
   * This is the one place a price has to be hard-coded somewhere, and it is
   * worth being explicit about why: once a merchant subscribes we read their
   * real, live price back from the Admin API and show that. But before they
   * subscribe there is no subscription to read, and a paywall that says nothing
   * about cost converts badly.
   *
   * MUST match the plan price configured in the Partner dashboard. If you
   * change pricing there, change it here too — nothing enforces agreement
   * because the pre-subscription state has no API to check against.
   */
  SWIFTCART_DISPLAY_PRICE: z.string().default('$30'),
  SWIFTCART_DISPLAY_INTERVAL: z.string().default('month'),

  /**
   * Invoice name of the single paid plan in the dashboard. Used only to render
   * the plan name before the API can tell us; entitlement never depends on it.
   * SwiftCart has no free plan, so — unlike a freemium app — we do not need to
   * match a plan name to decide access: any ACTIVE subscription is entitled.
   */
  SWIFTCART_PLAN_NAME: z.string().min(1).default('SwiftCart Pro'),

  SUPPORT_EMAIL: z.string().email().default('support@swiftcart.live'),
  PRIVACY_CONTACT_EMAIL: z.string().email().default('privacy@swiftcart.live'),
  COMPANY_ADDRESS: z.string().default('SwiftCart'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Static stub used ONLY during `next build` (phase-production-build).
 *
 * Next.js evaluates route modules at build time for metadata generation; those
 * modules import this env. We don't want to force Coolify/CI to pass real
 * secrets at build time, so we return a typed stub. At runtime (container
 * start) the real vars are present and validation runs normally — if they're
 * missing THEN we fail fast.
 */
const BUILD_STUB: Env = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  SHOPIFY_API_KEY: 'build-time-stub',
  SHOPIFY_API_SECRET: 'build-time-stub',
  SHOPIFY_APP_URL: 'https://build-stub.invalid',
  SHOPIFY_SCOPES: 'write_metafields',
  DATABASE_URL: 'postgresql://stub:stub@localhost:5432/stub',
  SESSION_SECRET: '0'.repeat(64),
  SHOPIFY_APP_HANDLE: 'swiftcart',
  SWIFTCART_DISPLAY_PRICE: '$30',
  SWIFTCART_DISPLAY_INTERVAL: 'month',
  SWIFTCART_PLAN_NAME: 'SwiftCart Pro',
  SUPPORT_EMAIL: 'support@build.invalid',
  PRIVACY_CONTACT_EMAIL: 'privacy@build.invalid',
  COMPANY_ADDRESS: 'build stub',
};

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return BUILD_STUB;
    }
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
