// scripts/attribution-report.js
// Prints a nudge -> conversion attribution report from the stitched tables.
// Degrades gracefully: if DATABASE_URL is missing or the data-stitch tables
// aren't migrated yet, it explains and exits 0 (never a hard failure in CI).
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { dbQuery } from "../db.js";
import {
  buildAttributionReport,
  buildExperimentReport,
  formatMinor,
  NUDGE_TYPES,
} from "../src/attribution.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export async function loadAttributionInputs() {
  const sent = await dbQuery(
    "SELECT nudge_type FROM email_events WHERE type = 'nudge_sent'",
  );
  const conv = await dbQuery(
    `SELECT ce.last_nudge_type AS nudge_type, o.amount_total AS amount_minor
       FROM cart_emails ce
       JOIN orders o ON o.order_id = ce.converted_order_id
      WHERE ce.converted_at IS NOT NULL`,
  );
  return {
    nudgeEvents: sent.rows.map((r) => ({ nudgeType: r.nudge_type })),
    conversions: conv.rows.map((r) => ({
      nudgeType: r.nudge_type,
      amountMinor: r.amount_minor,
    })),
  };
}

export async function loadExperimentInputs() {
  // One exposure row per (email, experiment) captured in the funnel, and one
  // conversion row per converted cart × the experiments recorded at capture.
  const exposures = await dbQuery(
    `SELECT DISTINCT ee.email, kv.key AS experiment_key, kv.value AS variant
       FROM email_events ee,
            LATERAL jsonb_each_text(ee.data->'experiments') kv
      WHERE ee.type = 'cart_captured'
        AND ee.data ? 'experiments'`,
  );
  const conversions = await dbQuery(
    `SELECT DISTINCT ce.converted_order_id, kv.key AS experiment_key,
            kv.value AS variant, o.amount_total AS amount_minor
       FROM cart_emails ce
       JOIN orders o ON o.order_id = ce.converted_order_id
       JOIN email_events ee
         ON ee.email = ce.email
        AND ee.type = 'cart_captured'
        AND ee.data ? 'experiments',
            LATERAL jsonb_each_text(ee.data->'experiments') kv
      WHERE ce.converted_at IS NOT NULL`,
  );
  return {
    exposures: exposures.rows.map((r) => ({
      experimentKey: r.experiment_key,
      variant: r.variant,
    })),
    conversions: conversions.rows.map((r) => ({
      experimentKey: r.experiment_key,
      variant: r.variant,
      amountMinor: r.amount_minor,
    })),
  };
}

function printExperimentReport(report) {
  const keys = Object.keys(report.byExperiment);
  if (keys.length === 0) {
    console.log("  (no A/B exposures recorded yet)");
    return;
  }
  for (const key of keys) {
    console.log(`  ${key}:`);
    const variants = report.byExperiment[key].variants;
    for (const v of Object.keys(variants)) {
      const b = variants[v];
      const pct = (b.conversionRate * 100).toFixed(1);
      console.log(
        `    ${v}: exposed=${b.exposed} converted=${b.converted} (${pct}%) revenue=${formatMinor(b.revenueMinor)}`,
      );
    }
  }
}

export async function main() {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    console.log(
      "[attribution] DATABASE_URL not set — skipping (no data to report yet).",
    );
    return;
  }

  let inputs;
  try {
    inputs = await loadAttributionInputs();
  } catch (err) {
    console.log(
      "[attribution] could not read stitched tables (run the data-stitch migration first):",
      String(err?.message || err),
    );
    return;
  }

  const report = buildAttributionReport(inputs);
  console.log("[attribution] Nudge -> conversion (last-touch)");
  for (const t of NUDGE_TYPES) {
    const b = report.byNudgeType[t];
    const pct = (b.conversionRate * 100).toFixed(1);
    console.log(
      `  ${t}: sent=${b.sent} converted=${b.converted} (${pct}%) revenue=${formatMinor(b.revenueMinor)}`,
    );
  }
  console.log(
    `  organic (no nudge): converted=${report.organic.converted} revenue=${formatMinor(report.organic.revenueMinor)}`,
  );
  console.log(
    `  TOTAL: converted=${report.totals.totalConverted} revenue=${formatMinor(report.totals.totalRevenueMinor)}`,
  );

  try {
    const expInputs = await loadExperimentInputs();
    const expReport = buildExperimentReport(expInputs);
    console.log("\n[attribution] A/B variant -> conversion (last-touch)");
    printExperimentReport(expReport);
  } catch (err) {
    console.log(
      "[attribution] could not read A/B exposures:",
      String(err?.message || err),
    );
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main().catch((err) => {
    console.error("Attribution report failed:", err);
    process.exit(1);
  });
}
