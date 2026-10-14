// server/health.js
// Public health summary for monitoring (/api/health): config presence,
// database reachability, recent webhook and error activity.

import { resolveTenantFromRequest } from "./tenancy.js";
import { loadProductsData, loadReviewsData } from "./data-files.js";
import express from "express";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createHealthRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.get("/api/health", (req, res) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
        ? tenant.catalog.nicheCategorySlugs.map((s) =>
            String(s || "").toLowerCase(),
          )
        : null;
      const allowedProductTypes = Array.isArray(
        tenant?.catalog?.productTypeSlugs,
      )
        ? tenant.catalog.productTypeSlugs.map((s) =>
            String(s || "").toLowerCase(),
          )
        : null;

      let productsData = { list: [], generatedAt: "" };
      try {
        productsData = loadProductsData();
      } catch {
        productsData = { list: [], generatedAt: "" };
      }

      let reviewsData = { list: [], generatedAt: "" };
      try {
        reviewsData = loadReviewsData();
      } catch {
        reviewsData = { list: [], generatedAt: "" };
      }

      const tenantProducts = Array.isArray(productsData?.list)
        ? productsData.list
            .filter((p) => String(p?.tenant_id || "default") === activeTenantId)
            .filter((p) => {
              if (!allowedNiches || allowedNiches.length === 0) return true;
              const slug = String(p?.nicheCategory?.slug || "").toLowerCase();
              return allowedNiches.includes(slug);
            })
            .filter((p) => {
              if (!allowedProductTypes || allowedProductTypes.length === 0)
                return true;
              const slug = String(p?.productType?.slug || "").toLowerCase();
              return allowedProductTypes.includes(slug);
            })
        : [];

      const tenantReviews = Array.isArray(reviewsData?.list)
        ? reviewsData.list.filter(
            (r) => String(r?.tenant_id || "default") === activeTenantId,
          )
        : [];

      const canonicalCount = tenantProducts.filter((p) => {
        const cp = String(p?.seo?.canonicalPath || "");
        return Boolean(cp);
      }).length;

      const canonicalCoveragePercent = tenantProducts.length
        ? Math.round((canonicalCount / tenantProducts.length) * 100)
        : 0;

      const warnings = [];
      if (tenantProducts.length === 0) warnings.push("No products loaded");
      if (tenantProducts.length > 0 && canonicalCoveragePercent < 100) {
        warnings.push("Some products are missing seo.canonicalPath");
      }

      return res.json({
        tenant: {
          tenant_id: activeTenantId,
        },
        products: {
          count: tenantProducts.length,
          generatedAt: String(productsData?.generatedAt || ""),
        },
        reviews: {
          count: tenantReviews.length,
          generatedAt: String(reviewsData?.generatedAt || ""),
        },
        seo: {
          canonicalCoveragePercent,
        },
        warnings,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ error: err?.message || "Failed to compute health" });
    }
  });
  return router;
}
