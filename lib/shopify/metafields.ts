import type { Entitlement, Store } from '@prisma/client';
import { ShopifyClient } from './client';
import { logger } from '../logger';

/**
 * Mirror entitlement into a shop metafield so the storefront can gate on it
 * with ZERO network calls.
 *
 * Why this exists: the obvious implementation — and the one the app this
 * replaces used — has the theme extension `fetch()` an app-proxy endpoint on
 * every single storefront page load, then unhide the cart bar once the answer
 * arrives. That costs a round-trip to our server before the bar can paint, on
 * every page, for every shopper. It is the slowest possible way to answer a
 * question whose answer changes maybe once a month.
 *
 * A shop metafield is rendered into the page by Liquid at no cost. The app
 * proxy endpoint still exists (`/api/proxy/status`) purely as a fallback for
 * the window where the metafield hasn't been written yet.
 *
 * NAMESPACE / KEY are load-bearing: they are hard-coded in the extension's
 * Liquid as `shop.metafields.swiftcart.plan`. Changing either here without
 * changing the Liquid silently reverts every storefront to the slow path.
 */
export const METAFIELD_NAMESPACE = 'swiftcart';
export const METAFIELD_KEY = 'plan';

const SHOP_ID_QUERY = /* GraphQL */ `
  query ShopId {
    shop {
      id
    }
  }
`;

const METAFIELD_DEFINITION_CREATE = /* GraphQL */ `
  mutation CreatePlanDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
      }
      userErrors {
        field
        message
        code
      }
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
 * Create the metafield definition, once per store.
 *
 * The definition is what makes the metafield readable from Liquid and the
 * Storefront API — a bare `metafieldsSet` without one writes a value the theme
 * cannot see, which fails in the most confusing possible way (the write
 * succeeds, the storefront reads blank).
 *
 * Safe to call repeatedly: a definition that already exists comes back as the
 * TAKEN user error, which we treat as success.
 */
async function ensureDefinition(client: ShopifyClient): Promise<void> {
  const resp = await client.graphql<{
    metafieldDefinitionCreate: {
      createdDefinition: { id: string } | null;
      userErrors: Array<{ field: string[] | null; message: string; code: string | null }>;
    };
  }>(METAFIELD_DEFINITION_CREATE, {
    definition: {
      name: 'SwiftCart plan',
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEY,
      description: 'SwiftCart subscription state. Managed by the app — do not edit.',
      type: 'single_line_text_field',
      ownerType: 'SHOP',
      access: {
        admin: 'MERCHANT_READ',
        storefront: 'PUBLIC_READ',
      },
    },
  });

  const errors = resp.data?.metafieldDefinitionCreate?.userErrors ?? [];
  const realErrors = errors.filter((e) => e.code !== 'TAKEN');
  if (realErrors.length > 0) {
    // Not fatal — the app proxy fallback covers us. Log loudly enough to notice
    // if it starts happening to every store.
    logger.warn(
      { shop: client.shopDomain, errors: realErrors },
      'Could not create SwiftCart plan metafield definition — storefront will use the proxy fallback',
    );
  }
}

/**
 * Write the current entitlement to `shop.metafields.swiftcart.plan`.
 *
 * Value is the lowercase entitlement — "active" or "none" — matching what the
 * Liquid compares against.
 *
 * Never throws. A failed mirror degrades the storefront to the proxy fallback;
 * it must not break the caller (an app open, or a webhook that has already
 * committed the authoritative state to our own database).
 */
export async function syncPlanMetafield(
  store: Pick<Store, 'shopDomain' | 'accessToken'>,
  entitlement: Entitlement,
): Promise<boolean> {
  try {
    const client = new ShopifyClient(store);

    const shopResp = await client.graphql<{ shop: { id: string } }>(SHOP_ID_QUERY);
    const shopId = shopResp.data?.shop?.id;
    if (!shopId) {
      logger.warn({ shop: store.shopDomain }, 'Could not resolve shop GID for metafield write');
      return false;
    }

    await ensureDefinition(client);

    const setResp = await client.graphql<{
      metafieldsSet: {
        metafields: Array<{ id: string }>;
        userErrors: Array<{ field: string[] | null; message: string }>;
      };
    }>(METAFIELDS_SET, {
      metafields: [
        {
          ownerId: shopId,
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

    logger.info(
      { shop: store.shopDomain, entitlement },
      'Mirrored entitlement to shop metafield',
    );
    return true;
  } catch (err) {
    logger.warn(
      { shop: store.shopDomain, err: (err as Error).message },
      'Failed to mirror entitlement to shop metafield — storefront falls back to proxy',
    );
    return false;
  }
}
