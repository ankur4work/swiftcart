import { NextRequest, NextResponse } from 'next/server';

/**
 * Content-Security-Policy for an embedded app.
 *
 * Shopify requires `frame-ancestors` to name the specific shop admin plus
 * admin.shopify.com, and App Store review checks for it. The shop comes from
 * the `?shop=` param the admin appends when it loads the iframe.
 *
 * The param is untrusted, so it is matched against a strict myshopify pattern
 * before being interpolated — an unvalidated value here would let anyone frame
 * the app from a host of their choosing, which is the exact attack
 * frame-ancestors exists to stop.
 *
 * API routes are excluded: they are fetched, never framed, and a CSP on a JSON
 * response is noise.
 */
const SHOP_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function middleware(req: NextRequest): NextResponse {
  const res = NextResponse.next();

  const shop = req.nextUrl.searchParams.get('shop');
  const ancestors =
    shop && SHOP_PATTERN.test(shop.toLowerCase())
      ? `https://${shop.toLowerCase()} https://admin.shopify.com`
      : 'https://admin.shopify.com';

  res.headers.set('Content-Security-Policy', `frame-ancestors ${ancestors};`);
  // Some proxies inject this; it would override frame-ancestors and blank the
  // embedded app. next.config.mjs blanks it too — belt and braces, because the
  // failure mode is a white screen with nothing in the console.
  res.headers.delete('X-Frame-Options');

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
