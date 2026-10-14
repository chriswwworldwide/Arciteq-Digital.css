// tools/extract-routes.js — refactor helper (parser-based).
// Moves a contiguous block of top-level statements from server.js — route
// registrations (app.get/post/...) plus helper declarations between them —
// into a router module, then mounts the router at exactly the same spot so
// route order is unchanged. Dependencies are computed from the AST:
//   - names imported in server.js → re-imported in the module;
//   - names declared elsewhere in server.js → passed in ("ctx") at mount;
//   - names declared in the block but still used by server.js → exported
//     from the module and imported back.
// Usage: node tools/extract-routes.js <module> <Factory> <firstLine> <lastLine> [extraDeclName...]
// DRY_RUN=1 prints the plan only.
import fs from "node:fs";
import path from "node:path";
import { parse } from "acorn";

const [, , modulePath, factory, firstArg, lastArg, ...extra] = process.argv;
const first = Number(firstArg);
const last = Number(lastArg);
const text = fs.readFileSync("server.js", "utf8");
const ast = parse(text, { ecmaVersion: "latest", sourceType: "module", locations: true });

const imports = new Map(); // local name -> { source, imported }
const topDecl = new Map(); // name -> node
for (const n of ast.body) {
  if (n.type === "ImportDeclaration") {
    for (const s of n.specifiers) {
      imports.set(s.local.name, {
        source: n.source.value,
        imported: s.type === "ImportDefaultSpecifier" ? "default" : s.type === "ImportNamespaceSpecifier" ? "*" : s.imported.name,
      });
    }
  } else if (n.type === "FunctionDeclaration") topDecl.set(n.id.name, n);
  else if (n.type === "VariableDeclaration") for (const d of n.declarations) if (d.id.name) topDecl.set(d.id.name, n);
}

const isRoute = (n) =>
  n.type === "ExpressionStatement" &&
  n.expression.type === "CallExpression" &&
  n.expression.callee.type === "MemberExpression" &&
  n.expression.callee.object.name === "app" &&
  ["get", "post", "put", "patch", "delete", "all"].includes(n.expression.callee.property.name);

const block = ast.body.filter((n) => n.loc.start.line >= first && n.loc.end.line <= last);
const extras = extra.map((name) => {
  const n = topDecl.get(name);
  if (!n) throw new Error(`extra not found: ${name}`);
  return n;
});
for (const n of block) {
  if (!(isRoute(n) || n.type === "FunctionDeclaration" || n.type === "VariableDeclaration")) {
    throw new Error(`line ${n.loc.start.line}: unsupported statement ${n.type} inside block`);
  }
}
const moved = [...new Set([...block, ...extras])].sort((a, b) => a.start - b.start);
const movedSet = new Set(moved);
const declaredInBlock = new Set();
for (const n of moved) {
  if (n.type === "FunctionDeclaration") declaredInBlock.add(n.id.name);
  if (n.type === "VariableDeclaration") for (const d of n.declarations) declaredInBlock.add(d.id.name);
}

// Walk identifiers that reference top-level names (skip property keys).
function refs(node, cb) {
  (function walk(n, parent, key) {
    if (!n || typeof n.type !== "string") return;
    if (
      n.type === "Identifier" &&
      !(parent?.type === "MemberExpression" && key === "property" && !parent.computed) &&
      !(parent?.type === "Property" && key === "key" && !parent.computed && !parent.shorthand) &&
      !(parent?.type === "MethodDefinition" && key === "key")
    ) cb(n, parent, key);
    for (const k of Object.keys(n)) {
      if (k === "loc") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => walk(c, n, k));
      else if (v && typeof v.type === "string") walk(v, n, k);
    }
  })(node, null, null);
}

// Names declared locally anywhere inside moved code (params, inner consts):
// if a dep name is shadowed somewhere we refuse rather than risk a bad rename.
const localNames = new Set();
for (const n of moved) {
  (function walk(x) {
    if (!x || typeof x.type !== "string") return;
    if (x !== n && (x.type === "VariableDeclarator" || x.type === "FunctionDeclaration") && x.id?.type === "Identifier") localNames.add(x.id.name);
    if (/Function/.test(x.type)) for (const p of x.params || []) if (p.type === "Identifier") localNames.add(p.name);
    for (const k of Object.keys(x)) {
      if (k === "loc") continue;
      const v = x[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v.type === "string") walk(v);
    }
  })(n);
}

const needImports = new Map();
const deps = new Set();
for (const n of moved) {
  refs(n, (id) => {
    const name = id.name;
    if (name === "app" || declaredInBlock.has(name)) return;
    if (imports.has(name)) needImports.set(name, imports.get(name));
    else if (topDecl.has(name)) deps.add(name);
  });
}
// __dirname in server.js is the repo root: use the shared ROOT_DIR instead.
const usesDirname = deps.delete("__dirname");
if (usesDirname) needImports.set("ROOT_DIR", { source: "./server/data-files.js", imported: "ROOT_DIR" });
for (const d of deps) {
  if (localNames.has(d)) throw new Error(`dep "${d}" is shadowed inside the block — handle manually`);
}

// Names from the block still used by the rest of server.js → export.
const usedOutside = new Set();
for (const n of ast.body) {
  if (movedSet.has(n)) continue;
  refs(n, (id) => {
    if (declaredInBlock.has(id.name)) usedOutside.add(id.name);
  });
}

console.log(`block lines ${first}-${last}: ${block.length} statements (${block.filter(isRoute).length} routes) + ${extras.length} extras`);
console.log(`  re-imports: ${[...needImports.keys()].join(", ") || "-"}`);
console.log(`  passed in (ctx): ${[...deps].join(", ") || "-"}`);
console.log(`  exported back: ${[...usedOutside].join(", ") || "-"}`);
if (process.env.DRY_RUN) process.exit(0);

// Rewrite moved code: app.X( → router.X( ; dep → ctx.dep (by AST position).
const edits = []; // { start, end, text }
for (const n of moved) {
  if (isRoute(n)) edits.push({ start: n.expression.callee.object.start, end: n.expression.callee.object.end, text: "router" });
  refs(n, (id, parent) => {
    if (usesDirname && id.name === "__dirname") {
      edits.push({ start: id.start, end: id.end, text: "ROOT_DIR" });
      return;
    }
    if (!deps.has(id.name)) return;
    if (parent?.type === "Property" && parent.shorthand) {
      edits.push({ start: parent.start, end: parent.end, text: `${id.name}: ctx.${id.name}` });
    } else {
      edits.push({ start: id.start, end: id.end, text: `ctx.${id.name}` });
    }
  });
}
const sliceWithEdits = (n) => {
  // include comment lines directly above
  let s = n.start;
  const lines = text.slice(0, s).split("\n");
  let k = lines.length - 1;
  while (k > 0 && /^\s*\/\//.test(lines[k - 1])) k -= 1;
  const commentStart = lines.slice(0, k).join("\n").length + (k > 0 ? 1 : 0);
  const own = edits.filter((e) => e.start >= n.start && e.end <= n.end).sort((a, b) => b.start - a.start);
  let src = text.slice(n.start, n.end);
  for (const e of own) src = src.slice(0, e.start - n.start) + e.text + src.slice(e.end - n.start);
  return { lead: text.slice(commentStart, n.start), src, commentStart };
};

const relFromModule = (source) => {
  if (!source.startsWith(".")) return source;
  const abs = path.resolve(source);
  let rel = path.relative(path.dirname(path.resolve(modulePath)), abs);
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
};
const bySource = new Map();
for (const [local, { source, imported }] of needImports) {
  const src = relFromModule(source);
  if (!bySource.has(src)) bySource.set(src, { def: null, ns: null, named: [] });
  const e = bySource.get(src);
  if (imported === "default") e.def = local;
  else if (imported === "*") e.ns = local;
  else e.named.push(imported === local ? local : `${imported} as ${local}`);
}
if (!bySource.has("express")) bySource.set("express", { def: "express", ns: null, named: [] });
else bySource.get("express").def = "express";
const importLines = [...bySource.entries()].map(([src, e]) => {
  const parts = [];
  if (e.def) parts.push(e.def);
  if (e.ns) parts.push(`* as ${e.ns}`);
  if (e.named.length) parts.push(`{ ${e.named.join(", ")} }`);
  return `import ${parts.join(", ")} from "${src}";`;
});

const declParts = [];
const routeParts = [];
for (const n of moved) {
  const { lead, src } = sliceWithEdits(n);
  if (isRoute(n)) routeParts.push(`${lead}${src}`.replace(/^/gm, "  "));
  else {
    const exported = (n.type === "FunctionDeclaration" && usedOutside.has(n.id.name)) ||
      (n.type === "VariableDeclaration" && n.declarations.some((d) => usedOutside.has(d.id.name)));
    declParts.push(`${lead}${exported ? "export " : ""}${src}`);
  }
}
const depList = [...deps].sort();
const header = fs.existsSync(`${modulePath}.header`) ? fs.readFileSync(`${modulePath}.header`, "utf8") : `// ${modulePath}\n`;
const moduleSrc = `${header}
${importLines.join("\n")}

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

${declParts.join("\n\n")}

export function ${factory}(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
${routeParts.join("\n\n")}
  return router;
}
`;
fs.writeFileSync(modulePath, moduleSrc);

// Rewrite server.js: remove moved statements; mount at the first route.
const firstRoute = block.find(isRoute) || block[0];
const removals = moved.map((n) => {
  const { commentStart } = sliceWithEdits(n);
  let end = n.end;
  while (text[end] === "\n" && text[end + 1] === "\n") end += 1;
  if (text[end] === "\n") end += 1;
  return { start: commentStart, end, n };
}).sort((a, b) => b.start - a.start);
const importPath = `./${modulePath}`;
const mount = `app.use(\n  ${factory}({${depList.length ? `\n${depList.map((d) => `    ${d},`).join("\n")}\n  ` : ""}}),\n);\n\n`;
let out = text;
for (const r of removals) {
  out = out.slice(0, r.start) + (r.n === firstRoute ? mount : "") + out.slice(r.end);
}
const exportedNames = [...usedOutside].sort();
const importStmt = `import { ${[factory, ...exportedNames].join(", ")} } from "${importPath}";\n`;
out = out.replace('import { createHqRouter } from "./server/hq.js";', `${importStmt}import { createHqRouter } from "./server/hq.js";`);
fs.writeFileSync("server.js", out);
console.log(`wrote ${modulePath} and mounted ${factory} in server.js`);
