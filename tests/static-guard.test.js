import { describe, it, expect } from "vitest";
import { isPrivateStaticPath } from "../src/static-guard.js";

describe("isPrivateStaticPath", () => {
  it.each([
    "/server.js",
    "/db.js",
    "/package.json",
    "/PROSPECTS.md",
    "/BILLIONS.md",
    "/roxjaya/VOICE.md",
    "/migrations/001_init.sql",
    "/scripts/migrate.js",
    "/src/utils.js",
    "/data/alerts.json",
    "/data/exceptions.json",
    "/data/ad_spend.json",
    "/data/local_import_stderr.log",
    "/roxjaya/data/inbox.json",
    "/api/newsletter-open.js",
    "/DATA/alerts.json",
    "/SERVER.JS",
  ])("blocks %s", (p) => {
    expect(isPrivateStaticPath(p)).toBe(true);
  });

  it.each([
    "/roxjaya/",
    "/roxjaya/app.js",
    "/roxjaya/styles.css",
    "/roxjaya/data/faq.json",
    "/roxjaya/data/payment.json",
    "/data/products.json",
    "/data/reviews.json",
    "/data/supplier-assignments.json",
    "/kits/dog.html",
    "/content/senior-dog-mobility.html",
    "/script.js",
    "/service-worker.js",
    "/styles/styles.css",
    "/index.html",
  ])("serves %s", (p) => {
    expect(isPrivateStaticPath(p)).toBe(false);
  });
});
