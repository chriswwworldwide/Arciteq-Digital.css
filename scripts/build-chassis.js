#!/usr/bin/env node
// build-chassis.js — regenerate the donor tenant, copy it to the neutral
// chassis, tokenise all persona-specific values, strip dead files and photos,
// then FAIL if any persona string survived. No silent ghosts.
//
//   node scripts/build-chassis.js
//
// Source of truth for what gets blanked: scripts/reskin/chassis.tokens.json

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipe = JSON.parse(
  fs.readFileSync(
    path.join(root, "scripts/reskin/chassis.tokens.json"),
    "utf8",
  ),
);

const donorDir = path.join(root, recipe.donorSlug);
const outDir = path.join(root, recipe.outDir);

// ---- 1. regenerate the donor so the chassis tracks its latest state --------
console.log(`regenerating ${recipe.donorSlug} from ${recipe.donorConfig}…`);
execFileSync(
  "node",
  [path.join(root, "scripts/reskin-tenant.js"), recipe.donorConfig],
  {
    cwd: root,
    stdio: "inherit",
  },
);

// ---- 2. fresh copy ----------------------------------------------------------
const slotsPath = path.join(outDir, "images", "slots.json");
const preservedSlots = fs.existsSync(slotsPath)
  ? fs.readFileSync(slotsPath)
  : null;
fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(donorDir, outDir, { recursive: true });

// ---- 3. strip dead weight ----------------------------------------------------
for (const f of recipe.stripFiles)
  fs.rmSync(path.join(outDir, f), { force: true });
for (const d of recipe.stripDirs)
  fs.rmSync(path.join(outDir, d), { recursive: true, force: true });

// ---- 4. tokenise --------------------------------------------------------------
// literal renames first (path normalisation), then tokens longest-first so
// "Josh Harrison" beats "Josh" and "1:05:43" beats "1:14".
const renames = [...recipe.renames].sort(
  (a, b) => b.find.length - a.find.length,
);
const tokens = [...recipe.tokens].sort((a, b) => b.find.length - a.find.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const walk = (dir) => {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
};

const TEXT_EXT = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".md",
  ".xml",
  ".txt",
  ".svg",
]);
let tokenised = 0;
for (const file of walk(outDir)) {
  if (!TEXT_EXT.has(path.extname(file))) continue;
  let s = fs.readFileSync(file, "utf8");
  let changed = false;
  for (const r of renames) {
    const next = s.split(r.find).join(r.replace);
    if (next !== s) ((s = next), (changed = true));
  }
  for (const t of tokens) {
    const re = new RegExp(t.regex ? t.find : esc(t.find), "g");
    const next = s.replace(re, `{{${t.token}}}`);
    if (next !== s) ((s = next), (changed = true));
  }
  if (changed) {
    fs.writeFileSync(file, s);
    tokenised++;
  }
}

const imageSlotRemaps = {
  "predictor.html": [["images/finish.jpg", "images/predictor-hero.jpg"]],
  "splits.html": [["images/rope.jpg", "images/splits-hero.jpg"]],
  "events.html": [
    ["images/squad-athlos.jpg", "images/events-hero.jpg"],
    ["images/pb-venue.jpg", "images/events-secondary.jpg"],
    [
      "{{COACH_FIRST}} beside the {{PB_SOLO}} finish board in {{PB_VENUE}}",
      "{{COACH_FIRST}} racing inside a HYROX event arena",
    ],
    [
      "Arms up at the finish — the part you trained for.",
      "Race-floor effort — the reason the weekend is on the calendar.",
    ],
  ],
  "coaching.html": [["images/sprint.jpg", "images/coaching-hero.jpg"]],
  "find-a-partner.html": [
    ["images/race-pair.jpg", "images/race-mate-hero.jpg"],
  ],
  "run-zone.html": [
    ["images/treadmill.jpg", "images/run-hero.jpg"],
    ["images/race-revel.jpg", "images/run-compromised.jpg"],
  ],
  "stations-prep.html": [
    ["images/walkin.jpg", "images/stations-hero.jpg"],
    ["images/skierg-laugh.jpg", "images/station-skierg.jpg"],
    ["images/station-lean.jpg", "images/station-sled-push.jpg"],
    ["images/rope.jpg", "images/station-sled-pull.jpg"],
    ["images/wallball.jpg", "images/station-burpees.jpg"],
    ["images/bike.jpg", "images/station-row.jpg"],
    ["images/carry.jpg", "images/station-farmers-carry.jpg"],
    ["images/coaching.jpg", "images/station-sandbag-lunges.jpg"],
    ["images/detail.jpg", "images/station-wall-balls.jpg"],
    [
      "{{COACH_FIRST}} on the erg between pieces — same engine, different machine",
      "{{COACH_FIRST}} driving through the rowing station mid-race",
    ],
    [
      "{{COACH_FIRST}} crouched low between efforts — the legs the lunges are built on",
      "{{COACH_FIRST}} completing sandbag lunges with the bag across the shoulders",
    ],
    [
      "Head down between wall-ball sets — the breathing pattern holds",
      "{{COACH_FIRST}} completing wall balls under fatigue",
    ],
  ],
};
for (const [fileName, replacements] of Object.entries(imageSlotRemaps)) {
  const file = path.join(outDir, fileName);
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, "utf8");
  for (const [from, to] of replacements) content = content.split(from).join(to);
  fs.writeFileSync(file, content);
}
for (const file of walk(outDir).filter((candidate) => candidate.endsWith(".html"))) {
  let content = fs
    .readFileSync(file, "utf8")
    .replace(/\s*<p class="site-credit"[\s\S]*?<\/p>/g, "");
  content = content.replace(
    "</footer>",
    '  <p class="site-credit" style="text-align:center;margin:2rem 0 0"><a href="/" rel="noopener" style="display:inline-flex;align-items:center;gap:.45em;padding:.45em .9em;border:1px solid rgba(255,255,255,.18);border-radius:999px;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6);text-decoration:none">Built with <b style="color:#ff3b3b;font-weight:700">Station 9</b></a></p>\n    </footer>',
  );
  fs.writeFileSync(file, content);
}

// ---- 4a. hero-mode contract — one attribute drives everything --------------
// Donor HTML carries class="hero--full" + dead data-hero-roll; CSS selectors
// key off the class; app.js checks it for the mask pass. Normalise the whole
// surface to data-hero-mode="full|ambient" so a tenant flips ONE attribute —
// no CSS rewriting, no class surgery at generation time.
for (const file of walk(outDir)) {
  const ext = path.extname(file);
  if (ext !== ".css" && ext !== ".js" && ext !== ".html") continue;
  let s = fs.readFileSync(file, "utf8");
  const before = s;
  if (ext === ".css") {
    s = s.split(".hero--full").join('[data-hero-mode="full"]');
  } else if (ext === ".js") {
    s = s.split('".hero--full"').join("'[data-hero-mode=\"full\"]'");
  } else {
    s = s
      .split('class="hero hero--bleed hero--full" data-hero-roll="full"')
      .join('class="hero hero--bleed" data-hero-mode="full"');
  }
  if (s !== before) fs.writeFileSync(file, s);
}

// ---- 4b. tokenised tenant record (replaces the roxjaya-derived record) -------
const tenantsFile = path.join(root, "data", "tenants.json");
const donorRec = JSON.parse(fs.readFileSync(tenantsFile, "utf8")).tenants.find(
  (t) => t.tenant_id === recipe.donorSlug,
);
let recStr = JSON.stringify(donorRec, null, 2);
for (const r of renames) recStr = recStr.split(r.find).join(r.replace);
for (const t of tokens) {
  recStr = recStr.replace(
    new RegExp(t.regex ? t.find : esc(t.find), "g"),
    `{{${t.token}}}`,
  );
}
fs.writeFileSync(path.join(outDir, "tenant.record.json"), recStr + "\n");

// ---- 4c. news feed — every chassis tenant ships with 3 voice items ----------
// The feed demonstrates "owner's take" commentary, so the master carries three
// sample items; a tenant config can replace them wholesale via cfg.news.
const newsPath = path.join(outDir, "data", "news.json");
const news = JSON.parse(fs.readFileSync(newsPath, "utf8"));
while (news.items.length < 3) {
  news.items.push({
    date: "2026-09-22",
    title: "The station nobody trains enough",
    summary:
      "Ask a room of first-timers which station worries them and it's always the sled. Ask the people who've raced and they say wall balls — the station that looks easy and empties your legs.",
    take: "{{VOICE_NEWS_TAKE}}",
    link: "/{{SLUG}}/stations-prep.html",
    linkLabel: "All eight stations →",
  });
}
fs.writeFileSync(newsPath, JSON.stringify(news, null, 2) + "\n");

// ---- 5. the point of the whole exercise: fail loudly --------------------------
const forbidden = recipe.forbiddenStrings.map((f) => f.toLowerCase());
const leaks = [];
for (const file of walk(outDir)) {
  if (!TEXT_EXT.has(path.extname(file))) continue;
  const s = fs.readFileSync(file, "utf8").toLowerCase();
  for (const f of forbidden) {
    if (s.includes(f)) leaks.push(`${path.relative(outDir, file)}: "${f}"`);
  }
}
if (leaks.length) {
  console.error("\nPERSONA LEAK — these strings survived tokenisation:");
  for (const l of leaks) console.error("  " + l);
  process.exit(1);
}

// ---- 6. image contract ---------------------------------------------------------
fs.mkdirSync(path.join(outDir, "images"), { recursive: true });
if (preservedSlots)
  fs.writeFileSync(path.join(outDir, "images", "slots.json"), preservedSlots);
const imgRefs = new Set();
for (const file of walk(outDir)) {
  if (!TEXT_EXT.has(path.extname(file))) continue;
  for (const m of fs
    .readFileSync(file, "utf8")
    .matchAll(/images\/([a-z0-9/_-]+\.(?:jpe?g|png|webp))/g))
    imgRefs.add(m[1]);
}
fs.writeFileSync(
  path.join(outDir, "images", "REQUIRED.md"),
  `# Image contract — chassis\n\nThis site ships with no photography. To build a tenant, drop these\nfiles into its assets folder (same names, any real photo per slot):\n\n${[
    ...imgRefs,
  ]
    .sort()
    .map((r) => `- images/${r}`)
    .join(
      "\n",
    )}\n\nOptional extras (gallery/, lifestyle) can be added per tenant; filenames\nin pages are the contract — rename files to match, not the other way round.\n`,
);

console.log(
  `\nchassis built → ${recipe.outDir}/  (${tokenised} files tokenised, ${imgRefs.size} image slots, 0 leaks)`,
);
