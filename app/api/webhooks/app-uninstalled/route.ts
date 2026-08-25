import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/lib/shopify/hmac';
import { markStoreUninstalled } from '@/lib/shopify/store';
import { isValidShopDomain } from '@/lib/shopify/validators';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const raw = await req.text();

  if (!verifyWebhookHmac(raw, req.headers.get('x-shopify-hmac-sha256'))) {
    logger.warn('app/uninstalled webhook rejected: invalid HMAC');
    return NextResponse.json({ error: 'invalid hmac' }, { status: 401 });
  }

  const shop = req.headers.get('x-shopify-shop-domain');
  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'invalid shop' }, { status: 400 });
  }

  await markStoreUninstalled(shop);
  logger.info({ shop }, 'Store marked uninstalled');

  return NextResponse.json({ ok: true });
}
