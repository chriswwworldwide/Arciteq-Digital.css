import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { dbQuery } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const dryRun = process.env.DRY_RUN !== "false";
const maxAgeDays = Number(process.env.RECOVERY_MAX_AGE_DAYS || 7);
const nudge1Days = Number(process.env.NUDGE_1_DAYS || 1);
const nudge2Days = Number(process.env.NUDGE_2_DAYS || 7);

export function loadProductsMap() {
  const file = path.join(__dirname, "..", "data", "products.json");
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed?.products) ? parsed.products : [];
  const map = new Map();
  for (const p of list) {
    map.set(String(p.productId), p);
  }
  return map;
}

export function getNudgeWindowMs(nudgeCount) {
  if (nudgeCount === 0) return nudge1Days * 24 * 60 * 60 * 1000;
  if (nudgeCount === 1) return nudge2Days * 24 * 60 * 60 * 1000;
  return Infinity;
}

export function buildRecoveryEmail(items, products, nudgeCount) {
  const lines = items
    .map((i) => {
      const pid = String(i?.id || "");
      const qty = Number(i?.qty || 1);
      const p = products.get(pid);
      if (!p) return null;
      const price = Number(p?.price?.amount || 0);
      const currency = String(p?.price?.currency || "").toUpperCase();
      const lineTotal = ((price * qty) / 100).toFixed(2);
      return `${qty}x ${p.title} — ${lineTotal} ${currency}`;
    })
    .filter(Boolean);

  const subject =
    nudgeCount === 0
      ? "You left something behind for your pet"
      : "Your pet's cart is still waiting — last chance";

  const body =
    nudgeCount === 0
      ? [
          "Hi,",
          "You started shopping but didn't finish. Here's what you left in your cart:",
          "",
          ...lines,
          "",
          "Come back and complete your order: http://localhost:3000/cart.html",
          "",
          "If you have questions, reply to this email.",
        ].join("\n")
      : [
          "Hi,",
          "We noticed you still haven't completed your order. Here's what's waiting:",
          "",
          ...lines,
          "",
          "This is a friendly last nudge before your cart is cleared.",
          "Return to your cart: http://localhost:3000/cart.html",
          "",
          "Need help? Just reply to this email.",
        ].join("\n");

  return { subject, body };
}

async function main() {
  const products = loadProductsMap();
  const maxAge = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { rows } = await dbQuery(
    `SELECT id, tenant_id, email, cart, nudge_count, last_nudged_at, created_at
     FROM cart_emails
     WHERE status = 'active'
       AND nudge_count < 2
       AND created_at >= $1
     ORDER BY created_at ASC
     LIMIT 100`,
    [maxAge],
  );

  let processed = 0;

  for (const row of rows) {
    const nudgeCount = Number(row.nudge_count || 0);
    const lastNudged = new Date(row.last_nudged_at || row.created_at).getTime();
    const windowMs = getNudgeWindowMs(nudgeCount);
    const dueAt = lastNudged + windowMs;

    if (Date.now() < dueAt) continue;

    const items = Array.isArray(row.cart) ? row.cart : [];
    const { subject, body } = buildRecoveryEmail(items, products, nudgeCount);

    console.log("---");
    console.log(`To: ${row.email}`);
    console.log(`Subject: ${subject}`);
    console.log(body);
    console.log("---");

    if (!dryRun) {
      const nextCount = nudgeCount + 1;
      const nextStatus = nudgeCount === 0 ? "active" : "nudged_2";
      const statusLabel =
        nudgeCount === 0 ? "nudged_1 (still active)" : "nudged_2";
      await dbQuery(
        `UPDATE cart_emails
         SET nudge_count = $1, last_nudged_at = now(), status = $2, updated_at = now()
         WHERE id = $3`,
        [nextCount, nextStatus, row.id],
      );
      console.log(`Marked cart_email ${row.id} as ${statusLabel}.`);
    }

    processed++;
  }

  console.log(`Processed ${processed} abandoned cart nudge(s).`);
  process.exit(0);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  main().catch((err) => {
    console.error("Abandoned cart recovery failed:", err);
    process.exit(1);
  });
}
