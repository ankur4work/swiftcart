import { randomUUID } from 'node:crypto';
import { logger } from '../logger';
import { decrypt } from '../crypto';

export const ADMIN_API_VERSION = '2025-07';

export interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number | null;
      throttleStatus: ThrottleStatus;
    };
  };
}

export class ShopifyAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly shop: string,
    public readonly requestId: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ShopifyAPIError';
  }
}

/**
 * Thrown on 401/403 — in practice this always means the stored offline token
 * has expired (they last ~1h). Callers should treat it as "not entitled /
 * unknown" and let the next embedded app open re-exchange, never as a hard
 * failure that surfaces a stack trace to the merchant.
 */
export class ShopifyAuthError extends ShopifyAPIError {
  constructor(shop: string, requestId: string, body?: unknown) {
    super('Shopify auth error — access token likely expired', 403, shop, requestId, body);
    this.name = 'ShopifyAuthError';
  }
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number): number => base + Math.floor(Math.random() * base);

export interface ShopifyClientOptions {
  /** Bypass decryption — used when the token is already in hand post-exchange. */
  accessTokenOverride?: string;
  fetchImpl?: typeof fetch;
}

export class ShopifyClient {
  public readonly shopDomain: string;
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    store: { shopDomain: string; accessToken: string },
    opts: ShopifyClientOptions = {},
  ) {
    this.shopDomain = store.shopDomain;
    this.accessToken = opts.accessTokenOverride ?? decrypt(store.accessToken);
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private endpoint(): string {
    return `https://${this.shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
  }

  async graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<GraphQLResponse<T>> {
    let attempt = 0;

    for (;;) {
      const requestId = randomUUID();
      const started = Date.now();
      const res = await this.fetchImpl(this.endpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
          'X-Request-ID': requestId,
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal,
      });

      // 429 and 5xx are both retryable, with the same backoff shape.
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (attempt >= MAX_RETRIES) {
          throw new ShopifyAPIError(
            `Shopify ${res.status} after ${MAX_RETRIES} retries`,
            res.status,
            this.shopDomain,
            requestId,
          );
        }
        const wait = jitter(BASE_BACKOFF_MS * 2 ** attempt);
        logger.warn(
          { shop: this.shopDomain, requestId, status: res.status, wait, attempt },
          'Shopify retryable error — backing off',
        );
        await sleep(wait);
        attempt += 1;
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        const text = await res.text().catch(() => '');
        logger.warn(
          { shop: this.shopDomain, requestId, status: res.status, body: text.slice(0, 300) },
          'Shopify auth error',
        );
        throw new ShopifyAuthError(this.shopDomain, requestId, text);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ShopifyAPIError(
          `Shopify ${res.status}: ${text.slice(0, 300)}`,
          res.status,
          this.shopDomain,
          requestId,
          text,
        );
      }

      const body = (await res.json()) as GraphQLResponse<T>;
      logger.debug(
        {
          shop: this.shopDomain,
          requestId,
          duration: Date.now() - started,
          cost: body.extensions?.cost?.actualQueryCost,
        },
        'shopify.graphql',
      );

      const throttled = body.errors?.some((e) => e.extensions?.code === 'THROTTLED');
      if (throttled && attempt < MAX_RETRIES) {
        const wait = jitter(BASE_BACKOFF_MS * 2 ** attempt);
        logger.warn({ shop: this.shopDomain, requestId, wait, attempt }, 'GraphQL THROTTLED');
        await sleep(wait);
        attempt += 1;
        continue;
      }

      return body;
    }
  }
}
