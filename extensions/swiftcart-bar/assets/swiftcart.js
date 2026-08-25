/*
 * SwiftCart — storefront behaviour.
 *
 * Runs on a page whose theme we have never seen, so the rules are: touch
 * nothing outside our own element, never throw into the theme's call stack, and
 * assume every optional thing is missing.
 *
 * The bar is already rendered correctly by Liquid before this file executes
 * (see blocks/swiftcart.liquid). Everything here is about keeping it in sync
 * afterwards.
 */
(function () {
  'use strict';

  var root = document.getElementById('swiftcart-root');
  if (!root) return;

  var DESKTOP_BREAKPOINT = 750;
  var STATUS_CACHE_KEY = 'swiftcart:plan';

  var config = {
    design: root.dataset.design || 'bar',
    hideWhenEmpty: root.dataset.hideWhenEmpty === 'true',
    showDesktop: root.dataset.showDesktop === 'true',
    showMobile: root.dataset.showMobile === 'true',
    cartSelector: (root.dataset.cartSelector || '').trim(),
    moneyFormat: root.dataset.moneyFormat || '${{amount}}',
    statusUrl: root.dataset.statusUrl || '',
    cartUrl: root.dataset.cartUrl || '/cart',
  };

  var els = {
    count: root.querySelector('[data-swiftcart-count]'),
    badge: root.querySelector('[data-swiftcart-badge]'),
    subtotal: root.querySelector('[data-swiftcart-subtotal]'),
    trigger: root.querySelector('[data-swiftcart-open]'),
  };

  var itemCount = parseInt(root.dataset.itemCount || '0', 10) || 0;

  // ---------------------------------------------------------------- money

  /**
   * Format cents using the shop's own money format string.
   *
   * Shopify gives us the exact format the merchant configured — "${{amount}}",
   * "{{amount_with_comma_separator}} kr", and so on — so we render prices the
   * way the rest of their store does.
   *
   * The app this replaces instead shipped a 200-entry currency→locale table and
   * fed it to Intl.NumberFormat. That produced a *plausible* price that
   * disagreed with every other price on the page: a store selling in EUR with a
   * German format got the table's guess, not the merchant's setting.
   */
  function formatMoney(cents) {
    var amount = (cents || 0) / 100;

    return config.moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/g, function (_match, name) {
      switch (name) {
        case 'amount':
          return withSeparators(amount, 2, ',', '.');
        case 'amount_no_decimals':
          return withSeparators(amount, 0, ',', '.');
        case 'amount_with_comma_separator':
          return withSeparators(amount, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator':
          return withSeparators(amount, 0, '.', ',');
        case 'amount_with_apostrophe_separator':
          return withSeparators(amount, 2, "'", '.');
        case 'amount_with_space_separator':
          return withSeparators(amount, 2, ' ', ',');
        case 'amount_no_decimals_with_space_separator':
          return withSeparators(amount, 0, ' ', ',');
        case 'amount_with_period_and_space_separator':
          return withSeparators(amount, 2, ' ', '.');
        default:
          return withSeparators(amount, 2, ',', '.');
      }
    });
  }

  function withSeparators(value, decimals, thousands, decimalMark) {
    var fixed = Math.abs(value).toFixed(decimals);
    var parts = fixed.split('.');
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    var sign = value < 0 ? '-' : '';
    return decimals > 0 ? sign + whole + decimalMark + parts[1] : sign + whole;
  }

  // ----------------------------------------------------------- visibility

  function applyDeviceVisibility() {
    root.classList.toggle('swiftcart--hide-mobile', !config.showMobile);
    root.classList.toggle('swiftcart--hide-desktop', !config.showDesktop);
  }

  function applyEmptyState() {
    var shouldHide = config.hideWhenEmpty && itemCount === 0;
    if (shouldHide) {
      root.setAttribute('hidden', '');
    } else {
      root.removeAttribute('hidden');
    }
  }

  // -------------------------------------------------------- opening the cart

  /**
   * Selectors themes commonly use for their cart drawer trigger, most specific
   * first. Tried only when the merchant hasn't supplied one.
   *
   * This list is a convenience, not a contract: when none of them match we fall
   * back to navigating to the cart page, which always works. That fallback is
   * why it is safe to guess at all.
   */
  var DRAWER_SELECTORS = [
    '[data-swiftcart-ignore="false"]',
    'a[href$="/cart"][data-cart-drawer-toggle]',
    '[data-cart-drawer-toggle]',
    '.js-drawer-open-right',
    '#cart-icon-bubble',
    '.header__icon--cart',
    '.cart-drawer-toggle',
    '.js-cart-drawer-open',
    '[data-action="open-cart"]',
  ];

  function findDrawerTrigger() {
    if (config.cartSelector) {
      try {
        return document.querySelector(config.cartSelector);
      } catch (err) {
        // A malformed selector from the settings field must not take the bar
        // down with it — fall through to the cart page.
        return null;
      }
    }

    for (var i = 0; i < DRAWER_SELECTORS.length; i += 1) {
      var el = document.querySelector(DRAWER_SELECTORS[i]);
      // Never click ourselves: several of these would match our own trigger on
      // a theme that reuses the class, and that is an infinite loop.
      if (el && !root.contains(el)) return el;
    }
    return null;
  }

  function openCart(event) {
    if (event) event.preventDefault();

    var trigger = findDrawerTrigger();
    if (trigger) {
      trigger.click();

      // If the theme's drawer didn't actually open, the click did nothing and
      // the shopper is left with no feedback. Detect that and navigate instead.
      window.setTimeout(function () {
        if (!drawerLooksOpen()) {
          window.location.href = config.cartUrl;
        }
      }, 400);
      return;
    }

    window.location.href = config.cartUrl;
  }

  /**
   * Heuristic: a drawer that opened almost always either sets a body class or
   * exposes a dialog/aria-expanded state. False negatives just mean we navigate
   * to the cart page, which is an acceptable outcome, so this errs toward
   * "open" only when there is real evidence.
   */
  function drawerLooksOpen() {
    var body = document.body;
    if (/drawer|cart/i.test(body.className) && /open|active|visible/i.test(body.className)) {
      return true;
    }
    var openDialog = document.querySelector(
      'dialog[open], [aria-modal="true"], .drawer.is-open, .cart-drawer.is-open, cart-drawer[open]'
    );
    return Boolean(openDialog);
  }

  // ------------------------------------------------------------ cart sync

  var refreshTimer = null;

  function scheduleRefresh() {
    // Themes fire several cart mutations in a burst (add, then a section
    // re-render, then a count update). Debouncing collapses those into one
    // /cart.js read instead of three.
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshCart, 180);
  }

  function refreshCart() {
    fetch(window.Shopify && window.Shopify.routes ? window.Shopify.routes.root + 'cart.js' : '/cart.js', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (cart) {
        if (!cart) return;
        itemCount = cart.item_count || 0;

        if (els.count) {
          els.count.textContent = itemCount + ' ' + (itemCount === 1 ? 'item' : 'items');
        }
        if (els.badge) {
          els.badge.textContent = String(itemCount);
        }
        if (els.subtotal) {
          els.subtotal.textContent = formatMoney(cart.items_subtotal_price);
        }

        applyEmptyState();
      })
      .catch(function () {
        /* A failed refresh leaves the last known good values on screen. */
      });
  }

  /**
   * Detect cart mutations.
   *
   * Shopify has no universal "the cart changed" event, and themes differ wildly
   * — some dispatch a custom event, some re-render a section, some do neither.
   * So we watch the network instead, which is the one thing every theme has to
   * do to change the cart.
   *
   * Both wrappers preserve the original function's return value and rethrow
   * nothing: the theme's own code must behave exactly as it would without us.
   */
  function watchCartRequests() {
    var CART_MUTATION = /\/cart\/(add|change|update|clear)/;

    if (window.fetch) {
      var originalFetch = window.fetch;
      window.fetch = function () {
        var args = arguments;
        var url = '';
        try {
          url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
        } catch (err) {
          url = '';
        }

        var result = originalFetch.apply(this, args);
        if (CART_MUTATION.test(url)) {
          result.then(scheduleRefresh, function () {});
        }
        return result;
      };
    }

    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (typeof url === 'string' && CART_MUTATION.test(url)) {
        this.addEventListener('load', scheduleRefresh);
      }
      return originalOpen.apply(this, arguments);
    };

    // Themes that DO announce cart changes — cheaper and more reliable than the
    // network sniffing above when present, so listen for both.
    ['cart:updated', 'cart:refresh', 'cart:change', 'ajaxCart.afterCartLoad'].forEach(function (name) {
      document.addEventListener(name, scheduleRefresh);
    });

    // Back/forward cache restore: the cart may have changed in another tab.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) scheduleRefresh();
    });
  }

  // ---------------------------------------------------------- entitlement

  /**
   * Fallback entitlement check.
   *
   * Only runs when the Liquid could not read `shop.metafields.swiftcart.plan`
   * — a fresh install, or a store where the metafield definition failed. The
   * normal path never reaches this function, and the result is cached in
   * sessionStorage so it costs at most one request per browsing session rather
   * than one per page view.
   */
  function resolveEntitlement() {
    if (root.dataset.plan === 'active') return Promise.resolve(true);
    if (root.dataset.plan === 'none') return Promise.resolve(false);

    var cached = null;
    try {
      cached = window.sessionStorage.getItem(STATUS_CACHE_KEY);
    } catch (err) {
      /* Private browsing or blocked storage — just re-fetch. */
    }
    if (cached === 'active') return Promise.resolve(true);
    if (cached === 'none') return Promise.resolve(false);

    if (!config.statusUrl) return Promise.resolve(false);

    return fetch(config.statusUrl, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (body) {
        var plan = body && body.plan === 'active' ? 'active' : 'none';
        try {
          window.sessionStorage.setItem(STATUS_CACHE_KEY, plan);
        } catch (err) {
          /* ignore */
        }
        return plan === 'active';
      })
      .catch(function () {
        // Fail closed. Showing a paid feature to a store we could not verify is
        // the one outcome worth avoiding here.
        return false;
      });
  }

  // ------------------------------------------------------------------ boot

  function start() {
    applyDeviceVisibility();
    applyEmptyState();

    if (els.trigger) {
      els.trigger.addEventListener('click', openCart);
    }

    watchCartRequests();

    // The server-rendered count can be stale if the page came from a cache
    // (Shopify's CDN caches storefront HTML), so reconcile once on load.
    scheduleRefresh();
  }

  resolveEntitlement().then(function (entitled) {
    if (!entitled) {
      root.parentNode && root.parentNode.removeChild(root);
      return;
    }
    root.classList.remove('swiftcart--pending');
    start();
  });
})();
