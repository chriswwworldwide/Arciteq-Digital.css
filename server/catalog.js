// server/catalog.js
// Product catalogue: supplier import + draft publish/unpublish (admin),
// the server-rendered product page, and storefront APIs (tenant config,
// shipping estimate, free-shipping progress, related products).

import { requireAdmin, resolveTenantFromRequest } from "./tenancy.js";
import path from "path";
import {
  safeReadJsonFile,
  safeWriteJsonFile,
  loadProductsData,
  ROOT_DIR,
} from "./data-files.js";
import {
  buildProductFromSupplierItem,
  findDuplicateProductId,
  scoreDraftProduct,
} from "../src/product-utils.js";
import {
  estimateForProduct,
  shipsFromLabel,
  originRegion,
  resolveRegion,
  formatEstimate,
} from "../src/shipping.js";
import { freeShippingProgress } from "../src/free-shipping.js";
import { relatedProducts } from "../src/related-products.js";
import express from "express";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createCatalogRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.post("/admin/run-import", (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const queuePath = path.join(ROOT_DIR, "data", "import_queue.json");
      const auditPath = path.join(ROOT_DIR, "data", "import_audit.json");
      const feedPath = path.join(
        ROOT_DIR,
        "data",
        "placeholder_supplier_feed.json",
      );
      const draftsPath = path.join(ROOT_DIR, "data", "drafts.json");
      const productsPath = path.join(ROOT_DIR, "data", "products.json");

      const queueData = safeReadJsonFile(queuePath, {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        queue: [],
      });
      const auditData = safeReadJsonFile(auditPath, {
        schemaVersion: 1,
        events: [],
      });
      const feedData = safeReadJsonFile(feedPath, {
        schemaVersion: 1,
        items: [],
      });
      const draftsData = safeReadJsonFile(draftsPath, {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        drafts: [],
      });
      const productsData = safeReadJsonFile(productsPath, {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        products: [],
      });

      const pendingJob = Array.isArray(queueData?.queue)
        ? queueData.queue.find((j) => String(j?.status || "") === "pending")
        : null;

      if (!pendingJob) {
        return res.json({ ok: true, message: "No pending jobs" });
      }

      pendingJob.status = "running";
      pendingJob.startedAt = new Date().toISOString();
      safeWriteJsonFile(queuePath, queueData);

      const feedItems = Array.isArray(feedData?.items) ? feedData.items : [];

      const beforeCount = Array.isArray(productsData?.products)
        ? productsData.products.length
        : 0;
      const products = Array.isArray(productsData?.products)
        ? productsData.products
        : [];
      const drafts = Array.isArray(draftsData?.drafts) ? draftsData.drafts : [];

      const autoPublishMinScore = Number(
        process.env.AUTO_PUBLISH_MIN_SCORE || 85,
      );
      const minScore = Number.isFinite(autoPublishMinScore)
        ? autoPublishMinScore
        : 85;

      let imported = 0;
      let published = 0;
      const errors = [];

      for (const rawItem of feedItems) {
        try {
          const nextProduct = buildProductFromSupplierItem(
            rawItem,
            activeTenantId,
          );

          const duplicateOfProductId = findDuplicateProductId({
            products,
            nextProduct,
          });
          const isDuplicate = Boolean(duplicateOfProductId);

          const { score, reasons } = scoreDraftProduct(nextProduct);
          if (isDuplicate) {
            reasons.push(
              `Duplicate of existing productId: ${duplicateOfProductId}`,
            );
          }
          const draftEntry = {
            draftId: `draft-${String(nextProduct.productId)}`,
            productId: String(nextProduct.productId),
            tenant_id: String(nextProduct.tenant_id || "default"),
            source: {
              type: "placeholder_supplier_feed",
              supplierSku: String(rawItem?.supplierSku || ""),
            },
            score,
            reasons,
            status: isDuplicate
              ? "duplicate"
              : score >= minScore
                ? "auto_published"
                : "draft",
            product: nextProduct,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const existingDraftIndex = drafts.findIndex(
            (d) => String(d?.productId || "") === String(nextProduct.productId),
          );
          if (existingDraftIndex >= 0) drafts[existingDraftIndex] = draftEntry;
          else drafts.push(draftEntry);

          if (isDuplicate || score < minScore) {
            imported += 1;
            continue;
          }

          const existingIndex = products.findIndex(
            (p) => String(p?.productId || "") === String(nextProduct.productId),
          );
          if (existingIndex >= 0) {
            products[existingIndex] = {
              ...products[existingIndex],
              ...nextProduct,
              audit: {
                ...(products[existingIndex]?.audit || {}),
                updatedAt: new Date().toISOString(),
              },
            };
          } else {
            products.push(nextProduct);
          }

          imported += 1;
          published += 1;
        } catch (err) {
          errors.push(String(err?.message || "Failed to import item"));
        }
      }

      draftsData.drafts = drafts;
      draftsData.generatedAt = new Date().toISOString();
      safeWriteJsonFile(draftsPath, draftsData);

      productsData.products = products;
      productsData.generatedAt = new Date().toISOString();
      safeWriteJsonFile(productsPath, productsData);

      pendingJob.status =
        errors.length > 0 ? "completed_with_errors" : "completed";
      pendingJob.completedAt = new Date().toISOString();
      pendingJob.result = {
        imported,
        published,
        errors,
        productsBefore: beforeCount,
        productsAfter: products.length,
        draftsAfter: drafts.length,
        autoPublishMinScore: minScore,
      };
      safeWriteJsonFile(queuePath, queueData);

      auditData.events = Array.isArray(auditData?.events)
        ? auditData.events
        : [];
      auditData.events.push({
        at: new Date().toISOString(),
        type: "import_run",
        tenant_id: activeTenantId,
        jobId: String(pendingJob?.jobId || ""),
        imported,
        published,
        errorsCount: errors.length,
      });
      safeWriteJsonFile(auditPath, auditData);

      return res.json({ ok: true, job: pendingJob });
    } catch (err) {
      return res
        .status(500)
        .json({ error: String(err?.message || "Import failed") });
    }
  });

  router.post("/admin/unpublish-product", (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const productId = String(req.body?.productId || "").trim();
      if (!productId) {
        return res.status(400).json({ error: "Missing productId" });
      }

      const productsPath = path.join(ROOT_DIR, "data", "products.json");
      const draftsPath = path.join(ROOT_DIR, "data", "drafts.json");
      const auditPath = path.join(ROOT_DIR, "data", "import_audit.json");

      const productsData = safeReadJsonFile(productsPath, {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        products: [],
      });
      const draftsData = safeReadJsonFile(draftsPath, {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        drafts: [],
      });
      const auditData = safeReadJsonFile(auditPath, {
        schemaVersion: 1,
        events: [],
      });

      const products = Array.isArray(productsData?.products)
        ? productsData.products
        : [];
      const drafts = Array.isArray(draftsData?.drafts) ? draftsData.drafts : [];

      const existingProduct = products.find(
        (p) => String(p?.productId || "") === productId,
      );
      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      if (String(existingProduct?.tenant_id || "default") !== activeTenantId) {
        return res.status(404).json({ error: "Product not found" });
      }

      const nextProducts = products.filter(
        (p) => String(p?.productId || "") !== productId,
      );
      productsData.products = nextProducts;
      productsData.generatedAt = new Date().toISOString();
      safeWriteJsonFile(productsPath, productsData);

      const draftIndex = drafts.findIndex(
        (d) => String(d?.productId || "") === productId,
      );
      if (draftIndex >= 0) {
        const prev = drafts[draftIndex] || {};
        drafts[draftIndex] = {
          ...prev,
          status: "draft",
          updatedAt: new Date().toISOString(),
        };
        draftsData.drafts = drafts;
        draftsData.generatedAt = new Date().toISOString();
        safeWriteJsonFile(draftsPath, draftsData);
      }

      auditData.events = Array.isArray(auditData?.events)
        ? auditData.events
        : [];
      auditData.events.push({
        at: new Date().toISOString(),
        type: "unpublish_product",
        tenant_id: activeTenantId,
        productId,
      });
      safeWriteJsonFile(auditPath, auditData);

      return res.json({
        ok: true,
        unpublished: productId,
        productsBefore: products.length,
        productsAfter: nextProducts.length,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ error: String(err?.message || "Failed to unpublish product") });
    }
  });

  router.post("/admin/publish-draft", (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const productId = String(req.body?.productId || "").trim();
      if (!productId) {
        return res.status(400).json({ error: "Missing productId" });
      }

      const draftsPath = path.join(ROOT_DIR, "data", "drafts.json");
      const productsPath = path.join(ROOT_DIR, "data", "products.json");
      const auditPath = path.join(ROOT_DIR, "data", "import_audit.json");

      const draftsData = safeReadJsonFile(draftsPath, {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        drafts: [],
      });
      const productsData = safeReadJsonFile(productsPath, {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        products: [],
      });
      const auditData = safeReadJsonFile(auditPath, {
        schemaVersion: 1,
        events: [],
      });

      const drafts = Array.isArray(draftsData?.drafts) ? draftsData.drafts : [];
      const products = Array.isArray(productsData?.products)
        ? productsData.products
        : [];

      const draftIndex = drafts.findIndex(
        (d) => String(d?.productId || "") === productId,
      );
      if (draftIndex < 0) {
        return res.status(404).json({ error: "Draft not found" });
      }

      const draft = drafts[draftIndex] || {};
      if (String(draft?.tenant_id || "default") !== activeTenantId) {
        return res.status(404).json({ error: "Draft not found" });
      }

      if (String(draft?.status || "") === "duplicate") {
        return res.status(400).json({
          error: "Draft is marked as duplicate",
          reasons: draft?.reasons || [],
        });
      }

      const draftProduct =
        draft?.product && typeof draft.product === "object"
          ? draft.product
          : null;
      if (!draftProduct) {
        return res.status(400).json({ error: "Draft has no product data" });
      }

      const { score, reasons } = scoreDraftProduct(draftProduct);
      const autoPublishMinScore = Number(
        process.env.AUTO_PUBLISH_MIN_SCORE || 85,
      );
      const minScore = Number.isFinite(autoPublishMinScore)
        ? autoPublishMinScore
        : 85;

      const duplicateOfProductId = findDuplicateProductId({
        products,
        nextProduct: draftProduct,
      });
      if (duplicateOfProductId && duplicateOfProductId !== productId) {
        reasons.push(
          `Duplicate of existing productId: ${duplicateOfProductId}`,
        );
        return res
          .status(400)
          .json({ error: "Duplicate product detected", score, reasons });
      }

      if (score < minScore) {
        return res.status(400).json({
          error: "Draft does not meet publish requirements",
          score,
          minScore,
          reasons,
        });
      }

      const existingIndex = products.findIndex(
        (p) => String(p?.productId || "") === productId,
      );
      if (existingIndex >= 0) {
        products[existingIndex] = {
          ...products[existingIndex],
          ...draftProduct,
          audit: {
            ...(products[existingIndex]?.audit || {}),
            updatedAt: new Date().toISOString(),
          },
        };
      } else {
        products.push(draftProduct);
      }

      productsData.products = products;
      productsData.generatedAt = new Date().toISOString();
      safeWriteJsonFile(productsPath, productsData);

      drafts[draftIndex] = {
        ...draft,
        score,
        reasons,
        status: "published",
        updatedAt: new Date().toISOString(),
      };
      draftsData.drafts = drafts;
      draftsData.generatedAt = new Date().toISOString();
      safeWriteJsonFile(draftsPath, draftsData);

      auditData.events = Array.isArray(auditData?.events)
        ? auditData.events
        : [];
      auditData.events.push({
        at: new Date().toISOString(),
        type: "publish_draft",
        tenant_id: activeTenantId,
        productId,
      });
      safeWriteJsonFile(auditPath, auditData);

      return res.json({ ok: true, published: productId, score });
    } catch (err) {
      return res
        .status(500)
        .json({ error: String(err?.message || "Failed to publish draft") });
    }
  });

  router.get("/product.html", (req, res) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
        ? tenant.catalog.nicheCategorySlugs
            .map((s) => String(s || "").toLowerCase())
            .filter(Boolean)
        : null;
      const allowedProductTypes = Array.isArray(
        tenant?.catalog?.productTypeSlugs,
      )
        ? tenant.catalog.productTypeSlugs
            .map((s) => String(s || "").toLowerCase())
            .filter(Boolean)
        : null;

      const id = String(req.query?.id || "");
      if (!id) {
        return res.sendFile(path.join(ROOT_DIR, "product.html"));
      }

      const { byId } = loadProductsData();
      const product = byId.get(id);
      if (!product) {
        return res.status(404).type("text/plain").send("Not found");
      }

      if (String(product?.tenant_id || "default") !== activeTenantId) {
        return res.status(404).type("text/plain").send("Not found");
      }

      if (allowedNiches && allowedNiches.length > 0) {
        const nicheSlug = String(
          product?.nicheCategory?.slug || "",
        ).toLowerCase();
        if (!allowedNiches.includes(nicheSlug)) {
          return res.status(404).type("text/plain").send("Not found");
        }
      }

      if (allowedProductTypes && allowedProductTypes.length > 0) {
        const typeSlug = String(product?.productType?.slug || "").toLowerCase();
        if (!allowedProductTypes.includes(typeSlug)) {
          return res.status(404).type("text/plain").send("Not found");
        }
      }

      const canonicalPath = String(product?.seo?.canonicalPath || "");
      if (canonicalPath) {
        return res.redirect(301, canonicalPath);
      }

      return res.sendFile(path.join(ROOT_DIR, "product.html"));
    } catch {
      return res
        .status(500)
        .type("text/plain")
        .send("Failed to resolve product");
    }
  });

  router.get("/api/tenant", (req, res) => {
    const tenant = resolveTenantFromRequest(req);
    const catalog =
      tenant?.catalog && typeof tenant.catalog === "object"
        ? tenant.catalog
        : null;
    const seo =
      tenant?.seo && typeof tenant.seo === "object" ? tenant.seo : null;
    const offers =
      tenant?.offers && typeof tenant.offers === "object"
        ? tenant.offers
        : null;
    const shop =
      tenant?.shop && typeof tenant.shop === "object" ? tenant.shop : null;
    const rawPaymentMethods = String(
      process.env.STRIPE_PAYMENT_METHODS || "card",
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const paymentMethods =
      rawPaymentMethods.length > 0 ? rawPaymentMethods : ["card"];
    return res.json({
      tenant_id: String(tenant.tenant_id || "default"),
      currency: String(tenant.currency || ""),
      language: String(tenant.language || ""),
      catalog,
      seo,
      offers,
      shop,
      payment_methods: paymentMethods,
    });
  });

  router.get("/api/shipping-estimate", (req, res) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const id = String(req.query?.id || "");
      if (!id) {
        return res.status(400).json({ error: "Missing product id" });
      }

      const { byId } = loadProductsData();
      const product = byId.get(id);
      if (
        !product ||
        String(product?.tenant_id || "default") !== activeTenantId
      ) {
        return res.status(404).json({ error: "Not found" });
      }

      const country = String(req.query?.country || "GB");
      const estimate = estimateForProduct(product, country);

      return res.json({
        productId: id,
        shipsFrom: shipsFromLabel(product),
        originRegion: originRegion(product),
        destinationRegion: resolveRegion(country),
        minDays: estimate.minDays,
        maxDays: estimate.maxDays,
        estimateLabel: formatEstimate(estimate),
      });
    } catch {
      return res.status(500).json({ error: "Failed to estimate shipping" });
    }
  });

  router.get("/api/free-shipping-progress", (req, res) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const thresholdMinor =
        Number(tenant?.offers?.freeShipping?.thresholdMinor) || 0;
      const currency = String(tenant?.currency || "GBP").toUpperCase();
      const subtotalMinor = Number(req.query?.subtotal) || 0;

      const progress = freeShippingProgress(subtotalMinor, {
        thresholdMinor,
        currency,
      });
      return res.json(progress);
    } catch {
      return res
        .status(500)
        .json({ error: "Failed to compute free-shipping progress" });
    }
  });

  router.get("/api/related-products", (req, res) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const id = String(req.query?.id || "");
      if (!id) {
        return res.status(400).json({ error: "Missing product id" });
      }

      const { list, byId } = loadProductsData();
      const target = byId.get(id);
      if (
        !target ||
        String(target?.tenant_id || "default") !== activeTenantId
      ) {
        return res.status(404).json({ error: "Not found" });
      }

      const limit = Math.max(1, Math.min(12, Number(req.query?.limit) || 4));

      // Only ever rank against this tenant's own catalog so we never surface
      // another site's products via internal links.
      const tenantCatalog = list.filter(
        (p) => String(p?.tenant_id || "default") === activeTenantId,
      );

      const related = relatedProducts(target, tenantCatalog, { limit }).map(
        (p) => {
          const image = Array.isArray(p?.images) ? p.images[0] : p?.images;
          return {
            productId: String(p?.productId || ""),
            title: String(p?.title || ""),
            canonicalPath: String(p?.seo?.canonicalPath || ""),
            image: image?.src
              ? { src: String(image.src), alt: String(image.alt || "") }
              : null,
            price:
              p?.price && Number.isInteger(p.price.amount)
                ? {
                    amount: p.price.amount,
                    currency: String(p.price.currency || ""),
                  }
                : null,
          };
        },
      );

      return res.json({ tenant_id: activeTenantId, productId: id, related });
    } catch {
      return res
        .status(500)
        .json({ error: "Failed to resolve related products" });
    }
  });
  return router;
}
