'use client';

import { useState } from 'react';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Divider,
  InlineStack,
  Layout,
  RangeSlider,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { CartBarPreview } from './CartBarPreview';
import type { ButtonPosition, CartBarConfig } from '@/lib/cart-bar';

interface Props {
  config: CartBarConfig;
  onChange: (next: CartBarConfig) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  dirty: boolean;
  error: string | null;
}

const POSITION_OPTIONS: Array<{ label: string; value: ButtonPosition }> = [
  { label: 'Bottom right', value: 'BOTTOM_RIGHT' },
  { label: 'Bottom left', value: 'BOTTOM_LEFT' },
  { label: 'Middle right', value: 'MIDDLE_RIGHT' },
  { label: 'Middle left', value: 'MIDDLE_LEFT' },
];

export function DesignTab({ config, onChange, onSave, saving, dirty, error }: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('mobile');
  const [previewItems, setPreviewItems] = useState(2);

  const set = <K extends keyof CartBarConfig>(key: K, value: CartBarConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <Layout>
      {/* Preview first in the DOM so it is what the merchant lands on when the
          two columns stack on a narrow admin window. */}
      <Layout.Section variant="oneHalf">
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Live preview
                </Text>
                <ButtonGroup variant="segmented">
                  <Button
                    pressed={device === 'mobile'}
                    onClick={() => setDevice('mobile')}
                    size="slim"
                  >
                    Mobile
                  </Button>
                  <Button
                    pressed={device === 'desktop'}
                    onClick={() => setDevice('desktop')}
                    size="slim"
                  >
                    Desktop
                  </Button>
                </ButtonGroup>
              </InlineStack>

              <CartBarPreview
                config={config}
                device={device}
                itemCount={previewItems}
                subtotal={previewItems === 0 ? '$0.00' : `$${(42 * previewItems).toFixed(2)}`}
              />

              <InlineStack gap="200" blockAlign="center">
                <Text as="span" variant="bodySm" tone="subdued">
                  Simulate cart:
                </Text>
                <ButtonGroup variant="segmented">
                  {[0, 1, 2, 5].map((n) => (
                    <Button
                      key={n}
                      size="slim"
                      pressed={previewItems === n}
                      onClick={() => setPreviewItems(n)}
                    >
                      {n === 0 ? 'Empty' : `${n}`}
                    </Button>
                  ))}
                </ButtonGroup>
              </InlineStack>

              {previewItems === 0 && config.hideWhenEmpty && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Hidden because “Hide when the cart is empty” is on.
                </Text>
              )}
              {device === 'desktop' && !config.showOnDesktop && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Hidden because desktop display is turned off.
                </Text>
              )}
              {device === 'mobile' && !config.showOnMobile && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Hidden because mobile display is turned off.
                </Text>
              )}
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>

      <Layout.Section variant="oneHalf">
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Style
              </Text>

              <Select
                label="Shape"
                options={[
                  { label: 'Sticky bar — full width along the bottom', value: 'BAR' },
                  { label: 'Floating button — compact circle', value: 'BUTTON' },
                ]}
                value={config.design}
                onChange={(v) => set('design', v as CartBarConfig['design'])}
              />

              {config.design === 'BUTTON' && (
                <Select
                  label="Position"
                  options={POSITION_OPTIONS}
                  value={config.buttonPosition}
                  onChange={(v) => set('buttonPosition', v as ButtonPosition)}
                />
              )}

              <Divider />

              <BlockStack gap="300">
                <ColorField
                  label="Background"
                  value={config.backgroundColor}
                  onChange={(v) => set('backgroundColor', v)}
                />
                <ColorField
                  label="Text and icon"
                  value={config.textColor}
                  onChange={(v) => set('textColor', v)}
                />
                <ColorField
                  label="Accent — the button and badge"
                  value={config.accentColor}
                  onChange={(v) => set('accentColor', v)}
                />
              </BlockStack>

              <RangeSlider
                label="Corner radius"
                value={config.cornerRadius}
                min={0}
                max={40}
                output
                suffix={<Text as="span" tone="subdued">{config.cornerRadius}px</Text>}
                onChange={(v) => set('cornerRadius', Array.isArray(v) ? v[0]! : v)}
              />
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Content
              </Text>

              <TextField
                label="Button label"
                value={config.ctaLabel}
                onChange={(v) => set('ctaLabel', v)}
                maxLength={30}
                showCharacterCount
                autoComplete="off"
              />

              <Checkbox
                label="Show item count"
                checked={config.showItemCount}
                onChange={(v) => set('showItemCount', v)}
              />
              <Checkbox
                label="Show subtotal"
                checked={config.showSubtotal}
                onChange={(v) => set('showSubtotal', v)}
              />
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Visibility
              </Text>

              <Checkbox
                label="Show on mobile"
                helpText="Where a persistent cart helps most — the header cart icon is hardest to reach on a phone."
                checked={config.showOnMobile}
                onChange={(v) => set('showOnMobile', v)}
              />
              <Checkbox
                label="Show on desktop"
                checked={config.showOnDesktop}
                onChange={(v) => set('showOnDesktop', v)}
              />
              <Checkbox
                label="Hide when the cart is empty"
                helpText="Recommended. An empty cart bar reads as page furniture and gets ignored."
                checked={config.hideWhenEmpty}
                onChange={(v) => set('hideWhenEmpty', v)}
              />
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Cart drawer
                </Text>
                <Badge tone="attention">Advanced</Badge>
              </InlineStack>

              <Text as="p" tone="subdued">
                SwiftCart opens your theme&apos;s own cart drawer by clicking its trigger. It
                finds that automatically on most themes. If your drawer doesn&apos;t open, paste
                the CSS selector for your cart button below — otherwise leave this empty and
                shoppers go to the cart page.
              </Text>

              <TextField
                label="Cart drawer selector"
                labelHidden
                value={config.cartOpenSelector}
                onChange={(v) => set('cartOpenSelector', v)}
                placeholder=".cart-drawer-toggle"
                helpText="A CSS selector, for example .cart-drawer-toggle or #cart-icon-bubble"
                autoComplete="off"
                monospaced
              />
            </BlockStack>
          </Card>

          <Box paddingBlockEnd="800">
            <InlineStack gap="300" blockAlign="center">
              <Button
                variant="primary"
                onClick={onSave}
                loading={saving}
                disabled={!dirty || saving}
              >
                Save changes
              </Button>
              {dirty && !saving && (
                <Text as="span" tone="subdued" variant="bodySm">
                  Unsaved changes
                </Text>
              )}
              {error && (
                <Text as="span" tone="critical" variant="bodySm">
                  {error}
                </Text>
              )}
            </InlineStack>
          </Box>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );
}

/**
 * Native colour input paired with a hex field.
 *
 * Polaris has no colour picker in v13 that fits a settings form — ColorPicker
 * is a full HSB surface meant for a popover. The native input is one click to a
 * familiar OS picker, and the text field keeps hex values pasteable from a
 * brand guide, which is how merchants actually supply colours.
 */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <BlockStack gap="100">
      <Text as="span" variant="bodyMd">
        {label}
      </Text>
      <div className="sc-color-row">
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={label}
        />
        <div style={{ flex: 1 }}>
          <TextField
            label={label}
            labelHidden
            value={value}
            onChange={(v) => onChange(v.toUpperCase())}
            autoComplete="off"
            monospaced
            maxLength={7}
          />
        </div>
      </div>
    </BlockStack>
  );
}

/**
 * `<input type="color">` accepts only 6-digit hex and silently resets to black
 * on anything else — including the 3-digit form the API happily allows, and
 * every intermediate state while someone types a value by hand.
 */
function normalizeHex(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return '#000000';
}
