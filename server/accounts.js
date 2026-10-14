// server/accounts.js
// A coach/gym's own books, shown on their desk's Money page: money in and
// out, bank-transfer reservations to confirm, a monthly picture, the
// country tax guide (Indonesia PPh Final UMKM / UK VAT + MTD) and an
// accountant-ready CSV. Paid site orders are included live from `orders`.
// Access: requireDeskAccess — a coach's key only ever sees their own site.

import express from "express";
import {
  accountingProfile,
  idPphFinal,
  ukTaxYear,
  nextMtdDeadline,
  gbVatStatus,
  mtdThresholdFor,
  TAX_RULES_CHECKED,
  ID_RULES,
  GB_RULES,
  RETENTION_RULES,
  ukKeepUntil,
  idKeepUntil,
} from "../src/tax-rules.js";
import { buildImportRows, importFingerprint } from "../src/csv-import.js";

export const INCOME_CATEGORIES = [
  "membership",
  "coaching",
  "class_pass",
  "event",
  "merch",
  "sponsorship",
  "other_income",
];
export const EXPENSE_CATEGORIES = [
  "venue",
  "equipment",
  "travel",
  "race_fees",
  "marketing",
  "software",
  "staff",
  "other_expense",
];
export const METHODS = [
  "qris",
  "bank_transfer",
  "cash",
  "card",
  "direct_debit",
  "stripe",
  "other",
];

const isoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
// submissions.id is a uuid.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const clean = (v, max) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

// Validates a new ledger entry. Returns { entry } or { error }.
export function validateEntry(body, { currency }) {
  const b = body && typeof body === "object" ? body : {};
  if (b.direction !== "income" && b.direction !== "expense") {
    return { error: "direction must be income or expense" };
  }
  const direction = b.direction;
  const allowed = direction === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!allowed.includes(b.category)) return { error: "invalid category" };
  if (!isoDate(b.entry_date)) return { error: "entry_date must be YYYY-MM-DD" };
  const amount = Math.round(Number(b.amount_minor));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "amount must be more than zero" };
  }
  const tax = b.tax_minor === undefined || b.tax_minor === null || b.tax_minor === ""
    ? 0
    : Math.round(Number(b.tax_minor));
  if (!Number.isFinite(tax) || tax < 0 || tax > amount) {
    return { error: "tax must be between zero and the amount" };
  }
  const method = b.method ? String(b.method) : null;
  if (method && !METHODS.includes(method)) return { error: "invalid method" };
  return {
    entry: {
      direction,
      category: b.category,
      entry_date: b.entry_date,
      amount_minor: amount,
      tax_minor: tax,
      method,
      description: clean(b.description, 300),
      counterparty: clean(b.counterparty, 120),
      reference: clean(b.reference, 80),
      currency,
    },
  };
}

// Amount from a bank-transfer reservation payload, in minor units.
export function reservationAmountMinor(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const key = ["amount_idr", "amount_gbp", "amount"].find(
    (k) => Number.isFinite(Number(p[k])) && Number(p[k]) > 0,
  );
  return key ? Math.round(Number(p[key]) * 100) : null;
}

// CSV cell: quoted, and neutralised against spreadsheet formula injection.
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}

// Column choices from the review screen: whole numbers ≥ -1 only.
function sanitiseMapping(m) {
  const col = (v) => (Number.isInteger(Number(v)) && Number(v) >= -1 && Number(v) < 200 ? Number(v) : -1);
  return {
    date: col(m.date),
    description: col(m.description),
    amount: col(m.amount),
    credit: col(m.credit),
    debit: col(m.debit),
    flow: col(m.flow),
  };
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

const majorUnits = (minor, currency) => {
  const n = Number(minor || 0) / 100;
  return String(currency).toLowerCase() === "idr" ? String(Math.round(n)) : n.toFixed(2);
};

// Record-keeping picture for the Money page: which years can be downloaded,
// the country's keeping rule, and whether the owner has saved their own
// copy of the last finished period. Pure so it can be unit-tested.
export function recordsInfo({ country, firstDate, today, exports }) {
  const nowYear = Number(today.slice(0, 4));
  const firstYear = firstDate ? Number(String(firstDate).slice(0, 4)) : nowYear;
  const years = [];
  for (let y = nowYear; y >= Math.min(firstYear, nowYear); y -= 1) years.push(y);

  const covered = (from, to) =>
    exports.some((e) => e.role === "coach" && String(e.period_from) <= from && String(e.period_to) >= to);

  let lastPeriod = null;
  let retention = null;
  if (country === "ID") {
    const y = nowYear - 1;
    lastPeriod = { label: String(y), from: `${y}-01-01`, to: `${y}-12-31` };
    retention = {
      years: RETENTION_RULES.ID.years,
      keepInCountry: true,
      keepUntil: idKeepUntil(y),
      sources: RETENTION_RULES.ID.sources,
    };
  } else if (country === "GB") {
    const ty = ukTaxYear(today);
    const start = Number(ty.start.slice(0, 4)) - 1;
    lastPeriod = {
      label: `${start}/${String(start + 1).slice(2)} tax year`,
      from: `${start}-04-06`,
      to: `${start + 1}-04-05`,
    };
    retention = {
      years: RETENTION_RULES.GB.years,
      keepUntil: ukKeepUntil(start),
      sources: RETENTION_RULES.GB.sources,
    };
  }
  const hadRecords = Boolean(firstDate) && lastPeriod && String(firstDate) <= lastPeriod.to;
  return {
    first_date: firstDate || null,
    years,
    retention,
    last_period: lastPeriod,
    needs_saving: Boolean(hadRecords && !covered(lastPeriod.from, lastPeriod.to)),
  };
}

export function createAccountsRouter({ dbQuery, requireDeskAccess, ensureTables }) {
  const router = express.Router();

  async function firstRecordDate(tenantId, currency) {
    const r = await dbQuery(
      `SELECT to_char(LEAST(
          (SELECT MIN(entry_date) FROM ledger_entries WHERE tenant_id = $1 AND currency = $2 AND voided_at IS NULL),
          (SELECT MIN(created_at)::date FROM orders WHERE tenant_id = $1 AND currency = $2 AND status = 'paid')
        ), 'YYYY-MM-DD') AS first`,
      [tenantId, currency],
    );
    return r.rows?.[0]?.first || null;
  }

  // Every route: resolve the caller's site, never trust a client tenant.
  const withAccess = (handler) => async (req, res) => {
    try {
      await ensureTables();
      const access = await requireDeskAccess(req, res);
      if (!access) return undefined;
      res.setHeader("X-Robots-Tag", "noindex");
      const tenantId = String(access.tenant.tenant_id);
      const profile = accountingProfile(access.tenant);
      return await handler(req, res, { ...access, tenantId, profile });
    } catch (err) {
      console.error("accounts route failed", req.path, err);
      return res.status(500).json({ error: "Something went wrong" });
    }
  };

  // Income/expense/tax totals between two dates (from inclusive, to exclusive).
  async function totalsBetween(tenantId, currency, from, to) {
    const [ledger, orders] = await Promise.all([
      dbQuery(
        `SELECT direction, COALESCE(SUM(amount_minor),0)::bigint AS amount, COALESCE(SUM(tax_minor),0)::bigint AS tax
           FROM ledger_entries
          WHERE tenant_id = $1 AND currency = $2 AND voided_at IS NULL
            AND entry_date >= $3::date AND entry_date < $4::date
          GROUP BY direction`,
        [tenantId, currency, from, to],
      ),
      dbQuery(
        `SELECT COALESCE(SUM(amount_total),0)::bigint AS amount, COALESCE(SUM(amount_tax),0)::bigint AS tax
           FROM orders
          WHERE tenant_id = $1 AND currency = $2 AND status = 'paid'
            AND created_at >= $3::date AND created_at < $4::date`,
        [tenantId, currency, from, to],
      ),
    ]);
    const out = { income: 0, expense: 0, tax: 0 };
    for (const r of ledger.rows || []) {
      out[r.direction] += Number(r.amount);
      if (r.direction === "income") out.tax += Number(r.tax);
    }
    out.income += Number(orders.rows?.[0]?.amount || 0);
    out.tax += Number(orders.rows?.[0]?.tax || 0);
    return out;
  }

  router.get(
    "/desk/accounts/overview",
    withAccess(async (req, res, { tenantId, tenant, profile, role }) => {
      const nowIso = new Date().toISOString().slice(0, 10);
      const year = /^\d{4}$/.test(String(req.query?.year || ""))
        ? Number(req.query.year)
        : Number(nowIso.slice(0, 4));
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
      const cur = profile.currency;

      const [ledgerMonths, orderMonths, cats, pending] = await Promise.all([
        dbQuery(
          `SELECT EXTRACT(MONTH FROM entry_date)::int AS m, direction,
                  SUM(amount_minor)::bigint AS amount, SUM(tax_minor)::bigint AS tax
             FROM ledger_entries
            WHERE tenant_id = $1 AND currency = $2 AND voided_at IS NULL
              AND entry_date >= $3::date AND entry_date < $4::date
            GROUP BY 1, 2`,
          [tenantId, cur, from, to],
        ),
        dbQuery(
          `SELECT EXTRACT(MONTH FROM created_at)::int AS m,
                  SUM(amount_total)::bigint AS amount, SUM(COALESCE(amount_tax,0))::bigint AS tax
             FROM orders
            WHERE tenant_id = $1 AND currency = $2 AND status = 'paid'
              AND created_at >= $3::date AND created_at < $4::date
            GROUP BY 1`,
          [tenantId, cur, from, to],
        ),
        dbQuery(
          `SELECT direction, category, SUM(amount_minor)::bigint AS amount
             FROM ledger_entries
            WHERE tenant_id = $1 AND currency = $2 AND voided_at IS NULL
              AND entry_date >= $3::date AND entry_date < $4::date
            GROUP BY 1, 2 ORDER BY 3 DESC`,
          [tenantId, cur, from, to],
        ),
        dbQuery(
          `SELECT COUNT(*)::int AS n FROM submissions s
            WHERE s.tenant_id = $1 AND s.kind = 'bank_transfer'
              AND s.created_at > now() - interval '180 days'
              AND NOT EXISTS (SELECT 1 FROM submission_reviews r
                               WHERE r.tenant_id = s.tenant_id AND r.submission_id = s.id)`,
          [tenantId],
        ),
      ]);

      const months = Array.from({ length: 12 }, (_, i) => ({
        month: `${year}-${String(i + 1).padStart(2, "0")}`,
        income: 0,
        siteSales: 0,
        expense: 0,
        tax: 0,
      }));
      for (const r of ledgerMonths.rows || []) {
        const m = months[r.m - 1];
        m[r.direction] += Number(r.amount);
        if (r.direction === "income") m.tax += Number(r.tax);
      }
      for (const r of orderMonths.rows || []) {
        const m = months[r.m - 1];
        m.siteSales += Number(r.amount);
        m.tax += Number(r.tax);
      }
      const categories = (cats.rows || []).map((r) => ({
        direction: r.direction,
        category: r.category,
        amount: Number(r.amount),
      }));
      const siteSalesTotal = months.reduce((s, m) => s + m.siteSales, 0);
      if (siteSalesTotal) {
        categories.push({ direction: "income", category: "site_sales", amount: siteSalesTotal });
      }
      const totals = months.reduce(
        (t, m) => ({
          income: t.income + m.income + m.siteSales,
          expense: t.expense + m.expense,
        }),
        { income: 0, expense: 0 },
      );

      let tax = { country: profile.country || null, checked: TAX_RULES_CHECKED };
      if (profile.country === "ID") {
        tax = {
          ...tax,
          scheme: "pph_final_umkm",
          taxpayer: profile.taxpayer,
          rate: ID_RULES.rate,
          sources: ID_RULES.sources,
          ...idPphFinal({
            year,
            monthlyGrossMinor: months.map((m) => m.income + m.siteSales),
            taxpayer: profile.taxpayer,
          }),
        };
      } else if (profile.country === "GB") {
        const ty = ukTaxYear(nowIso);
        const rollingFrom = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
        const [rolling, taxYear] = await Promise.all([
          totalsBetween(tenantId, cur, rollingFrom, tomorrow),
          totalsBetween(tenantId, cur, ty.start, tomorrow),
        ]);
        tax = {
          ...tax,
          vatRegistered: profile.vatRegistered,
          vat: profile.vatRegistered
            ? { collectedThisTaxYearMinor: taxYear.tax }
            : gbVatStatus(rolling.income),
          taxYear: {
            ...ty,
            incomeMinor: taxYear.income,
            expenseMinor: taxYear.expense,
            profitMinor: taxYear.income - taxYear.expense,
          },
          mtd: {
            thresholdMinor: mtdThresholdFor(ty.start),
            nextDeadline: nextMtdDeadline(nowIso),
            thresholds: GB_RULES.mtdThresholds,
          },
          sources: GB_RULES.sources,
        };
      }

      return res.json({
        ok: true,
        tenant_id: tenantId,
        brand: String(tenant?.seo?.brandName || tenantId),
        role,
        currency: cur,
        year,
        months,
        totals: { ...totals, profit: totals.income - totals.expense },
        categories,
        pending_payments: pending.rows?.[0]?.n || 0,
        records: recordsInfo({
          country: profile.country,
          firstDate: await firstRecordDate(tenantId, cur),
          today: nowIso,
          exports: (
            await dbQuery(
              "SELECT to_char(period_from, 'YYYY-MM-DD') AS period_from, to_char(period_to, 'YYYY-MM-DD') AS period_to, role FROM ledger_exports WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200",
              [tenantId],
            )
          ).rows || [],
        }),
        tax,
      });
    }),
  );

  router.get(
    "/desk/accounts/entries",
    withAccess(async (req, res, { tenantId, profile }) => {
      const from = isoDate(req.query?.from) ? req.query.from : "1900-01-01";
      const to = isoDate(req.query?.to) ? req.query.to : "9999-12-31";
      const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));
      const result = await dbQuery(
        `SELECT * FROM (
           SELECT 'ledger' AS source_table, id::text AS id, entry_date, direction, category,
                  description, counterparty, amount_minor, tax_minor, method, reference, source
             FROM ledger_entries
            WHERE tenant_id = $1 AND currency = $2 AND voided_at IS NULL
              AND entry_date BETWEEN $3::date AND $4::date
           UNION ALL
           SELECT 'order', order_id, created_at::date, 'income', 'site_sales',
                  'Website order', customer_email, amount_total, COALESCE(amount_tax,0),
                  'stripe', order_id, 'site'
             FROM orders
            WHERE tenant_id = $1 AND currency = $2 AND status = 'paid'
              AND created_at::date BETWEEN $3::date AND $4::date
         ) x
         ORDER BY entry_date DESC, id DESC
         LIMIT $5`,
        [tenantId, profile.currency, from, to, limit],
      );
      return res.json({ ok: true, currency: profile.currency, entries: result.rows });
    }),
  );

  router.post(
    "/desk/accounts/entries",
    withAccess(async (req, res, { tenantId, profile }) => {
      const checked = validateEntry(req.body, { currency: profile.currency });
      if (checked.error) return res.status(400).json({ error: checked.error });
      const e = checked.entry;
      const result = await dbQuery(
        `INSERT INTO ledger_entries
           (tenant_id, entry_date, direction, category, description, counterparty,
            amount_minor, tax_minor, currency, method, reference, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual') RETURNING id`,
        [
          tenantId, e.entry_date, e.direction, e.category, e.description, e.counterparty,
          e.amount_minor, e.tax_minor, e.currency, e.method, e.reference,
        ],
      );
      return res.json({ ok: true, id: result.rows?.[0]?.id });
    }),
  );

  router.post(
    "/desk/accounts/entries/:id/void",
    withAccess(async (req, res, { tenantId }) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
      const reason = clean(req.body?.reason, 200) || "voided";
      const voided = await dbQuery(
        `UPDATE ledger_entries SET voided_at = now(), void_reason = $3
          WHERE id = $1 AND tenant_id = $2 AND voided_at IS NULL
          RETURNING submission_id`,
        [id, tenantId, reason],
      );
      const row = voided.rows?.[0];
      if (!row) return res.status(404).json({ error: "Entry not found" });
      // A voided confirmation puts the reservation back on the to-confirm list.
      if (row.submission_id) {
        await dbQuery(
          "DELETE FROM submission_reviews WHERE tenant_id = $1 AND submission_id = $2",
          [tenantId, row.submission_id],
        );
      }
      return res.json({ ok: true });
    }),
  );

  router.get(
    "/desk/accounts/pending-payments",
    withAccess(async (req, res, { tenantId, profile }) => {
      const result = await dbQuery(
        `SELECT s.id, s.email, s.payload, s.created_at FROM submissions s
          WHERE s.tenant_id = $1 AND s.kind = 'bank_transfer'
            AND s.created_at > now() - interval '180 days'
            AND NOT EXISTS (SELECT 1 FROM submission_reviews r
                             WHERE r.tenant_id = s.tenant_id AND r.submission_id = s.id)
          ORDER BY s.created_at DESC LIMIT 100`,
        [tenantId],
      );
      const items = (result.rows || []).map((s) => {
        const p = s.payload && typeof s.payload === "object" ? s.payload : {};
        return {
          id: s.id,
          created_at: s.created_at,
          email: s.email,
          name: String(p.name || ""),
          whatsapp: String(p.whatsapp || ""),
          plan: String(p.plan_name || ""),
          reference: String(p.reference || ""),
          note: String(p.note || ""),
          amount_minor: reservationAmountMinor(p),
        };
      });
      return res.json({ ok: true, currency: profile.currency, items });
    }),
  );

  router.post(
    "/desk/accounts/pending-payments/:id/:decision",
    withAccess(async (req, res, { tenantId, profile }) => {
      const id = String(req.params.id || "").toLowerCase();
      const decision = req.params.decision;
      if (!UUID_RE.test(id) || !["confirm", "dismiss"].includes(decision)) {
        return res.status(400).json({ error: "bad request" });
      }
      const sub = await dbQuery(
        "SELECT id, email, payload FROM submissions WHERE id = $1 AND tenant_id = $2 AND kind = 'bank_transfer'",
        [id, tenantId],
      );
      const s = sub.rows?.[0];
      if (!s) return res.status(404).json({ error: "Reservation not found" });

      const claimed = await dbQuery(
        `INSERT INTO submission_reviews (tenant_id, submission_id, status)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING submission_id`,
        [tenantId, id, decision === "confirm" ? "confirmed" : "dismissed"],
      );
      if (!claimed.rows?.[0]) {
        return res.status(409).json({ error: "Already handled" });
      }
      if (decision === "dismiss") return res.json({ ok: true });

      const p = s.payload && typeof s.payload === "object" ? s.payload : {};
      const amount = Math.round(Number(req.body?.amount_minor)) || reservationAmountMinor(p);
      const date = isoDate(req.body?.entry_date)
        ? req.body.entry_date
        : new Date().toISOString().slice(0, 10);
      const method = METHODS.includes(req.body?.method) ? req.body.method : "bank_transfer";
      if (!amount || amount <= 0) {
        await dbQuery(
          "DELETE FROM submission_reviews WHERE tenant_id = $1 AND submission_id = $2",
          [tenantId, id],
        );
        return res.status(400).json({ error: "Enter the amount received" });
      }
      try {
        const entry = await dbQuery(
          `INSERT INTO ledger_entries
             (tenant_id, entry_date, direction, category, description, counterparty,
              amount_minor, currency, method, reference, source, submission_id)
           VALUES ($1,$2,'income','membership',$3,$4,$5,$6,$7,$8,'reservation',$9)
           RETURNING id`,
          [
            tenantId,
            date,
            clean(p.plan_name, 300) || "Membership",
            clean(p.name || s.email, 120),
            amount,
            profile.currency,
            method,
            clean(p.reference, 80),
            id,
          ],
        );
        await dbQuery(
          "UPDATE submission_reviews SET entry_id = $3 WHERE tenant_id = $1 AND submission_id = $2",
          [tenantId, id, entry.rows?.[0]?.id],
        );
        return res.json({ ok: true, entry_id: entry.rows?.[0]?.id });
      } catch (err) {
        await dbQuery(
          "DELETE FROM submission_reviews WHERE tenant_id = $1 AND submission_id = $2",
          [tenantId, id],
        );
        throw err;
      }
    }),
  );

  // ---- Import from a bank statement / booking-app export -----------------
  // Re-run on both preview and commit: the server always re-parses the file
  // itself, so amounts can't be tampered with between the two steps.
  async function analyseImport({ tenantId, csv, mapping, order }) {
    const text = String(csv || "");
    if (!text.trim()) return { error: "Choose a CSV file first." };
    if (text.length > 1_800_000) return { error: "That file is too big — export a shorter date range." };
    const built = buildImportRows(text, {
      mapping: mapping && typeof mapping === "object" ? sanitiseMapping(mapping) : undefined,
      order: order === "mdy" || order === "dmy" ? order : undefined,
    });
    if (built.error) return built;
    const rows = built.rows.map((r) => ({
      ...r,
      import_hash: importFingerprint(tenantId, r, r.occurrence),
    }));
    if (!rows.length) return { ...built, rows: [] };

    const dates = rows.map((r) => r.date).sort();
    const [imported, manual, pending] = await Promise.all([
      dbQuery(
        `SELECT import_hash FROM ledger_entries
          WHERE tenant_id = $1 AND voided_at IS NULL AND import_hash = ANY($2::text[])`,
        [tenantId, rows.map((r) => r.import_hash)],
      ),
      dbQuery(
        `SELECT entry_date, direction, amount_minor FROM ledger_entries
          WHERE tenant_id = $1 AND voided_at IS NULL AND import_hash IS NULL
            AND entry_date BETWEEN $2::date AND $3::date`,
        [tenantId, dates[0], dates.at(-1)],
      ),
      dbQuery(
        `SELECT s.id, s.payload, s.email, s.created_at FROM submissions s
          WHERE s.tenant_id = $1 AND s.kind = 'bank_transfer'
            AND s.created_at > now() - interval '180 days'
            AND NOT EXISTS (SELECT 1 FROM submission_reviews r
                             WHERE r.tenant_id = s.tenant_id AND r.submission_id = s.id)`,
        [tenantId],
      ),
    ]);
    const importedSet = new Set((imported.rows || []).map((r) => r.import_hash));
    const manualCounts = new Map();
    for (const m of manual.rows || []) {
      const k = `${m.entry_date}|${m.direction}|${m.amount_minor}`;
      manualCounts.set(k, (manualCounts.get(k) || 0) + 1);
    }
    const reservations = (pending.rows || []).map((s) => {
      const p = s.payload && typeof s.payload === "object" ? s.payload : {};
      return {
        id: s.id,
        name: String(p.name || s.email || ""),
        plan: String(p.plan_name || ""),
        reference: String(p.reference || "").trim(),
        amount_minor: reservationAmountMinor(p),
        created: new Date(s.created_at).toISOString().slice(0, 10),
      };
    });
    const usedReservations = new Set();

    const analysed = rows.map((r) => {
      let status = "new";
      if (importedSet.has(r.import_hash)) status = "already_imported";
      else if (r.category === "site_payout") status = "stripe_payout";
      else {
        const k = `${r.date}|${r.direction}|${r.amount_minor}`;
        const n = manualCounts.get(k) || 0;
        if (n > 0) {
          status = "possible_duplicate";
          manualCounts.set(k, n - 1);
        }
      }
      let reservation = null;
      if (r.direction === "income" && status !== "already_imported") {
        const desc = r.description.toLowerCase();
        const sameAmount = reservations.filter(
          (x) => !usedReservations.has(x.id) && x.amount_minor === r.amount_minor,
        );
        const byRef = sameAmount.find((x) => x.reference && desc.includes(x.reference.toLowerCase()));
        const byDate = sameAmount.filter((x) => x.created <= r.date && daysBetween(x.created, r.date) <= 14);
        const pick = byRef || (byDate.length === 1 ? byDate[0] : null);
        if (pick) {
          usedReservations.add(pick.id);
          reservation = {
            id: pick.id,
            name: pick.name,
            plan: pick.plan,
            reference: pick.reference,
            strength: byRef ? "reference" : "amount_and_date",
          };
          // The bank row IS the reservation payment, not an extra one.
          if (status === "possible_duplicate") status = "new";
        }
      }
      return {
        line: r.line,
        date: r.date,
        description: r.description,
        direction: r.direction,
        amount_minor: r.amount_minor,
        category: r.category === "site_payout" ? "other_income" : r.category,
        status,
        include: status === "new",
        reservation,
        import_hash: r.import_hash,
      };
    });
    return {
      headers: built.headers,
      mapping: built.mapping,
      order: built.order,
      period: built.period,
      rows: analysed,
      skipped: built.skipped,
    };
  }

  router.post(
    "/desk/accounts/import/preview",
    withAccess(async (req, res, { tenantId, profile }) => {
      const result = await analyseImport({
        tenantId,
        csv: req.body?.csv,
        mapping: req.body?.mapping,
        order: req.body?.order,
      });
      if (result.error) return res.status(400).json({ error: result.error });
      return res.json({
        ok: true,
        currency: profile.currency,
        ...result,
        rows: result.rows.map(({ import_hash: _h, ...r }) => r),
      });
    }),
  );

  router.post(
    "/desk/accounts/import/commit",
    withAccess(async (req, res, { tenantId, profile }) => {
      const result = await analyseImport({
        tenantId,
        csv: req.body?.csv,
        mapping: req.body?.mapping,
        order: req.body?.order,
      });
      if (result.error) return res.status(400).json({ error: result.error });
      const method = METHODS.includes(req.body?.method) ? req.body.method : "bank_transfer";
      const choices = new Map(
        (Array.isArray(req.body?.rows) ? req.body.rows : []).map((c) => [Number(c?.line), c]),
      );

      const counts = { imported: 0, reservations: 0, skipped_duplicates: 0, not_selected: 0 };
      for (const row of result.rows) {
        const choice = choices.get(row.line);
        if (!choice?.include) {
          counts.not_selected += 1;
          continue;
        }
        if (row.status === "already_imported") {
          counts.skipped_duplicates += 1;
          continue;
        }
        const allowed = row.direction === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        const category = allowed.includes(choice.category) ? choice.category : row.category;

        // Matched bank-transfer reservation: confirm it with this bank row.
        let submissionId = null;
        let description = row.description;
        let counterparty = null;
        if (row.reservation && choice.confirm_reservation !== false) {
          const claimed = await dbQuery(
            `INSERT INTO submission_reviews (tenant_id, submission_id, status)
             VALUES ($1, $2, 'confirmed') ON CONFLICT DO NOTHING RETURNING submission_id`,
            [tenantId, row.reservation.id],
          );
          if (claimed.rows?.[0]) {
            submissionId = row.reservation.id;
            description = row.reservation.plan || description;
            counterparty = row.reservation.name || null;
          }
        }

        const inserted = await dbQuery(
          `INSERT INTO ledger_entries
             (tenant_id, entry_date, direction, category, description, counterparty,
              amount_minor, currency, method, reference, source, submission_id, import_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'import',$11,$12)
           ON CONFLICT (tenant_id, import_hash) WHERE import_hash IS NOT NULL AND voided_at IS NULL
           DO NOTHING RETURNING id`,
          [
            tenantId,
            row.date,
            row.direction,
            submissionId ? "membership" : category,
            clean(description, 300),
            counterparty,
            row.amount_minor,
            profile.currency,
            method,
            submissionId ? clean(row.reservation.reference, 80) : null,
            submissionId,
            row.import_hash,
          ],
        );
        const entryId = inserted.rows?.[0]?.id;
        if (!entryId) {
          counts.skipped_duplicates += 1;
          if (submissionId) {
            await dbQuery(
              "DELETE FROM submission_reviews WHERE tenant_id = $1 AND submission_id = $2 AND entry_id IS NULL",
              [tenantId, submissionId],
            );
          }
          continue;
        }
        counts.imported += 1;
        if (submissionId) {
          counts.reservations += 1;
          await dbQuery(
            "UPDATE submission_reviews SET entry_id = $3 WHERE tenant_id = $1 AND submission_id = $2",
            [tenantId, submissionId, entryId],
          );
        }
      }
      return res.json({ ok: true, ...counts });
    }),
  );

  router.get(
    "/desk/accounts/export.csv",
    withAccess(async (req, res, { tenantId, tenant, profile, role }) => {
      const year = new Date().getUTCFullYear();
      let from = isoDate(req.query?.from) ? req.query.from : `${year}-01-01`;
      let to = isoDate(req.query?.to) ? req.query.to : `${year}-12-31`;
      if (String(req.query?.all || "") === "1") {
        const first = await firstRecordDate(tenantId, profile.currency);
        from = first || `${year}-01-01`;
        to = new Date().toISOString().slice(0, 10);
      }
      const result = await dbQuery(
        `SELECT * FROM (
           SELECT entry_date AS date, direction, category, description, counterparty,
                  method, reference, amount_minor, tax_minor, source
             FROM ledger_entries
            WHERE tenant_id = $1 AND currency = $2 AND voided_at IS NULL
              AND entry_date BETWEEN $3::date AND $4::date
           UNION ALL
           SELECT created_at::date, 'income', 'site_sales', 'Website order', customer_email,
                  'stripe', order_id, amount_total, COALESCE(amount_tax,0), 'site'
             FROM orders
            WHERE tenant_id = $1 AND currency = $2 AND status = 'paid'
              AND created_at::date BETWEEN $3::date AND $4::date
         ) x ORDER BY date, direction`,
        [tenantId, profile.currency, from, to],
      );
      const cur = profile.currency.toUpperCase();
      const header = [
        "Date", "Type", "Category", "Description", "Who", "Method",
        "Reference", `Amount (${cur})`, `Tax included (${cur})`, "Source",
      ];
      const lines = (result.rows || []).map((r) =>
        [
          String(r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date).slice(0, 10),
          r.direction === "income" ? "Money in" : "Money out",
          r.category,
          r.description,
          r.counterparty,
          r.method,
          r.reference,
          majorUnits(r.amount_minor, profile.currency),
          majorUnits(r.tax_minor, profile.currency),
          r.source,
        ].map(csvCell).join(","),
      );
      await dbQuery(
        "INSERT INTO ledger_exports (tenant_id, period_from, period_to, role, rows) VALUES ($1, $2, $3, $4, $5)",
        [tenantId, from, to, role, lines.length],
      );
      const brand = String(tenant?.seo?.brandName || tenantId).replace(/[^\w-]+/g, "-");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${brand}-accounts-${from}-to-${to}.csv"`,
      );
      return res.send(`\uFEFF${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`);
    }),
  );

  return router;
}
