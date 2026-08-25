import { NextRequest, NextResponse } from 'next/server';
import { requireSessionToken } from '@/lib/shopify/auth-guard';
import { extractBearerToken } from '@/lib/shopify/session';
import { exchangeOfflineAccessToken } from '@/lib/shopify/token-exchange';
import { upsertStoreWithToken } from '@/lib/shopify/store';
import { syncEntitlement } from '@/lib/entitlement';
import { displayPrice, planSelectionUrl } from '@/lib/shopify/billing';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Called by the embedded frontend on every app open.
 *
 * Does three things in order, and the order matters:
 *   1. Exchanges the session token for a fresh offline access token. Shopify's
 *      offline tokens now expire in ~1h, so this is not just an install-time
 *      step — it is how the app keeps a usable token at all.
 *   2. Upserts the store (which also handles reinstall billing reset).
 *   3. Re-reads the subscription and mirrors it to the storefront metafield.
 *
 * There is no separate OAuth install route. With token exchange and the new
 * embedded auth strategy, the first app open IS the install; Shopify never
 * sends the merchant through /api/auth at all. `redirect_urls` stays in
 * shopify.app.toml because the platform still validates it, but nothing here
 * serves that path.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireSessionToken(req);
  if (auth instanceof NextResponse) return auth;

  // requireSessionToken already verified this token; re-extracting is cheap and
  // avoids widening its return type just to pass the raw string along.
  const sessionToken = extractBearerToken(req.headers.get('authorization'))!;

  try {
    const exchanged = await exchangeOfflineAccessToken({
      shop: auth.shopDomain,
      sessionToken,
    });

    const store = await upsertStoreWithToken({
      shopDomain: auth.shopDomain,
      accessToken: exchanged.accessToken,
      scope: exchanged.scope,
      expiresIn: exchanged.expiresIn,
    });

    const { entitled, subscription } = await syncEntitlement(store);

    return NextResponse.json({
      shop: auth.shopDomain,
      entitled,
      subscription: subscription
        ? {
            name: subscription.name,
            status: subscription.status,
            test: subscription.test,
            currentPeriodEnd: subscription.currentPeriodEnd,
            price: subscription.price,
          }
        : null,
      // The paywall needs both of these before the merchant has a subscription
      // to read anything from.
      pricing: displayPrice(),
      planSelectionUrl: planSelectionUrl(auth.shopDomain),
    });
  } catch (err) {
    logger.error(
      { shop: auth.shopDomain, err: (err as Error).message },
      'Session bootstrap failed',
    );
    return NextResponse.json({ error: 'bootstrap failed' }, { status: 500 });
  }
}
