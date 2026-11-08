// reskin-tenant.js — build a demo tenant from the canonical chassis.
// Usage: node scripts/reskin-tenant.js .devin/template-preview.json --output-dir=<new-directory>
//
// Steps: copy chassis/, fill the approved tenant tokens and media, prepare
// sourced showcase data, validate the result, then install the booking preview.
// Isolated output leaves existing sites and the registry unchanged. Replacement needs explicit approval.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { installBookingPlanner } from "./booking-planner.js";
import { overrideReplacement } from "../src/reskin-overrides.js";
import { assertTemplateBuild, prepareShowcase, wireCoachView } from "../src/template-showcase.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Post-build mechanical check: broken images, viewport overflow, heavy crops
// (with before/after shots), JS errors, missing folds. Non-blocking — build
// still succeeds, but EYE shots must be reviewed before sign-off.
function runVerify(dir, label) {
  if (process.env.SKIP_VERIFY) return;
  try {
    const r = spawnSync(process.execPath, [path.join(root, "scripts/verify-build.mjs"), dir, "--pages=index.html", `--slug=${label}`], { stdio: "inherit", cwd: root });
    if (r.status !== 0) console.log(`verify-build: FAILs on ${label} — review before shipping. Full sweep: node scripts/verify-build.mjs ${dir}`);
  } catch (e) { console.log("verify-build skipped:", e.message); }
}

// tenants.json is shared state — parallel builds must serialize the
// read-modify-write or the last writer clobbers the others' registrations.
// Lockfile via O_EXCL create; stale locks (>60s) are broken so a crashed
// build can't wedge the queue. Writes go to a temp file then rename so a
// reader never sees a half-written file.
function withTenantsLock(mutate) {
  const tenantsFile = path.join(root, "data", "tenants.json");
  const lockFile = tenantsFile + ".lock";
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      const fd = fs.openSync(lockFile, "wx");
      fs.closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        if (Date.now() - fs.statSync(lockFile).mtimeMs > 60000)
          fs.unlinkSync(lockFile);
      } catch (e) {
        void e; // lock vanished between stat and unlink — retry loop handles it
      }
      if (Date.now() > deadline)
        throw new Error("timed out waiting for tenants.json lock");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    const tenants = JSON.parse(fs.readFileSync(tenantsFile, "utf8"));
    mutate(tenants);
    const tmp = tenantsFile + ".tmp-" + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(tenants, null, 2) + "\n");
    fs.renameSync(tmp, tenantsFile);
  } finally {
    fs.unlinkSync(lockFile);
  }
}

const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error("usage: node scripts/reskin-tenant.js <config.json>");
  process.exit(1);
}
const outputArg = process.argv.slice(3).find((arg) => arg.startsWith("--output-dir="));
const outputDir = outputArg ? path.resolve(root, outputArg.slice("--output-dir=".length)) : null;
const templateDonor = process.argv.includes("--template-donor");
if (outputArg && (!outputArg.slice("--output-dir=".length) || fs.existsSync(outputDir))) throw new Error("Staged output directory must be new and nonempty");
if (templateDonor && !outputDir) throw new Error("Template donor builds require an isolated --output-dir");
if (templateDonor) throw new Error("Historical donor builds are retired. Validate the canonical chassis and build new sites from it.");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
assertTemplateBuild(cfg, {
  existing: typeof cfg.slug === "string" && fs.existsSync(path.join(root, cfg.slug, "index.html")),
  legacyMaintenance: process.argv.includes("--legacy-maintenance"),
});
if (!/^[a-z][a-z0-9-]{1,48}$/.test(cfg.slug || "")) throw new Error("Invalid tenant slug");
if (cfg.tokens?.SLUG && cfg.tokens.SLUG !== cfg.slug) throw new Error("SLUG token must match the new tenant slug");
if (!outputDir && fs.existsSync(path.join(root, cfg.slug)) && !process.argv.includes("--replace-existing")) throw new Error("Existing sites are protected. Use an isolated --output-dir; replacing an existing site requires explicit approval and --replace-existing.");
for (const assets of [cfg.assets].flat().filter(Boolean)) {
  const assetPath = path.resolve(root, assets);
  if (path.dirname(assetPath) === root && fs.existsSync(path.join(assetPath, "index.html"))) throw new Error("A generated tenant cannot be used as an asset pack or alternate build source.");
}
if (cfg.templateDonor && !templateDonor) throw new Error("Template donor configurations require --template-donor and an isolated output");
if (templateDonor && cfg.mode === "chassis") throw new Error("A chassis consumer cannot be used as the template donor");
// optional shared market pack — pairs/overrides/seeds every tenant in the
// market needs (e.g. source-language cleanup). Tenant config wins conflicts.
if (cfg.sharedPack) {
  const sp = JSON.parse(
    fs.readFileSync(path.join(root, cfg.sharedPack), "utf8"),
  );
  cfg.extraPairs = [...(sp.extraPairs || []), ...(cfg.extraPairs || [])];
  cfg.copyOverrides = [
    ...(sp.copyOverrides || []),
    ...(cfg.copyOverrides || []),
  ];
  cfg.seedFiles = { ...(sp.seedFiles || {}), ...(cfg.seedFiles || {}) };
}
const {
  slug,
  brand,
  brandUpper,
  brandShort = brand,
  wordmarkHtml = brandUpper || (brand || "").toUpperCase(),
  coachFirst,
  coachFull,
  coachNick = coachFirst,
  city = "",
  whatsapp,
  instagramUrl,
  instagramHandle,
  greeting,
  colors = {},
  features = {},
  channels = [],
  cityRemap = {},
  seedEventsNext = null,
  email = "",
  metaKeywords = "",
  pageRenames = {},
  htmlTitle = "",
  metaDescription = "",
  currency = "idr",
  extraPairs = [],
  copyOverrides = [],
  stripSections = [],
  stripBlocks = [],
  excludePatterns = [],
} = cfg;
const excludeRes = excludePatterns.map((re) => new RegExp(re));

// Store-card defaults keep the G&H 365 copy working for configs that predate
// the tokenised card; tenants without a store should stripBlocks: ["store-card"].
cfg.tokens = cfg.tokens || {};
cfg.tokens.CURRENCY ??= String(cfg.currency || "GBP").toUpperCase();
cfg.tokens.STORE_NAME ??= `${cfg.tokens.BRAND || "Shop"} 365`;
cfg.tokens.STORE_TAG ??= "Own line · drops";
cfg.tokens.STORE_COPY ??= `Not a partner — ${cfg.tokens.COACH_FIRST || "the coach"}'s own clothing line. Doors open per drop; the list hears first.`;
cfg.tokens.STORE_CTA ??= "Visit the store";
cfg.tokens.PB_HALF_LABEL ??= "Recorded benchmark";
// SIG: masthead ownership stamp. Choose per the non-duplication rule in
// scripts/reskin/CHASSIS.md (never restate what the wordmark already says).
if (!cfg.tokens.SIG) {
  cfg.tokens.SIG = cfg.coachFirst ? `by ${cfg.coachFirst}` : `by ${cfg.tokens.BRAND || "the coach"}`;
  console.warn(`[reskin] SIG token unset — defaulted to "${cfg.tokens.SIG}". Review against the signature rule in CHASSIS.md and set tokens.SIG in the config.`);
}
cfg.tokens.ZONE_ACCENT ??= colors.zoneAccent || "#b45309";
// Mobile wordmark scale: short marks (PMA, GG) need a far larger vw than long
// names (HYROX DONCASTER) to fill the line. Estimated advance ≈0.72em per
// uppercase glyph (spaces ≈0.4); target ≈90vw line fill, capped at 24vw.
cfg.tokens.WM_MOBILE_SIZE ??= (() => {
  const text = String(cfg.tokens.WORDMARK_HTML || "").replace(/<[^>]+>/g, "");
  if (!text.trim()) return "5.9vw";
  const n = [...text].reduce((w, ch) => w + (ch === " " ? 0.4 : 1), 0);
  return `${Math.round(Math.min(120 / n, 24) * 10) / 10}vw`;
})();
// Mobile sig size is a flat 5.6vw in the chassis — agreed uniform size,
// independent of wordmark scale.
// SEASON_START is lowercase by design for mid-sentence use; the athlete
// headline needs a sentence-start version.
cfg.tokens.SEASON_HEADLINE ??= `From ${cfg.tokens.SEASON_START || "day one"} to ${cfg.tokens.PB_SOLO || "a PB"} in one season.`;
cfg.tokens.HERO_TITLE_HTML ??= "Your next goal.<br /><em>Start here.</em>";
cfg.tokens.HERO_DEK ??= `Explore coaching, race tools and practical training guidance — find your next step with ${cfg.tokens.BRAND || "us"}.`;
cfg.tokens.BIO_ROLE ??= "HYROX racer and coach";
cfg.tokens.EVENTS_PHOTO_BLOCK ??= "";
// Homepage race cards rotate at build time: only confirmed races starting at
// least `homepageLeadDays` out make the board (anything closer has slipped
// inside the no-pitch window and drops off the top); the next races rise into
// the list behind it. First card renders visible, the rest fold behind the
// "+ N more races" toggle in app.js. Defaults: 14-day lead, 4 cards.
cfg.tokens.RACE_CARDS ??= (() => {
  const cities = cfg.races?.cities || [];
  const leadDays = cfg.races?.homepageLeadDays ?? 14;
  const count = cfg.races?.homepageCount ?? 4;
  const cutoff = Date.now() + leadDays * 864e5;
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const fmt = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  const eligible = cities
    .filter(
      (c) =>
        c.race?.status === "confirmed" &&
        Date.parse(`${c.race.start}T00:00:00Z`) >= cutoff,
    )
    .sort(
      (a, b) => Date.parse(`${a.race.start}T00:00:00Z`) - Date.parse(`${b.race.start}T00:00:00Z`),
    );
  if (cities.length && !eligible.length)
    console.warn(
      `  RACE CARDS: ${cities.length} configured races but none start ${leadDays}+ days out — the events board will be empty. Refresh cfg.races.`,
    );
  else if (cities.length && eligible.length < count)
    console.warn(
      `  RACE CARDS: only ${eligible.length} of ${count} board slots filled after the ${leadDays}-day cutoff — top up cfg.races.cities.`,
    );
  return eligible
    .slice(0, count)
    .map(
      (c) =>
        `<div class="event"><div class="date"><strong><time datetime="${c.race.start}">${fmt(c.race.start)}</time></strong><span>${esc(c.name)}</span></div><div><h4>${esc(c.race.name)}</h4><p>${esc(c.race.dates)} · ${esc(c.country)}</p><a href="${esc(c.race.source)}" target="_blank" rel="noopener">Official event details</a></div><a class="btn btn-ghost" href="/${slug}/events.html#${c.slug}">Plan the weekend</a></div>`,
    )
    .join("\n");
})();
cfg.tokens.RACE_RECORD ??= "Experience earned on the start line";
cfg.tokens.RACE_COUNT ??= "Raced";
cfg.tokens.RACE_COUNT_LABEL ??= "on the start line — real experience, real times";
cfg.tokens.PROG_ONE ??= "Race Ready";
cfg.tokens.PROG_ONE_TAG ??= "structured programme";
cfg.tokens.PROG_TWO ??= "Foundations";
cfg.tokens.PROG_TWO_TAG ??= "foundation programme";
cfg.tokens.OFFER_SUMMARY ??= "1:1 coaching, online routes and race crew.";
cfg.tokens.PLANS_LEAD ??=
  "One clear route — 1:1 applications, structured programmes and prep tools. Less hunting, more training.";
cfg.tokens.PROGRAMMES_SUMMARY ??= "coaching routes, programmes and booking";
cfg.tokens.PROG_ONE_URL ??= cfg.tokens.PROGRAMMES_URL;
cfg.tokens.PROG_TWO_URL ??= cfg.tokens.PROGRAMMES_URL;
cfg.tokens.STUDIO_NOTE ??= "";
cfg.tokens.ATHLETE_FOCUS ??= "coaching focus";
cfg.tokens.LINK_CARD_TAG ??= "Verified · routes";
cfg.tokens.LINK_CARD_NAME ??= "Verified routes";
cfg.tokens.LINK_CARD_DESC ??=
  "The official channels, coaching applications and community links — all verified, no public discount codes.";
cfg.tokens.LINK_CARD_CTA ??= "Open the route →";
cfg.tokens.PROG_CARD_DESC ??=
  "Structured programmes and applications — the official coaching routes in.";
cfg.tokens.PKG_MONTHLY ??= "Monthly coaching";
cfg.tokens.COMMUNITY_DESC ??=
  "The community around the crew — training partners, race-weekend support and people to share the work with.";

// Expand {{TOKEN}} inside override patterns so patterns written against the
// chassis template still match the substituted output.
function overridePattern(pattern) {
  return String(pattern).replace(/\{\{(\w+)\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(cfg.tokens, key)
      ? String(cfg.tokens[key]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : m,
  );
}
function applyVerifiedOffers(s, file) {
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const checkedURL = value => {
    let url;
    try { url = new URL(value); } catch { throw new Error(`Offer URLs must be absolute HTTPS URLs for ${slug}`); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error(`Offer URLs must use HTTPS without credentials for ${slug}`);
    return url.href;
  };
  const validate = offer => {
    if (["title", "type", "description", "action", "sourceURL", "url"].some(key => typeof offer[key] !== "string" || !offer[key].trim())) throw new Error(`Incomplete sourced offer for ${slug}`);
    if (offer.price && typeof offer.price !== "string") throw new Error(`Offer price must include its display terms for ${slug}`);
    checkedURL(offer.sourceURL);
    return checkedURL(offer.url);
  };
  if (Array.isArray(cfg.coachingOffers) && /(?:index|coaching)\.html$/.test(file)) {
    if (!cfg.coachingOffers.length) throw new Error(`No coaching offers supplied for ${slug}`);
    const cards = cfg.coachingOffers.map((offer, i) => `<article class="plan${i ? "" : " featured"} reveal" data-offer-id="${i}"><span class="tag">${esc(offer.type)}</span><h4>${esc(offer.title)}</h4>${offer.price ? `<div class="price">${esc(offer.price)}</div>` : ""}<p class="per">${esc(offer.description)}</p>${offer.features?.length ? `<ul>${offer.features.map(text => `<li>${esc(text)}</li>`).join("")}</ul>` : ""}<a class="btn ${i ? "btn-ghost" : "btn-primary"}" href="${esc(validate(offer))}" target="_blank" rel="noopener">${esc(offer.action)}</a></article>`).join("");
    const home = file.endsWith("index.html");
    const pattern = home ? /<div class="plans">[\s\S]*?(?=<p class="plans-note">)/ : /<div class="plans coach-plans" data-training-platform>[\s\S]*?(?=<p class="shop-note">)/;
    if (!pattern.test(s)) throw new Error(`Coaching offer mount missing: ${file}`);
    const stories = !home && cfg.seedFiles?.["testimonials.json"]?.items?.length >= 3 ? `<section class="coaching-testimonials" id="athletes-say" hidden><p class="eyebrow">${esc(cfg.testimonialLabel || "Client experiences")}</p><h3>${esc(cfg.testimonialHeading || "In their words.")}</h3><div class="quotes" id="testimonials"></div></section>` : "";
    if (home && cfg.testimonialLabel) s = s.replace('<p class="eyebrow reveal">Athletes say</p>', () => `<p class="eyebrow reveal">${esc(cfg.testimonialLabel)}</p>`);
    s = s.replace(pattern, () => `<div class="plans coach-plans verified-offers">${cards}</div><p class="offer-terms">Offer details and prices are set by the provider. Check the linked page for current terms.</p>${stories}`);
    const intro = esc(cfg.coachingIntro || `Explore the coaching and training options from ${cfg.tokens.BRAND}. Choose the support that fits your next goal.`);
    if (home) s = s.replace(/(<section class="block" id="plans">[\s\S]*?<p class="lead reveal">)[\s\S]*?(<\/p>)/, (_match, start, end) => start + intro + end);
    else s = s.replace(/<p class="lead">[\s\S]*?<\/p>/, () => `<p class="lead">${intro}</p>`);
  }
  if (Array.isArray(cfg.partnerOffers) && file.endsWith("partners.html")) {
    const cards = cfg.partnerOffers.map(offer => `<article class="partner-card"><span class="pc-tag">${esc(offer.type || "Official destination")}</span><h4>${esc(offer.title)}</h4><p>${esc(offer.description)}</p>${offer.code ? `<span class="code">${esc(offer.code)}</span>` : ""}<a class="pc-cta" href="${esc(validate(offer))}" target="_blank" rel="${offer.affiliate ? "sponsored " : ""}noopener">${esc(offer.action)}</a></article>`).join("");
    const pattern = /<div class="partner-list">[\s\S]*?(?=<p class="shop-note">)/;
    if (!pattern.test(s)) throw new Error(`Partner offer mount missing: ${file}`);
    s = s.replace(pattern, () => `<div class="partner-list">${cards}</div>`);
    s = s.replace(/<p class="shop-note">[\s\S]*?<\/p>/, '<p class="shop-note">Partner offers may earn a commission. Discounts, eligibility and availability are set by the provider; check the destination before purchasing.</p>');
  }
  return s;
}

function applyCopyOverrides(s) {
  for (const o of copyOverrides) {
    if (cfg.partnerOffers && o.pattern.includes("shop-note") && o.replace.includes("partner-card")) continue;
    // {{TOKEN}} values escape literal dollars while authored capture
    // references keep String.replace's normal substitution syntax.
    const replacement = overrideReplacement(o.replace, cfg.tokens);
    s = s.replace(
      new RegExp(overridePattern(o.pattern), o.flags || "g"),
      replacement,
    );
  }
  return s;
}

// Remove any element carrying data-strip="<id>" — matched with tag-depth
// awareness so nested divs don't truncate the cut early.
function stripMarkedBlocks(s, id) {
  const open = new RegExp(
    `<(\\w+)([^>]*?)data-strip="${id}"[^>]*>`,
    "g",
  );
  let m;
  while ((m = open.exec(s))) {
    const tag = m[1];
    const tagRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, "g");
    tagRe.lastIndex = m.index;
    let depth = 0;
    let end = -1;
    let t;
    while ((t = tagRe.exec(s))) {
      depth += t[0].startsWith("</") ? -1 : t[0].endsWith("/>") ? 0 : 1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    if (end === -1) break;
    s = s.slice(0, m.index) + s.slice(end);
    open.lastIndex = 0;
  }
  return s;
}

const src = path.join(root, "roxjaya");
const dst = outputDir || path.join(root, slug);
const buildV = Date.now();

// Injected into a tenant's styles.css when config sets "heroFull": true —
// photo covers the whole hero (no amb letterbox, no edge feather) so the
// WebGL reveal unrolls across the full background. Kept out of the shared
// source so the flagship's classic hero stays untouched.
const DEMO_NAV_CSS = `@media (min-width: 901px) {
  .menu {
    display: grid;
    grid-template-columns: repeat(5, max-content);
    width: 100%;
    justify-content: center;
  }
}`;

const HERO_RIGHT_FADE_CSS = `@media (min-width: 801px) {
  .hero--bleed.hero--full .hero-mask {
    -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 64%, transparent 100%);
    mask-image: linear-gradient(90deg, #000 0%, #000 64%, transparent 100%);
  }
}`;

const HERO_EDGE_COVER_CSS = `@media (min-width: 801px) {
  .hero--bleed.hero--full .hero-mask {
    -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 38%, rgba(0, 0, 0, 0.96) 48%, rgba(0, 0, 0, 0.8) 60%, rgba(0, 0, 0, 0.55) 73%, rgba(0, 0, 0, 0.28) 86%, transparent 100%);
    mask-image: linear-gradient(90deg, #000 0%, #000 38%, rgba(0, 0, 0, 0.96) 48%, rgba(0, 0, 0, 0.8) 60%, rgba(0, 0, 0, 0.55) 73%, rgba(0, 0, 0, 0.28) 86%, transparent 100%);
  }
  .hero--bleed.hero--full::after {
    background:
      linear-gradient(90deg, rgba(15, 15, 17, 0) 42%, rgba(15, 15, 17, 0.25) 50%, rgba(15, 15, 17, 0.55) 60%, rgba(15, 15, 17, 0.82) 68%, rgba(15, 15, 17, 1) 75%, rgba(15, 15, 17, 1) 100%),
      linear-gradient(180deg, rgba(40, 14, 30, 0.05) 0%, rgba(40, 14, 30, 0.2) 45%, rgba(40, 14, 30, 0.86) 100%),
      linear-gradient(90deg, rgba(40, 14, 30, 0.88) 0%, rgba(40, 14, 30, 0.5) 45%, rgba(40, 14, 30, 0.12) 75%, rgba(40, 14, 30, 0) 100%);
  }
}`;

const HERO_FULL_CSS = `/* hero--full: photo covers the whole hero; reveal unrolls across the
   full background. Opt-in per tenant via "heroFull": true. */
.hero--bleed.hero--full .hero-img {
  object-fit: cover;
  /* --hero-focus keeps the subject clear of the bottom-left copy and is
     set per tenant on :root. A small lift keeps dark photos reading as a
     hero image rather than a dimmed background. */
  object-position: var(--hero-focus, 50% 30%);
  filter: brightness(1.22) contrast(1.02);
  padding: 0;
}

.hero--bleed.hero--full::after {
  background:
    linear-gradient(
      180deg,
      rgba(40, 14, 30, 0) 0%,
      rgba(40, 14, 30, 0.02) 60%,
      rgba(40, 14, 30, 0.18) 100%
    ),
    linear-gradient(
      90deg,
      rgba(40, 14, 30, 0.2) 0%,
      rgba(40, 14, 30, 0.07) 35%,
      rgba(40, 14, 30, 0) 50%
    );
}

@media (min-width: 801px) {
  .hero--bleed.hero--full .hero-mask {
    -webkit-mask-image: none;
    mask-image: none;
  }
}`;
if (slug === "roxjaya" || slug.startsWith("..") || slug === "chassis") {
  console.error("bad slug");
  process.exit(1);
}

// ==================== chassis mode =========================================
// cfg.mode === "chassis": build from the neutral master in chassis/ — no
// source-persona pairs at all. The config supplies tokens (one value per
// {{TOKEN}} in the master), an assets dir, and the usual optional hooks
// (copyOverrides, stripSections, pageFiles, seedFiles, extraCss, menu, hero).
// Any {{TOKEN}} left unfilled after the pass = loud failure.
if (cfg.mode === "chassis") {
  const nutrition = cfg.nutrition || { mode: "standard" };
  const nutritionModes = new Set(["standard", "nutrition-led", "hidden"]);
  if (!nutritionModes.has(nutrition.mode)) {
    console.error(
      'bad nutrition.mode — use "standard", "nutrition-led", or "hidden"',
    );
    process.exit(1);
  }
  if (
    nutrition.mode === "nutrition-led" &&
    typeof nutrition.reviewed !== "boolean"
  ) {
    console.error(
      "NUTRITION CHECK REQUIRED — set nutrition.reviewed to true or false; never publish inherited fuel advice under a nutrition coach's name by accident.",
    );
    process.exit(1);
  }

  const chassisDir = path.join(root, "chassis");
  if (!fs.existsSync(chassisDir)) {
    console.error("chassis/ missing — run: node scripts/build-chassis.js");
    process.exit(1);
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(chassisDir, dst, {
    recursive: true,
    filter: (p) =>
      !p.endsWith(".DS_Store") && !p.endsWith("tenant.record.json"),
  });

  // stripPages: drop whole pages the tenant doesn't ship (e.g. desk.html on
  // a studio site). Nav should already omit them via cfg.menu.
  const stripPages = [...(cfg.stripPages || [])];
  for (const f of stripPages) {
    const p = path.join(dst, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const tokenPairs = Object.entries(cfg.tokens || {}).map(([k, v]) => [
    `{{${k}}}`,
    v,
  ]);
  // VOICE_ATHLETE_QUOTE defaults to the quoted tagline so existing configs
  // keep working unchanged.
  if (cfg.tokens && !cfg.tokens.VOICE_ATHLETE_QUOTE && cfg.tokens.TAGLINE) {
    tokenPairs.push([
      "{{VOICE_ATHLETE_QUOTE}}",
      `"${cfg.tokens.TAGLINE}."`,
    ]);
  }
  const heroMode = cfg.heroMode || "full"; // "full" | "ambient";
  const sharedBenefitPages = new Set([
    "stations-prep.html",
    "run-zone.html",
    "taper-zone.html",
    "results.html",
    "predictor.html",
    "splits.html",
    "events.html",
    "race-crew.html",
    "news.html",
    "list.html",
    "partners.html",
    "shop.html",
  ]);

  for (const file of walk(dst)) {
    let s = fs.readFileSync(file, "utf8");
    const before = s;
    for (const [a, b] of tokenPairs) s = s.split(a).join(b);
    s = applyCopyOverrides(s);
    s = applyVerifiedOffers(s, file);
    for (const id of stripBlocks) s = stripMarkedBlocks(s, id);
    if (file.endsWith(".html")) {
      if (sharedBenefitPages.has(path.basename(file))) {
        s = s.replace(/<body([^>]*)>/, (_m, attrs) => {
          if (/\bzone-acc\b/.test(attrs)) return _m;
          if (/\sclass="/.test(attrs)) {
            return `<body${attrs.replace(/class="([^"]*)"/, 'class="$1 zone-acc"')}>`;
          }
          return `<body${attrs} class="zone-acc">`;
        });
      }
      s = s.replace(/\s*<p class="site-credit"[\s\S]*?<\/p>/g, "");
      s = s.replace(
        "</footer>",
        '  <p class="site-credit" style="text-align:center;margin:2rem 0 0"><a rel="noopener" style="cursor:default;display:inline-flex;align-items:center;gap:.45em;padding:.45em .9em;border:1px solid rgba(255,255,255,.18);border-radius:999px;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6);text-decoration:none">Built with <b style="color:#ff3b3b;font-weight:700">Station 9</b></a></p>\n    </footer>',
      );
      if (cfg.menu) s = replaceMenu(s); // chassis pages already carry a menu
      // demoPages: coach-shaped pages kept live as product evidence get a
      // banner so a studio/aggregator tenant doesn't claim them as its own.
      if ((cfg.demoPages || []).some((f) => file.endsWith(`/${f}`))) {
        s = s.replace(
          /(<body[^>]*>)/,
          `$1\n    <div style="background:#ff3b3b;color:#fff;text-align:center;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;padding:.5em 1em">Demo — this page is part of a Station&nbsp;9 client-site build.</div>`,
        );
      }
      if (cfg.htmlTitle && file.endsWith("index.html")) {
        s = s.replace(
          /<title>[\s\S]*?<\/title>/,
          `<title>${cfg.htmlTitle}</title>`,
        );
      }
      if (cfg.metaDescription && file.endsWith("index.html")) {
        s = s.replace(
          /(name="description"\s+content=")[^"]*(")/,
          `$1${cfg.metaDescription}$2`,
        );
      }
      s = s.replace(
        new RegExp(
          `((?:src|href)="\\/${slug}\\/[^"?]+\\.(?:css|js|jpe?g|png|webp|avif|gif|mp4|webm))(?:\\?v=\\d+)?"`,
          "g",
        ),
        `$1?v=${buildV}"`,
      );
      // the whole hero contract is this one attribute — CSS + JS both key off it
      s = s.replace('data-hero-mode="full"', `data-hero-mode="${heroMode}"`);
      if (heroMode !== "full")
        s = s.replace(' data-hero-roll="full"', "");
    }
    if (file.endsWith("styles.css")) {
      s += `\n${DEMO_NAV_CSS}\n`;
      if (cfg.extraCss) s += `\n${cfg.extraCss}\n`;
    }
    for (const id of stripSections) {
      s = s.replace(
        new RegExp(
          `[ \\t]*<section[^>]*id="${id}"[^>]*>[\\s\\S]*?</section>`,
          "",
        ),
        "",
      );
    }
    if (s !== before) fs.writeFileSync(file, s);
  }

  // assets: cfg.assets = dir(s) mirrored onto <slug>/ (photos, media)
  for (const dir of [cfg.assets].flat().filter(Boolean)) {
    const a = path.join(root, dir);
    if (fs.existsSync(a)) fs.cpSync(a, dst, {
      recursive: true,
      filter: file => fs.statSync(file).isDirectory() || /\.(?:jpe?g|png|webp|avif|gif|svg|mp4|webm|woff2?|ttf|otf|pdf)$/i.test(file),
    });
  }
  const crewDefaults = path.join(
    root,
    "scripts",
    "reskin",
    "chassis-demo-assets",
    "images",
    "gallery",
  );
  const skippedGallery = new Set();
  if (!cfg.customCrewAssets && fs.existsSync(crewDefaults)) {
    fs.mkdirSync(path.join(dst, "images", "gallery"), { recursive: true });
    // Collect existing image hashes when strict to avoid gallery/tenant dupes
    const existingHashes = new Set();
    if (cfg.strictImages) {
      const walkImg = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
          if (f.isDirectory()) walkImg(path.join(dir, f.name));
          else if (/\.(jpe?g|png|webp)$/i.test(f.name))
            existingHashes.add(crypto.createHash("md5").update(fs.readFileSync(path.join(dir, f.name))).digest("hex"));
        }
      };
      walkImg(path.join(dst, "images"));
    }
    const waivedSlots = new Set(
      (cfg.omitImageSlots || []).map((s) =>
        s.startsWith("images/") ? s : `images/${s}`,
      ),
    );
    for (const file of ["restaurant.jpg", "dinner-template.jpg", "dance.jpg", "stock-arena.jpg", "stock-barbell.jpg", "stock-rower.jpg", "stock-burpee.jpg", "stock-finish.jpg", "stock-sled-push.jpg"]) {
      if (waivedSlots.has(`images/gallery/${file}`)) continue;
      const src = path.join(crewDefaults, file);
      if (!fs.existsSync(src)) continue;
      if (cfg.strictImages) {
        const h = crypto.createHash("md5").update(fs.readFileSync(src)).digest("hex");
        if (existingHashes.has(h)) { console.log(`  gallery skip: ${file} (duplicate of tenant image)`); skippedGallery.add(file); continue; }
      }
      fs.copyFileSync(src, path.join(dst, "images", "gallery", file));
    }
  }

  // Tenant-specific gallery: copy images from <slug>-assets/images/gallery/
  // and merge gallery entries from tenantGallery config array into gallery.json
  const tenantGalleryDir = path.join(root, [cfg.assets].flat().filter(Boolean)[0] || "", "images", "gallery");
  if (fs.existsSync(tenantGalleryDir)) {
    fs.mkdirSync(path.join(dst, "images", "gallery"), { recursive: true });
    for (const file of fs.readdirSync(tenantGalleryDir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
      fs.copyFileSync(
        path.join(tenantGalleryDir, file),
        path.join(dst, "images", "gallery", file),
      );
    }
  }
  // When tenantGallery is provided it replaces the chassis stock defaults entirely
  if (Array.isArray(cfg.tenantGallery) && cfg.tenantGallery.length) {
    const gp = path.join(dst, "data", "gallery.json");
    const gd = { note: "PRIVATE PITCH PREVIEW.", photos: [] };
    for (const entry of cfg.tenantGallery) {
      let gallerySrc = entry.src.replace("{{SLUG}}", cfg.slug);
      // Prefix relative gallery paths with the tenant image root
      if (!gallerySrc.startsWith("/")) gallerySrc = `/${cfg.slug}/images/${gallerySrc}`;
      gd.photos.push({ ...entry, src: gallerySrc });
    }
    fs.writeFileSync(gp, JSON.stringify(gd, null, 2) + "\n");
  } else {
    // No tenant gallery — filter skipped stock from chassis defaults
    const gp = path.join(dst, "data", "gallery.json");
    if (fs.existsSync(gp) && skippedGallery.size) {
      const gd = JSON.parse(fs.readFileSync(gp, "utf8"));
      if (Array.isArray(gd.photos)) {
        gd.photos = gd.photos.filter((p) => !skippedGallery.has(path.basename(String(p.src || ""))));
        fs.writeFileSync(gp, JSON.stringify(gd, null, 2) + "\n");
      }
    }
  }

  // Gallery check: Race Wall needs exactly 4 photos with 2 event categories
  {
    const gp = path.join(dst, "data", "gallery.json");
    if (fs.existsSync(gp)) {
      const gd = JSON.parse(fs.readFileSync(gp, "utf8"));
      const photos = Array.isArray(gd.photos) ? gd.photos : [];
      const events = new Set(photos.map((p) => p.event).filter(Boolean));
      if (photos.length !== 4) console.log(`  WARNING: gallery has ${photos.length} photos (want exactly 4)`);
      if (events.size < 2) console.log(`  WARNING: gallery has ${events.size} event category (need 2 for filter tabs)`);
    }
  }

  if (!cfg.strictImages) {
    const legacyImageFallbacks = {
      "predictor-hero.jpg": "finish.jpg",
      "splits-hero.jpg": "rope.jpg",
      "events-hero.jpg": "squad-athlos.jpg",
      "events-secondary.jpg": "pb-venue.jpg",
      "coaching-hero.jpg": "sprint.jpg",
      "race-mate-hero.jpg": "race-pair.jpg",
      "stations-hero.jpg": "walkin.jpg",
      "run-hero.jpg": "treadmill.jpg",
      "run-compromised.jpg": "race-revel.jpg",
      "station-skierg.jpg": "skierg-laugh.jpg",
      "station-sled-push.jpg": "station-lean.jpg",
      "station-sled-pull.jpg": "rope.jpg",
      "station-burpees.jpg": "wallball.jpg",
      "station-row.jpg": "bike.jpg",
      "station-farmers-carry.jpg": "carry.jpg",
      "station-sandbag-lunges.jpg": "coaching.jpg",
      "station-wall-balls.jpg": "detail.jpg",
    };
    for (const [targetName, sourceName] of Object.entries(
      legacyImageFallbacks,
    )) {
      const target = path.join(dst, "images", targetName);
      const source = path.join(dst, "images", sourceName);
      if (targetName.startsWith("station-") && !fs.existsSync(target)) {
        cfg.omitImageSlots = [...(cfg.omitImageSlots || []), targetName];
        continue;
      }
      if (!fs.existsSync(target) && fs.existsSync(source))
        fs.copyFileSync(source, target);
    }
  }

  // imageMap: allocate uploaded photos to chassis slots without renaming the
  // batch. {"hero.jpg": "coach-finish-01.jpg"} copies that source onto the slot.
  // Slot-named files still work; the map wins on conflict. Missing sources fail.
  {
    const assetsDirs = [cfg.assets].flat().filter(Boolean).map((d) => path.join(root, d));
    for (const [slot, srcName] of Object.entries(cfg.imageMap || {})) {
      let src = null;
      for (const dir of assetsDirs) {
        for (const c of [path.join(dir, "images", srcName), path.join(dir, srcName)]) {
          if (fs.existsSync(c)) { src = c; break; }
        }
        if (src) break;
      }
      if (!src) {
        console.error(`  imageMap: no source found for images/${slot} -> ${srcName} (check the filename in the assets folder)`);
        process.exit(1);
      }
      fs.copyFileSync(src, path.join(dst, "images", slot));
      console.log(`  imageMap: images/${slot} <- ${srcName}`);
    }
  }

  // omitImageSlots: strip references to omitted images from generated pages.
  // The pipeline uses omitImageSlots to mark slots that have no real asset;
  // without this step the missing-image scan below would reject the build.
  // We remove <img> tags, background-image references, and any enclosing
  // element marked data-slot="<name>" for the omitted slots, plus any
  // src/srcset attributes pointing at the missing file.
  const omitSlots = (cfg.omitImageSlots || []).map((s) =>
    s.replace(/^images\//, "").replace(/\.\w+$/, ""),
  );
  if (omitSlots.length) {
    for (const file of walk(dst)) {
      if (!/\.(html|js|css)$/.test(file)) continue;
      let s = fs.readFileSync(file, "utf8");
      const before = s;
      // 1. Remove entire elements with data-slot="<name>" for omitted slots
      for (const slotName of omitSlots) {
        const slotAttr = new RegExp(
          `<(\\w+)([^>]*?)data-slot="${slotName}"[^>]*>`,
          "g",
        );
        let m;
        while ((m = slotAttr.exec(s))) {
          const tag = m[1];
          if (m[0].endsWith("/>")) {
            s = s.slice(0, m.index) + s.slice(m.index + m[0].length);
            slotAttr.lastIndex = 0;
            continue;
          }
          const tagRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, "g");
          tagRe.lastIndex = m.index;
          let depth = 0;
          let end = -1;
          let t;
          while ((t = tagRe.exec(s))) {
            depth += t[0].startsWith("</") ? -1 : t[0].endsWith("/>") ? 0 : 1;
            if (depth === 0) {
              end = t.index + t[0].length;
              break;
            }
          }
          if (end === -1) break;
          s = s.slice(0, m.index) + s.slice(end);
          slotAttr.lastIndex = 0;
        }
      }
      // 2. Remove standalone <img> tags referencing omitted images
      for (const slotName of omitSlots) {
        const escapedSlot = slotName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const figureRe = new RegExp(`\\s*<figure\\b[^>]*>(?:(?!<\\/figure>)[\\s\\S])*?images/${escapedSlot}\\.(?:jpe?g|png|webp)(?:(?!<\\/figure>)[\\s\\S])*?<\\/figure>`, "g");
        s = s.replace(figureRe, "");
        const imgRe = new RegExp(
          `\\s*<img[^>]*src="[^"]*images/${slotName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(?:jpe?g|png|webp)[^"]*"[^>]*/?>`,
          "g",
        );
        s = s.replace(imgRe, "");
      }
      // 3. Remove <source> tags in <picture> elements referencing omitted images
      for (const slotName of omitSlots) {
        const srcRe = new RegExp(
          `\\s*<source[^>]*srcset="[^"]*images/${slotName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(?:jpe?g|png|webp)[^"]*"[^>]*/?>`,
          "g",
        );
        s = s.replace(srcRe, "");
      }
      // 4. Blank JSON string values inside html/js (inline booking profiles,
      //    data blobs) that point at omitted images — keeps the JSON valid.
      for (const slotName of omitSlots) {
        const esc = slotName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const kvRe = new RegExp(
          `("[a-zA-Z]+"\\s*:\\s*")[^"]*images/${esc}\\.(?:jpe?g|png|webp)[^"]*(")`,
          "g",
        );
        s = s.replace(kvRe, "$1$2");
      }
      if (s !== before) fs.writeFileSync(file, s);
    }
  }

  // seedFiles same as pair mode
  for (const [f, content] of Object.entries(cfg.seedFiles || {})) {
    const data =
      typeof content === "string" && content.startsWith("@")
        ? JSON.parse(fs.readFileSync(path.join(root, content.slice(1)), "utf8"))
        : content;
    fs.writeFileSync(
      path.join(dst, "data", f),
      JSON.stringify(data, null, 2) + "\n",
    );
  }

  if (Array.isArray(cfg.coachingOffers)) {
    const faqPath = path.join(dst, "data", "faq.json");
    const faq = JSON.parse(fs.readFileSync(faqPath, "utf8"));
    const summary = cfg.coachingOffers.map(offer => `${offer.title}${offer.price ? ` — ${offer.price}` : " — enquire for current terms"}`).join("; ");
    faq.items = (faq.items || []).filter(item => !/cost|price|programme|program|discount|code|how do i get started/i.test(item.q || ""));
    faq.items.push({ q: "What training options and prices are available?", keywords: ["price", "cost", "fee", "programme", "program", "coaching"], a: `${summary}. Read the Coaching page for each offer's format and its official link. The provider sets current prices and terms.` });
    faq.items.push({ q: "How do I get started?", keywords: ["start", "book", "sign up", "join"], a: "Choose the offer that fits your goal on the Coaching page, then follow its own official button. Use Ask if you want to discuss your starting point first." });
    if (cfg.partnerOffers) faq.items.push({ q: "Where are the partner links and codes?", keywords: ["discount", "code", "affiliate", "partner brand"], a: `The Partners page lists ${cfg.partnerOffers.map(offer => `${offer.title}${offer.code ? ` (code ${offer.code})` : ""}`).join(", ")}. Check the linked provider for current eligibility and terms.` });
    fs.writeFileSync(faqPath, JSON.stringify(faq, null, 2) + "\n");
    const campaignPath = path.join(dst, "data", "campaign-offers.json");
    if (fs.existsSync(campaignPath)) {
      const campaigns = JSON.parse(fs.readFileSync(campaignPath, "utf8"));
      const carried = (campaigns.offers || []).filter(offer => !["coaching", "programme", "foundations"].includes(offer.id));
      campaigns.offers = cfg.coachingOffers.map((offer, i) => ({ id: i === 0 ? "coaching" : i === 1 ? "programme" : `programme-${i + 1}`, name: offer.title, goal: "Offer enquiries", destination: offer.url, image: `/${slug}/images/coaching-hero.jpg`, headline: offer.description, actionLabel: offer.action })).concat(carried.map(offer => offer.id === "shop" ? { ...offer, destination: cfg.tokens.STORE_URL } : offer));
      if (cfg.primaryCampaignOffer) campaigns.offers.sort((a, b) => Number(b.id === cfg.primaryCampaignOffer) - Number(a.id === cfg.primaryCampaignOffer));
      fs.writeFileSync(campaignPath, JSON.stringify(campaigns, null, 2) + "\n");
    }
  }

  // JSON data files (after seeding): drop array items whose image fields
  // point at an omitted slot — a removed card beats a broken image.
  if (omitSlots.length) {
    for (const file of walk(dst)) {
      if (!file.endsWith(".json")) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      const prune = (v) => {
        if (Array.isArray(v)) {
          return v
            .filter(
              (item) =>
                !omitSlots.some((slot) =>
                  new RegExp(`images/${slot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(?:jpe?g|png|webp)`).test(
                    JSON.stringify(item),
                  ),
                ),
            )
            .map(prune);
        }
        if (v && typeof v === "object") {
          for (const k of Object.keys(v)) v[k] = prune(v[k]);
        }
        return v;
      };
      const beforeJson = JSON.stringify(data);
      const pruned = prune(data);
      if (JSON.stringify(pruned) !== beforeJson) {
        console.log("  prune:", file.split("/").slice(-2).join("/"));
        fs.writeFileSync(file, JSON.stringify(pruned, null, 2) + "\n");
      }
    }
  }

  // cfg.news: owner's-voice feed items — replaces the chassis sample items
  if (Array.isArray(cfg.news) && cfg.news.length) {
    fs.writeFileSync(
      path.join(dst, "data", "news.json"),
      JSON.stringify(
        { note: "Owner-voice feed — edit via config.", items: cfg.news },
        null,
        2,
      ) + "\n",
    );
  }

  // pageFiles same as pair mode
  for (const [f, spec] of Object.entries(cfg.pageFiles || {})) {
    let s = spec.startsWith("@")
      ? fs.readFileSync(path.join(root, spec.slice(1)), "utf8")
      : spec;
    for (const [a, b] of tokenPairs) s = s.split(a).join(b);
    s = applyCopyOverrides(s);
    s = applyVerifiedOffers(s, file);
    for (const id of stripBlocks) s = stripMarkedBlocks(s, id);
    s = s.replace(
      new RegExp(
        `((?:src|href)="\\/${slug}\\/[^"?]+\\.(?:css|js|jpe?g|png|webp|avif|gif|mp4|webm))(?:\\?v=\\d+)?"`,
        "g",
      ),
      `$1?v=${buildV}"`,
    );
    if (cfg.menu) s = replaceMenu(s);
    fs.writeFileSync(path.join(dst, f), s);
  }

  // Strip gallery.json entries for skipped (duplicate) stock images
  if (skippedGallery.size) {
    const gp = path.join(dst, "data", "gallery.json");
    if (fs.existsSync(gp)) {
      const gd = JSON.parse(fs.readFileSync(gp, "utf8"));
      if (Array.isArray(gd.photos)) {
        gd.photos = gd.photos.filter(
          (p) => !skippedGallery.has(String(p.src || "").split("/").pop()),
        );
        fs.writeFileSync(gp, JSON.stringify(gd, null, 2) + "\n");
      }
    }
  }

  prepareShowcase({ root, outputDir: dst, config: cfg });

  // fail loudly on unfilled tokens — the inverse of the persona-leak check
  const missing = new Set();
  const scan = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) scan(p);
      else if (/\.(html|js|css|json)$/.test(e.name))
        for (const m of fs
          .readFileSync(p, "utf8")
          .matchAll(/\{\{([A-Z_]+)\}\}/g))
          missing.add(`${m[1]}  (${path.relative(dst, p)})`);
    }
  };
  scan(dst);
  if (missing.size) {
    console.error("\nUNFILLED TOKENS — add these to cfg.tokens:");
    for (const m of [...missing].sort()) console.error("  " + m);
    process.exit(1);
  }

  // every referenced image must exist in the tenant — broken imgs are
  // silent persona leaks the same way leftover strings are
  const missingImgs = new Set();
  const scanImgs = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && e.name !== "images") scanImgs(p);
      else if (!e.isDirectory() && /\.(html|js|json)$/.test(e.name))
        for (const m of fs
          .readFileSync(p, "utf8")
          .matchAll(/images\/[a-z0-9/_-]+\.(?:jpe?g|png|webp)/g))
          if (!fs.existsSync(path.join(dst, m[0]))) missingImgs.add(m[0]);
    }
  };
  scanImgs(dst);
  if (missingImgs.size) {
    console.error(
      "\nMISSING IMAGES — drop these in cfg.assets (see chassis/images/REQUIRED.md):",
    );
    for (const m of [...missingImgs].sort()) console.error("  " + m);
    process.exit(1);
  }

  // slot coverage contract: every chassis-required image must either
  // render on a page or be explicitly waived in cfg.omitImageSlots.
  // A slot that silently renders nothing (missing file, pruned figure,
  // copyOverride strip) is a hidden gap — fail loudly instead.
  const requiredSlots = (() => {
    try {
      return (
        fs
          .readFileSync(
            path.join(root, "chassis/images/REQUIRED.md"),
            "utf8",
          )
          .match(/images\/[a-z0-9/_-]+\.(?:jpe?g|png|webp)/g) || []
      );
    } catch {
      return [];
    }
  })();
  if (requiredSlots.length) {
    const rendered = new Set();
    const collectRendered = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory() && e.name !== "images") collectRendered(p);
        else if (!e.isDirectory() && /\.(html|js|json)$/.test(e.name))
          for (const m of fs
            .readFileSync(p, "utf8")
            .matchAll(/images\/[a-z0-9/_-]+\.(?:jpe?g|png|webp)/g))
            rendered.add(m[0]);
      }
    };
    collectRendered(dst);
    const waived = new Set(
      (cfg.omitImageSlots || []).map((s) =>
        s.startsWith("images/") ? s : `images/${s}`,
      ),
    );
    // planner-watermark is documented optional ("never blocks a build")
    const enforced = requiredSlots.filter(
      (r) => r !== "images/planner-watermark.jpg",
    );
    const gaps = enforced.filter(
      (r) => !rendered.has(r) && !waived.has(r),
    );
    if (gaps.length) {
      console.error(
        "\nSLOT GAPS — required chassis images render nothing and are not waived:",
      );
      for (const g of gaps.sort()) console.error("  " + g);
      console.error(
        "  Fill each slot with a real photo, or add an explicit entry to omitImageSlots (the waiver).",
      );
      process.exit(1);
    }
    const stale = [...waived].filter(
      (w) =>
        enforced.includes(w) &&
        fs.existsSync(path.join(dst, w)),
    );
    if (stale.length) {
      console.warn(
        "  STALE WAIVERS — waived slots that have a real file (un-waive or delete the file):",
      );
      for (const s of stale.sort()) console.warn("    " + s);
    }
    console.log(
      `  slot coverage: ${requiredSlots.length - waived.size} filled, ${waived.size} waived, 0 unwaived gaps`,
    );
    // unused files: photos shipped in images/ that no slot references — either
    // map them or leave them out of the batch.
    const onDisk = [];
    const collectFiles = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) collectFiles(p);
        else if (/\.(jpe?g|png|webp)$/i.test(e.name))
          onDisk.push(path.relative(dst, p));
      }
    };
    collectFiles(path.join(dst, "images"));
    const unused = onDisk.filter(
      (f) => !rendered.has(f) && !f.startsWith("images/gallery/"),
    );
    if (unused.length) {
      console.log("  UNUSED (not referenced by any slot — safe to remove or map):");
      for (const u of unused.sort()) console.log("    " + u);
    }
  }

  if (cfg.strictImages) {
    const referenced = new Set();
    const collectRefs = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory() && e.name !== "images") collectRefs(p);
        else if (!e.isDirectory() && /\.(html|js|json)$/.test(e.name))
          for (const m of fs
            .readFileSync(p, "utf8")
            .matchAll(/images\/[a-z0-9/_-]+\.(?:jpe?g|png|webp)/g))
            referenced.add(m[0]);
      }
    };
    collectRefs(dst);
    const byHash = new Map();
    for (const image of referenced) {
      const content = fs.readFileSync(path.join(dst, image));
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      const matches = byHash.get(hash) || [];
      matches.push(image);
      byHash.set(hash, matches);
    }
    // Allow deliberate duplicates listed in config (e.g. bio + coaching-hero same headshot)
    const allowedDups = new Set((cfg.allowDuplicateSlots || []).map((s) => s.replace(/^images\//, "")));
    const duplicates = [...byHash.values()]
      .map((matches) => matches.filter((m) => !m.startsWith("images/gallery/")))
      .filter((matches) => matches.length > 1)
      .filter((matches) => !matches.every((m) => allowedDups.has(path.basename(m))));
    if (duplicates.length) {
      console.error(
        "\nDUPLICATE IMAGES — strict builds require a unique photo per slot:",
      );
      for (const matches of duplicates)
        console.error("  " + matches.join(" = "));
      process.exit(1);
    }
  }

  // register from the tokenised record template — never the roxjaya record
  let tStr = fs.readFileSync(
    path.join(chassisDir, "tenant.record.json"),
    "utf8",
  );
  for (const [a, b] of tokenPairs) {
    // tokens sit inside JSON strings — escape \ and " so the fill stays valid
    const safe = String(b).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    tStr = tStr.split(a).join(safe);
  }
  const t = JSON.parse(tStr);
  t.tenant_id = slug;
  const demoDomain = String(process.env.DEMO_BASE_DOMAIN || "")
    .trim()
    .toLowerCase();
  t.hostnames = [
    `${slug}.localhost`,
    `demo-${slug}.localhost`,
    ...(demoDomain
      ? [`${slug}.${demoDomain}`, `demo-${slug}.${demoDomain}`]
      : []),
  ];
  t.canonicalHost = `${slug}.localhost`;
  t.currency = cfg.currency || "gbp";
  t.demo = true;
  if (!outputDir) withTenantsLock((tenants) => {
    tenants.tenants = tenants.tenants.filter((x) => x.tenant_id !== slug);
    tenants.tenants.push(t);
  });

  installBookingPlanner({ root, slug, config: cfg, tenant: t, outputDir: dst });
  wireCoachView({ outputDir: dst, config: cfg });
  const nutritionState =
    nutrition.mode === "nutrition-led"
      ? nutrition.reviewed
        ? `nutrition: reviewed by ${nutrition.reviewer || "coach"}`
        : "nutrition: DRAFT — warning + noindex applied"
      : `nutrition: ${nutrition.mode}`;
  console.log(
    `chassis build done → ${slug}/  (hero: ${heroMode}; ${nutritionState})`,
  );
  console.log(
    outputDir ? `staged "${slug}" at ${dst}; live registry unchanged` : `tenant "${slug}" registered — hostnames: ${t.hostnames.join(", ")}`,
  );
  console.log(`open http://localhost:3000/${slug}/`);
  runVerify(dst, slug);
  process.exit(0);
}

// ---- 1. copy --------------------------------------------------------------
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, {
  recursive: true,
  filter: (p) =>
    !p.includes("images/gallery/inbox") &&
    !p.endsWith(".DS_Store") &&
    !p.endsWith("HANDBOOK.md") &&
    !p.endsWith("VOICE.md") &&
    !p.includes("/automation") &&
    !excludeRes.some((re) => re.test(p)),
});

// ---- 2. substitutions (order matters) -------------------------------------
const pairs = [
  ["roxjaya.com", `${slug}.localhost`],
  ["/roxjaya/", `/${slug}/`],
  ["https://www.instagram.com/dinabawden87/", instagramUrl],
  ["@dinabawden87", `@${instagramHandle}`],
  ["dinabawden87", instagramHandle],
  ["6281211611987", whatsapp],
  [
    "Halo MaDin! I found you on Roxjaya Warriors — I'm interested in HYROX coaching. ",
    greeting,
  ],
  ['R<span class="o">O</span>XJAYA WARRIORS', wordmarkHtml],
  ["ROXJAYA WARRIORS", brandUpper || brand.toUpperCase()],
  ["Roxjaya Warriors Jakarta", brand],
  ["Roxjaya Warriors", brand],
  ["Roxjaya", brandShort],
  ["by Dina Rosdiana", `by ${coachFull}`],
  ["Dina Rosdiana", coachFull],
  ["MaDin", coachNick],
  ["Dina", coachFirst],
  ["Jakarta", city],
  ...Object.entries(pageRenames),
  ...extraPairs,
  ["#ff2d95", colors.pink || "#ff2d95"],
  ["#e0177c", colors.pink600 || "#e0177c"],
  ["#ffe1f0", colors.pink100 || "#ffe1f0"],
  ["#b45309", colors.zoneAccent || "#b45309"],
  ["roxjaya", slug],
];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(html|js|css|json)$/.test(e.name)) yield p;
  }
}

const extraChannels = channels
  .filter((c) => !c.url.includes("instagram"))
  .map(
    (c) =>
      `          <a href="${c.url}" target="_blank" rel="noopener">${c.label}</a>\n`,
  )
  .join("");

const localScene =
  pageRenames["jakarta-hybrid-scene"] || "jakarta-hybrid-scene";
const localGuide = pageRenames["hyrox-jakarta"] || "hyrox-jakarta";
const coachingPage =
  pageRenames["hybrid-coaching-jakarta"] || "hybrid-coaching-jakarta";
const trainingLinks = cfg.singleIntroOffer
  ? `              <li><a href="/${slug}/#plans">6-week introduction</a></li>
              <li><a href="/${slug}/#plans">17 coached sessions each week</a></li>
              <li><a href="/${slug}/#events">Full simulations</a></li>`
  : `              <li><a href="/${slug}/#plans">Coaching plans</a></li>
              <li><a href="/${slug}/${coachingPage}/">Hybrid coaching</a></li>
              <li><a href="/${slug}/elite-race-prep/">Elite race prep</a></li>
              <li><a href="/${slug}/events/#cohorts">12-week cohorts</a></li>`;
const localGuideLink =
  cfg.localRaceGuide === false
    ? ""
    : `              <li><a href="/${slug}/${localGuide}/">Hyrox ${city} guide</a></li>\n`;
const merchandiseLink =
  cfg.merchandise === false
    ? ""
    : `              <li><a href="/${slug}/#merch">Merchandise</a></li>\n`;
const salesMenu = `        <ul class="menu" id="menu">
          <li><a href="/${slug}/predictor/">Race Predictor</a></li>
          <li><a href="/${slug}/splits/">Split Analyser</a></li>
          <li><a class="match-zone" href="/${slug}/find-a-partner/">Find a Race Mate</a></li>
          <li>
            <button aria-expanded="false" aria-haspopup="true">
              <img class="avatar" src="/${slug}/images/avatar.jpg" alt="" width="30" height="30" />
              Ask ${coachFirst} <span class="caret"></span>
            </button>
            <ul class="sub">
              <li><a href="/${slug}/#tips">${cfg.coachTipsLabel || `${coachFirst}'s 3 tips`}</a></li>
              <li><a href="/${slug}/#ask">Ask a question</a></li>
              <li><a href="/${slug}/#story">${coachFirst}'s story</a></li>
              <li><a href="/${slug}/#plans">Book a 1:1 call</a></li>
            </ul>
          </li>
          <li>
            <button aria-expanded="false" aria-haspopup="true">Train With ${coachFirst} <span class="caret"></span></button>
            <ul class="sub">
${trainingLinks}
            </ul>
          </li>
          <li>
            <button aria-expanded="false" aria-haspopup="true">UK Race Planner <span class="caret"></span></button>
            <ul class="sub">
              <li><a href="/${slug}/race-planner/">UK race planner</a></li>
              <li><a href="/${slug}/events/#races">Race calendar</a></li>
${localGuideLink}              <li><a href="/${slug}/news/">UK Hyrox news</a></li>
            </ul>
          </li>
          <li><a href="/${slug}/${localScene}/">${city} Scene</a></li>
          <li><a href="/${slug}/results/">Results Board</a></li>
          <li>
            <button aria-expanded="false" aria-haspopup="true">Stations Prep <span class="caret"></span></button>
            <ul class="sub">
              <li><a href="/${slug}/stations-prep/">All eight stations</a></li>
              <li><a href="/${slug}/run-zone/">Run training &amp; pace calculator</a></li>
              <li><a href="/${slug}/taper-zone/">Final two-week taper</a></li>
            </ul>
          </li>
          <li>
            <button aria-expanded="false" aria-haspopup="true">Station 9 <span class="caret"></span></button>
            <ul class="sub">
              <li><a href="/${slug}/station-9/">Station 9 meetups</a></li>
              <li><a href="/${slug}/broadcast/">Weekly broadcast</a></li>
              <li><a href="/${slug}/diary/">This week's diary</a></li>
              <li><a href="/${slug}/#wall-photos">${cfg.wallLabel || "Race Wall"}</a></li>
${merchandiseLink}              <li><a href="/${slug}/#ask">Chat Zone</a></li>
            </ul>
          </li>
        </ul>`;

function replaceMenu(s) {
  const markerRe = /<ul class="menu" id="menu"[^>]*>/;
  const markerMatch = markerRe.exec(s);
  const start = markerMatch ? markerMatch.index : -1;
  if (start < 0) return s;
  const tags = /<\/?ul\b[^>]*>/g;
  tags.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tags.exec(s))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0)
      return (
        s.slice(0, start) + (cfg.menu || salesMenu) + s.slice(tags.lastIndex)
      );
  }
  return s;
}

let touched = 0;
for (const file of walk(dst)) {
  let s = fs.readFileSync(file, "utf8");
  const before = s;
  for (const [a, b] of pairs) s = s.split(a).join(b);
  // footer: append extra channel links after the IG anchor
  if (extraChannels) {
    s = s.replace(
      new RegExp(`>Instagram @${instagramHandle}</a\\s*>`, "g"),
      (m) => `${m}\n${extraChannels}`,
    );
  }
  // cities.json: remap race cities/countries for the demo market
  if (file.endsWith("cities.json")) {
    for (const [a, b] of Object.entries(cityRemap)) s = s.split(a).join(b);
  }
  // SEO meta still in the source language
  if (metaKeywords) {
    s = s.replace(
      /(name="keywords"\s+content=")[^"]*(")/,
      `$1${metaKeywords}$2`,
    );
    s = s.replace(/("keywords":\s*")[^"]*(")/, `$1${metaKeywords}$2`);
  }
  if (file.endsWith("index.html")) {
    if (htmlTitle) {
      s = s.replace(/<title>[\s\S]*?<\/title>/, `<title>${htmlTitle}</title>`);
    }
    if (metaDescription) {
      s = s.replace(
        /(name="description"\s+content=")[^"]*(")/,
        `$1${metaDescription}$2`,
      );
      s = s.replace(
        /"description":\s*"Pelatih[^"]*"/,
        `"description": "${metaDescription}"`,
      );
    }
  }
  // per-demo copy fixes: regex find → replace
  s = applyCopyOverrides(s);
  for (const id of stripBlocks) s = stripMarkedBlocks(s, id);
  if (file.endsWith(".html")) s = replaceMenu(s);
  if (file.endsWith("styles.css")) s += `\n${DEMO_NAV_CSS}\n`;
  // cache-bust tenant css/js so browsers can't serve stale hero/styles
  if (file.endsWith(".html")) {
    s = s.replace(
      new RegExp(
        `((?:src|href)="\\/${slug}\\/[^"?]+\\.(?:css|js|jpe?g|png|webp|avif|gif|mp4|webm))(?:\\?v=\\d+)?"`,
        "g",
      ),
      `$1?v=${buildV}"`,
    );
  }
  // heroFull opt-in: photo covers the whole hero so the reveal unrolls
  // across the entire background (keeps .hero--bleed so the JS hooks it)
  if (cfg.heroFull) {
    if (file.endsWith("styles.css")) s += `\n${HERO_FULL_CSS}\n`;
    if (file.endsWith("index.html")) {
      s = s.replace(
        'class="hero hero--bleed"',
        'class="hero hero--bleed hero--full" data-hero-roll="full"',
      );
    }
  }
  if (cfg.heroRightFade && file.endsWith("styles.css")) {
    s += `\n${HERO_RIGHT_FADE_CSS}\n`;
  }
  if (cfg.heroEdgeCover && file.endsWith("styles.css")) {
    s += `\n${HERO_EDGE_COVER_CSS}\n`;
  }
  // free-form tenant-scoped CSS appended after all theme blocks
  if (cfg.extraCss && file.endsWith("styles.css")) {
    s += `\n${cfg.extraCss}\n`;
  }
  // broadcastDemo opt-in: the bulletin page flips from the locked teaser to
  // the playable demo player, and gets linked in nav + footer (the source
  // site keeps it hidden/locked — direct URL only, like the predictor).
  if (cfg.broadcastDemo && file.endsWith(".html")) {
    s = s.replace('data-broadcast="locked"', 'data-broadcast="live"');
    s = s.replace(
      `class="s9-zone" href="/${slug}/station-9/">Station 9</a></li>`,
      `class="s9-zone" href="/${slug}/station-9/">Station 9</a></li>\n          <li><a href="/${slug}/broadcast/">Broadcast</a></li>\n          <li><a href="/${slug}/diary/">Diary</a></li>`,
    );
    s = s.replace(
      `<a href="/${slug}/station-9/">Station 9</a>`,
      `<a href="/${slug}/station-9/">Station 9</a>\n          <a href="/${slug}/broadcast/">Broadcast</a>\n          <a href="/${slug}/diary/">Diary</a>`,
    );
  }
  // drop whole sections that only make sense in the source market
  // colour/system pairs re-run after appended blocks (heroFull, fades, edge
  // cover) — those inject their own literals which otherwise escape tenant
  // colour remaps
  for (const [a, b] of pairs) s = s.split(a).join(b);

  for (const id of stripSections) {
    s = s.replace(
      new RegExp(
        `[ \\t]*<section[^>]*id="${id}"[^>]*>[\\s\\S]*?</section>`,
        "",
      ),
      "",
    );
  }
  if (s !== before) {
    fs.writeFileSync(file, s);
    touched++;
  }
}

// ---- 2b. rename renamed pages on disk --------------------------------------
for (const [a, b] of Object.entries(pageRenames)) {
  const from = path.join(dst, `${a}.html`);
  if (fs.existsSync(from)) fs.renameSync(from, path.join(dst, `${b}.html`));
}

// ---- 2c. image overrides — demo assets cloned over the source imagery ------
// cfg.imageOverrides = dir (or list of dirs) relative to repo root, mirrored
// onto <slug>/ in order — later dirs win, so per-tenant photos can overlay a
// shared placeholder pack.
for (const dir of [cfg.imageOverrides].flat().filter(Boolean)) {
  const assets = path.join(root, dir);
  if (fs.existsSync(assets)) {
    fs.cpSync(assets, dst, { recursive: true });
  }
}

// cfg.overrideExclude = regex patterns; any file copied in by an override dir
// whose path (relative to <slug>/) matches is deleted. Lets a shared asset
// pack ship minus tenant-inappropriate photos (e.g. club-branded shots).
const overrideRes = (cfg.overrideExclude || []).map((re) => new RegExp(re));
if (overrideRes.length) {
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (overrideRes.some((re) => re.test(path.relative(dst, p))))
        fs.rmSync(p);
    }
  };
  walk(dst);
}

// ---- 3. seed data files ---------------------------------------------------
const note = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dst, "data", f), "utf8")).note;
  } catch {
    return "";
  }
};
const seed = {
  "matchboard.json": (f) => ({ note: note(f), items: [] }),
  "travelboard.json": (f) => ({ note: note(f), items: [] }),
  "partners.json": (f) => ({ note: note(f), items: [] }),
  "news.json": (f) => ({ note: note(f), items: [] }),
  "station9.json": (f) => ({ note: note(f), next: null, away: [] }),
  "events.json": (f) => ({ note: note(f), next: seedEventsNext }),
  "inbox.json": () => ({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    items: [],
  }),
};
for (const [f, build] of Object.entries(seed)) {
  fs.writeFileSync(
    path.join(dst, "data", f),
    JSON.stringify(build(f), null, 2) + "\n",
  );
}
// whole-file data seeds from config (e.g. a market's race calendar).
// A string value "@path" reads shared seed JSON relative to the repo root.
for (const [f, content] of Object.entries(cfg.seedFiles || {})) {
  const data =
    typeof content === "string" && content.startsWith("@")
      ? JSON.parse(fs.readFileSync(path.join(root, content.slice(1)), "utf8"))
      : content;
  fs.writeFileSync(
    path.join(dst, "data", f),
    JSON.stringify(data, null, 2) + "\n",
  );
}

// cfg.pageFiles: brand-new tenant pages ("shop.html": "@path/to/seed.html" or
// inline HTML). Written in target copy; tenant pairs, regex overrides, menu
// and cache-busting are applied so they render like first-class pages.
for (const [f, spec] of Object.entries(cfg.pageFiles || {})) {
  let s = spec.startsWith("@")
    ? fs.readFileSync(path.join(root, spec.slice(1)), "utf8")
    : spec;
  for (const [a, b] of pairs) s = s.split(a).join(b);
  s = applyCopyOverrides(s);
  for (const id of stripBlocks) s = stripMarkedBlocks(s, id);
  s = s.replace(
    new RegExp(
      `((?:src|href)="\\/${slug}\\/[^"?]+\\.(?:css|js|jpe?g|png|webp|avif|gif|mp4|webm))(?:\\?v=\\d+)?"`,
      "g",
    ),
    `$1?v=${buildV}"`,
  );
  s = replaceMenu(s);
  fs.writeFileSync(path.join(dst, f), s);
}

// ---- 4. register tenant ----------------------------------------------------
const tenantsFile = path.join(root, "data", "tenants.json");
const tenants = JSON.parse(fs.readFileSync(tenantsFile, "utf8"));
const base = tenants.tenants.find((t) => t.tenant_id === "roxjaya");
if (!base) {
  console.error("no roxjaya tenant in tenants.json");
  process.exit(1);
}
let t = JSON.parse(JSON.stringify(base));
t.tenant_id = slug;
const demoDomain = String(process.env.DEMO_BASE_DOMAIN || "")
  .trim()
  .toLowerCase();
t.hostnames = [
  `${slug}.localhost`,
  `demo-${slug}.localhost`,
  ...(demoDomain
    ? [`${slug}.${demoDomain}`, `demo-${slug}.${demoDomain}`]
    : []),
];
t.canonicalHost = `${slug}.localhost`;
if (email) t.seo.supportEmail = email;
let tStr = JSON.stringify(t);
tStr = tStr
  .split("roxjaya")
  .join(slug)
  .split("Roxjaya Warriors Jakarta")
  .join(brand)
  .split("Dina Rosdiana")
  .join(coachFull)
  .split("Dina")
  .join(coachFirst)
  .split("Jakarta")
  .join(city)
  .split("dinazumba1987@gmail.com")
  .join(email || "demo@example.com");
for (const [a, b] of Object.entries(pageRenames)) tStr = tStr.split(a).join(b);
for (const [a, b] of extraPairs) tStr = tStr.split(a).join(b);
t = JSON.parse(tStr);
t.currency = currency;
if (t.guides && t.guides.headerHtml) {
  t.guides.headerHtml = t.guides.headerHtml
    .split('R<span class="o">O</span>XJAYA WARRIORS')
    .join(wordmarkHtml);
}
t.features = features;
t.channels = channels;
t.demo = true;
if (!outputDir) withTenantsLock((tenants) => {
  tenants.tenants = tenants.tenants.filter((x) => x.tenant_id !== slug);
  tenants.tenants.push(t);
});

installBookingPlanner({ root, slug, config: cfg, tenant: t, outputDir: dst });
console.log(`reskin done → ${slug}/  (${touched} files touched)`);
console.log(
  outputDir ? `staged "${slug}" at ${dst}; live registry unchanged` : `tenant "${slug}" registered — hostnames: ${t.hostnames.join(", ")}`,
);
console.log(`open http://localhost:3000/${slug}/`);
runVerify(dst, slug);
