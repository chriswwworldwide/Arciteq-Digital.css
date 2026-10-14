// tools/prune-imports.js — removes import specifiers that ESLint reports as
// unused (no-unused-vars) from the given files; drops imports left empty.
// Usage: node tools/prune-imports.js server.js server/foo.js
import fs from "node:fs";
import { ESLint } from "eslint";
import { parse } from "acorn";

const files = process.argv.slice(2);
const eslint = new ESLint();
for (const file of files) {
  const [result] = await eslint.lintFiles([file]);
  const unused = new Set(
    result.messages
      .filter((m) => m.ruleId === "no-unused-vars")
      .map((m) => (m.message.match(/^'([^']+)'/) || [])[1])
      .filter(Boolean),
  );
  if (!unused.size) continue;
  const text = fs.readFileSync(file, "utf8");
  const ast = parse(text, { ecmaVersion: "latest", sourceType: "module" });
  const edits = [];
  for (const n of ast.body) {
    if (n.type !== "ImportDeclaration") continue;
    const keep = n.specifiers.filter((s) => !unused.has(s.local.name));
    if (keep.length === n.specifiers.length) continue;
    let replacement = "";
    if (keep.length) {
      const def = keep.find((s) => s.type === "ImportDefaultSpecifier");
      const ns = keep.find((s) => s.type === "ImportNamespaceSpecifier");
      const named = keep
        .filter((s) => s.type === "ImportSpecifier")
        .map((s) => (s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`));
      const parts = [];
      if (def) parts.push(def.local.name);
      if (ns) parts.push(`* as ${ns.local.name}`);
      if (named.length) parts.push(named.length > 3 ? `{\n${named.map((x) => `  ${x},`).join("\n")}\n}` : `{ ${named.join(", ")} }`);
      replacement = `import ${parts.join(", ")} from "${n.source.value}";`;
    }
    let end = n.end;
    if (!replacement && text[end] === "\n") end += 1;
    edits.push({ start: n.start, end, replacement });
  }
  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  fs.writeFileSync(file, out);
  console.log(`${file}: removed ${[...unused].join(", ")}`);
}
