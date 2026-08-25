'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppProvider,
  Badge,
  BlockStack,
  Banner,
  Box,
  Card,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  SkeletonDisplayText,
  Tabs,
  Text,
} from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useShopifyFetch } from './useShopifyFetch';
import { Paywall } from './Paywall';
import { DesignTab } from './DesignTab';
import { InstallTab } from './InstallTab';
import { PlanTab } from './PlanTab';
import { SupportTab } from './SupportTab';
import { toConfig, type BootstrapResult, type CartBarConfig } from '@/lib/cart-bar';

interface Props {
  supportEmail: string;
}

const TABS = [
  { id: 'design', content: 'Design' },
  { id: 'setup', content: 'Setup' },
  { id: 'plan', content: 'Plan' },
  { id: 'support', content: 'Support' },
];

export function AppShell({ supportEmail }: Props) {
  const shopifyFetch = useShopifyFetch();

  const [boot, setBoot] = useState<BootstrapResult | null>(null);
  const [config, setConfig] = useState<CartBarConfig | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /**
   * The last configuration the server acknowledged. Comparing against this —
   * rather than tracking a boolean the change handler flips — means the Save
   * button correctly goes quiet again when a merchant edits a field and then
   * undoes the edit by hand.
   */
  const persisted = useRef<CartBarConfig | null>(null);
  const dirty =
    config !== null &&
    persisted.current !== null &&
    JSON.stringify(config) !== JSON.stringify(persisted.current);

  const load = useCallback(async () => {
    // Bootstrap first, unconditionally: it is what exchanges the session token
    // for a usable access token, so /api/settings would 409 on a fresh install
    // if this were skipped or run in parallel.
    const bootRes = await shopifyFetch('/api/session/bootstrap', { method: 'POST' });
    if (!bootRes.ok) {
      throw new Error(`Could not start the app (${bootRes.status})`);
    }
    const bootJson = (await bootRes.json()) as BootstrapResult;
    setBoot(bootJson);

    const settingsRes = await shopifyFetch('/api/settings');
    if (settingsRes.ok) {
      const { settings } = (await settingsRes.json()) as { settings: Partial<CartBarConfig> };
      const next = toConfig(settings);
      persisted.current = next;
      setConfig(next);
    }
  }, [shopifyFetch]);

  useEffect(() => {
    load().catch((err: Error) => setFatal(err.message));
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await shopifyFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(config),
      });

      if (res.status === 402) {
        // Subscription lapsed while the tab was open. Re-run bootstrap so the
        // paywall takes over rather than leaving the merchant editing settings
        // that will never apply.
        await load();
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          issues?: Array<{ message: string }>;
        };
        throw new Error(body.issues?.[0]?.message ?? `Save failed (${res.status})`);
      }

      const { settings } = (await res.json()) as { settings: Partial<CartBarConfig> };
      const next = toConfig(settings);
      persisted.current = next;
      setConfig(next);
      setSaved(true);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const recheckSubscription = async () => {
    await load();
  };

  if (fatal) {
    return (
      <AppProvider i18n={enTranslations}>
        <Page>
          <Banner tone="critical" title="SwiftCart couldn't start">
            <p>{fatal}</p>
            <p>
              Reload the page. If it keeps happening, email {supportEmail} and we&apos;ll take a
              look.
            </p>
          </Banner>
        </Page>
      </AppProvider>
    );
  }

  if (!boot) {
    return (
      <AppProvider i18n={enTranslations}>
        <Page>
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <SkeletonDisplayText size="medium" />
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </AppProvider>
    );
  }

  if (!boot.entitled) {
    return (
      <AppProvider i18n={enTranslations}>
        <Paywall
          pricing={boot.pricing}
          planSelectionUrl={boot.planSelectionUrl}
          // A merchant who has a subscription record but isn't entitled has
          // cancelled or lapsed — worth saying so, since the copy and the CTA
          // both change.
          lapsed={boot.subscription !== null}
          onRecheck={recheckSubscription}
        />
      </AppProvider>
    );
  }

  return (
    <AppProvider i18n={enTranslations}>
      <Page
        title="SwiftCart"
        subtitle="A floating cart bar that keeps the cart one tap away."
        titleMetadata={<Badge tone="success">Active</Badge>}
      >
        <BlockStack gap="400">
          {saved && (
            <Banner tone="success" onDismiss={() => setSaved(false)}>
              Saved. Your storefront is updated.
            </Banner>
          )}

          <Card padding="0">
            <Tabs tabs={TABS} selected={tab} onSelect={setTab} fitted />
          </Card>

          <Box paddingBlockStart="200">
            {tab === 0 &&
              (config ? (
                <DesignTab
                  config={config}
                  onChange={setConfig}
                  onSave={save}
                  saving={saving}
                  dirty={dirty}
                  error={saveError}
                />
              ) : (
                <Card>
                  <SkeletonBodyText lines={6} />
                </Card>
              ))}

            {tab === 1 && <InstallTab shop={boot.shop} />}

            {tab === 2 && (
              <PlanTab
                subscription={boot.subscription}
                pricing={boot.pricing}
                planSelectionUrl={boot.planSelectionUrl}
              />
            )}

            {tab === 3 && <SupportTab supportEmail={supportEmail} shop={boot.shop} />}
          </Box>

          <Box paddingBlockEnd="800">
            <InlineStack align="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {boot.shop}
              </Text>
            </InlineStack>
          </Box>
        </BlockStack>
      </Page>
    </AppProvider>
  );
}
