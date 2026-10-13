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
} from "../src/tax-rules.js";

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
  const direction = b.direction === "expense" ? "expense" : b.direction === "income" ? "income" : null;
  if (!direction) return { error: "direction must be income or expense" };
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
  return `"${s.replace(/"/g, '""')}"`;
}

const majorUnits = (minor, currency) => {
  const n = Number(minor || 0) / 100;
  return String(currency).toLowerCase() === "idr" ? String(Math.round(n)) : n.toFixed(2);
};

export function createAccountsRouter({ dbQuery, requireDeskAccess, ensureTables }) {
  const router = express.Router();

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

  router.get(
    "/desk/accounts/export.csv",
    withAccess(async (req, res, { tenantId, tenant, profile }) => {
      const year = new Date().getUTCFullYear();
      const from = isoDate(req.query?.from) ? req.query.from : `${year}-01-01`;
      const to = isoDate(req.query?.to) ? req.query.to : `${year}-12-31`;
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
