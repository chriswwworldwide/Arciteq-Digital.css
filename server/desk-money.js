// server/desk-money.js
// Renders a site's Money page (/<site>/money/) from the shared template
// server/desk-money.html, branded with the site's own stylesheet and the
// masthead from its coach desk.

import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "./data-files.js";
import { accountingProfile } from "../src/tax-rules.js";

// Money page for a site desk: one shared template, branded with the
// site's own stylesheet and the masthead from its coach desk.
export const deskMoneyTemplate = fs.readFileSync(
  path.join(ROOT_DIR, "server", "desk-money.html"),
  "utf8",
);

export const escapeHtml = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

export function renderDeskMoney(tenant) {
  const site = String(tenant?.tenant_id || "");
  const profile = accountingProfile(tenant);
  let masthead = "";
  try {
    const coach = fs.readFileSync(path.join(ROOT_DIR, site, "coach.html"), "utf8");
    masthead = (coach.match(/<header class="masthead[\s\S]*?<\/header>/) || [""])[0]
      .replace(/Coach(?:&#39;|')s desk/g, "Money");
  } catch {
    masthead = "";
  }
  const brand = String(tenant?.seo?.brandName || site);
  const symbol =
    profile.currency === "idr"
      ? "Rp"
      : profile.currency === "gbp"
        ? "£"
        : profile.currency.toUpperCase();
  const config = {
    tenantId: site,
    brand,
    currency: profile.currency,
    country: profile.country,
    vatRegistered: profile.vatRegistered,
    keyName: `${site}.coach.key`,
  };
  return deskMoneyTemplate
    .replaceAll("__TENANT__", site)
    .replaceAll("__BRAND__", escapeHtml(brand))
    .replaceAll("__CURSYMBOL__", symbol)
    .replace("__MASTHEAD__", () => masthead)
    .replace("__CONFIG__", () => JSON.stringify(config).replace(/</g, "\\u003c"));
}
