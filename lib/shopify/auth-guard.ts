import { NextRequest, NextResponse } from 'next/server';
import type { Store } from '@prisma/client';
import { extractBearerToken, verifySessionToken, type ShopifySessionClaims } from './session';
import { getStore } from './store';
import { logger } from '../logger';

export interface AuthContext {
  claims: ShopifySessionClaims;
  shopDomain: string;
}

export interface StoreContext extends AuthContext {
  store: Store;
}

/**
 * Verify the App Bridge session token on an embedded API call.
 *
 * Returns either the context or a ready-to-return 401 NextResponse — callers
 * branch with `instanceof NextResponse`. This keeps the guard usable from route
 * handlers without throwing, which in the App Router means a wrapped 500 rather
 * than the 401 the frontend needs in order to retry with a fresh token.
 */
export async function requireSessionToken(req: NextRequest): Promise<AuthContext | NextResponse> {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'missing bearer token' }, { status: 401 });
  }
  try {
    const claims = await verifySessionToken(token);
    return { claims, shopDomain: claims.shop };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Session token verification failed');
    return NextResponse.json({ error: 'invalid session token' }, { status: 401 });
  }
}

/** As `requireSessionToken`, but also resolves the installed Store row. */
export async function requireStore(req: NextRequest): Promise<StoreContext | NextResponse> {
  const auth = await requireSessionToken(req);
  if (auth instanceof NextResponse) return auth;

  const store = await getStore(auth.shopDomain);
  if (!store) {
    // Valid token, no install record: the merchant reached an API route before
    // /api/session/bootstrap ran, or reinstalled without it. 409 (not 401)
    // because retrying with a fresh token would not help — the frontend needs
    // to run bootstrap first.
    return NextResponse.json(
      { error: 'store not installed', action: 'bootstrap' },
      { status: 409 },
    );
  }

  return { ...auth, store };
}
