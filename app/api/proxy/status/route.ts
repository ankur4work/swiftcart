import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/shopify/hmac';
import { isValidShopDomain } from '@/lib/shopify/validators';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Storefront entitlement check — the FALLBACK path.
 *
 * The theme extension reads `app.metafields.swiftcart.plan` first and only
 * calls this when that comes back blank — a fresh install whose metafield write
 * hasn't landed yet. Keeping the metafield as the primary path is the whole
 * point (see lib/shopify/metafields.ts); this route exists so a store in that
 * window degrades to "slower" instead of "broken".
 *
 * Reached at `https://{shop}/apps/swiftcart/status`, which Shopify signs and
 * proxies here.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);

  // Signature first, before any parameter is trusted or any query is run.
  if (!verifyAppProxySignature(url.searchParams)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const shop = url.searchParams.get('shop');
  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'invalid shop' }, { status: 400 });
  }

  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
    select: { entitlement: true, uninstalledAt: true, settings: true },
  });

  const entitled = Boolean(store) && store!.uninstalledAt === null && store!.entitlement === 'ACTIVE';

  return NextResponse.json(
    {
      plan: entitled ? 'active' : 'none',
      // Settings are returned so a merchant who has not opened the theme editor
      // still gets sensible rendering. The extension prefers its own block
      // settings when they are present — those are what the merchant edits.
      settings: entitled && store?.settings ? publicSettings(store.settings) : null,
    },
    {
      headers: {
        // Short cache: entitlement changes are rare, and the metafield path
        // takes over as soon as it is written, so a minute of staleness on the
        // fallback is a good trade for not fielding a request per page view.
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  );
}

function publicSettings(s: {
  design: string;
  buttonPosition: string;
  showOnDesktop: boolean;
  showOnMobile: boolean;
  hideWhenEmpty: boolean;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  cornerRadius: number;
  showItemCount: boolean;
  showSubtotal: boolean;
  ctaLabel: string;
  cartOpenSelector: string;
}) {
  return {
    design: s.design.toLowerCase(),
    buttonPosition: s.buttonPosition.toLowerCase(),
    showOnDesktop: s.showOnDesktop,
    showOnMobile: s.showOnMobile,
    hideWhenEmpty: s.hideWhenEmpty,
    backgroundColor: s.backgroundColor,
    textColor: s.textColor,
    accentColor: s.accentColor,
    cornerRadius: s.cornerRadius,
    showItemCount: s.showItemCount,
    showSubtotal: s.showSubtotal,
    ctaLabel: s.ctaLabel,
    cartOpenSelector: s.cartOpenSelector,
  };
}
