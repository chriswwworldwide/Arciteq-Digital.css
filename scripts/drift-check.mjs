// Drift check: rebuild each configured tenant to /tmp and diff the output
// against the live dir. Reports where live has drifted from what its config
// + the current chassis would produce — hand-edits the build doesn't know.
// Usage:
//   node scripts/drift-check.mjs              # all configs with a live dir
//   node scripts/drift-check.mjs faisalpma    # one tenant
//   node scripts/drift-check.mjs --keep       # keep the staged builds
// ?v= cache stamps are normalised away; only real content diffs are listed.
import { spawnSync } from "node:child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = "/tmp/drift-check";
const KEEP = process.argv.includes("--keep");
const only = process.argv.slice(2).find(a => !a.startsWith("--"));

const cfgs = fs.readdirSync(path.join(ROOT, "scripts/reskin"))
  .filter(f => f.endsWith(".demo.json"))
  .map(f => {
    const c = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/reskin", f), "utf8"));
    return { file: path.join(ROOT, "scripts/reskin", f), slug: c.slug || f.replace(".demo.json", "") };
  })
  .filter(c => fs.existsSync(path.join(ROOT, c.slug)))
  .filter(c => !only || c.slug === only);

if (!cfgs.length) { console.log("no matching tenants"); process.exit(0); }

const TEXT = /\.(html?|css|m?js|json|md|txt|svg|xml)$/i;
const norm = s => s.replace(/\?v=[^"'\s]*/g, "?v=STAMP");
const walk = (dir, base = "") => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]);

function diffDirs(live, built) {
  const lf = fs.existsSync(live) ? new Set(walk(live)) : new Set();
  const bf = new Set(walk(built));
  const rows = [];
  for (const f of [...lf].sort()) {
    if (!bf.has(f)) { rows.push(`  only-live   ${f}`); continue; }
    const lp = path.join(live, f), bp = path.join(built, f);
    if (TEXT.test(f)) {
      const a = norm(fs.readFileSync(lp, "utf8")), b = norm(fs.readFileSync(bp, "utf8"));
      if (a !== b) {
        const al = a.split("\n"), bl = b.split("\n");
        let n = 0; for (let i = 0; i < Math.max(al.length, bl.length); i++) if (al[i] !== bl[i]) n++;
        rows.push(`  differs     ${f} (${n} lines)`);
      }
    } else if (fs.statSync(lp).size !== fs.statSync(bp).size) {
      rows.push(`  bin-differs ${f}`);
    }
  }
  for (const f of [...bf].sort()) if (!lf.has(f)) rows.push(`  only-built  ${f}`);
  return rows;
}

console.log(`drift check → ${cfgs.length} tenant(s), staging in ${OUT}`);
const report = [];
for (const { file, slug } of cfgs) {
  const dst = path.join(OUT, slug);
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/reskin-tenant.js"), file, `--output-dir=${dst}`],
    { env: { ...process.env, SKIP_VERIFY: "1" }, encoding: "utf8", timeout: 120000 });
  if (r.status !== 0) { report.push(`\n${slug}: BUILD FAILED\n${(r.stderr || r.stdout || "").slice(-400)}`); continue; }
  const rows = diffDirs(path.join(ROOT, slug), dst);
  report.push(`\n${slug}: ${rows.length} drifted file(s)` + (rows.length ? `\n${rows.slice(0, 40).join("\n")}${rows.length > 40 ? `\n  ... +${rows.length - 40} more` : ""}` : ""));
  console.log(`done ${slug} (${rows.length})`);
}
console.log(report.join(""));
if (!KEEP) fs.rmSync(OUT, { recursive: true, force: true });
