// scripts/interest-report.js
// Prints an email-capture interest report grouped by source label
// (e.g. "segment:breeders" from a kit-interest form) so we can see which
// segment landing pages are generating demand. Degrades gracefully: if
// DATABASE_URL is missing or the tables aren't migrated, it explains and
// exits 0 (never a hard failure in CI).
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { dbQuery } from "../db.js";
import { summarizeInterest } from "../src/interest-report.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export async function loadCaptureEvents() {
  const res = await dbQuery(
    "SELECT data FROM email_events WHERE type = 'cart_captured'",
  );
  return (res?.rows || []).map((r) => ({ source: r?.data?.source }));
}

export async function main() {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    console.log(
      "[interest] DATABASE_URL not set — skipping (no data to report yet).",
    );
    return;
  }

  let events;
  try {
    events = await loadCaptureEvents();
  } catch (err) {
    console.log(
      "[interest] could not read email_events (run the data-stitch migration first):",
      String(err?.message || err),
    );
    return;
  }

  const report = summarizeInterest(events);
  console.log("[interest] Email captures by source");
  for (const { source, count } of report.bySource) {
    console.log(`  ${source}: ${count}`);
  }
  console.log(`  TOTAL: ${report.total}`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main().catch((err) => {
    console.error("Interest report failed:", err);
    process.exit(1);
  });
}
