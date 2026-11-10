// Checks photo-map entries against the chassis slot map.
// LEGACY schema only (flat per-file dict with slots/must-keep/face) — for
// existing unmigrated sites. New builds use check.mjs.
// For each photo with a declared slot, computes the object-position that
// keeps every must-keep box inside the slot's visible window, across the
// slot's full responsive aspect range. Flags conflicts it cannot solve.
// Usage: node scripts/photo-map/check-legacy.mjs <tenant>
import { readFileSync, existsSync } from 'fs';

const tenant = process.argv[2];
const slots = JSON.parse(readFileSync('chassis/photo-slots.json')).slots;
const slotByKey = Object.fromEntries(slots.map(s => [s.key, s]));

const mapPath = `scripts/reskin/${tenant}-assets/photo-map.json`;
if (!existsSync(mapPath)) { console.error(`no ${mapPath}`); process.exit(1); }
const photos = JSON.parse(readFileSync(mapPath));

const report = [];
for (const [file, ph] of Object.entries(photos)) {
  const pAspect = ph.width / ph.height;
  for (const slotKey of ph.slots || []) {
    const slot = slotByKey[slotKey];
    if (!slot) { report.push({ file, slotKey, status: 'UNKNOWN SLOT' }); continue; }
    if (slot.elastic) {
      report.push({ file, slotKey, status: 'elastic — adapts to photo, no crop' });
      continue;
    }
    const keeps = ph['must-keep'] || [];
    if (!keeps.length && !ph.face) {
      report.push({ file, slotKey, status: 'ok (no constraints logged)' });
      continue;
    }
    // Worst case = slot aspect furthest from photo aspect (most cropping)
    const worst = [slot.aspectMin, slot.aspectMax]
      .map(s => Math.abs(Math.log(s / pAspect)))
      .reduce((a, b, i) => Math.max(a, b) === b ? i : a, 0) === 0 ? slot.aspectMin : slot.aspectMax;
    // cover: image scaled to fill. If photo wider than slot (pA > s): horizontal
    // crop, visible width fraction = s/pA. If taller (pA < s): vertical crop,
    // visible height fraction = pA/s.
    let solved = true, pos = {};
    if (worst >= pAspect) {
      const v = pAspect / worst;                    // visible height fraction
      const tops = keeps.map(k => k.box[1]), bots = keeps.map(k => k.box[3]);
      if (ph.face) { tops.push(ph.face[1]); bots.push(ph.face[1]); }
      const lo = Math.min(...tops), hi = Math.max(...bots);
      if (hi - lo > v) solved = false;
      else {
        const centre = (lo + hi) / 2;
        const off = Math.min(Math.max(centre - v / 2, 0), 1 - v);
        pos.y = +(off / (1 - v) * 100).toFixed(0);
      }
    } else {
      const v = worst / pAspect;                    // visible width fraction
      const lfts = keeps.map(k => k.box[0]), rts = keeps.map(k => k.box[2]);
      if (ph.face) { lfts.push(ph.face[0]); rts.push(ph.face[0]); }
      const lo = Math.min(...lfts), hi = Math.max(...rts);
      if (hi - lo > v) solved = false;
      else {
        const centre = (lo + hi) / 2;
        const off = Math.min(Math.max(centre - v / 2, 0), 1 - v);
        pos.x = +(off / (1 - v) * 100).toFixed(0);
      }
    }
    report.push({ file, slotKey, status: solved ? `ok — object-position ${pos.x ?? 50}% ${pos.y ?? 50}%` : 'CONFLICT: constraints wider than visible window — needs recrop or different photo' });
  }
}
console.log(report.map(r => `${r.status.startsWith('ok') || r.status.startsWith('elastic') ? ' ' : '!'} ${r.file} -> ${r.slotKey}\n    ${r.status}`).join('\n'));
