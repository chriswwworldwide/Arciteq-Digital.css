// scripts/backup-db.js
// Nightly-friendly database backup: pg_dump → backups/roxjaya-YYYY-MM-DD.sql.gz,
// keeping the last 35 days. Usage: `npm run backup` (reads DATABASE_URL from
// .env.local / .env). The backups/ folder is gitignored and blocked from the
// website. For production, also switch on the host's own database backups
// and copy these files somewhere off the server.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
dotenv.config({ path: path.join(root, ".env"), quiet: true });

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS || 35);
const dir = path.resolve(root, process.env.BACKUP_DIR || "backups");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

const pgDump = [
  process.env.PG_DUMP_PATH,
  "/opt/homebrew/opt/postgresql@17/bin/pg_dump",
  "/usr/local/opt/postgresql@17/bin/pg_dump",
  "pg_dump",
].find((p) => p && (p === "pg_dump" || fs.existsSync(p)));

const stamp = new Date().toISOString().slice(0, 10);
const file = path.join(dir, `roxjaya-${stamp}.sql.gz`);
const tmp = `${file}.partial`;

const child = spawn(pgDump, ["--no-owner", "--no-privileges", databaseUrl], {
  stdio: ["ignore", "pipe", "inherit"],
});
const exited = new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("close", (code) =>
    code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}`)),
  );
});

try {
  await Promise.all([
    pipeline(child.stdout, createGzip(), fs.createWriteStream(tmp, { mode: 0o600 })),
    exited,
  ]);
  fs.renameSync(tmp, file);
  const size = fs.statSync(file).size;
  console.log(`Backup written: ${path.relative(root, file)} (${Math.round(size / 1024)} KB)`);

  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  for (const name of fs.readdirSync(dir)) {
    if (!/^roxjaya-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full);
      console.log(`Removed old backup: ${name}`);
    }
  }
} catch (err) {
  fs.rmSync(tmp, { force: true });
  console.error(`Backup failed: ${err.message}`);
  if (err.code === "ENOENT") {
    console.error("pg_dump not found — install PostgreSQL client tools or set PG_DUMP_PATH.");
  }
  process.exit(1);
}
