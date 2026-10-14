// tools/route-snapshot.js
// Preload for refactor safety: `node --import ./tools/route-snapshot.js server.js`
// Instead of listening, the app writes its full route/middleware order to
// ROUTE_SNAPSHOT_OUT (default /tmp/routes.txt) and exits. Routers are
// flattened, so moving routes into a module mounted at the same position
// produces an identical list — any reordering or loss shows up as a diff.

import fs from "node:fs";
import express from "express";

const out = process.env.ROUTE_SNAPSHOT_OUT || "/tmp/routes.txt";

function flatten(stack, lines) {
  for (const layer of stack || []) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {})
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase())
        .sort()
        .join(",");
      const handlers = (layer.route.stack || []).length;
      lines.push(`ROUTE ${methods} ${layer.route.path} (${handlers} handlers)`);
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      flatten(layer.handle.stack, lines);
    } else {
      lines.push(`USE ${layer.name || "<anonymous>"}`);
    }
  }
}

express.application.listen = function snapshotInsteadOfListen() {
  const lines = [];
  flatten(this.router?.stack, lines);
  fs.writeFileSync(out, `${lines.join("\n")}\n`);
  console.log(`route snapshot: ${lines.length} entries → ${out}`);
  process.exit(0);
};
