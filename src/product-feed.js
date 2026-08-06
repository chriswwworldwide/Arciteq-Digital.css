// src/product-feed.js
// Pure product-feed builder for Google Merchant Center / Meta catalog.
// Turns data/products.json into shopping-feed items (and a GMC RSS 2.0 XML doc)
// so paid + free shopping listings can be automated. No IO — callers pass the
// catalog and site URL in.

export const DEFAULT_SITE_URL = "https://lartdelaseduction.com";

/** Minor units (pence/cents) + currency -> "12.90 EUR" (GMC price format). */
export function formatPrice(amountMinor, currency) {
  const minor = Number(amountMinor);
  if (!Number.isInteger(minor) || minor <= 0) return null;
  const cur = String(currency || "").toUpperCase();
  if (!cur) return null;
  return `${(minor / 100).toFixed(2)} ${cur}`;
}

/** schema.org availability URL/string -> GMC availability token. */
export function availabilityLabel(availability) {
  const a = String(availability || "").toLowerCase();
  if (a.includes("outofstock")) return "out_of_stock";
  if (a.includes("preorder")) return "preorder";
  if (a.includes("backorder")) return "backorder";
  return "in_stock";
}

function absoluteUrl(siteUrl, pathOrUrl) {
  const p = String(pathOrUrl || "");
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${String(siteUrl || "").replace(/\/+$/, "")}${p.startsWith("/") ? "" : "/"}${p}`;
}

/**
 * Build a single feed item, or null if the product lacks the required fields
 * (id, title, canonical link, price, image).
 */
export function buildFeedItem(product, opts = {}) {
  if (!product) return null;
  const siteUrl = opts.siteUrl || DEFAULT_SITE_URL;
  const id = product.productId;
  const title = product.title;
  const link = absoluteUrl(siteUrl, product?.seo?.canonicalPath);
  const price = formatPrice(product?.price?.amount, product?.price?.currency);
  const image = product?.images?.[0]?.src;
  const imageLink = absoluteUrl(siteUrl, image);

  if (!id || !title || !product?.seo?.canonicalPath || !price || !image)
    return null;

  const item = {
    id: String(id),
    title: String(title),
    description: String(product.description || title),
    link,
    image_link: imageLink,
    availability: availabilityLabel(product.availability),
    price,
    brand: String(product.brand || ""),
    condition: "new",
  };
  const productType =
    product?.nicheCategory?.name || product?.productType?.name;
  if (productType) item.product_type = String(productType);
  return item;
}

/** Build feed items for the whole catalog, skipping invalid products. */
export function buildProductFeed(products, opts = {}) {
  return (Array.isArray(products) ? products : [])
    .map((p) => buildFeedItem(p, opts))
    .filter(Boolean);
}

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GMC_NS = "http://base.google.com/ns/1.0";
// Fields that map to the g: namespace in a GMC RSS feed.
const G_FIELDS = new Set([
  "id",
  "image_link",
  "availability",
  "price",
  "brand",
  "condition",
  "product_type",
]);

/** Render feed items as a Google Merchant Center RSS 2.0 XML document. */
export function feedToXml(items, meta = {}) {
  const title = xmlEscape(meta.title || "Product feed");
  const link = xmlEscape(meta.link || DEFAULT_SITE_URL);
  const description = xmlEscape(meta.description || "Product feed");

  const entries = (Array.isArray(items) ? items : [])
    .map((item) => {
      const fields = Object.entries(item)
        .map(([key, value]) => {
          const tag = G_FIELDS.has(key) ? `g:${key}` : key;
          return `      <${tag}>${xmlEscape(value)}</${tag}>`;
        })
        .join("\n");
      return `    <item>\n${fields}\n    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="${GMC_NS}">
  <channel>
    <title>${title}</title>
    <link>${link}</link>
    <description>${description}</description>
${entries}
  </channel>
</rss>
`;
}
