// src/subscriptions.js
// Pure helpers for reading Stripe subscription / invoice webhook payloads.
// Stripe moved `invoice.subscription` under `invoice.parent.subscription_details`
// in the 2025 API, so every accessor here tolerates both shapes. No IO.

const idOf = (v) =>
  typeof v === "string"
    ? v
    : v && typeof v === "object"
      ? String(v.id || "")
      : "";

export function subscriptionIdFromInvoice(invoice) {
  return (
    idOf(invoice?.parent?.subscription_details?.subscription) ||
    idOf(invoice?.subscription) ||
    ""
  );
}

export function metadataFromInvoice(invoice) {
  const meta =
    invoice?.parent?.subscription_details?.metadata ||
    invoice?.subscription_details?.metadata ||
    {};
  return meta && typeof meta === "object" ? meta : {};
}

export function subscriptionIdFromSession(session) {
  return idOf(session?.subscription);
}

export function customerIdOf(obj) {
  return idOf(obj?.customer);
}

/** Recurring price on the first subscription item, in minor units, plus its interval. */
export function priceFromSubscription(subscription) {
  const item = Array.isArray(subscription?.items?.data)
    ? subscription.items.data[0]
    : null;
  const price = item?.price || item?.plan || null;
  const unit = Number(price?.unit_amount);
  const qty = Number(item?.quantity) || 1;
  return {
    amountMinor: Number.isInteger(unit) ? unit * qty : null,
    currency:
      String(price?.currency || subscription?.currency || "").toLowerCase() ||
      null,
    interval:
      String(price?.recurring?.interval || price?.interval || "") || null,
  };
}

/** Unix seconds → ISO string, or null. */
export function isoFromUnix(seconds) {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

export function periodEndFromSubscription(subscription) {
  const item = Array.isArray(subscription?.items?.data)
    ? subscription.items.data[0]
    : null;
  return isoFromUnix(
    item?.current_period_end ?? subscription?.current_period_end,
  );
}

/** A renewal is any paid invoice that is not the first one of the subscription. */
export function isRenewalInvoice(invoice) {
  const reason = String(invoice?.billing_reason || "");
  return (
    subscriptionIdFromInvoice(invoice) !== "" &&
    reason !== "subscription_create" &&
    reason !== "manual"
  );
}
