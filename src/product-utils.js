// src/product-utils.js
// Pure helpers extracted from server.js so they can be unit-tested in isolation.
// These functions have no side effects and do not depend on server state.

export function scoreDraftProduct(product) {
  const reasons = [];
  let score = 100;

  const petType = Array.isArray(product?.petType) ? product.petType : [];
  const lifeStage = Array.isArray(product?.lifeStage) ? product.lifeStage : [];
  const sizeRequirement = Array.isArray(product?.sizeRequirement)
    ? product.sizeRequirement
    : [];
  const materials = Array.isArray(product?.materials) ? product.materials : [];
  const safetyDisclaimer = String(product?.safetyDisclaimer || "").trim();
  const warehouseLocation = String(product?.warehouseLocation || "").trim();
  const availability = String(product?.availability || "").toLowerCase();

  if (
    availability.includes("outofstock") ||
    availability.includes("out_of_stock")
  ) {
    score -= 100;
    reasons.push("Out of stock at supplier");
  }

  if (petType.length === 0) {
    score -= 25;
    reasons.push("Missing petType");
  }
  if (lifeStage.length === 0) {
    score -= 15;
    reasons.push("Missing lifeStage");
  }
  if (sizeRequirement.length === 0) {
    score -= 15;
    reasons.push("Missing sizeRequirement");
  }
  if (!safetyDisclaimer) {
    score -= 25;
    reasons.push("Missing safetyDisclaimer");
  }
  if (!warehouseLocation) {
    score -= 10;
    reasons.push("Missing warehouseLocation");
  }
  if (materials.length === 0) {
    score -= 10;
    reasons.push("Missing materials");
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { score, reasons };
}

export function normalizeToSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildDedupeKey({ brand, title }) {
  const b = normalizeToSlug(brand);
  const t = normalizeToSlug(title);
  if (!b || !t) return "";
  return `${b}::${t}`;
}

export function findDuplicateProductId({ products, nextProduct }) {
  const nextKey = String(nextProduct?.dedupeKey || "");
  if (!nextKey) return "";

  const hit = products.find((p) => {
    const existingKey =
      String(p?.dedupeKey || "") ||
      buildDedupeKey({
        brand: String(p?.brand || ""),
        title: String(p?.title || ""),
      });
    return existingKey === nextKey;
  });
  return hit?.productId ? String(hit.productId) : "";
}

export function buildProductFromSupplierItem(item, tenantId) {
  const title = String(item?.title || "").trim();
  if (!title) throw new Error("Missing title");

  const supplierSku = String(item?.supplierSku || "").trim();
  if (!supplierSku) throw new Error("Missing supplierSku");

  const amount = Number(item?.price?.amount);
  if (!Number.isInteger(amount) || amount < 0)
    throw new Error("Invalid price.amount");

  const currency = String(item?.price?.currency || "").toLowerCase();
  if (!currency) throw new Error("Missing price.currency");

  const productSlug = normalizeToSlug(title);
  const nicheSlug = "pet-safety-essentials";
  const productTypeSlug = "safety-essentials";

  const productId = `imp-${normalizeToSlug(tenantId)}-${normalizeToSlug(supplierSku)}`;

  const brand = "PawSense";
  const supplierId = String(
    item?.supplierId || item?.supplier?.id || "placeholder",
  );
  const dedupeKey = buildDedupeKey({ brand, title });

  return {
    productId,
    tenant_id: String(tenantId || "default"),
    source: {
      supplierId,
      supplierSku,
    },
    dedupeKey,
    title,
    description: String(item?.description || ""),
    nicheCategory: {
      slug: nicheSlug,
      name: "Pet Safety Essentials",
    },
    productType: {
      slug: productTypeSlug,
      name: "Safety Essentials",
    },
    seo: {
      slug: productSlug,
      canonicalPath: `/${nicheSlug}/${productSlug}`,
      legacySlugs: [],
    },
    images: [
      {
        src: String(item?.image?.src || ""),
        alt: String(item?.image?.alt || title),
        width: Number(item?.image?.width || 1200),
        height: Number(item?.image?.height || 1200),
      },
    ],
    price: {
      amount,
      currency,
    },
    availability: String(item?.availability || "https://schema.org/InStock"),
    brand,
    tags: ["imported", "placeholder"],
    petType: Array.isArray(item?.petType) ? item.petType : [],
    lifeStage: Array.isArray(item?.lifeStage) ? item.lifeStage : [],
    sizeRequirement: Array.isArray(item?.sizeRequirement)
      ? item.sizeRequirement
      : [],
    shippingOrigin: String(item?.warehouseLocation || "EU"),
    warehouseLocation: String(item?.warehouseLocation || "EU"),
    materials: Array.isArray(item?.materials) ? item.materials : [],
    marketing_hooks: {
      emotionalPainPoints: [
        "Spot routine changes early",
        "Feel reassured when you’re not home",
      ],
      ugcAngles: [
        "Photo of the product on a collar",
        "Short video of a calm daily routine",
      ],
    },
    attributes: {},
    safetyDisclaimer: String(item?.safetyDisclaimer || "").trim(),
    linkedConsumables: [],
    bundle: null,
    flags: {
      featured: false,
      priority: 5,
    },
    audit: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getBaseUrl(req) {
  const hostHeader = String(req.headers.host || "localhost");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "");
  const protocol = forwardedProto ? forwardedProto.split(",")[0] : req.protocol;
  return `${protocol}://${hostHeader}`;
}

export function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
