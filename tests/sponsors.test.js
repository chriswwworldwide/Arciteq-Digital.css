import { describe, it, expect } from "vitest";
import {
  sponsorSlotOf,
  sponsorItems,
  sanitizeSponsor,
  addDays,
  buildSponsorCandidate,
  activePartners,
  extendPartner,
} from "../src/sponsors.js";
import { validateCandidate, applyEdits, applyPatches } from "../src/inbox.js";
import { summarizePageviews } from "../src/analytics.js";

const product = {
  id: "roxjaya-ad-results-001",
  title: "Results board sponsor",
  attributes: { sponsorSlot: "results" },
};
const good = {
  name: "20FIT",
  url: "https://20fit.example.com/",
  logo: "https://20fit.example.com/logo.png",
  tagline: "Jakarta's Hyrox club",
};

describe("sponsors: products", () => {
  it("reads the slot only from a valid attribute", () => {
    expect(sponsorSlotOf(product)).toBe("results");
    expect(sponsorSlotOf({ attributes: { sponsorSlot: "BAD SLOT!" } })).toBe(
      "",
    );
    expect(sponsorSlotOf({})).toBe("");
  });
  it("picks sponsor products out of an order", () => {
    const byId = new Map([
      [product.id, product],
      ["plan", { id: "plan", attributes: {} }],
    ]);
    const items = [{ productId: "plan" }, { id: product.id, quantity: 1 }];
    expect(sponsorItems(items, byId).map((p) => p.id)).toEqual([product.id]);
    expect(sponsorItems(null, byId)).toEqual([]);
  });
});

describe("sponsors: sanitize", () => {
  it("accepts a complete sponsor", () => {
    expect(sanitizeSponsor(good).sponsor).toEqual(good);
  });
  it("rejects missing name / bad urls", () => {
    expect(sanitizeSponsor({ ...good, name: "X" }).error).toMatch(/name/i);
    expect(sanitizeSponsor({ ...good, url: "javascript:1" }).error).toMatch(
      /Website/,
    );
    expect(sanitizeSponsor({ ...good, logo: "ftp://x" }).error).toMatch(/Logo/);
    expect(sanitizeSponsor(null).error).toBeTruthy();
  });
});

describe("sponsors: candidate → partners.json", () => {
  const base = {
    orderId: "abcdef12-3456",
    email: "boss@20fit.example.com",
    product,
    sponsor: good,
    paidAt: "2026-09-03T10:00:00Z",
    partnersFile: "roxjaya/data/partners.json",
  };

  it("builds a valid inbox candidate with a 31-day paid window", () => {
    const c = buildSponsorCandidate(base);
    expect(c.kind).toBe("sponsor");
    expect(c.key).toBe("sponsor:abcdef12-3456:results");
    expect(validateCandidate(c)).not.toBeNull();
    const row = c.apply[0].value;
    expect(row).toMatchObject({
      id: "sp-abcdef12",
      slot: "results",
      name: "20FIT",
      from: "2026-09-03",
      until: addDays("2026-09-03T10:00:00Z", 31),
    });
    expect(c.editable).toEqual(["name", "url", "logo", "tagline"]);
  });

  it("returns null for non-sponsor products or missing order", () => {
    expect(
      buildSponsorCandidate({ ...base, product: { attributes: {} } }),
    ).toBeNull();
    expect(buildSponsorCandidate({ ...base, orderId: "" })).toBeNull();
  });

  it("keeps a paid-but-incomplete sponsor off the site until fixed", () => {
    const c = validateCandidate(
      buildSponsorCandidate({
        ...base,
        sponsor: { name: "Someone", url: "", logo: "", tagline: "" },
      }),
    );
    expect(c.source).toBe("");
    expect(sanitizeSponsor(c.apply[0].value).error).toMatch(/Website/);
    applyEdits(c, { url: "https://fixed.example.com/" });
    expect(sanitizeSponsor(c.apply[0].value).sponsor.url).toBe(
      "https://fixed.example.com/",
    );
  });

  it("Dina's edits land in the partner row that gets written", () => {
    const c = validateCandidate(buildSponsorCandidate(base));
    applyEdits(c, { tagline: "Tidier line", name: "20FIT Arena" });
    const files = { "roxjaya/data/partners.json": { items: [] } };
    const out = applyPatches(c, {
      allowedFiles: ["roxjaya/data/partners.json"],
      readJson: (f) => files[f],
      writeJson: (f, j) => (files[f] = j),
    });
    expect(out.applied).toEqual(["roxjaya/data/partners.json"]);
    const row = files["roxjaya/data/partners.json"].items[0];
    expect(row.tagline).toBe("Tidier line");
    expect(row.name).toBe("20FIT Arena");
    expect(row.url).toBe(good.url);
  });
});

describe("sponsors: lifecycle", () => {
  const json = {
    items: [
      {
        name: "A",
        url: "https://a.x/",
        orderId: "o1",
        from: "2026-01-01",
        until: "2026-02-01",
      },
      {
        name: "B",
        url: "https://b.x/",
        orderId: "o2",
        from: "2026-03-01",
        until: "2026-03-31",
      },
      { name: "C", url: "https://c.x/", orderId: "o3" },
      { name: "", url: "https://d.x/", orderId: "o4" },
    ],
  };
  it("shows only rows inside their paid window", () => {
    expect(activePartners(json, "2026-01-15").map((p) => p.name)).toEqual([
      "A",
      "C",
    ]);
    expect(activePartners(json, "2026-02-15").map((p) => p.name)).toEqual([
      "C",
    ]);
    expect(activePartners(null).length).toBe(0);
  });
  it("renewal only ever extends `until`", () => {
    const j = JSON.parse(JSON.stringify(json));
    expect(extendPartner(j, "o1", "2026-03-01")).toBe(true);
    expect(j.items[0].until).toBe("2026-03-01");
    expect(extendPartner(j, "o1", "2026-01-10")).toBe(false);
    expect(j.items[0].until).toBe("2026-03-01");
    expect(extendPartner(j, "nope", "2027-01-01")).toBe(false);
  });
});

describe("sponsors: click reporting", () => {
  it("separates /out/<id> beacons from page rankings", () => {
    const rows = [
      { at: "2026-09-01T08:00:00Z", path: "/roxjaya/", visitor: "v1" },
      {
        at: "2026-09-01T08:00:00Z",
        path: "/roxjaya/out/sp-abc",
        visitor: "v1",
      },
      {
        at: "2026-09-01T08:00:00Z",
        path: "/roxjaya/out/sp-abc/",
        visitor: "v2",
      },
      { at: "2026-09-01T08:00:00Z", path: "/roxjaya/out/", visitor: "v2" },
    ];
    const s = summarizePageviews(rows);
    expect(s.outbound).toEqual([
      { key: "sp-abc", count: 2 },
      { key: "unknown", count: 1 },
    ]);
    expect(s.pages.map((p) => p.key)).toEqual(["/roxjaya/"]);
  });
});
