#!/usr/bin/env node
// Lists copyOverrides in a chassis config that no longer match any chassis text
// (raw or token-resolved), so dead patterns inherited from older configs can be
// removed before a build. Read-only: never edits the config or the chassis.
// Usage: node scripts/reskin/lint-overrides.js scripts/reskin/<slug>.demo.json
// Approximation: an override that only matches text produced by an earlier
// override, a seed file or a page file will be reported as dead — check those
// by hand before deleting.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error("Usage: node scripts/reskin/lint-overrides.js <config.demo.json>");
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(path.resolve(root, cfgPath), "utf8"));

let text = "";
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|js|json|css)$/.test(e.name)) text += fs.readFileSync(p, "utf8") + "\n";
  }
};
walk(path.join(root, "chassis"));
const resolved = text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => cfg.tokens?.[k] ?? m);

const dead = [];
(cfg.copyOverrides || []).forEach((o, i) => {
  let re;
  try {
    re = new RegExp(o.pattern, o.flags || "");
  } catch (err) {
    dead.push({ i, pattern: o.pattern, reason: `invalid regex: ${err.message}` });
    return;
  }
  if (!re.test(text) && !re.test(resolved)) dead.push({ i, pattern: o.pattern, reason: "no match" });
});

const total = (cfg.copyOverrides || []).length;
console.log(`${cfgPath}: ${total - dead.length} live, ${dead.length} dead of ${total} copyOverrides`);
for (const d of dead) console.log(`  #${d.i} (${d.reason}): ${d.pattern.slice(0, 100)}`);
