// reskin-tenant.js — clone the roxjaya site into a demo tenant.
// Usage: node scripts/reskin-tenant.js scripts/reskin/hustle.demo.json
//
// Steps: copy roxjaya/ → <slug>/, apply ordered brand substitutions across
// html/js/css, seed fresh data files, remap the race calendar, register the
// tenant in data/tenants.json. Safe to re-run — the target dir is replaced.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error("usage: node scripts/reskin-tenant.js <config.json>");
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
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
  wordmarkHtml = brandUpper || brand.toUpperCase(),
  coachFirst,
  coachFull,
  coachNick = coachFirst,
  city,
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
  excludePatterns = [],
} = cfg;
const excludeRes = excludePatterns.map((re) => new RegExp(re));

const src = path.join(root, "roxjaya");
const dst = path.join(root, slug);
const buildV = Date.now();

// Injected into a tenant's styles.css when config sets "heroFull": true —
// photo covers the whole hero (no amb letterbox, no edge feather) so the
// WebGL reveal unrolls across the full background. Kept out of the shared
// source so the flagship's classic hero stays untouched.
const HERO_FULL_CSS = `/* hero--full: photo covers the whole hero; reveal unrolls across the
   full background. Opt-in per tenant via "heroFull": true. */
.hero--bleed.hero--full .hero-amb {
  display: none;
}

.hero--bleed.hero--full .hero-img {
  object-fit: cover;
  /* --hero-focus keeps the subject clear of the bottom-left copy and is
     set per tenant on :root. */
  object-position: var(--hero-focus, 50% 30%);
  padding: 0;
}

.hero--bleed.hero--full::after {
  background:
    linear-gradient(
      180deg,
      rgba(40, 14, 30, 0.05) 0%,
      rgba(40, 14, 30, 0.2) 45%,
      rgba(40, 14, 30, 0.86) 100%
    ),
    linear-gradient(
      90deg,
      rgba(40, 14, 30, 0.88) 0%,
      rgba(40, 14, 30, 0.5) 45%,
      rgba(40, 14, 30, 0.12) 75%,
      rgba(40, 14, 30, 0) 100%
    );
}

@media (min-width: 801px) {
  .hero--bleed.hero--full .hero-mask {
    -webkit-mask-image: none;
    mask-image: none;
  }
}`;
if (slug === "roxjaya" || slug.startsWith("..")) {
  console.error("bad slug");
  process.exit(1);
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
  for (const o of copyOverrides) {
    s = s.replace(new RegExp(o.pattern, o.flags || "g"), o.replace);
  }
  // cache-bust tenant css/js so browsers can't serve stale hero/styles
  if (file.endsWith(".html")) {
    s = s.replace(
      new RegExp(
        `((?:src|href)="\\/${slug}\\/[^"?]+\\.(?:css|js))(?:\\?v=\\d+)?"`,
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
        'class="hero hero--bleed hero--full"',
      );
    }
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
  for (const id of stripSections) {
    s = s.replace(
      new RegExp(
        `<section[^>]*id="${id}"[^>]*>[\\s\\S]*?</section>`,
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
      else if (overrideRes.some((re) => re.test(path.relative(dst, p)))) fs.rmSync(p);
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
  ...(demoDomain ? [`${slug}.${demoDomain}`, `demo-${slug}.${demoDomain}`] : []),
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
for (const [a, b] of Object.entries(pageRenames))
  tStr = tStr.split(a).join(b);
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
tenants.tenants = tenants.tenants.filter((x) => x.tenant_id !== slug);
tenants.tenants.push(t);
fs.writeFileSync(tenantsFile, JSON.stringify(tenants, null, 2) + "\n");

console.log(`reskin done → ${slug}/  (${touched} files touched)`);
console.log(`tenant "${slug}" registered — hostnames: ${t.hostnames.join(", ")}`);
console.log(`open http://localhost:3000/${slug}/`);
