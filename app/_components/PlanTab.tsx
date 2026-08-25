'use client';

import {
  Badge,
  BlockStack,
  Button,
  Card,
  Divider,
  InlineStack,
  Layout,
  Text,
} from '@shopify/polaris';
import type { PricingDisplay, SubscriptionSummary } from '@/lib/cart-bar';

interface Props {
  subscription: SubscriptionSummary | null;
  pricing: PricingDisplay;
  planSelectionUrl: string;
}

export function PlanTab({ subscription, pricing, planSelectionUrl }: Props) {
  return (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="500">
            <InlineStack align="space-between" blockAlign="start" wrap>
              <BlockStack gap="200">
                <InlineStack gap="300" blockAlign="center">
                  <Text as="h2" variant="headingLg">
                    {subscription?.name ?? pricing.planName}
                  </Text>
                  <Badge tone="success">Active</Badge>
                  {subscription?.test && <Badge tone="attention">Test charge</Badge>}
                </InlineStack>
                <Text as="p" tone="subdued">
                  Billed by Shopify and charged to your Shopify invoice.
                </Text>
              </BlockStack>

              <BlockStack gap="100" inlineAlign="end">
                <Text as="p" variant="heading2xl">
                  {/*
                    Price comes from the merchant's REAL subscription whenever we
                    have one. The env-configured display price is only a fallback
                    for the brief window before the first read lands — using it
                    here unconditionally would show the wrong number to anyone
                    grandfathered on older pricing.
                  */}
                  {subscription?.price
                    ? formatMoney(subscription.price.amount, subscription.price.currencyCode)
                    : pricing.price}
                </Text>
                <Text as="p" tone="subdued">
                  per {subscription?.price?.interval === 'ANNUAL' ? 'year' : pricing.interval}
                </Text>
              </BlockStack>
            </InlineStack>

            <Divider />

            <BlockStack gap="300">
              {subscription?.currentPeriodEnd && (
                <DetailRow
                  label="Next billing date"
                  value={formatDate(subscription.currentPeriodEnd)}
                />
              )}
              {subscription?.trialDays ? (
                <DetailRow label="Trial" value={`${subscription.trialDays} days`} />
              ) : null}
              <DetailRow label="Status" value={titleCase(subscription?.status ?? 'Active')} />
            </BlockStack>

            <InlineStack gap="300">
              {/* Cancelling, upgrading and payment method all live on Shopify's
                  hosted page — the app deliberately owns none of it. */}
              <Button url={planSelectionUrl} target="_top">
                Manage subscription
              </Button>
            </InlineStack>

            <Text as="p" variant="bodySm" tone="subdued">
              Cancelling takes effect at the end of the current billing period. SwiftCart stops
              appearing on your storefront when the subscription ends; your design settings are
              kept in case you come back.
            </Text>
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <InlineStack align="space-between">
      <Text as="span" tone="subdued">
        {label}
      </Text>
      <Text as="span" fontWeight="medium">
        {value}
      </Text>
    </InlineStack>
  );
}

function formatMoney(amount: string, currencyCode: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currencyCode}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      // Shopify returns "30.0"; trailing cents on a round monthly price is noise.
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${amount} ${currencyCode}`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
