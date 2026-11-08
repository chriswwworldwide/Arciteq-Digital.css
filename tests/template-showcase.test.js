import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertTemplateBuild, selectConfirmedRaces, renderRaceCards, normaliseShowcaseNavigation, renderCoachView, resolveTrainingPlatform, resolveCampaignOffers, wireCoachView } from "../src/template-showcase.js";

const race = (slug, start, country = "United Kingdom") => ({ slug, name: slug, country, race: { name: `HYROX ${slug}`, status: "confirmed", start, end: start, dates: start, source: `https://hyrox.com/event/${slug}/` } });
const catalogue = { checked: "2026-10-25", cities: [race("world", "2026-11-02", "Singapore"), race("local", "2026-12-02"), race("old", "2026-01-01"), { ...race("unknown", "2026-12-10"), race: { status: "pending" } }] };

describe("canonical template showcase", () => {
  it("shares the homepage Back-scroll checkpoint without a tenant-specific override", () => {
    const html = fs.readFileSync(new URL("../chassis/index.html", import.meta.url), "utf8");
    expect(html.match(/const key = "__s9HomeScroll"/g)).toHaveLength(1);
    expect(html).toContain("event.persisted || returning");
    expect(html).toContain("anchor: lastAnchor");
    expect(html).toContain("observer?.disconnect()");
    expect(html).toContain('const inputs = ["wheel", "touchstart", "pointerdown", "keydown"]');
    expect(html).toContain('holdScroll(() => ({ x: 0, y: 0 }), 500, [50, 150, 350])');
    expect(html).not.toContain('history.replaceState(null, "", location.pathname + location.search)');
    const paul = JSON.parse(fs.readFileSync(new URL("../scripts/reskin/paulgillingham.demo.json", import.meta.url), "utf8"));
    expect(paul.copyOverrides.some(override => override.replace.includes("__s9HomeScroll"))).toBe(false);
  });
  it("refuses new builds from another tenant, including quiet legacy defaults", () => {
    expect(() => assertTemplateBuild({ mode: "pair" }, { existing: false })).toThrow(/canonical template/);
    expect(() => assertTemplateBuild({}, { existing: false, legacyMaintenance: true })).toThrow(/canonical template/);
    expect(() => assertTemplateBuild({ mode: "chassis" }, {})).not.toThrow();
    expect(() => assertTemplateBuild({ mode: "pair" }, { existing: true, legacyMaintenance: true })).not.toThrow();
  });
  it("prefers regional confirmed races but uses a real world event when needed", () => {
    expect(selectConfirmedRaces(catalogue, { today: "2026-10-25", region: "United Kingdom" }).map(c => c.slug)).toEqual(["local", "world"]);
    expect(selectConfirmedRaces(catalogue, { today: "2026-10-25", region: "Canada" })[0].slug).toBe("world");
  });
  it("fails stale or empty catalogues instead of publishing TBA cards", () => {
    expect(() => selectConfirmedRaces(catalogue, { today: "2027-02-01" })).toThrow(/Refresh/);
    expect(() => selectConfirmedRaces({ checked: "2026-10-25", cities: [] }, { today: "2026-10-25" })).toThrow(/confirmed/);
    expect(() => selectConfirmedRaces({ checked: "2026-10-25", cities: [race("unsafe", "2026-11-01")] }, { today: "2026-10-25" })).not.toThrow();
  });
  it("renders dated, sourced homepage cards with safe escaped content", () => {
    const cities = selectConfirmedRaces(catalogue, { today: "2026-10-25" });
    const html = renderRaceCards(cities, "preview", { today: "2026-10-25" });
    expect(html).not.toMatch(/TBA|TBC/);
    expect(html).toContain("https://hyrox.com/event/");
    // rotation: the race inside the 14-day lead window drops off the board
    expect(html).not.toContain('datetime="2026-11-02"');
    expect(html).toContain('datetime="2026-12-02"');
    // a zero-lead board still renders the next race (explicit override only)
    const full = renderRaceCards(cities, "preview", { today: "2026-10-25", leadDays: 0 });
    expect(full).toContain('datetime="2026-11-02"');
    expect(full).toContain("/preview/events.html#world");
  });
  it("makes core showcase features discoverable and retires split calendar links", () => {
    const html = normaliseShowcaseNavigation('<ul class="menu" id="menu"><li><a href="/preview/race-planner/">Race-trip planner</a></li><li><a href="/preview/news.html">UK HYROX news</a></li></ul>', "preview");
    expect(html).toContain("The Hybrid Brief");
    expect(html).toContain("Race Calendar &amp; Travel");
    expect(html).not.toContain("/preview/desk.html");
    expect(html).toContain("/preview/planner.html?view=client");
    expect(html).not.toContain("/race-planner/");
  });
  it("separates coach-only links from client navigation and provides the coach workspace bar", () => {
    const publicHTML = normaliseShowcaseNavigation('<ul class="menu" id="menu"><li><a href="/preview/desk.html">The Desk</a></li><li><a href="/preview/manage-videos.html">Manage videos</a></li></ul><footer><a href="/preview/desk.html#next-campaign">Campaigns</a></footer>', "preview");
    expect(publicHTML).not.toMatch(/desk\.html|manage-videos\.html/);
    const bar = renderCoachView("preview");
    expect(bar).toContain("The Desk");
    expect(bar).toContain("Bookings");
    expect(bar).toContain("view=coach");
    expect(bar).toContain("Content");
    expect(bar).toContain("Programmes");
    expect(bar).toContain("Finance");
    expect(bar).toContain("/preview/campaigns.html?audience=coach");
    expect(publicHTML).not.toContain("manage-programmes.html");
    expect(bar).toContain("audience=public");
    expect(bar).toContain("Your coaching tools");
    expect(bar).toContain('href="/preview/?audience=coach"');
    expect(bar).toContain("Preview public site");
  });
  it("wires coach previews idempotently without treating the toolbar as public navigation", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "s9-coach-view-unit-"));
    const page = '<html lang="en"><head></head><body><div class="nav"><ul class="menu" id="menu"><li><a href="/preview/desk.html">Desk</a></li></ul></div></body></html>';
    for (const file of ["index.html", "desk.html", "manage-videos.html", "manage-programmes.html"]) fs.writeFileSync(path.join(directory, file), page);
    fs.writeFileSync(path.join(directory, "planner.html"), '<html><head></head><body>Booking preview</body></html>');
    const config = { slug: "preview" };
    wireCoachView({ outputDir: directory, config });
    wireCoachView({ outputDir: directory, config });
    const html = fs.readFileSync(path.join(directory, "index.html"), "utf8");
    expect(html.match(/<aside[^>]*data-coach-view/g)).toHaveLength(1);
    expect(html).toContain('data-coach-preview="true"');
    expect(fs.readFileSync(path.join(directory, "manage-videos.html"), "utf8")).toContain('data-coach-page="true"');
    expect(fs.readFileSync(path.join(directory, "planner.html"), "utf8")).toContain('data-coach-view');
    wireCoachView({ outputDir: directory, config: { slug: "preview", coachPreview: false } });
    expect(fs.readFileSync(path.join(directory, "index.html"), "utf8")).not.toContain('data-coach-view');
    expect(fs.existsSync(path.join(directory, "manage-videos.html"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "manage-programmes.html"))).toBe(false);
  });
  it("removes links to an omitted Fuel module without dropping the surrounding advice", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "s9-hidden-fuel-"));
    const html = '<html><head></head><body><p>Early dinner (<a href="/preview/fuel-zone/#night">Fuel Zone: night before</a>).</p><p><a href="/preview/fuel-zone.html#cramps">Practical race advice</a></p></body></html>';
    fs.writeFileSync(path.join(directory, "taper-zone.html"), html);
    wireCoachView({ outputDir: directory, config: { slug: "preview", nutrition: { mode: "hidden" } } });
    const output = fs.readFileSync(path.join(directory, "taper-zone.html"), "utf8");
    expect(output).not.toContain("fuel-zone");
    expect(output).toContain("Early dinner.");
    expect(output).toContain("Practical race advice");
  });
  it("keeps private tools focused and never treats an enquiry URL as a provider login", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "s9-focused-desk-"));
    const page = '<html><head></head><body><header>Brand</header><div class="nav"><div><ul id="menu"><li>Public menu</li></ul></div></div><main><a href="/preview/campaigns.html#client-success">Client success</a></main></body></html>';
    for (const file of ["index.html", "desk.html", "campaigns.html", "platform-setup.html"]) fs.writeFileSync(path.join(directory, file), page);
    wireCoachView({ outputDir: directory, config: { slug: "preview" } });
    for (const file of ["desk.html", "campaigns.html", "platform-setup.html"]) {
      const html = fs.readFileSync(path.join(directory, file), "utf8");
      expect(html).not.toContain('id="menu"');
      expect(html).toContain('data-coach-page="true"');
      expect(html).toContain('href="/preview/campaigns.html#client-success"');
    }
    expect(fs.readFileSync(path.join(directory, "index.html"), "utf8")).toContain('id="menu"');
    const unknown = resolveTrainingPlatform({ tokens: { PROGRAMMES_URL: "https://example.com/enquire", APPLY_URL: "https://example.com/enquire" } });
    expect(unknown.coachURL).toBe("");
    expect(unknown.clientURL).toBe("");
    expect(unknown.directCoachLink).toBe(false);
  });
  it("keeps coach sign-in, client access and public programme destinations distinct", () => {
    const platform = resolveTrainingPlatform({ tokens: { PROGRAMMES_URL: "https://example.com/programmes", APPLY_URL: "https://example.com/apply" }, trainingPlatform: { name: "ABC Trainerize", coachURL: "https://www.trainerize.com/login/", clientURL: "https://www.trainerize.com/login/" } });
    expect(platform.coachURL).toBe("https://www.trainerize.com/login/");
    expect(platform.programmesURL).toBe("https://example.com/programmes");
    expect(platform.directCoachLink).toBe(true);
    const fitr = resolveTrainingPlatform({ tokens: { PROGRAMMES_URL: "https://sample.fitr.training/t/Example", APPLY_URL: "https://example.com/apply" } });
    expect(fitr.name).toBe("FITR");
    expect(fitr.coachURL).toBe("https://app.fitr.training/");
    expect(fitr.programmesURL).toContain("sample.fitr.training");
  });
  it("uses the sourced primary offer without losing separate application and login routes", () => {
    const platform = resolveTrainingPlatform({ tokens: { PROGRAMMES_URL: "https://example.com/overview", APPLY_URL: "https://example.com/apply" }, trainingPlatform: { programmesURL: "https://example.com/old", clientURL: "https://example.com/login" }, coachingOffers: [{ title: "A real plan", description: "A sourced description", url: "https://example.com/product" }] });
    expect(platform.programmesURL).toBe("https://example.com/product");
    expect(platform.applicationURL).toBe("https://example.com/apply");
    expect(platform.clientURL).toBe("https://example.com/login");
    expect(platform.offerTitle).toBe("A real plan");
    expect(platform.offerDescription).toBe("A sourced description");
  });
  it("preserves explicit product and affiliate destinations through showcase preparation", () => {
    const training = { programmesURL: "https://example.com/overview", applicationURL: "https://example.com/apply" };
    const offers = [{ id: "programme", destination: "https://example.com/12-week" }, { id: "coaching", destination: "https://example.com/consultation" }, { id: "programme-3", destination: "https://example.com/doubles?ref=coach" }, { id: "shop", destination: "https://example.com/store?sca_ref=public-referral" }];
    expect(resolveCampaignOffers(offers, training)).toEqual(offers);
    expect(resolveCampaignOffers([{ id: "programme" }, { id: "coaching" }], training).map(o => o.destination)).toEqual([training.programmesURL, training.applicationURL]);
  });
  it("rejects unsafe explicit campaign URLs instead of silently replacing them", () => {
    for (const destination of ["javascript:alert(1)", "https://user:password@example.com/", "https://example.com/?access_token=private"]) expect(() => resolveCampaignOffers([{ id: "programme", destination }], {})).toThrow();
  });
  it("rejects an unsafe primary offer even when the old programme fallback is valid", () => {
    expect(() => resolveTrainingPlatform({ tokens: { PROGRAMMES_URL: "https://example.com/overview", APPLY_URL: "https://example.com/apply" }, coachingOffers: [{ url: "javascript:alert(1)" }] })).toThrow(/valid HTTPS/);
  });
  it("rejects unsafe or credential-bearing training destinations", () => {
    const config = { tokens: { PROGRAMMES_URL: "https://example.com/programmes", APPLY_URL: "https://example.com/apply" }, trainingPlatform: { coachURL: "javascript:alert(1)" } };
    expect(() => resolveTrainingPlatform(config)).toThrow(/valid HTTPS/);
    config.trainingPlatform.coachURL = "https://user:password@example.com/login";
    expect(() => resolveTrainingPlatform(config)).toThrow(/valid HTTPS/);
    config.trainingPlatform.coachURL = "https://example.com/login?access_token=private";
    expect(() => resolveTrainingPlatform(config)).toThrow(/valid HTTPS/);
  });
  it("keeps captions and station labels free of decorative figure counters and slashes", () => {
    const css = fs.readFileSync("chassis/guidance.css", "utf8");
    expect(css).not.toMatch(/content:\s*["']Fig[.\s]/i);
    expect(css).not.toMatch(/counter-(?:reset|increment):\s*plate/);
    expect(css).not.toMatch(/\.num::before\s*\{[^}]*content:\s*["']\/ /);
  });
  it("uses the shared partial frame on Prep Club and preserves Partners image proportions", () => {
    const prep = fs.readFileSync("chassis/prep-club.html", "utf8");
    const partners = fs.readFileSync("chassis/partners.html", "utf8");
    const shelf = fs.readFileSync("chassis/shelf.css", "utf8");
    expect(prep).toMatch(/<figure class="guide-hero-photo prep-hero-photo"><img/);
    expect(partners).toContain("shelf--partners");
    expect(shelf).toMatch(/shelf--partners \.guide-hero-photo img\s*\{[^}]*height:\s*auto;[^}]*aspect-ratio:\s*auto;[^}]*object-fit:\s*contain;/);
  });
  it("ships sourced international stories with coach takes and a usable city schema", () => {
    const cities = JSON.parse(fs.readFileSync("chassis/data/cities.json", "utf8"));
    const news = JSON.parse(fs.readFileSync("chassis/data/news.json", "utf8"));
    expect(cities.cities.length).toBeGreaterThanOrEqual(6);
    expect(news.items.length).toBeGreaterThanOrEqual(5);
    for (const item of news.items) {
      expect(item.source).toMatch(/^https:\/\//);
      expect(item.take).toBeTruthy();
    }
    expect(fs.readFileSync("chassis/planner.js", "utf8")).not.toContain('timeZone: "the UK/');
  });
});
