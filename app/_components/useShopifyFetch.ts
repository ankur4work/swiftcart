'use client';

import { useCallback } from 'react';

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      config?: { shop?: string };
    };
  }
}

/**
 * `fetch` with a fresh App Bridge session token attached.
 *
 * App Bridge v4 does patch same-origin fetch to add this header on its own, but
 * we set it explicitly anyway: the patch is invisible at the call site, so when
 * a request comes back 401 there is no way to tell from the code whether the
 * token was attached and rejected or never attached at all. Being explicit
 * makes that a one-line question instead of a debugging session.
 *
 * A token is minted per call rather than cached. They expire after about a
 * minute, and `idToken()` is served from App Bridge's own cache, so this is
 * cheap and removes a whole class of "worked until the tab sat idle" bugs.
 */
export function useShopifyFetch(): (path: string, init?: RequestInit) => Promise<Response> {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const bridge = typeof window !== 'undefined' ? window.shopify : undefined;
    if (!bridge?.idToken) {
      throw new Error('App Bridge is not available — is the app running inside Shopify admin?');
    }

    const token = await bridge.idToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return fetch(path, { ...init, headers });
  }, []);
}
