// src/sponsors.js
// Self-serve sponsorship rails, generic for any tenant. A sponsor slot is an
// ordinary product (kind "service") whose `attributes.sponsorSlot` names the
// placement (e.g. "results"). When such an order is paid, the tenant's
// approval inbox receives a `sponsor` candidate; approving it prepends the
// partner into the tenant's partners file with a paid-until date. Renewals
// extend `until`; a lapse simply lets `until` pass. Pure helpers, no IO.

const SLOT_RE = /^[a-z][a-z0-9-]{1,30}$/;
const DAY = 864e5;

function str(v, max) {
  return String(v ?? "")
    .trim()
    .slice(0, max);
}

export function isHttp(u) {
  return /^https?:\/\/[^\s]+$/i.test(u);
}

/** Slot name for a product, or "" when it is not a sponsor slot. */
export function sponsorSlotOf(product) {
  const s = str(product?.attributes?.sponsorSlot, 40).toLowerCase();
  return SLOT_RE.test(s) ? s : "";
}

/** True when any normalized order item is a sponsor-slot product. */
export function sponsorItems(items, byId) {
  return (Array.isArray(items) ? items : [])
    .map((it) => byId.get(String(it?.productId || it?.id || "")))
    .filter((p) => p && sponsorSlotOf(p));
}

/**
 * Clean a sponsor's own details (from the advertise form). Returns
 * { error } or { sponsor }. Logo must be an http(s) image URL — we never
 * store uploads; a sponsor hosts their own logo.
 */
export function sanitizeSponsor(raw) {
  const name = str(raw?.name, 60);
  const url = str(raw?.url, 300);
  const logo = str(raw?.logo, 300);
  const tagline = str(raw?.tagline, 90);
  if (name.length < 2) return { error: "Brand name is required" };
  if (!isHttp(url)) return { error: "Website must start with http(s)://" };
  if (logo && !isHttp(logo)) return { error: "Logo must be an http(s) URL" };
  return { sponsor: { name, url, logo, tagline } };
}

/** ISO date `days` after `from` (a Date or ISO string). */
export function addDays(from, days) {
  const t = new Date(from).getTime();
  return new Date(t + days * DAY).toISOString().slice(0, 10);
}

/**
 * Build the approval-inbox candidate for a paid sponsor order. One candidate
 * per order + slot; the patch prepends a partner row into `partnersFile`.
 */
export function buildSponsorCandidate({
  orderId,
  email,
  product,
  sponsor,
  paidAt = new Date(),
  until = "",
  partnersFile,
}) {
  const slot = sponsorSlotOf(product);
  if (!slot || !orderId || !partnersFile) return null;
  const from = new Date(paidAt).toISOString().slice(0, 10);
  const paidUntil = until || addDays(paidAt, 31);
  const id = `sp-${String(orderId).slice(0, 8)}`;
  const value = {
    id,
    slot,
    name: sponsor.name,
    url: sponsor.url,
    logo: sponsor.logo || "",
    tagline: sponsor.tagline || "",
    orderId: String(orderId),
    from,
    until: paidUntil,
  };
  return {
    key: `sponsor:${orderId}:${slot}`,
    kind: "sponsor",
    title: `${sponsor.name} — ${product.title}`,
    summary: `Paid. Wants the "${slot}" slot until ${paidUntil}. Link: ${sponsor.url}${
      sponsor.tagline ? ` — "${sponsor.tagline}"` : ""
    }`,
    source: isHttp(sponsor.url) ? sponsor.url : "",
    editable: ["name", "url", "logo", "tagline"],
    data: {
      slot,
      email: String(email || ""),
      name: sponsor.name,
      url: sponsor.url || "",
      logo: sponsor.logo || "",
      tagline: sponsor.tagline || "",
      until: paidUntil,
      hint: "Check the brand and link. Approve to show them; Ignore to keep them off the site (refund by hand in Stripe).",
    },
    apply: [{ file: partnersFile, path: "items", op: "prepend", value }],
  };
}

/** Partners whose paid window covers `today` (ISO date), grouped by slot. */
export function activePartners(json, today = new Date()) {
  const t =
    typeof today === "string" ? today : today.toISOString().slice(0, 10);
  const items = Array.isArray(json?.items) ? json.items : [];
  return items.filter(
    (p) =>
      p &&
      p.name &&
      p.url &&
      (!p.from || p.from <= t) &&
      (!p.until || p.until >= t),
  );
}

/**
 * Extend a live partner's paid window after a renewal invoice. Returns true
 * when a row was changed. `until` never moves backwards.
 */
export function extendPartner(json, orderId, until) {
  const items = Array.isArray(json?.items) ? json.items : [];
  let changed = false;
  for (const p of items) {
    if (!p || String(p.orderId) !== String(orderId)) continue;
    if (!p.until || p.until < until) {
      p.until = until;
      changed = true;
    }
  }
  return changed;
}
