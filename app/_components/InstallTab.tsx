'use client';

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  List,
  Text,
} from '@shopify/polaris';

interface Props {
  shop: string;
}

/**
 * Setup instructions.
 *
 * The one thing a merchant must do that the app cannot do for them: turn on the
 * app embed in the theme editor. Theme app extensions are off by default and
 * there is no API to enable one — so an app that doesn't say this clearly gets
 * uninstalled by merchants who concluded it simply doesn't work.
 */
export function InstallTab({ shop }: Props) {
  // Deep link straight to the Apps section of the theme editor for the live
  // theme. Once the extension is published you can append
  // `&activateAppId=<uuid>/swiftcart-bar` to pre-toggle the embed itself —
  // the UUID only exists after `shopify app deploy`, so this links to the
  // section rather than hard-coding an ID that isn't minted yet.
  const themeEditorUrl = `https://${shop}/admin/themes/current/editor?context=apps`;

  return (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="500">
            <InlineStack gap="300" blockAlign="center">
              <Text as="h2" variant="headingLg">
                Turn on SwiftCart in your theme
              </Text>
              <Badge tone="attention">Required</Badge>
            </InlineStack>

            <Text as="p" tone="subdued">
              Shopify keeps app embeds switched off until you enable them, so this last step is
              yours. It takes about thirty seconds and doesn&apos;t change your theme code.
            </Text>

            <Box
              background="bg-surface-secondary"
              padding="400"
              borderRadius="300"
            >
              <BlockStack gap="300">
                <List type="number">
                  <List.Item>Open the theme editor using the button below.</List.Item>
                  <List.Item>
                    In the left sidebar, choose <b>App embeds</b>.
                  </List.Item>
                  <List.Item>
                    Find <b>SwiftCart</b> and switch it on.
                  </List.Item>
                  <List.Item>
                    Click <b>Save</b>.
                  </List.Item>
                </List>
              </BlockStack>
            </Box>

            <InlineStack gap="300">
              <Button variant="primary" url={themeEditorUrl} target="_top">
                Open theme editor
              </Button>
              <Button url={`https://${shop}`} target="_blank">
                View storefront
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </Layout.Section>

      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Not seeing the bar?
            </Text>
            <BlockStack gap="300">
              <Troubleshoot
                symptom="Nothing appears on the storefront"
                fix="Check that the app embed is switched on and saved in the theme editor, and that you're looking at the live theme rather than a copy."
              />
              <Troubleshoot
                symptom="The bar appears, but only after adding something to the cart"
                fix="That's “Hide when the cart is empty” working as intended. Turn it off on the Design tab if you want it visible at all times."
              />
              <Troubleshoot
                symptom="Tapping it loads the cart page instead of opening the drawer"
                fix="Your theme's drawer trigger wasn't detected automatically. Paste its CSS selector into the Cart drawer field on the Design tab."
              />
              <Troubleshoot
                symptom="It overlaps something at the bottom of the page"
                fix="Switch the shape to the floating button, or move it to a middle position, on the Design tab."
              />
            </BlockStack>
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );
}

function Troubleshoot({ symptom, fix }: { symptom: string; fix: string }) {
  return (
    <BlockStack gap="100">
      <Text as="h3" variant="headingSm">
        {symptom}
      </Text>
      <Text as="p" tone="subdued">
        {fix}
      </Text>
    </BlockStack>
  );
}
