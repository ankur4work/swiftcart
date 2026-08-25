# SwiftCart

A floating cart bar for Shopify. A sticky bar or floating button follows the shopper on every page, showing live item count and subtotal, and opens the theme's own cart drawer on tap.

Paid-only: a single **$30/month** plan through Shopify Managed Pricing. There is no free tier and no trial.

---

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js 14 (App Router), TypeScript |
| Admin UI | Polaris v13 + App Bridge v4 (CDN) |
| Data | Postgres via Prisma |
| Storefront | Theme app extension (Liquid + one CSS + one JS asset) |
| Auth | Token exchange (no OAuth redirect flow) |
| Billing | Shopify Managed Pricing — plans live in the Partner dashboard |
| Hosting | Docker on Coolify |

## Layout

```
app/
  _components/        Admin UI — paywall, design editor, live preview, tabs
  api/
    session/bootstrap Token exchange + entitlement sync; runs on every app open
    settings          GET/PUT cart bar configuration
    subscription      Re-reads subscription state from Shopify
    proxy/status      Signed app-proxy fallback for the storefront
    webhooks/         uninstall, subscription updates, 3× GDPR
    health            Liveness + config-drift probe
lib/
  shopify/            Auth, HMAC, GraphQL client, billing, metafields
  entitlement.ts      The single write path for "is this store paid"
extensions/
  swiftcart-bar/      The theme app extension that renders on the storefront
```

## How entitlement reaches the storefront

This is the part worth understanding before changing anything.

1. `lib/entitlement.ts` reads the merchant's real subscription from the Admin API — on every app open, and from the `app_subscriptions/update` webhook.
2. It writes the result to `Store.entitlement` **and** mirrors it into the shop metafield `swiftcart.plan`.
3. The theme extension checks that metafield **in Liquid**. Not subscribed → the block outputs nothing at all: no markup, no CSS, no JS.
4. Only when the metafield is unreadable (fresh install) does the storefront fall back to one signed app-proxy call, cached in `sessionStorage`.

The result is that the common path costs the storefront **zero** network requests to answer "is this store paid".

## Local setup

```bash
pnpm install
cp .env.example .env          # fill in SHOPIFY_API_KEY / SECRET / SESSION_SECRET
pnpm docker:up                # Postgres on host port 5433
pnpm prisma:migrate           # create the schema
pnpm dev:shopify              # Shopify CLI tunnel + dev server
```

Generate `SESSION_SECRET` with `openssl rand -hex 32`.

## Before the first deploy

The app does not exist in the Partner dashboard yet, so three placeholders need real values:

| Where | Placeholder |
| --- | --- |
| `shopify.app.toml` | `client_id = "REPLACE_WITH_CLIENT_ID"` |
| `lib/shopify/app-identity.ts` | `APP_CLIENT_ID` |
| Coolify env | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` |

`/api/health?strict=1` compares the running env against `app-identity.ts` and returns 503 on a mismatch, so a deploy pointed at the wrong app fails the health check instead of hanging on a blank embedded screen. That check stays dormant until `APP_CLIENT_ID` is filled in.

Then, in the Partner dashboard: create **one** plan at $30/month with **no free option**, and set the app handle to `swiftcart` so the hosted plan URL resolves.

## Deployment

Coolify builds `docker/Dockerfile`. Set the health check to `/api/health?strict=1`.

Required env vars are listed in `.env.example`. Note that the Dockerfile declares them as build `ARG`s as well — Coolify passes env at build time, and `SHOPIFY_API_KEY` in particular is baked into the App Bridge script tag.

Deploy credentials live in `.deploy/coolify.env`, which is gitignored.

## Scopes

`write_metafields`, and nothing else.

The extension renders from Liquid and the Ajax Cart API, so it needs no product, order or cart access. The single scope is for the entitlement metafield. Adding scopes means more App Store review questions and a scarier install prompt — don't widen it without a concrete need.

## Known consideration: Polaris React

The admin UI is built on `@shopify/polaris` v13.9.5 — the latest published version, and the same family the other apps here use. npm marks it deprecated: Shopify now points new admin work at **Polaris web components** instead.

Nothing is broken and nothing blocks App Store submission — v13 is stable and widely deployed. But it is no longer maintained, so at some point the UI layer will want porting. That is a contained job: it touches `app/_components/` only. The storefront extension, billing, auth and data layers have no Polaris dependency at all.

## Data handling

No shopper data is stored. No customer identifier, cart contents, or browsing event ever reaches this server — which is why the two customer GDPR webhooks are honest acknowledged no-ops rather than stubs. `shop/redact` deletes the store row outright.
