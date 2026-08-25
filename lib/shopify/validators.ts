import { z } from 'zod';

export const SHOP_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/**
 * True if the string contains any ASCII control character (NUL, CR, LF, ...).
 *
 * This has to be checked *before* trimming, not after. `String.prototype.trim()`
 * strips \n and \r along with ordinary spaces, so a trailing
 * `shop.myshopify.com\n` would otherwise normalize into a perfectly valid
 * domain and pass. The shop domain arrives from query params and webhook
 * headers and then flows into log lines and outbound URLs — a surviving CR/LF
 * is a header- and log-injection primitive, so reject the input outright
 * rather than silently sanitising it.
 *
 * Written as a code scan rather than a regex so the source carries no literal
 * control bytes.
 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Canonicalize a shop domain, or return null if it isn't a valid one.
 * Single source of truth shared by the schema and the type guard, so the two
 * can never disagree about what is acceptable.
 */
function normalizeShopDomain(raw: string): string | null {
  if (hasControlChar(raw)) return null;
  const normalized = raw.trim().toLowerCase();
  return SHOP_DOMAIN_REGEX.test(normalized) ? normalized : null;
}

export const ShopDomainSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeShopDomain(value);
  if (normalized === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid shop domain' });
    return z.NEVER;
  }
  return normalized;
});

export function isValidShopDomain(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  return normalizeShopDomain(input) !== null;
}

/** Hex colour, 3 or 6 digits, with leading #. Rejects anything else outright. */
export const HexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex colour like #2563EB');

/**
 * A CSS selector the merchant supplies to point at their theme's cart-drawer
 * trigger. It is injected into `document.querySelector()` in the storefront, so
 * the character set is restricted to what selectors legitimately need —
 * quotes, angle brackets, backslashes and parens are all refused.
 *
 * This is defence in depth, not the primary control: the value only ever
 * reaches querySelector, never innerHTML or eval. But a merchant account is not
 * automatically trusted (staff accounts, compromised sessions), and a selector
 * field is an obvious place to try an escape.
 */
export const CartOpenSelectorSchema = z
  .string()
  .max(200)
  .regex(/^[a-zA-Z0-9\s._#\-[\]="':>+~*,]*$/, 'Contains characters not valid in a CSS selector')
  .refine((v) => !v.includes('javascript:'), 'Invalid selector');
