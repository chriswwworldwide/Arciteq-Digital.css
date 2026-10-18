// reskin-tenant.js — clone the roxjaya site into a demo tenant.
// Usage: node scripts/reskin-tenant.js scripts/reskin/hustle.demo.json
//
// Steps: copy roxjaya/ → <slug>/, apply ordered brand substitutions across
// html/js/css, seed fresh data files, remap the race calendar, register the
// tenant in data/tenants.json. Safe to re-run — the target dir is replaced.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
.hero--bleed.hero--full .hero-amb {
  display: none;
}

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
  if (nutrition.mode === "hidden") stripPages.push("fuel-zone.html");
  for (const f of stripPages) {
    const p = path.join(dst, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const tokenPairs = Object.entries(cfg.tokens || {}).map(([k, v]) => [
    `{{${k}}}`,
    v,
  ]);
  const heroMode = cfg.heroMode || "full"; // "full" | "ambient"

  for (const file of walk(dst)) {
    let s = fs.readFileSync(file, "utf8");
    const before = s;
    for (const [a, b] of tokenPairs) s = s.split(a).join(b);
    for (const o of copyOverrides)
      s = s.replace(new RegExp(o.pattern, o.flags || "g"), o.replace);
    if (file.endsWith(".html")) {
      s = s.replace(/\s*<p class="site-credit"[\s\S]*?<\/p>/g, "");
      s = s.replace(
        "</footer>",
        '  <p class="site-credit" style="text-align:center;margin:2rem 0 0"><a href="/" rel="noopener" style="display:inline-flex;align-items:center;gap:.45em;padding:.45em .9em;border:1px solid rgba(255,255,255,.18);border-radius:999px;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6);text-decoration:none">Built with <b style="color:#ff3b3b;font-weight:700">Station 9</b></a></p>\n    </footer>',
      );
      if (nutrition.mode === "hidden") {
        s = s.replace(
          /\s*<li><a href="\/[^"]+\/fuel-zone\/?">Fuel zone<\/a><\/li>/g,
          "",
        );
        s = s.replace(/\s*<a href="\/[^"]+\/fuel-zone\/?">Fuel Zone<\/a>/g, "");
      }
      if (
        nutrition.mode === "nutrition-led" &&
        !nutrition.reviewed &&
        file.endsWith("/fuel-zone.html")
      ) {
        s = s.replace(
          "<head>",
          '<head>\n    <meta name="robots" content="noindex, nofollow" />',
        );
        s = s.replace(
          /(<body[^>]*>)/,
          `$1\n    <div role="status" style="background:#ffb020;color:#141414;text-align:center;font-weight:800;padding:.75rem 1rem">NUTRITION DRAFT — this page contains inherited race-fuelling guidance and must be reviewed by the coach before publication.</div>`,
        );
      }
      if (
        nutrition.mode === "nutrition-led" &&
        nutrition.reviewed &&
        file.endsWith("/fuel-zone.html")
      ) {
        s = s.replace(
          /(<body[^>]*>)/,
          `$1\n    <div role="status" style="background:#173f2b;color:#d9ffe9;text-align:center;font-weight:700;padding:.6rem 1rem">Nutrition content reviewed and approved by ${nutrition.reviewer || cfg.tokens?.COACH_NAME || "the coach"}.</div>`,
        );
      }
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
          `((?:src|href)="\\/${slug}\\/[^"?]+\\.(?:css|js))(?:\\?v=\\d+)?"`,
          "g",
        ),
        `$1?v=${buildV}"`,
      );
      // the whole hero contract is this one attribute — CSS + JS both key off it
      s = s.replace('data-hero-mode="full"', `data-hero-mode="${heroMode}"`);
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
    if (fs.existsSync(a)) fs.cpSync(a, dst, { recursive: true });
  }
  const crewDefaults = path.join(
    root,
    "scripts",
    "reskin",
    "chassis-demo-assets",
    "images",
    "gallery",
  );
  if (!cfg.customCrewAssets && fs.existsSync(crewDefaults)) {
    fs.mkdirSync(path.join(dst, "images", "gallery"), { recursive: true });
    for (const file of ["restaurant.jpg", "dance.jpg"])
      fs.copyFileSync(
        path.join(crewDefaults, file),
        path.join(dst, "images", "gallery", file),
      );
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
      if (!fs.existsSync(target) && fs.existsSync(source))
        fs.copyFileSync(source, target);
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
    for (const o of copyOverrides)
      s = s.replace(new RegExp(o.pattern, o.flags || "g"), o.replace);
    s = s.replace(
      new RegExp(
        `((?:src|href)="\\/${slug}\\/[^"?]+\\.(?:css|js))(?:\\?v=\\d+)?"`,
        "g",
      ),
      `$1?v=${buildV}"`,
    );
    if (cfg.menu) s = replaceMenu(s);
    fs.writeFileSync(path.join(dst, f), s);
  }

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
    const duplicates = [...byHash.values()].filter(
      (matches) => matches.length > 1,
    );
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
  withTenantsLock((tenants) => {
    tenants.tenants = tenants.tenants.filter((x) => x.tenant_id !== slug);
    tenants.tenants.push(t);
  });

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
    `tenant "${slug}" registered — hostnames: ${t.hostnames.join(", ")}`,
  );
  console.log(`open http://localhost:3000/${slug}/`);
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
              <li><a href="/${slug}/fuel-zone/">Race nutrition</a></li>
              <li><a href="/${slug}/taper-zone/">Final two-week taper</a></li>
            </ul>
          </li>
          <li>
            <button aria-expanded="false" aria-haspopup="true">Station 9 <span class="caret"></span></button>
            <ul class="sub">
              <li><a href="/${slug}/station-9/">Station 9 meetups</a></li>
              <li><a href="/${slug}/broadcast/">Weekly broadcast</a></li>
              <li><a href="/${slug}/diary/">This week's diary</a></li>
              <li><a href="/${slug}/#wall-photos">${cfg.wallLabel || "Warriors Wall"}</a></li>
${merchandiseLink}              <li><a href="/${slug}/#ask">Chat Zone</a></li>
            </ul>
          </li>
        </ul>`;

function replaceMenu(s) {
  const marker = '<ul class="menu" id="menu">';
  const start = s.indexOf(marker);
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
  for (const o of copyOverrides) {
    s = s.replace(new RegExp(o.pattern, o.flags || "g"), o.replace);
  }
  if (file.endsWith(".html")) s = replaceMenu(s);
  if (file.endsWith("styles.css")) s += `\n${DEMO_NAV_CSS}\n`;
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
  for (const o of copyOverrides) {
    s = s.replace(new RegExp(o.pattern, o.flags || "g"), o.replace);
  }
  s = s.replace(
    new RegExp(
      `((?:src|href)="\\/${slug}\\/[^"?]+\\.(?:css|js))(?:\\?v=\\d+)?"`,
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
withTenantsLock((tenants) => {
  tenants.tenants = tenants.tenants.filter((x) => x.tenant_id !== slug);
  tenants.tenants.push(t);
});

console.log(`reskin done → ${slug}/  (${touched} files touched)`);
console.log(
  `tenant "${slug}" registered — hostnames: ${t.hostnames.join(", ")}`,
);
console.log(`open http://localhost:3000/${slug}/`);
