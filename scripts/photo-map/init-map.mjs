// Emits a starter photo-map.json from a tenant's images dir.
// Every entry needs human/agent eyeballing: fill subject, face, must-keep.
// Usage: node scripts/photo-map/init-map.mjs <tenant>
import { readdirSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const tenant = process.argv[2];
const dir = `scripts/reskin/${tenant}-assets/images`;
const out = `scripts/reskin/${tenant}-assets/photo-map.json`;
if (existsSync(out)) { console.error(`${out} exists — not overwriting`); process.exit(1); }
const map = {};
for (const f of readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f))) {
  const sips = execSync(`sips -g pixelWidth -g pixelHeight "${dir}/${f}"`).toString();
  const w = +sips.match(/pixelWidth: (\d+)/)[1], h = +sips.match(/pixelHeight: (\d+)/)[1];
  map[f] = {
    width: w, height: h,
    subject: '',                       // what/who is in the shot
    face: null,                        // [x,y] normalised, primary subject face
    'must-keep': [],                   // [{label, box:[x1,y1,x2,y2]}] — never crop out
    notes: '',
    slots: []                          // slot keys from chassis/photo-slots.json this photo may fill
  };
}
writeFileSync(out, JSON.stringify(map, null, 2));
console.log(`${out}: ${Object.keys(map).length} photos — eyeball and fill anchors/must-keep/slots`);
