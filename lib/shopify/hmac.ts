import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env';

/** OAuth / admin redirect HMAC (hex digest over sorted query params). */
export function verifyOAuthHmac(params: Record<string, string>): boolean {
  const { hmac, signature: _signature, ...rest } = params;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join('&');

  const computed = createHmac('sha256', env.SHOPIFY_API_SECRET).update(message).digest('hex');
  return safeEqualHex(computed, hmac);
}

/** Webhook HMAC (base64 digest over the RAW request body — never the parsed JSON). */
export function verifyWebhookHmac(rawBody: string | Buffer, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const computed = createHmac('sha256', env.SHOPIFY_API_SECRET).update(body).digest('base64');
  return safeEqualB64(computed, hmacHeader);
}

/**
 * App proxy signature.
 *
 * Different scheme from the other two, and the difference is easy to get
 * wrong: the parameter is `signature` (not `hmac`), the digest is hex, and the
 * message joins sorted `key=value` pairs with NO separator at all — not `&`.
 * Repeated params are joined with a comma before hashing.
 *
 * https://shopify.dev/docs/apps/build/online-store/display-dynamic-data#calculate-a-digital-signature
 */
export function verifyAppProxySignature(searchParams: URLSearchParams): boolean {
  const signature = searchParams.get('signature');
  if (!signature) return false;

  const grouped = new Map<string, string[]>();
  for (const [key, value] of searchParams.entries()) {
    if (key === 'signature') continue;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(value);
    else grouped.set(key, [value]);
  }

  const message = [...grouped.keys()]
    .sort()
    .map((key) => `${key}=${grouped.get(key)!.join(',')}`)
    .join('');

  const computed = createHmac('sha256', env.SHOPIFY_API_SECRET).update(message).digest('hex');
  return safeEqualHex(computed, signature);
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length === 0 || ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function safeEqualB64(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'base64');
    const bb = Buffer.from(b, 'base64');
    if (ab.length === 0 || ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
