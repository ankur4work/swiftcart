'use client';

import { BlockStack, Button, Card, InlineStack, Layout, Text } from '@shopify/polaris';

interface Props {
  supportEmail: string;
  shop: string;
}

const FAQ = [
  {
    q: 'Does SwiftCart edit my theme files?',
    a: 'No. It ships as a theme app extension, which Shopify renders alongside your theme. Nothing is written into your theme code, and uninstalling removes it cleanly with no leftovers.',
  },
  {
    q: 'Will it slow my store down?',
    a: 'One small stylesheet and one script, both served from the Shopify CDN. The cart bar reads the cart state Shopify already renders into the page, so it draws immediately rather than waiting on a network call.',
  },
  {
    q: 'Does it work with my theme?',
    a: 'It works with any theme, because it renders on top of the page rather than inside it. Themes with their own cart drawer are detected automatically; if yours is unusual, set the drawer selector on the Design tab.',
  },
  {
    q: 'What happens if I cancel?',
    a: 'The cart bar stops appearing on your storefront at the end of the billing period. Your design settings are kept, so resubscribing restores exactly what you had.',
  },
  {
    q: 'Does it collect shopper data?',
    a: 'No. No shopper identifier, cart contents, or browsing activity is ever sent to our servers. There is nowhere in the app that stores customer data.',
  },
];

export function SupportTab({ supportEmail, shop }: Props) {
  const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(`SwiftCart support — ${shop}`)}`;

  return (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              Need a hand?
            </Text>
            <Text as="p" tone="subdued">
              Email us and include your store URL — we usually reply within one business day.
            </Text>
            <InlineStack gap="300">
              <Button variant="primary" url={mailto} target="_top">
                Email support
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </Layout.Section>

      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Common questions
            </Text>
            <BlockStack gap="400">
              {FAQ.map((item) => (
                <BlockStack gap="100" key={item.q}>
                  <Text as="h3" variant="headingSm">
                    {item.q}
                  </Text>
                  <Text as="p" tone="subdued">
                    {item.a}
                  </Text>
                </BlockStack>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );
}
