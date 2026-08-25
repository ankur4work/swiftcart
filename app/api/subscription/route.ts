import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/lib/shopify/auth-guard';
import { syncEntitlement } from '@/lib/entitlement';
import { displayPrice, planSelectionUrl } from '@/lib/shopify/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Current subscription state, re-read from Shopify.
 *
 * The frontend polls this after sending the merchant to the hosted plan page,
 * because there is no reliable "they came back" event to hang off — the
 * merchant approves the charge on admin.shopify.com and lands back in the
 * iframe with no signal that anything changed. The app_subscriptions/update
 * webhook usually beats them back, but not always, so this forces a read
 * rather than trusting the cached column.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireStore(req);
  if (ctx instanceof NextResponse) return ctx;

  const { entitled, subscription } = await syncEntitlement(ctx.store);

  return NextResponse.json({
    entitled,
    subscription: subscription
      ? {
          name: subscription.name,
          status: subscription.status,
          test: subscription.test,
          trialDays: subscription.trialDays,
          currentPeriodEnd: subscription.currentPeriodEnd,
          price: subscription.price,
        }
      : null,
    pricing: displayPrice(),
    planSelectionUrl: planSelectionUrl(ctx.shopDomain),
  });
}
