// Pre-build audit of a photo-map.json (current schema: images + placements
// + wall + dataPlacements + review). Run BEFORE review, not during it.
//
//   node scripts/photo-map/check.mjs <tenant>
//
// Reports:
//   UNASSIGNED  — chassis slots with no file chosen
//   DUP         — same file placed in multiple slots (reuse must be
//                 deliberate; flag anything not carrying reuseReason)
//   UNREVIEWED  — placed file missing from images{} or failing the
//                 build-time completeness rules setup.mjs enforces
//   CROP        — must-keep/face bounds can't fit the slot's aspect range
//                 (uses chassis/photo-slots.json when present)
//   REVIEW      — map review.status not approved/resolved
//   SPARE       — rating>=4 images never placed (suggestions, not errors)
//
// Exit code 1 if any hard failure (UNASSIGNED/UNREVIEWED/CROP/REVIEW).
import { readFileSync, existsSync } from 'fs';

const tenant = process.argv[2];
if (!tenant) { console.error('Usage: node scripts/photo-map/check.mjs <tenant>'); process.exit(1); }

const mapPath = `scripts/reskin/${tenant}-assets/photo-map.json`;
if (!existsSync(mapPath)) { console.error(`no ${mapPath}`); process.exit(1); }
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const images = map.images || {};

const slotDefs = existsSync('chassis/photo-slots.json')
  ? Object.fromEntries(JSON.parse(readFileSync('chassis/photo-slots.json')).slots.map(s => [s.key, s]))
  : {};

const problems = [], notes = [];

// ---- intake gate ---------------------------------------------------------
if (map.intakeComplete !== true)
  problems.push(`REVIEW  intakeComplete is not true — intake must be closed before allocating`);

// ---- coverage ------------------------------------------------------------
const allSlots = [...(map.placements || []), ...(map.dataPlacements || [])];
for (const s of allSlots) {
  if (s.role === 'decorative') continue;
  if (!s.file) problems.push(`UNASSIGNED  ${s.id || s.chassisSlot} (${s.page}) has no file`);
  else if (s.id && !s.alt?.trim()) problems.push(`UNREVIEWED  ${s.id} missing alt text`);
  if (s.page && s.file && (!s.frame || s.frame.mode === 'existing'))
    problems.push(`UNREVIEWED  ${s.id} needs explicit framing (frame.mode still '${s.frame?.mode || 'missing'}')`);
  if (s.frame?.mode === 'element' && !s.frameNote?.trim())
    problems.push(`UNREVIEWED  ${s.id} element frame needs frameNote`);
}

// ---- duplicates -----------------------------------------------------------
// Dups count per *kind*: feed/nav-card reuse (dataPlacements, which carry a
// built-in reuseReason) is expected. The smell is one file filling two
// static page slots with no logged reason.
const staticSlots = (map.placements || []).filter(x => x.file);
const use = {};
for (const s of staticSlots) (use[s.file] ||= {static: []}).static.push(s.id || s.chassisSlot);
const wallFiles = new Set((map.wall || []).map(w => w.file));
for (const [file, u] of Object.entries(use)) {
  if (u.static.length > 1) {
    const deliberate = staticSlots.some(s => s.file === file && s.reuseReason);
    (deliberate ? notes : problems).push(
      `DUP  ${file} fills ${u.static.length} static slots: ${u.static.join(', ')}${deliberate ? ' (reuseReason logged)' : ' — same photo in unrelated slots; pick a spare or log reuseReason'}`);
  }
}

// ---- image completeness ----------------------------------------------------
for (const s of allSlots.filter(x => x.file)) {
  const ph = images[s.file];
  if (!ph) { problems.push(`UNREVIEWED  ${s.id}: ${s.file} not in images{}`); continue; }
  const missing = [];
  if (ph.reviewed !== true) missing.push('reviewed!=true');
  if (!ph.subject) missing.push('no subject');
  if (!Number.isInteger(ph.rating) || ph.rating < 1 || ph.rating > 5) missing.push('bad rating');
  if (!Array.isArray(ph.dims) || ph.dims.length !== 2 || !ph.dims.every(n => Number.isFinite(n) && n > 0)) missing.push('no dims');
  if (!Array.isArray(ph.anchors?.mustKeep)) missing.push('no anchors.mustKeep');
  if (missing.length) problems.push(`UNREVIEWED  ${s.file} (${s.id}): ${missing.join(', ')}`);
}

// ---- crop conflicts ----------------------------------------------------------
const cropCheck = (s, ph) => {
  const slot = slotDefs[s.chassisSlot];
  if (!slot || slot.elastic || !ph.dims) return;
  const keeps = ph.anchors?.mustKeep || [];
  if (!keeps.length && !ph.anchors?.face) return;
  const pA = ph.dims[0] / ph.dims[1];
  const worst = [slot.aspectMin, slot.aspectMax].reduce((a, b) =>
    Math.abs(Math.log(b / pA)) > Math.abs(Math.log(a / pA)) ? b : a);
  const boxes = keeps.map(k => k.box || k);
  if (worst >= pA) {
    const v = pA / worst;
    const ys = boxes.map(k => [k[1], k[3]]);
    if (ph.anchors?.face) ys.push([ph.anchors.face[1], ph.anchors.face[1]]);
    const lo = Math.min(...ys.map(y => y[0])), hi = Math.max(...ys.map(y => y[1]));
    if (hi - lo > v) problems.push(`CROP  ${s.file} in ${s.id}: must-keep span ${(hi - lo).toFixed(2)} > visible ${v.toFixed(2)} (vertical) — recrop or reassign`);
  } else {
    const v = worst / pA;
    const xs = boxes.map(k => [k[0], k[2]]);
    if (ph.anchors?.face) xs.push([ph.anchors.face[0], ph.anchors.face[0]]);
    const lo = Math.min(...xs.map(x => x[0])), hi = Math.max(...xs.map(x => x[1]));
    if (hi - lo > v) problems.push(`CROP  ${s.file} in ${s.id}: must-keep span ${(hi - lo).toFixed(2)} > visible ${v.toFixed(2)} (horizontal) — recrop or reassign`);
  }
};
for (const s of allSlots.filter(x => x.file && images[x.file])) cropCheck(s, images[s.file]);

// ---- review status ------------------------------------------------------------
const rev = map.review || {};
const openItems = (rev.items || []).filter(i => !i.resolution);
if (openItems.length) problems.push(`REVIEW  ${openItems.length} unresolved review item(s): ${openItems.map(i => i.slot).join(', ')}`);
if (rev.status && !['approved', 'resolved'].includes(rev.status))
  problems.push(`REVIEW  review.status='${rev.status}' — resolve or get Chris's decision first`);

// ---- spares (notes only) -----------------------------------------------------
const placed = new Set(allSlots.map(s => s.file));
const goodSpares = Object.entries(images)
  .filter(([f, ph]) => !placed.has(f) && !wallFiles.has(f) && ph.rating >= 4 && ph.reviewed)
  .map(([f]) => f);
if (goodSpares.length) notes.push(`SPARE  ${goodSpares.length} unused rating>=4 images: ${goodSpares.slice(0, 8).join(', ')}${goodSpares.length > 8 ? '…' : ''}`);

// ---- output --------------------------------------------------------------------
console.log(`photo-map audit: ${tenant} — ${allSlots.length} placements, ${Object.keys(images).length} images\n`);
if (problems.length) console.log(problems.map(p => `! ${p}`).join('\n'));
if (notes.length) console.log('\n' + notes.map(n => `· ${n}`).join('\n'));
if (!problems.length) console.log('  all clear — safe to review');
process.exit(problems.length ? 1 : 0);
