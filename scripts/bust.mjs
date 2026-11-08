// Re-stamp ?v= cache tags in a built site's HTML without a rebuild —
// for hand-edits between builds. Usage: node scripts/bust.mjs faisalpma
import fs from "fs";
import path from "path";

const slug = process.argv[2];
if (!slug) { console.error("usage: bust.mjs <dir-or-slug>"); process.exit(2); }
const dir = path.resolve(process.cwd(), slug);
if (!fs.existsSync(dir)) { console.error("not found:", dir); process.exit(2); }

const stamp = `r${Date.now()}`;
let touched = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".html"))) {
  const p = path.join(dir, f);
  const before = fs.readFileSync(p, "utf8");
  const after = before.replace(/(\.(?:css|js|jpe?g|png|webp|avif|gif|mp4|webm))\?v=[^"'\s]*/g, `$1?v=${stamp}`);
  if (after !== before) { fs.writeFileSync(p, after); touched++; }
}
console.log(`${slug}: re-stamped ?v=${stamp} in ${touched} html file(s)`);
