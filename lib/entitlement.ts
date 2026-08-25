import type { Store } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from './logger';
import {
  entitlementFromSubscription,
  fetchActiveSubscription,
  type ActiveSubscription,
} from './shopify/billing';
import { syncPlanMetafield } from './shopify/metafields';

export interface EntitlementState {
  entitled: boolean;
  subscription: ActiveSubscription | null;
}

/**
 * Re-read the merchant's subscription from Shopify, persist it, and mirror it
 * to the storefront metafield.
 *
 * This is the single write path for entitlement — called on every embedded app
 * open and from the app_subscriptions/update webhook. Everything else reads
 * `Store.entitlement`.
 *
 * The metafield mirror is best-effort by design (see syncPlanMetafield): a
 * failure there leaves the storefront on the app-proxy fallback, which is
 * slower but correct. It must never prevent the database from recording the
 * truth we just fetched.
 */
export async function syncEntitlement(store: Store): Promise<EntitlementState> {
  const subscription = await fetchActiveSubscription(store);
  const entitlement = entitlementFromSubscription(subscription);
  const changed = store.entitlement !== entitlement;

  await prisma.store.update({
    where: { id: store.id },
    data: {
      entitlement,
      shopifyChargeId: subscription?.id ?? null,
      subscriptionStatus: subscription?.status ?? null,
      subscriptionName: subscription?.name ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null,
    },
  });

  // Only audit transitions. Writing a row on every app open would bury the
  // handful of events that actually matter under thousands of no-ops.
  if (changed) {
    await prisma.billingEvent.create({
      data: {
        storeId: store.id,
        eventType: entitlement === 'ACTIVE' ? 'subscription_activated' : 'subscription_ended',
        status: subscription?.status ?? null,
        shopifyChargeId: subscription?.id ?? null,
        amount: subscription?.price?.amount ?? null,
        currencyCode: subscription?.price?.currencyCode ?? null,
      },
    });
    logger.info(
      { shop: store.shopDomain, from: store.entitlement, to: entitlement },
      'Entitlement changed',
    );
  }

  // Mirror on change, and also on first sight of an ACTIVE store whose
  // metafield may never have been written (e.g. the definition create failed
  // on a previous open and has since started working).
  if (changed || entitlement === 'ACTIVE') {
    await syncPlanMetafield(store, entitlement);
  }

  return { entitled: entitlement === 'ACTIVE', subscription };
}
