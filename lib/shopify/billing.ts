import type { Entitlement, Store } from '@prisma/client';
import { ShopifyClient, ShopifyAuthError } from './client';
import { env } from '../env';
import { logger } from '../logger';

/**
 * Shopify Managed Pricing — SwiftCart is PAID ONLY.
 *
 * Plans live in the Shopify dev dashboard, NOT in this codebase. Shopify hosts
 * the plan-selection page, creates the subscription, and handles trials,
 * proration, upgrades and test charges. The app never calls
 * appSubscriptionCreate.
 *
 * Two consequences that matter when editing this file:
 *
 *  1. **Never hard-code a price in the entitlement path.** The app owner
 *     changes pricing in the dashboard and it must take effect with no deploy.
 *     Any amount shown to a merchant comes from `fetchActiveSubscription` —
 *     their real, current subscription. The one exception is the pre-purchase
 *     paywall, which by definition has no subscription to read; that number
 *     lives in env.SWIFTCART_DISPLAY_PRICE and is documented there.
 *
 *  2. **Entitlement is "has an ACTIVE subscription", full stop.** A freemium
 *     app has to match a plan name to tell the free tier from the paid ones.
 *     SwiftCart has no free tier, so there is nothing to disambiguate — and
 *     that removes the single most fragile part of the usual implementation.
 *     Do not reintroduce a name or price comparison here; a $0 subscription is
 *     a paid plan granted free to a development store via "Free for partners
 *     and developers", and treating it as unentitled locks partners out of
 *     exactly the app they are meant to be testing.
 */

const ACTIVE_SUBSCRIPTION_QUERY = /* GraphQL */ `
  query ActiveAppSubscription {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        trialDays
        currentPeriodEnd
        lineItems {
          id
          plan {
            pricingDetails {
              __typename
              ... on AppRecurringPricing {
                interval
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface ActiveSubscriptionResp {
  currentAppInstallation: {
    activeSubscriptions: Array<{
      id: string;
      name: string;
      status: string;
      test: boolean;
      trialDays: number;
      currentPeriodEnd: string | null;
      lineItems: Array<{
        id: string;
        plan: {
          pricingDetails: {
            __typename: string;
            interval?: string;
            price?: { amount: string; currencyCode: string };
          };
        };
      }>;
    }>;
  } | null;
}

export interface ActiveSubscription {
  id: string;
  /** Plan name as configured in the dashboard — display only, never matched on. */
  name: string;
  status: string;
  /** True on development stores, where Shopify forces test charges. */
  test: boolean;
  trialDays: number;
  currentPeriodEnd: string | null;
  /** Live recurring price. Null for a plan with no recurring line item. */
  price: { amount: string; currencyCode: string; interval: string } | null;
}

/**
 * The merchant's current subscription, straight from Shopify.
 *
 * Authoritative for both entitlement and the displayed price. The
 * `Store.entitlement` column is only a cache kept warm by the
 * app_subscriptions/update webhook, so it can lag a merchant action by however
 * long delivery takes.
 *
 * Returns null when there is no active subscription, and ALSO on API failure —
 * callers must treat null as "not entitled" rather than failing open, so a
 * Shopify outage or an expired token can never hand out the paid app.
 */
export async function fetchActiveSubscription(
  store: Pick<Store, 'shopDomain' | 'accessToken'>,
): Promise<ActiveSubscription | null> {
  let resp;
  try {
    const client = new ShopifyClient(store);
    resp = await client.graphql<ActiveSubscriptionResp>(ACTIVE_SUBSCRIPTION_QUERY);
  } catch (err) {
    // An expired offline token is the routine case here, not an incident: it
    // resolves itself the next time the merchant opens the app and bootstrap
    // re-exchanges. Log it quietly and report "not entitled".
    const level = err instanceof ShopifyAuthError ? 'info' : 'error';
    logger[level](
      { shop: store.shopDomain, err: (err as Error).message },
      'Could not read subscription — treating as not entitled',
    );
    return null;
  }

  const subs = resp.data?.currentAppInstallation?.activeSubscriptions ?? [];
  const sub = subs.find((s) => s.status === 'ACTIVE') ?? subs[0];
  if (!sub) return null;

  const recurring = sub.lineItems
    .map((li) => li.plan.pricingDetails)
    .find((d) => d.__typename === 'AppRecurringPricing' && d.price);

  return {
    id: sub.id,
    name: sub.name,
    status: sub.status,
    test: sub.test,
    trialDays: sub.trialDays,
    currentPeriodEnd: sub.currentPeriodEnd,
    price:
      recurring?.price && recurring.interval
        ? {
            amount: recurring.price.amount,
            currencyCode: recurring.price.currencyCode,
            interval: recurring.interval,
          }
        : null,
  };
}

/**
 * Map a Shopify subscription onto our entitlement gate.
 *
 * See the doctrine at the top of this file for why this is a status check and
 * nothing more.
 */
export function entitlementFromSubscription(sub: ActiveSubscription | null): Entitlement {
  return sub && sub.status === 'ACTIVE' ? 'ACTIVE' : 'NONE';
}

/**
 * Shopify-hosted plan selection page for this app.
 *
 * Pattern (per the Managed Pricing docs):
 *   https://admin.shopify.com/store/:store_handle/charges/:app_handle/pricing_plans
 *
 * `store_handle` is the myshopify subdomain; `app_handle` comes from
 * SHOPIFY_APP_HANDLE so a rename doesn't need a code change.
 *
 * ⚠️ Embedded apps must open this at the TOP window. It lives on
 * admin.shopify.com, so navigating the iframe to it is blocked and the merchant
 * sees a blank frame. Use App Bridge's Redirect with REMOTE target, or a plain
 * anchor with target="_top".
 */
export function planSelectionUrl(shopDomain: string): string {
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/, '');
  return `https://admin.shopify.com/store/${storeHandle}/charges/${env.SHOPIFY_APP_HANDLE}/pricing_plans`;
}

/** What the paywall shows before a merchant has anything to read back. */
export function displayPrice(): { price: string; interval: string; planName: string } {
  return {
    price: env.SWIFTCART_DISPLAY_PRICE,
    interval: env.SWIFTCART_DISPLAY_INTERVAL,
    planName: env.SWIFTCART_PLAN_NAME,
  };
}
