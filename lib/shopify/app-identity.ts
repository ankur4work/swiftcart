/**
 * Canonical identity of THIS app, mirrored from `shopify.app.toml`.
 *
 * The runtime environment (SHOPIFY_API_KEY / SHOPIFY_APP_URL / SHOPIFY_SCOPES)
 * is validated against these constants in `/api/health` so that a deploy
 * pointed at the WRONG app or domain fails loudly — Coolify's health check
 * rolls it back — instead of silently hanging on the embedded App Bridge
 * skeleton screen, which is what a client_id mismatch looks like from the
 * merchant's side.
 *
 * Why this can't be derived from env alone: Zod rejects a *missing* var, but
 * cannot catch one that is present yet wrong — the previous app's client_id
 * left over after re-creating the app, or a stale domain in APP_URL.
 *
 * ⚠️ If you re-create, rename, or re-domain the app, update BOTH this file and
 * `shopify.app.toml` (and the Coolify env vars) so all three agree.
 */

/**
 * Matches `client_id` in shopify.app.toml. Public identifier — safe to commit.
 *
 * Annotated `: string` rather than left to inference on purpose: with the
 * literal type, TypeScript narrows the placeholder comparison below to `never`
 * and the guard stops compiling the moment a real ID is pasted in.
 */
export const APP_CLIENT_ID: string = 'b933b83ab9f7c6c531cf0859d40f247d';

/** Host portion of `application_url` in shopify.app.toml (no scheme, no path). */
export const APP_HOST = 'swiftcart.live';

/** Matches `access_scopes.scopes` in shopify.app.toml. Order-insensitive. */
export const APP_SCOPES = 'write_metafields';

function normalizeScopes(raw: string): string {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

/**
 * Compare the live env against the canonical identity above. Returns the list
 * of mismatches (empty = healthy). Intended for production only — dev uses a
 * throwaway tunnel URL that will never match.
 */
export function checkAppIdentity(env: {
  SHOPIFY_API_KEY: string;
  SHOPIFY_APP_URL: string;
  SHOPIFY_SCOPES: string;
}): string[] {
  const issues: string[] = [];

  // Skip the client_id comparison while the placeholder is still in place —
  // before the Partner dashboard app exists there is nothing to compare to, and
  // failing here would block the very first deploy.
  if (APP_CLIENT_ID !== 'REPLACE_WITH_CLIENT_ID' && env.SHOPIFY_API_KEY !== APP_CLIENT_ID) {
    issues.push(
      `SHOPIFY_API_KEY (${env.SHOPIFY_API_KEY.slice(0, 8)}…) does not match expected client_id ${APP_CLIENT_ID.slice(0, 8)}…`,
    );
  }

  let host = '';
  try {
    host = new URL(env.SHOPIFY_APP_URL).host;
  } catch {
    host = '(unparseable)';
  }
  if (host !== APP_HOST) {
    issues.push(`SHOPIFY_APP_URL host '${host}' does not match expected '${APP_HOST}'`);
  }

  if (normalizeScopes(env.SHOPIFY_SCOPES) !== normalizeScopes(APP_SCOPES)) {
    issues.push(
      `SHOPIFY_SCOPES '${env.SHOPIFY_SCOPES}' does not match shopify.app.toml scopes '${APP_SCOPES}'`,
    );
  }

  return issues;
}
