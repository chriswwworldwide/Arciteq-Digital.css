// src/free-shipping.js
// Pure free-shipping-threshold progress for the cart AOV nudge
// ("Add £8.10 more for free shipping" + a progress bar). A free-shipping
// threshold is one of the highest-ROI AOV levers, so keep the math server-safe
// and deterministic. Amounts are integer minor units (pence/cents), per repo rule.

const CURRENCY_SYMBOLS = { GBP: "\u00A3", EUR: "\u20AC", USD: "$" };

function toMinor(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** Format integer minor units to a display string, e.g. 810 GBP -> "£8.10". */
export function formatMoney(amountMinor, currency = "GBP") {
  const cur = String(currency || "").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[cur] || "";
  const major = (toMinor(amountMinor) / 100).toFixed(2);
  return symbol ? `${symbol}${major}` : `${major} ${cur}`.trim();
}

/**
 * Compute free-shipping progress for a cart.
 * @param {number} subtotalMinor cart subtotal in minor units
 * @param {object} opts { thresholdMinor, currency }
 * @returns {{ enabled, qualified, thresholdMinor, subtotalMinor, remainingMinor, progress, remainingLabel, message }}
 */
export function freeShippingProgress(subtotalMinor, opts = {}) {
  const threshold = toMinor(opts.thresholdMinor);
  const subtotal = toMinor(subtotalMinor);
  const currency = opts.currency || "GBP";

  // A zero/absent threshold means the offer is off — never claim free shipping.
  if (threshold <= 0) {
    return {
      enabled: false,
      qualified: false,
      thresholdMinor: 0,
      subtotalMinor: subtotal,
      remainingMinor: 0,
      progress: 0,
      remainingLabel: "",
      message: "",
    };
  }

  const qualified = subtotal >= threshold;
  const remainingMinor = qualified ? 0 : threshold - subtotal;
  const progress = Math.min(1, subtotal / threshold);
  const remainingLabel = qualified ? "" : formatMoney(remainingMinor, currency);

  return {
    enabled: true,
    qualified,
    thresholdMinor: threshold,
    subtotalMinor: subtotal,
    remainingMinor,
    progress,
    remainingLabel,
    message: qualified
      ? "You've unlocked free shipping!"
      : `Add ${remainingLabel} more for free shipping`,
  };
}
