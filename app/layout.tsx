import type { Metadata } from 'next';
import Script from 'next/script';
import { env } from '@/lib/env';
import '@shopify/polaris/build/esm/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'SwiftCart',
  description: 'A floating cart bar that keeps the cart one tap away on every page.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          App Bridge must be the FIRST script on the page — it sets up the
          iframe handshake with the admin and exposes the global `shopify`
          object everything else depends on. `beforeInteractive` is what puts
          it in <head> ahead of the React bundle; with the default strategy it
          loads after hydration and every `shopify.idToken()` call in the tree
          throws on first render.
        */}
        <Script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={env.SHOPIFY_API_KEY}
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
