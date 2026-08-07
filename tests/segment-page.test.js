// tests/segment-page.test.js
import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  escapeJsonLd,
  resolveProduct,
  splitEvents,
  renderSegmentPage,
  renderSegmentsIndex,
} from "../src/segment-page.js";

const products = [
  {
    productId: "p1",
    title: "Reflective No-Pull Harness (Placeholder)",
    nicheCategory: { slug: "pet-safety-essentials" },
    seo: { slug: "reflective-no-pull-harness" },
  },
  {
    productId: "p2",
    title: "Indoor Pet Wellness Camera",
    nicheCategory: { slug: "smart-monitoring" },
    seo: { slug: "indoor-pet-wellness-camera" },
  },
];

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml('<a href="x">&\'')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;",
    );
  });
  it("handles nullish", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("escapeJsonLd", () => {
  it("prevents script breakout", () => {
    expect(escapeJsonLd("</script>")).not.toContain("</");
  });
});

describe("resolveProduct", () => {
  it("resolves url + strips functional tags from title", () => {
    expect(resolveProduct("p1", products)).toEqual({
      url: "/pet-safety-essentials/reflective-no-pull-harness",
      title: "Reflective No-Pull Harness",
    });
  });
  it("returns null for unknown product", () => {
    expect(resolveProduct("nope", products)).toBeNull();
  });
  it("returns null when category/slug missing", () => {
    expect(resolveProduct("x", [{ productId: "x", title: "X" }])).toBeNull();
  });
});

describe("splitEvents", () => {
  const events = [
    { date: "2026-01-10", name: "Past", result: "1st" },
    { date: "2026-12-20", name: "Future" },
    { date: "not-a-date", name: "Ignored" },
  ];
  it("splits by the reference date and sorts", () => {
    const { upcoming, recent } = splitEvents(events, new Date("2026-06-01"));
    expect(upcoming.map((e) => e.name)).toEqual(["Future"]);
    expect(recent.map((e) => e.name)).toEqual(["Past"]);
  });
  it("treats an event dated today as upcoming", () => {
    const { upcoming } = splitEvents(
      [{ date: "2026-06-01", name: "Today" }],
      new Date("2026-06-01T15:00:00Z"),
    );
    expect(upcoming.map((e) => e.name)).toEqual(["Today"]);
  });
  it("handles non-array input", () => {
    expect(splitEvents(null)).toEqual({ upcoming: [], recent: [] });
  });
});

describe("renderSegmentPage", () => {
  const segment = {
    slug: "show-dogs",
    metaTitle: "For Show Dogs",
    metaDescription: "desc",
    heroTitle: "Ring ready",
    heroIntro: "intro",
    whoFor: "handlers",
    why: "condition",
    reads: [{ title: "Coat care", body: "groom regularly" }],
    problems: [{ title: "Consistent", text: "condition holds" }],
    picks: [{ productId: "p1", why: "control", ref: "show-dogs" }],
    events: [
      { date: "2026-01-10", name: "Crufts", location: "NEC", result: "BOB" },
      { date: "2026-12-20", name: "Winter Show", location: "TBC" },
    ],
    rundown: {
      steps: [{ time: "AM", title: "Arrive", text: "settle" }],
    },
    kit: { name: "Show-Day Kit", text: "bundle soon" },
    faqs: [{ q: "When to condition?", a: "Weeks ahead." }],
  };

  const html = renderSegmentPage(segment, {
    products,
    today: new Date("2026-06-01"),
  });

  it("renders canonical, hero and intro", () => {
    expect(html).toContain(
      '<link rel="canonical" href="/segments/show-dogs.html"',
    );
    expect(html).toContain("Ring ready");
    expect(html).toContain("Who it's for");
    expect(html).toContain("handlers");
  });

  it("resolves product picks to canonical urls", () => {
    expect(html).toContain(
      "/pet-safety-essentials/reflective-no-pull-harness?ref=show-dogs",
    );
  });

  it("splits events into upcoming and recent with results", () => {
    expect(html).toContain("Upcoming events");
    expect(html).toContain("Recent events");
    expect(html).toContain("Winter Show");
    expect(html).toContain("BOB");
  });

  it("emits FAQ + ItemList + Event JSON-LD that parses", () => {
    const blocks = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1].trim()));
    const types = blocks.map((b) =>
      Array.isArray(b) ? b[0]["@type"] : b["@type"],
    );
    expect(types).toContain("FAQPage");
    expect(types).toContain("ItemList");
    expect(types).toContain("Event");
    expect(types).toContain("BreadcrumbList");
  });

  it("renders a breadcrumb trail to the hub", () => {
    expect(html).toContain('class="seg-breadcrumb"');
    expect(html).toContain('href="/segments/"');
    expect(html).toContain('aria-current="page"');
  });

  it("hub has breadcrumb + ItemList schema listing every segment", () => {
    const index = renderSegmentsIndex([
      { slug: "breeders", indexTitle: "Breeders" },
      { slug: "show-dogs", indexTitle: "Show Dogs" },
    ]);
    expect(index).toContain('class="seg-breadcrumb"');
    const blocks = [
      ...index.matchAll(
        /<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1].trim()));
    const types = blocks.map((b) => b["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("ItemList");
    const itemList = blocks.find((b) => b["@type"] === "ItemList");
    expect(itemList.itemListElement).toHaveLength(2);
    expect(itemList.itemListElement[0].url).toBe("/segments/breeders.html");
  });

  it("renders the enquiry form for the kit", () => {
    expect(html).toContain('class="seg-enquiry"');
    expect(html).toContain('data-segment="show-dogs"');
  });

  it("omits the events section when there are no events", () => {
    const noEvents = renderSegmentPage(
      { ...segment, events: [] },
      { products, today: new Date("2026-06-01") },
    );
    expect(noEvents).not.toContain("Upcoming events");
  });
});

describe("renderSegmentsIndex", () => {
  it("links every segment", () => {
    const html = renderSegmentsIndex([
      { slug: "breeders", heroTitle: "Breeders", metaDescription: "d" },
      { slug: "multi-pet", indexTitle: "Multi-Pet", indexBlurb: "b" },
    ]);
    expect(html).toContain("/segments/breeders.html");
    expect(html).toContain("/segments/multi-pet.html");
    expect(html).toContain("Multi-Pet");
  });
});
