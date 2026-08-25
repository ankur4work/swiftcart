import type { Entitlement, Store } from '@prisma/client';
import { prisma } from '../prisma';
import { decrypt, encrypt } from '../crypto';

export interface StoreUpsertInput {
  shopDomain: string;
  accessToken: string;
  scope: string;
  /** Seconds until the token expires (null = non-expiring, which Shopify rejects). */
  expiresIn?: number | null;
}

function expiresAt(expiresIn: number | null | undefined): Date | null {
  if (!expiresIn) return null;
  // 60s of headroom so we refresh before the token is actually dead.
  return new Date(Date.now() + (expiresIn - 60) * 1000);
}

type ReinstallReset = {
  entitlement: Entitlement;
  shopifyChargeId: null;
  subscriptionStatus: null;
  subscriptionName: null;
  currentPeriodEnd: null;
};

/**
 * When a store comes back from an uninstalled state, Shopify has already
 * cancelled whatever app subscription existed before uninstall. Carrying the
 * old entitlement forward would hand a reinstalling merchant the paid app for
 * free until a webhook happened to correct it.
 *
 * Reset to NONE so the paywall re-requests charge approval — this is also
 * Shopify App Store requirement 1.2.2 (accept, decline and request approval for
 * charges again on reinstall).
 *
 * Returns an empty patch when the store was never uninstalled, which is the
 * common case: `refreshStoreToken` runs on EVERY embedded app open and must
 * never revoke an active subscriber.
 */
async function reinstallReset(shopDomain: string): Promise<{
  patch: ReinstallReset | Record<string, never>;
  prior: { id: string; entitlement: Entitlement; shopifyChargeId: string | null } | null;
}> {
  const existing = await prisma.store.findUnique({
    where: { shopDomain },
    select: { id: true, uninstalledAt: true, entitlement: true, shopifyChargeId: true },
  });
  if (!existing || existing.uninstalledAt == null) {
    return { patch: {}, prior: null };
  }
  return {
    patch: {
      entitlement: 'NONE',
      shopifyChargeId: null,
      subscriptionStatus: null,
      subscriptionName: null,
      currentPeriodEnd: null,
    },
    prior: {
      id: existing.id,
      entitlement: existing.entitlement,
      shopifyChargeId: existing.shopifyChargeId,
    },
  };
}

async function logReinstallReset(prior: {
  id: string;
  entitlement: Entitlement;
  shopifyChargeId: string | null;
}): Promise<void> {
  // Nothing to audit if there was no paid state to clear.
  if (prior.entitlement === 'NONE' && !prior.shopifyChargeId) return;
  await prisma.billingEvent.create({
    data: {
      storeId: prior.id,
      eventType: 'reinstall_reset',
      shopifyChargeId: prior.shopifyChargeId,
    },
  });
}

export async function upsertStoreWithToken(input: StoreUpsertInput): Promise<Store> {
  const { patch, prior } = await reinstallReset(input.shopDomain);

  // Reinstall clears uninstalledAt AND scheduledRedactAt, so an in-flight 48h
  // redact is cancelled automatically — the `app/uninstalled → app/installed
  // within 48h` flow Shopify explicitly supports.
  const store = await prisma.store.upsert({
    where: { shopDomain: input.shopDomain },
    create: {
      shopDomain: input.shopDomain,
      accessToken: encrypt(input.accessToken),
      accessTokenExpiresAt: expiresAt(input.expiresIn),
      scope: input.scope,
      entitlement: 'NONE',
      installedAt: new Date(),
      settings: { create: {} },
    },
    update: {
      accessToken: encrypt(input.accessToken),
      accessTokenExpiresAt: expiresAt(input.expiresIn),
      scope: input.scope,
      uninstalledAt: null,
      scheduledRedactAt: null,
      ...patch,
    },
  });

  if (prior) await logReinstallReset(prior);

  // A store that installed before CartBarSettings existed (or whose settings
  // row was cascade-deleted) needs one now — every read path assumes it.
  await prisma.cartBarSettings.upsert({
    where: { storeId: store.id },
    create: { storeId: store.id },
    update: {},
  });

  return store;
}

export async function getStore(shopDomain: string): Promise<Store | null> {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store || store.uninstalledAt) return null;
  return store;
}

export async function getStoreToken(shopDomain: string): Promise<string | null> {
  const store = await getStore(shopDomain);
  if (!store) return null;
  return decrypt(store.accessToken);
}

/** True if the token is gone or dies within 5 minutes. */
export function isTokenExpired(store: { accessTokenExpiresAt: Date | null }): boolean {
  if (!store.accessTokenExpiresAt) return false;
  return store.accessTokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;
}

export async function markStoreUninstalled(shopDomain: string): Promise<void> {
  await prisma.store.updateMany({
    where: { shopDomain, uninstalledAt: null },
    data: {
      uninstalledAt: new Date(),
      // Shopify cancels the subscription on uninstall; reflect that immediately
      // rather than leaving a stale ACTIVE row behind.
      entitlement: 'NONE',
      subscriptionStatus: 'CANCELLED',
    },
  });
}
