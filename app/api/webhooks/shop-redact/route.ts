import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/lib/shopify/hmac';
import { isValidShopDomain } from '@/lib/shopify/validators';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GDPR: 48 hours after uninstall, erase everything we hold for this shop.
 *
 * Unlike the two customer webhooks, this one has real work to do — the Store
 * row holds the shop domain, an encrypted access token, and their cart bar
 * configuration.
 *
 * Deleted immediately rather than scheduled. Shopify has already waited the 48
 * hours before sending this, so there is no further grace period to honour, and
 * a row deleted now cannot be missed by a cleanup job that fails to run.
 * `onDelete: Cascade` takes the settings and billing events with it.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const raw = await req.text();

  if (!verifyWebhookHmac(raw, req.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({ error: 'invalid hmac' }, { status: 401 });
  }

  const shop = req.headers.get('x-shopify-shop-domain');
  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'invalid shop' }, { status: 400 });
  }

  const deleted = await prisma.store.deleteMany({ where: { shopDomain: shop } });
  logger.info({ shop, deleted: deleted.count }, 'shop/redact — store data erased');

  return NextResponse.json({ ok: true });
}
