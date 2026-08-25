/**
 * The cart bar's configuration shape, shared by the API, the admin UI and the
 * preview.
 *
 * Declared as a plain interface rather than reusing the Prisma model type on
 * purpose: this crosses into client components, and importing `@prisma/client`
 * there drags the query engine's types into the browser bundle graph. The
 * fields mirror `CartBarSettings` in prisma/schema.prisma — change one, change
 * the other.
 */

export type BarDesign = 'BAR' | 'BUTTON';
export type ButtonPosition = 'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'MIDDLE_RIGHT' | 'MIDDLE_LEFT';

export interface CartBarConfig {
  design: BarDesign;
  buttonPosition: ButtonPosition;
  showOnDesktop: boolean;
  showOnMobile: boolean;
  hideWhenEmpty: boolean;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  cornerRadius: number;
  showItemCount: boolean;
  showSubtotal: boolean;
  ctaLabel: string;
  cartOpenSelector: string;
}

export const DEFAULT_CONFIG: CartBarConfig = {
  design: 'BAR',
  buttonPosition: 'BOTTOM_RIGHT',
  showOnDesktop: true,
  showOnMobile: true,
  hideWhenEmpty: true,
  backgroundColor: '#111827',
  textColor: '#FFFFFF',
  accentColor: '#2563EB',
  cornerRadius: 12,
  showItemCount: true,
  showSubtotal: true,
  ctaLabel: 'View cart',
  cartOpenSelector: '',
};

/** Strip server-only fields (id, storeId, timestamps) off an API payload. */
export function toConfig(raw: Partial<CartBarConfig> | null | undefined): CartBarConfig {
  if (!raw) return { ...DEFAULT_CONFIG };
  return {
    design: raw.design ?? DEFAULT_CONFIG.design,
    buttonPosition: raw.buttonPosition ?? DEFAULT_CONFIG.buttonPosition,
    showOnDesktop: raw.showOnDesktop ?? DEFAULT_CONFIG.showOnDesktop,
    showOnMobile: raw.showOnMobile ?? DEFAULT_CONFIG.showOnMobile,
    hideWhenEmpty: raw.hideWhenEmpty ?? DEFAULT_CONFIG.hideWhenEmpty,
    backgroundColor: raw.backgroundColor ?? DEFAULT_CONFIG.backgroundColor,
    textColor: raw.textColor ?? DEFAULT_CONFIG.textColor,
    accentColor: raw.accentColor ?? DEFAULT_CONFIG.accentColor,
    cornerRadius: raw.cornerRadius ?? DEFAULT_CONFIG.cornerRadius,
    showItemCount: raw.showItemCount ?? DEFAULT_CONFIG.showItemCount,
    showSubtotal: raw.showSubtotal ?? DEFAULT_CONFIG.showSubtotal,
    ctaLabel: raw.ctaLabel ?? DEFAULT_CONFIG.ctaLabel,
    cartOpenSelector: raw.cartOpenSelector ?? DEFAULT_CONFIG.cartOpenSelector,
  };
}

export interface SubscriptionSummary {
  name: string;
  status: string;
  test: boolean;
  trialDays?: number;
  currentPeriodEnd: string | null;
  price: { amount: string; currencyCode: string; interval: string } | null;
}

export interface PricingDisplay {
  price: string;
  interval: string;
  planName: string;
}

export interface BootstrapResult {
  shop: string;
  entitled: boolean;
  subscription: SubscriptionSummary | null;
  pricing: PricingDisplay;
  planSelectionUrl: string;
}
