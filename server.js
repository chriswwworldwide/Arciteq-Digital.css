// server.js — Express local preview for index.html
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.disable("x-powered-by");

// 🔒 Never expose archives, backups, dependency trees or repo metadata.
const BLOCKED_PATHS = [
  /(^|\/)backups(\/|$)/i,
  /(^|\/)backups_cleanup(\/|$)/i,
  /(^|\/)public_backup[^/]*(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)server(\/|$)/i,
  /(^|\/)middleware(\/|$)/i,
  /(^|\/)scripts(\/|$)/i,
  /(^|\/)api(\/|$)/i,
  /(^|\/)admin(\/|$)/i,
  /\.(tar\.gz|tgz|zip|env|pem|key|log)$/i,
  /(^|\/)(package(-lock)?\.json|tsconfig\.json|Procfile|Makefile|docker-compose\.yml|render\.yaml)$/i,
  /(^|\/)\.DS_Store$/i,
];

app.use((req, res, next) => {
  const decodedPath = (() => {
    try {
      return decodeURIComponent(req.path);
    } catch {
      return req.path;
    }
  })();

  if (BLOCKED_PATHS.some((pattern) => pattern.test(decodedPath))) {
    return res.status(404).type("text/plain").send("Not found");
  }
  next();
});

// 🔒 Baseline response hardening for the preview server.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// 🚫 Disable all browser caching during local development
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ✅ Serve the static site (dotfiles such as .env and .git are never served)
app.use(
  express.static(__dirname, {
    dotfiles: "deny",
    index: false,
    redirect: false,
  }),
);

// ✅ When you visit http://localhost:3000/ or /index.html, serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}/`);
});
