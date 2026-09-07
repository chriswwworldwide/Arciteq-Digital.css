import { describe, it, expect } from "vitest";
import {
  pageviewsEnabled,
  referrerHost,
  validatePageview,
  summarizePageviews,
} from "../src/analytics.js";

describe("pageviewsEnabled", () => {
  it("is opt-in per tenant", () => {
    expect(pageviewsEnabled({ analytics: { pageviews: true } })).toBe(true);
    expect(pageviewsEnabled({ analytics: { pageviews: "yes" } })).toBe(false);
    expect(pageviewsEnabled({})).toBe(false);
    expect(pageviewsEnabled(null)).toBe(false);
  });
});

describe("referrerHost", () => {
  it("keeps external hosts, drops own host, www and junk", () => {
    expect(referrerHost("https://www.instagram.com/p/x", "roxjaya.com")).toBe(
      "instagram.com",
    );
    expect(referrerHost("https://www.roxjaya.com/splits/", "roxjaya.com")).toBe(
      null,
    );
    expect(referrerHost("not a url", "roxjaya.com")).toBe(null);
    expect(referrerHost("", "roxjaya.com")).toBe(null);
  });
});

describe("validatePageview", () => {
  it("strips query/hash, keeps utm + visitor, rejects bad paths", () => {
    const out = validatePageview(
      {
        path: "/roxjaya/splits/?token=secret#x",
        referrer: "https://l.instagram.com/?u=1",
        utm: { source: "ig", medium: "bio", campaign: " launch " },
        visitor: "ABCDEF0123456789",
      },
      { ownHost: "roxjaya.com:3000" },
    );
    expect(out.row).toEqual({
      path: "/roxjaya/splits/",
      referrer_host: "l.instagram.com",
      utm_source: "ig",
      utm_medium: "bio",
      utm_campaign: "launch",
      visitor: "abcdef0123456789",
    });
    expect(validatePageview({ path: "javascript:x" }).error).toBe(
      "Invalid path",
    );
    expect(
      validatePageview({ path: "/", visitor: "not-hex!" }).row.visitor,
    ).toBe(null);
  });
});

describe("summarizePageviews", () => {
  const rows = [
    {
      path: "/",
      visitor: "a",
      at: "2026-09-01T10:00:00Z",
      referrer_host: "instagram.com",
    },
    { path: "/", visitor: "a", at: "2026-09-01T11:00:00Z" },
    {
      path: "/splits/",
      visitor: "b",
      at: "2026-09-01T12:00:00Z",
      utm_source: "ig",
      email: "x@y.z",
    },
    { path: "/splits/", visitor: "c", at: "2026-09-02T09:00:00Z" },
    { path: "/results/", visitor: null, at: "bad date" },
  ];

  it("counts views, daily-unique visitors, identified views, top pages and sources", () => {
    const s = summarizePageviews(rows, { top: 2 });
    expect(s.views).toBe(5);
    expect(s.visitors).toBe(3);
    expect(s.identified).toBe(1);
    expect(s.days).toEqual([
      { day: "2026-09-01", views: 3, visitors: 2 },
      { day: "2026-09-02", views: 1, visitors: 1 },
    ]);
    expect(s.pages).toEqual([
      { key: "/", count: 2 },
      { key: "/splits/", count: 2 },
    ]);
    expect(s.sources).toEqual([
      { key: "direct / typed", count: 2 },
      { key: "ig", count: 1 },
    ]);
  });

  it("handles empty input", () => {
    expect(summarizePageviews(null)).toEqual({
      views: 0,
      visitors: 0,
      identified: 0,
      days: [],
      pages: [],
      sources: [],
    });
  });
});
