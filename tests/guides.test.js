import { describe, it, expect } from "vitest";
import {
  validateGuide,
  sanitizeBody,
  similarity,
  nearDuplicate,
  renderGuidePage,
  renderGuideIndex,
  slugify,
} from "../src/guides.js";

const para = (i) =>
  `<p>Paragraph ${i}: ${"hyrox station pacing words for the test body ".repeat(6)}</p>`;
const body = `<h3>First</h3>${para(1)}${para(2)}<h3>Second</h3>${para(3)}${para(4)}${para(5)}${para(6)}${para(7)}${para(8)}${para(9)}${para(10)}${para(11)}`;
const good = {
  title: "How to pace the sled push in Jakarta heat",
  description:
    "A practical guide to sled push pacing for HYROX athletes training in hot, humid Jakarta gyms and racing indoors.",
  body_html: body,
  faqs: [
    { q: "How heavy is the women's sled?", a: "102 kg including the sled." },
    { q: "How long should it take?", a: "Two to four minutes for most." },
  ],
};

describe("guides", () => {
  it("validates and slugifies a good guide", () => {
    const r = validateGuide(good);
    expect(r.error).toBeUndefined();
    expect(r.guide.slug).toBe("how-to-pace-the-sled-push-in-jakarta-heat");
    expect(r.guide.faqs).toHaveLength(2);
  });
  it("rejects thin bodies and missing FAQs", () => {
    expect(
      validateGuide({ ...good, body_html: "<h3>x</h3><p>short</p>" }).error,
    ).toMatch(/short/);
    expect(validateGuide({ ...good, faqs: [] }).error).toMatch(/FAQ/);
    expect(validateGuide({ ...good, description: "tiny" }).error).toMatch(
      /description/,
    );
  });
  it("sanitises body HTML", () => {
    const out = sanitizeBody(
      '<script>alert(1)</script><p onclick="x">ok <a href="javascript:evil()">bad</a> <a href="/roxjaya/">good</a></p><img src=x>',
    );
    expect(out).toBe(
      'alert(1)<p>ok <a>bad</a> <a href="/roxjaya/">good</a></p>',
    );
  });
  it("detects near duplicates", () => {
    expect(similarity(body, body)).toBe(1);
    const other =
      "<p>completely different text about nutrition and tapering before race day</p>";
    expect(similarity(body, other)).toBe(0);
    const dup = nearDuplicate({ title: good.title, body_html: body }, [
      { slug: "old", title: "Old", body_html: body },
    ]);
    expect(dup?.slug).toBe("old");
    expect(
      nearDuplicate({ title: "x", body_html: other }, [
        { slug: "old", title: "Old", body_html: body },
      ]),
    ).toBeNull();
  });
  it("renders a page with schema, toc, faqs and canonical", () => {
    const g = {
      ...validateGuide(good).guide,
      published_at: "2026-10-04T00:00:00Z",
      updated_at: "2026-10-04T00:00:00Z",
    };
    const cfg = {
      basePath: "/roxjaya/guides/",
      brand: "Roxjaya Warriors Jakarta",
      homePath: "/roxjaya/",
      author: { name: "Dina Rosdiana" },
      nav: [{ href: "/roxjaya/", label: "Home" }],
    };
    const html = renderGuidePage(g, cfg, [
      { slug: "other", title: "Other guide" },
    ]);
    expect(html).toContain(
      '<link rel="canonical" href="/roxjaya/guides/how-to-pace-the-sled-push-in-jakarta-heat/" />',
    );
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"dateModified":"2026-10-04"');
    expect(html).toContain('<h3 id="first">First</h3>');
    expect(html).toContain('href="#first"');
    expect(html).toContain("/roxjaya/guides/other/");
    expect(renderGuideIndex([g], cfg)).toContain(g.title);
  });
  it("slugify", () => {
    expect(slugify("Sled Push & Pull: Tips!")).toBe("sled-push-and-pull-tips");
  });
});
