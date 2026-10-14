// server/product-pages.js
// Canonical slug-first product pages: /:nicheCategorySlug/:productSlug,
// tenant-scoped, rendered from product.html.

import { resolveTenantFromRequest } from "./tenancy.js";
import { loadProductsData, ROOT_DIR } from "./data-files.js";
import path from "path";
import express from "express";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createProductPagesRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.get("/:nicheCategorySlug/:productSlug", (req, res, next) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const nicheCategorySlug = String(req.params.nicheCategorySlug || "");
      const productSlug = String(req.params.productSlug || "");

      if (nicheCategorySlug.toLowerCase() === "admin") return next();

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
      if (
        allowedNiches &&
        allowedNiches.length > 0 &&
        !allowedNiches.includes(nicheCategorySlug.toLowerCase())
      ) {
        return res.status(404).type("text/plain").send("Not found");
      }

      const { list } = loadProductsData();
      const product = list.find((p) => {
        if (String(p?.tenant_id || "default") !== activeTenantId) return false;
        if (String(p?.nicheCategory?.slug || "") !== nicheCategorySlug)
          return false;

        const canonicalSlug = String(p?.seo?.slug || "");
        const legacySlugs = Array.isArray(p?.seo?.legacySlugs)
          ? p.seo.legacySlugs.map(String)
          : [];

        return (
          canonicalSlug === productSlug || legacySlugs.includes(productSlug)
        );
      });

      if (
        product &&
        allowedProductTypes &&
        allowedProductTypes.length > 0 &&
        !allowedProductTypes.includes(
          String(product?.productType?.slug || "").toLowerCase(),
        )
      ) {
        return res.status(404).type("text/plain").send("Not found");
      }

      if (!product) return next();

      const canonicalPath = String(product?.seo?.canonicalPath || "");
      if (canonicalPath && canonicalPath !== req.path) {
        return res.redirect(301, canonicalPath);
      }

      return res.sendFile(path.join(ROOT_DIR, "product.html"));
    } catch (err) {
      return next(err);
    }
  });
  return router;
}
