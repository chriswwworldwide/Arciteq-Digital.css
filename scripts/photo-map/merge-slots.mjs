// Merges two+ slot scans into the canonical chassis/photo-slots.json.
// Slots whose rendered aspect differs materially between tenants are marked
// elastic (they follow the image); the rest are pinned crop constraints.
// Usage: node scripts/photo-map/merge-slots.mjs scan1.json scan2.json [...] --out chassis/photo-slots.json
import { readFileSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx > -1 ? args[outIdx + 1] : 'chassis/photo-slots.json';
const runs = args.filter((a, i) => i !== outIdx && i !== outIdx + 1).map(f => JSON.parse(readFileSync(f)));

const merged = {};
for (const run of runs) {
  for (const s of run.slots) {
    const k = s.key;
    if (!merged[k]) {
      const { aspects, ...rest } = s;
      merged[k] = { ...rest, seen: [run.tenant] };
    } else {
      merged[k].seen.push(run.tenant);
      merged[k].aspectMin = Math.min(merged[k].aspectMin, s.aspectMin);
      merged[k].aspectMax = Math.max(merged[k].aspectMax, s.aspectMax);
    }
  }
}
for (const m of Object.values(merged)) {
  const rngs = runs.map(r => r.slots.find(s => s.key === m.key)).filter(Boolean)
    .map(s => [s.aspectMin, s.aspectMax]);
  m.elastic = rngs.length > 1 &&
    (Math.abs(rngs[0][0] - rngs[1][0]) > 0.1 || Math.abs(rngs[0][1] - rngs[1][1]) > 0.1);
}
const doc = {
  generated: new Date().toISOString().slice(0, 10),
  measuredOn: runs.map(r => r.tenant),
  widths: runs[0].widths,
  note: 'aspect=rendered w/h. elastic slots follow the image aspect (no fixed frame); pinned slots crop via cover. must-keep boxes only constrained by pinned slots.',
  slots: Object.values(merged).sort((a, b) => a.key.localeCompare(b.key))
};
writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`${out}: ${doc.slots.length} slots, ${doc.slots.filter(s => s.elastic).length} elastic`);
