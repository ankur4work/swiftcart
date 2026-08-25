import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/lib/shopify/hmac';
import { isValidShopDomain } from '@/lib/shopify/validators';
import { prisma } from '@/lib/prisma';
import { syncEntitlement } from '@/lib/entitlement';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Subscription lifecycle — activated, cancelled, declined, expired, frozen.
 *
 * The payload carries the new status, but we deliberately ignore it and re-read
 * the subscription from the Admin API instead. Two reasons: webhook delivery is
 * at-least-once and out-of-order, so an older payload can arrive after a newer
 * one and would otherwise overwrite good state with stale state; and the
 * re-read is the same code path used on app open, so there is exactly one
 * implementation of "what is this merchant entitled to".
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const raw = await req.text();

  if (!verifyWebhookHmac(raw, req.headers.get('x-shopify-hmac-sha256'))) {
    logger.warn('app_subscriptions/update webhook rejected: invalid HMAC');
    return NextResponse.json({ error: 'invalid hmac' }, { status: 401 });
  }

  const shop = req.headers.get('x-shopify-shop-domain');
  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'invalid shop' }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
  if (!store) {
    // Nothing to update. Ack anyway — a non-2xx makes Shopify retry a webhook
    // that can never succeed, and enough of those get the endpoint disabled.
    logger.warn({ shop }, 'Subscription webhook for unknown store');
    return NextResponse.json({ ok: true });
  }

  try {
    const { entitled } = await syncEntitlement(store);
    logger.info({ shop, entitled }, 'Subscription webhook processed');
  } catch (err) {
    logger.error(
      { shop, err: (err as Error).message },
      'Subscription webhook sync failed — will self-correct on next app open',
    );
    // Still a 200: the app-open path re-syncs, so a retry storm buys nothing.
  }

  return NextResponse.json({ ok: true });
}
