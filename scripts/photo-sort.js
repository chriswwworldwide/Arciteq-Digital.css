#!/usr/bin/env node
// scripts/photo-sort.js — index + allocate a pile of source photos into the
// chassis image slots, so tenant builds stop needing hand-picked filenames.
//
//   node scripts/photo-sort.js <assetsDir> [--apply <tenantAssetsDir>] [--pin hero.jpg=somefile.jpg]
//
// Index: every image in <assetsDir> gets scored per slot from
// chassis/images/slots.json using:
//   - aspect match (slot wants landscape/portrait vs photo's real shape)
//   - keyword match (slot keywords vs IG caption sidecar .txt + filename)
//   - faceCritical guard (hero/portrait slots only take shots whose captions
//     suggest a person, never scenery/gym equipment)
// Allocation: slots fill in priority order (1 first), each photo used once,
// then a report lists confident picks, low-confidence picks, and unused photos.
// --apply copies the winners into a tenant assets dir under slot filenames;
// --pin slot=photo forces a specific assignment (e.g. keep Station 9's hero).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const slotsPath = path.join(root, "chassis", "images", "slots.json");
const slots = JSON.parse(fs.readFileSync(slotsPath, "utf8")).slots;

const args = process.argv.slice(2);
const srcDir = args[0];
if (!srcDir || !fs.existsSync(srcDir)) {
  console.error(
    "usage: node scripts/photo-sort.js <assetsDir> [--apply <outDir>] [--pin slot=file ...]",
  );
  process.exit(1);
}
const applyDir = args.includes("--apply") ? args[args.indexOf("--apply") + 1] : null;
const pins = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pin" && args[i + 1]) {
    const [slot, file] = args[i + 1].split("=");
    pins[slot] = file;
    i++;
  }
}

const IMG = /\.(jpe?g|png|webp|heic)$/i;
const PERSON_WORDS =
  /\b(i|me|my|we|us|he|she|coach|athlete|partner|team|squad|client|race|finish|pb|proud|won|first)\b/i;
const CROP_RISK_WORDS = /\b(nature|food|view|skyline|equipment|product)\b/i;

function dims(f) {
  try {
    const out = execSync(
      `sips -g pixelWidth -g pixelHeight "${f}" 2>/dev/null`,
      { encoding: "utf8" },
    );
    const w = +(/pixelWidth:\s*(\d+)/.exec(out)?.[1] || 0);
    const h = +(/pixelHeight:\s*(\d+)/.exec(out)?.[1] || 0);
    return w && h ? { w, h, ratio: w / h } : null;
  } catch {
    return null;
  }
}

// ---- index every photo ------------------------------------------------
const photos = [];
for (const f of fs.readdirSync(srcDir).sort()) {
  if (!IMG.test(f)) continue;
  const full = path.join(srcDir, f);
  const d = dims(full);
  if (!d) continue;
  const sidecar = full.replace(IMG, ".txt");
  const caption = fs.existsSync(sidecar)
    ? fs.readFileSync(sidecar, "utf8").toLowerCase()
    : "";
  photos.push({
    file: f,
    full,
    ...d,
    text: `${f.toLowerCase()} ${caption}`,
    hasPerson: PERSON_WORDS.test(caption),
    cropRisk: CROP_RISK_WORDS.test(caption),
  });
}
if (!photos.length) {
  console.error(`no images found in ${srcDir}`);
  process.exit(1);
}
console.log(`indexed ${photos.length} photos`);

// ---- scoring -----------------------------------------------------------
function score(photo, slot) {
  let s = 0;
  const wantAspect = slot.aspect || "any";
  if (wantAspect === "landscape") s += photo.ratio >= 1.15 ? 3 : photo.ratio >= 0.9 ? 1 : -3;
  else if (wantAspect === "portrait") s += photo.ratio <= 0.85 ? 3 : photo.ratio <= 1.0 ? 1 : -3;
  let kw = 0;
  for (const k of slot.keywords || []) if (photo.text.includes(k)) kw++;
  s += Math.min(kw, 2) * 4;
  if (slot.faceCritical) {
    if (photo.cropRisk) s -= 8;
    else if (photo.hasPerson) s += 3;
    else s -= 4; // no evidence of a person in a face-critical slot
  }
  return s;
}

// ---- allocate (priority order, no reuse) --------------------------------
const order = Object.entries(slots).sort(
  (a, b) => (a[1].priority || 3) - (b[1].priority || 3),
);
const used = new Set();
const assign = {};
const review = [];
for (const slotName of pins ? Object.keys(pins) : []) {
  const p = photos.find((p) => p.file === pins[slotName]);
  if (p) {
    assign[slotName] = { photo: p.file, score: 99, pinned: true };
    used.add(p.file);
  }
}
for (const [slotName, slot] of order) {
  if (assign[slotName]) continue;
  const candidates = photos
    .filter((p) => !used.has(p.file))
    .map((p) => ({ p, s: score(p, slot) }))
    .sort((a, b) => b.s - a.s);
  const best = candidates[0];
  if (!best) break;
  assign[slotName] = { photo: best.p.file, score: best.s };
  used.add(best.p.file);
  if (best.s < 4) review.push({ slot: slotName, photo: best.p.file, score: best.s, label: slot.label });
}

// ---- report ------------------------------------------------------------
console.log("\n=== ASSIGNMENTS (slot ← photo · score) ===");
for (const [slot, a] of Object.entries(assign)) {
  const flag = a.pinned ? "PIN" : a.score < 4 ? "REVIEW" : "ok";
  console.log(`  ${flag.padEnd(6)} ${slot.padEnd(34)} ← ${a.photo}  (${a.score})`);
}
if (review.length) {
  console.log("\n=== NEEDS HUMAN EYES ===");
  for (const r of review) console.log(`  ${r.slot}: "${r.label}" ← ${r.photo}`);
}
const unused = photos.filter((p) => !used.has(p.file)).map((p) => p.file);
console.log(`\nunused: ${unused.length} photos${unused.length ? " — " + unused.slice(0, 10).join(", ") + (unused.length > 10 ? "…" : "") : ""}`);

// ---- apply -------------------------------------------------------------
if (applyDir) {
  for (const [slot, a] of Object.entries(assign)) {
    const src = path.join(srcDir, a.photo);
    const dst = path.join(applyDir, slot);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  console.log(`\napplied → ${applyDir}`);
}
