// tools/move-functions.js — refactor helper.
// Moves named top-level declarations (functions, or const/let statements)
// out of server.js into a module, exporting them, and imports them back.
// Boundaries come from a real JavaScript parser (acorn, already installed
// via ESLint), including any comment lines directly above a declaration.
// Usage:
//   node tools/move-functions.js <module path> <header file|-> name1 name2 ...
// DRY_RUN=1 prints what would move without changing anything.
import fs from "node:fs";
import { parse } from "acorn";

const [, , modulePath, headerFile, ...names] = process.argv;
const text = fs.readFileSync("server.js", "utf8");
const ast = parse(text, { ecmaVersion: "latest", sourceType: "module", locations: true });
const lines = text.split("\n");

function declName(node) {
  if (node.type === "FunctionDeclaration") return node.id?.name;
  if (node.type === "VariableDeclaration" && node.declarations.length === 1) {
    return node.declarations[0].id?.name;
  }
  return null;
}

const decls = names.map((name) => {
  const node = ast.body.find((n) => declName(n) === name);
  if (!node) throw new Error(`not found at top level: ${name}`);
  const start = node.loc.start.line - 1;
  const end = node.loc.end.line - 1;
  let top = start;
  while (top > 0 && /^\s*\/\//.test(lines[top - 1])) top -= 1;
  return { name, top, start, end };
}).sort((a, b) => a.top - b.top);

for (let i = 1; i < decls.length; i += 1) {
  if (decls[i].top <= decls[i - 1].end) {
    throw new Error(`overlap between ${decls[i - 1].name} and ${decls[i].name}`);
  }
}
for (const d of decls) console.log(`  ${d.name}: lines ${d.top + 1}-${d.end + 1}`);
if (process.env.DRY_RUN) process.exit(0);

const blocks = decls.map((d) => {
  const block = lines.slice(d.top, d.end + 1);
  const i = d.start - d.top;
  block[i] = block[i].replace(/^(export )?/, "export ");
  return block.join("\n");
});
for (const d of [...decls].reverse()) {
  let end = d.end;
  if (lines[end + 1] === "") end += 1;
  lines.splice(d.top, end - d.top + 1);
}

const header = headerFile && headerFile !== "-" ? fs.readFileSync(headerFile, "utf8") : "";
const existing = fs.existsSync(modulePath)
  ? `${fs.readFileSync(modulePath, "utf8").trimEnd()}\n\n`
  : header;
fs.writeFileSync(modulePath, `${existing}${blocks.join("\n\n")}\n`);

const importPath = `./${modulePath}`;
let out = lines.join("\n");
const esc = importPath.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const importRe = new RegExp(`import \\{([^}]*)\\} from "${esc}";`);
const m = out.match(importRe);
if (m) {
  const all = [...new Set([...m[1].split(",").map((s) => s.trim()).filter(Boolean), ...names])];
  out = out.replace(importRe, `import {\n${all.map((n) => `  ${n},`).join("\n")}\n} from "${importPath}";`);
} else {
  out = out.replace(
    'import { createHqRouter } from "./server/hq.js";',
    `import {\n${names.map((n) => `  ${n},`).join("\n")}\n} from "${importPath}";\nimport { createHqRouter } from "./server/hq.js";`,
  );
}
fs.writeFileSync("server.js", out);
console.log(`moved ${names.length} declaration(s) → ${modulePath}`);
