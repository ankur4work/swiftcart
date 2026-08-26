import type { Entitlement, Store } from '@prisma/client';
import { ShopifyClient } from './client';
import { logger } from '../logger';

/**
 * Mirror entitlement into an APP-DATA METAFIELD so the storefront can gate on
 * it with ZERO network calls.
 *
 * Why this exists: the obvious implementation — and the one the app this
 * replaces used — has the theme extension `fetch()` an app-proxy endpoint on
 * every storefront page load, then unhide the cart bar once the answer
 * arrives. That costs a round-trip before the bar can paint, on every page, for
 * every shopper, to answer a question whose answer changes maybe once a month.
 * A metafield is rendered into the page by Liquid at no cost.
 *
 * ---
 *
 * Owner is the APP INSTALLATION, not the shop, and that distinction is
 * load-bearing:
 *
 *  - Writing a shop-owned metafield in a custom namespace needs an access
 *    scope. The obvious-looking `write_metafields` **does not exist** — Shopify
 *    rejects it at deploy time with "These scopes are invalid", because
 *    metafield access is granted through the owner resource's scope, and there
 *    is no scope that grants the Shop resource for this purpose alone.
 *  - App-data metafields live on the app's own installation under the reserved
 *    `$app:` namespace. An app always has access to its own installation, so
 *    this requires **no access scope at all** — which is why SwiftCart ships
 *    with an empty scope list and the merchant sees no permission prompt.
 *  - They are readable from a theme app extension as `app.metafields.*`.
 *
 * NAMESPACE / KEY are load-bearing: they are hard-coded in the extension's
 * Liquid as `app.metafields.swiftcart.plan`. `$app:swiftcart` resolves to the
 * fully-qualified `app--{app_id}--swiftcart`, which the `app` Liquid object
 * already scopes for us. Change either here without changing the Liquid and
 * every storefront silently reverts to the slow proxy path.
 */
export const METAFIELD_NAMESPACE = '$app:swiftcart';
export const METAFIELD_KEY = 'plan';

const APP_INSTALLATION_QUERY = /* GraphQL */ `
  query AppInstallationId {
    currentAppInstallation {
      id
    }
  }
`;

const METAFIELDS_SET = /* GraphQL */ `
  mutation SetPlanMetafield($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/**
 * Write the current entitlement to `app.metafields.swiftcart.plan`.
 *
 * Value is the lowercase entitlement — "active" or "none" — matching what the
 * Liquid compares against.
 *
 * Never throws. A failed mirror degrades the storefront to the app-proxy
 * fallback; it must not break the caller (an app open, or a webhook that has
 * already committed the authoritative state to our own database).
 */
export async function syncPlanMetafield(
  store: Pick<Store, 'shopDomain' | 'accessToken'>,
  entitlement: Entitlement,
): Promise<boolean> {
  try {
    const client = new ShopifyClient(store);

    const installResp = await client.graphql<{
      currentAppInstallation: { id: string } | null;
    }>(APP_INSTALLATION_QUERY);

    const ownerId = installResp.data?.currentAppInstallation?.id;
    if (!ownerId) {
      logger.warn(
        { shop: store.shopDomain },
        'Could not resolve app installation GID for metafield write',
      );
      return false;
    }

    const setResp = await client.graphql<{
      metafieldsSet: {
        metafields: Array<{ id: string }>;
        userErrors: Array<{ field: string[] | null; message: string }>;
      };
    }>(METAFIELDS_SET, {
      metafields: [
        {
          ownerId,
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
          type: 'single_line_text_field',
          value: entitlement.toLowerCase(),
        },
      ],
    });

    const errors = setResp.data?.metafieldsSet?.userErrors ?? [];
    if (errors.length > 0) {
      logger.warn({ shop: store.shopDomain, errors }, 'metafieldsSet returned user errors');
      return false;
    }

    logger.info({ shop: store.shopDomain, entitlement }, 'Mirrored entitlement to app metafield');
    return true;
  } catch (err) {
    logger.warn(
      { shop: store.shopDomain, err: (err as Error).message },
      'Failed to mirror entitlement to app metafield — storefront falls back to proxy',
    );
    return false;
  }
}
