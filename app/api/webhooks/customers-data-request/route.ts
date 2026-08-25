import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/lib/shopify/hmac';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GDPR: a shopper has asked the merchant for the data we hold about them.
 *
 * SwiftCart holds none. The floating cart is rendered by the theme extension
 * from Liquid and the Ajax Cart API — no shopper identifier, cart contents,
 * order, or browsing event is ever transmitted to this server, and the schema
 * (prisma/schema.prisma) has no customer table to search.
 *
 * So the honest response is an acknowledged no-op. This is NOT a stub to fill
 * in later: if a future feature starts storing shopper data, this handler must
 * be implemented in the same change, not after it.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const raw = await req.text();

  if (!verifyWebhookHmac(raw, req.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({ error: 'invalid hmac' }, { status: 401 });
  }

  logger.info(
    { shop: req.headers.get('x-shopify-shop-domain') },
    'customers/data_request acknowledged — no customer data is stored by this app',
  );
  return NextResponse.json({ ok: true });
}
