'use client';

import { useState } from 'react';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineStack,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import { CartBarPreview } from './CartBarPreview';
import { DEFAULT_CONFIG, type PricingDisplay } from '@/lib/cart-bar';

interface Props {
  pricing: PricingDisplay;
  planSelectionUrl: string;
  /** True when the merchant HAD a subscription that has since lapsed. */
  lapsed: boolean;
  onRecheck: () => Promise<void>;
}

const VALUE_PROPS = [
  {
    title: 'The cart is never more than one tap away',
    body: 'A sticky bar or floating button follows the shopper on every page, showing live item count and subtotal. No hunting for the header icon on mobile.',
  },
  {
    title: 'Opens your theme drawer, not a new page',
    body: "SwiftCart triggers the cart drawer your theme already has, so shoppers never lose their place. Falls back to the cart page when there's no drawer.",
  },
  {
    title: 'Matches your brand in three colours',
    body: 'Background, text and accent, plus corner radius and copy. Preview every change live before it reaches your storefront.',
  },
  {
    title: 'Adds nothing to your page weight that matters',
    body: 'One small stylesheet and one script, served from the Shopify CDN as a theme app extension. No script tags injected into your theme.',
  },
];

/**
 * The hard paywall.
 *
 * SwiftCart has no free tier, so this is what an unsubscribed merchant sees
 * instead of the app — not a nag banner over a working product. The preview is
 * still shown because it is the clearest possible statement of what they would
 * be buying, and because a paywall with nothing to look at converts badly.
 */
export function Paywall({ pricing, planSelectionUrl, lapsed, onRecheck }: Props) {
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    try {
      await onRecheck();
    } finally {
      setChecking(false);
    }
  };

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <BlockStack gap="200">
                  <InlineStack gap="300" blockAlign="center">
                    <Text as="h1" variant="headingXl">
                      SwiftCart
                    </Text>
                    {lapsed ? (
                      <Badge tone="critical">Subscription ended</Badge>
                    ) : (
                      <Badge tone="info">Not subscribed</Badge>
                    )}
                  </InlineStack>
                  <Text as="p" variant="bodyLg" tone="subdued">
                    A floating cart bar that keeps the cart one tap away on every page.
                  </Text>
                </BlockStack>
              </InlineStack>

              <Divider />

              <InlineStack gap="500" align="space-between" blockAlign="center" wrap>
                <BlockStack gap="200">
                  <div className="sc-paywall-price">
                    <span className="sc-paywall-price__amount">{pricing.price}</span>
                    <Text as="span" variant="bodyLg" tone="subdued">
                      / {pricing.interval}
                    </Text>
                  </div>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {pricing.planName} · billed through Shopify · cancel any time
                  </Text>
                </BlockStack>

                <BlockStack gap="200" inlineAlign="end">
                  {/*
                    target="_top" is load-bearing. The plan page lives on
                    admin.shopify.com, which refuses to be framed — navigating
                    the embedded iframe there leaves the merchant staring at a
                    blank panel with no error.
                  */}
                  <Button
                    variant="primary"
                    size="large"
                    url={planSelectionUrl}
                    target="_top"
                  >
                    {lapsed ? 'Resubscribe' : 'Start subscription'}
                  </Button>
                  <Button variant="plain" onClick={recheck} loading={checking}>
                    Already subscribed? Refresh
                  </Button>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                What you get
              </Text>
              <BlockStack gap="400">
                {VALUE_PROPS.map((prop) => (
                  <BlockStack gap="100" key={prop.title}>
                    <Text as="h3" variant="headingSm">
                      {prop.title}
                    </Text>
                    <Text as="p" tone="subdued">
                      {prop.body}
                    </Text>
                  </BlockStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Preview
              </Text>
              <CartBarPreview
                config={DEFAULT_CONFIG}
                device="mobile"
                itemCount={2}
                subtotal="$84.00"
              />
              <Box paddingBlockStart="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Colours, copy, shape and placement are all configurable once you subscribe.
                </Text>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
