'use client';

import type { CartBarConfig } from '@/lib/cart-bar';

/**
 * Live storefront preview of the cart bar.
 *
 * Renders a stylised product page with the merchant's actual configuration
 * applied, so every colour, radius and label change is visible immediately
 * instead of requiring a round-trip through the theme editor.
 *
 * The app this replaces had no preview at all — the merchant picked colours
 * blind in the theme editor, saved, then opened the storefront in another tab
 * to see what happened. That loop is the single biggest reason a merchant gives
 * up during setup, which is why this is the first thing on the Design tab.
 */

interface Props {
  config: CartBarConfig;
  device: 'desktop' | 'mobile';
  /** Simulated cart state, so `hideWhenEmpty` can be demonstrated. */
  itemCount: number;
  subtotal: string;
}

export function CartBarPreview({ config, device, itemCount, subtotal }: Props) {
  const visibleOnThisDevice = device === 'mobile' ? config.showOnMobile : config.showOnDesktop;
  const hiddenByEmptyCart = config.hideWhenEmpty && itemCount === 0;
  const showBar = visibleOnThisDevice && !hiddenByEmptyCart;

  return (
    <div className={`sc-preview ${device === 'mobile' ? 'sc-preview--mobile' : ''}`}>
      <div className="sc-preview__chrome">
        <span className="sc-preview__dot" />
        <span className="sc-preview__dot" />
        <span className="sc-preview__dot" />
        <span className="sc-preview__url">your-store.com/products/…</span>
      </div>

      <div className="sc-preview__page">
        <div className="sc-preview__hero" />
        <div className="sc-preview__line sc-preview__line--medium" />
        <div className="sc-preview__line sc-preview__line--short" />
        <div className="sc-preview__grid">
          <div className="sc-preview__tile" />
          <div className="sc-preview__tile" />
          <div className="sc-preview__tile" />
        </div>
      </div>

      {showBar && config.design === 'BAR' && (
        <BarVariant config={config} itemCount={itemCount} subtotal={subtotal} />
      )}
      {showBar && config.design === 'BUTTON' && (
        <ButtonVariant config={config} itemCount={itemCount} subtotal={subtotal} />
      )}
    </div>
  );
}

function BarVariant({ config, itemCount, subtotal }: Omit<Props, 'device'>) {
  return (
    <div
      className="sc-bar"
      style={{
        background: config.backgroundColor,
        color: config.textColor,
        borderRadius: config.cornerRadius,
      }}
    >
      <div className="sc-bar__left">
        <span className="sc-bar__icon">
          <CartIcon color={config.textColor} />
        </span>
        <span className="sc-bar__meta">
          {config.showItemCount && (
            <span className="sc-bar__count">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
          {config.showSubtotal && <span className="sc-bar__subtotal">{subtotal}</span>}
        </span>
      </div>
      <button
        type="button"
        className="sc-bar__cta"
        style={{
          background: config.accentColor,
          color: config.textColor,
          borderRadius: Math.max(4, config.cornerRadius - 4),
        }}
      >
        {config.ctaLabel}
      </button>
    </div>
  );
}

function ButtonVariant({ config, itemCount, subtotal }: Omit<Props, 'device'>) {
  return (
    <div
      className={`sc-fab sc-fab--${config.buttonPosition.toLowerCase()}`}
      style={{ background: config.backgroundColor }}
    >
      <CartIcon color={config.textColor} size={24} />
      {config.showItemCount && (
        <span
          className="sc-fab__badge"
          style={{ background: config.accentColor, color: config.textColor }}
        >
          {itemCount}
        </span>
      )}
      {config.showSubtotal && (
        <span
          className="sc-fab__price"
          style={{ background: config.accentColor, color: config.textColor }}
        >
          {subtotal}
        </span>
      )}
    </div>
  );
}

function CartIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.75 8.25h14.5l-.9 10.1a2.4 2.4 0 0 1-2.4 2.15H8.05a2.4 2.4 0 0 1-2.4-2.15Z" />
      <path d="M8.5 8.25v-1.5a3.5 3.5 0 0 1 7 0v1.5" />
    </svg>
  );
}
