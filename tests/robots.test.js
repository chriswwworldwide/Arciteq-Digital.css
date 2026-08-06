// tests/robots.test.js
import { describe, it, expect } from "vitest";
import { generateRobotsTxt, DEFAULT_DISALLOW } from "../src/robots.js";

describe("generateRobotsTxt", () => {
  it("allows crawling and blocks private surfaces", () => {
    const txt = generateRobotsTxt({ siteUrl: "https://example.com" });
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
    for (const d of DEFAULT_DISALLOW) {
      expect(txt).toContain(`Disallow: ${d}`);
    }
  });

  it("points at the sitemap and trims a trailing slash", () => {
    const txt = generateRobotsTxt({ siteUrl: "https://example.com/" });
    expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
    expect(txt).not.toContain("com//sitemap");
  });

  it("omits the Sitemap line when no site URL is given", () => {
    const txt = generateRobotsTxt();
    expect(txt).not.toMatch(/Sitemap:/);
    expect(txt).toContain("User-agent: *");
  });

  it("filters blank disallow entries and honors a custom list", () => {
    const txt = generateRobotsTxt({
      siteUrl: "https://x.io",
      disallow: ["/secret", "", "  "],
    });
    expect(txt).toContain("Disallow: /secret");
    expect(txt.match(/Disallow:/g)).toHaveLength(1);
  });

  it("tolerates a non-array disallow (no Disallow lines)", () => {
    const txt = generateRobotsTxt({ siteUrl: "https://x.io", disallow: null });
    expect(txt).not.toMatch(/Disallow:/);
    expect(txt).toContain("Sitemap: https://x.io/sitemap.xml");
  });

  it("ends with a trailing newline", () => {
    expect(generateRobotsTxt()).toMatch(/\n$/);
  });
});
