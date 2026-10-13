// server/hq.js
// Station 9 HQ — the internal control panel for our own work with gyms:
// pipeline, contacts, notes, money we've taken, and each client site's
// leads/health. Admin-key only. Mounted from server.js.

import express from "express";

export const HQ_STAGES = [
  "prospect",
  "contacted",
  "demo_sent",
  "call_booked",
  "won",
  "live",
  "paused",
  "lost",
];
const LANES = new Set(["replace", "bolt_on"]);
const ACTIVITY_KINDS = new Set([
  "note",
  "dm",
  "call",
  "email",
  "meeting",
  "stage",
  "payment",
]);
const PAYMENT_KINDS = new Set(["setup", "subscription", "addon", "other"]);
const PAYMENT_METHODS = new Set(["stripe", "bank_transfer", "cash", "other"]);

const TEXT_FIELDS = {
  name: 120,
  coach: 120,
  city: 80,
  country: 60,
  instagram: 80,
  whatsapp: 30,
  email: 160,
  website: 300,
  next_action: 300,
  notes: 5000,
};

function cleanText(value, max) {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, max) : null;
}

function cleanMinor(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function cleanDate(value) {
  if (value === null || value === undefined || value === "") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : undefined;
}

// Validates a create/update body against the allowed fields. Returns
// { fields } with only the keys present in the body, or { error }.
export function validateGymInput(body, { requireName, tenantIds }) {
  const input = body && typeof body === "object" ? body : {};
  const fields = {};

  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    if (key in input) fields[key] = cleanText(input[key], max);
  }
  if (requireName && !fields.name) return { error: "name is required" };
  if ("name" in input && !fields.name) return { error: "name can't be empty" };

  if ("stage" in input) {
    if (!HQ_STAGES.includes(input.stage)) return { error: "invalid stage" };
    fields.stage = input.stage;
  }
  if ("lane" in input) {
    if (input.lane && !LANES.has(input.lane)) return { error: "invalid lane" };
    fields.lane = input.lane || null;
  }
  if ("score" in input) {
    if (input.score === null || input.score === "") {
      fields.score = null;
    } else {
      const n = Math.round(Number(input.score));
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { error: "score must be 0-100" };
      }
      fields.score = n;
    }
  }
  if ("currency" in input) {
    const c = String(input.currency || "").trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(c)) return { error: "currency must be 3 letters" };
    fields.currency = c;
  }
  for (const key of ["setup_fee_minor", "monthly_minor"]) {
    if (key in input) {
      const v = cleanMinor(input[key]);
      if (v === undefined) return { error: `${key} must be a whole number` };
      fields[key] = v;
    }
  }
  if ("next_action_at" in input) {
    const d = cleanDate(input.next_action_at);
    if (d === undefined) return { error: "next_action_at must be YYYY-MM-DD" };
    fields.next_action_at = d;
  }
  if ("tenant_id" in input) {
    const t = String(input.tenant_id || "").trim();
    if (t && !tenantIds.has(t)) return { error: "unknown tenant_id" };
    fields.tenant_id = t || null;
  }
  return { fields };
}

export function createHqRouter({
  dbQuery,
  requireAdmin,
  ensureTables,
  loadTenants,
  readExceptions,
}) {
  const router = express.Router();
  router.use("/admin/hq", (req, res, next) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    res.setHeader("X-Robots-Tag", "noindex");
    return ensureTables().then(() => next(), next);
  });

  const tenantIdSet = () =>
    new Set(loadTenants().map((t) => String(t?.tenant_id || "")));

  const fail = (res, label, err) => {
    console.error(`HQ ${label} failed`, err);
    return res.status(500).json({ error: `Failed to ${label}` });
  };

  const gymRollupSql = `
    SELECT g.*,
      COALESCE((SELECT SUM(p.amount) FROM platform_payments p
                 WHERE p.tenant_id = g.tenant_id AND p.status = 'paid'), 0)::bigint AS paid_total_minor,
      (SELECT MAX(p.created_at) FROM platform_payments p
        WHERE p.tenant_id = g.tenant_id AND p.status = 'paid') AS last_paid_at,
      (SELECT COUNT(*) FROM submissions s
        WHERE s.tenant_id = g.tenant_id AND s.created_at > now() - interval '30 days')::int
      + (SELECT COUNT(*) FROM cart_emails c
        WHERE c.tenant_id = g.tenant_id AND c.created_at > now() - interval '30 days')::int AS leads_30d,
      (SELECT COUNT(*) FROM page_views v
        WHERE v.tenant_id = g.tenant_id AND v.at > now() - interval '30 days')::int AS views_30d,
      (SELECT MAX(a.at) FROM hq_activity a WHERE a.gym_id = g.id) AS last_activity_at
    FROM hq_gyms g`;

  const escalationsFor = (tenantId, days = 7) => {
    if (!tenantId) return [];
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return readExceptions().filter(
      (e) =>
        String(e?.tenant_id || "") === tenantId &&
        e?.action === "escalated" &&
        new Date(e?.createdAt || 0).getTime() >= cutoff,
    );
  };

  router.get("/admin/hq/tenants", (req, res) => {
    const list = loadTenants().map((t) => ({
      tenant_id: String(t?.tenant_id || ""),
      brand: String(t?.seo?.brandName || t?.tenant_id || ""),
    }));
    return res.json({ ok: true, tenants: list });
  });

  router.get("/admin/hq/summary", async (req, res) => {
    try {
      const [stages, mrr, cashMonth, cashTotal, due] = await Promise.all([
        dbQuery("SELECT stage, COUNT(*)::int AS n FROM hq_gyms GROUP BY stage"),
        dbQuery(
          "SELECT currency, COALESCE(SUM(monthly_minor), 0)::bigint AS amount FROM hq_gyms WHERE stage = 'live' GROUP BY currency",
        ),
        dbQuery(
          "SELECT currency, COALESCE(SUM(amount), 0)::bigint AS amount FROM platform_payments WHERE status = 'paid' AND created_at >= date_trunc('month', now()) GROUP BY currency",
        ),
        dbQuery(
          "SELECT currency, COALESCE(SUM(amount), 0)::bigint AS amount FROM platform_payments WHERE status = 'paid' GROUP BY currency",
        ),
        dbQuery(
          "SELECT COUNT(*)::int AS n FROM hq_gyms WHERE next_action_at <= current_date AND stage <> 'lost'",
        ),
      ]);
      const linked = await dbQuery(
        "SELECT tenant_id FROM hq_gyms WHERE tenant_id IS NOT NULL AND stage IN ('won', 'live', 'paused')",
      );
      const escalations = (linked.rows || []).reduce(
        (sum, r) => sum + escalationsFor(r.tenant_id).length,
        0,
      );
      const byStage = Object.fromEntries(HQ_STAGES.map((s) => [s, 0]));
      for (const r of stages.rows || []) byStage[r.stage] = r.n;
      return res.json({
        ok: true,
        by_stage: byStage,
        mrr: mrr.rows,
        cash_this_month: cashMonth.rows,
        cash_total: cashTotal.rows,
        follow_ups_due: due.rows?.[0]?.n || 0,
        escalations_7d: escalations,
      });
    } catch (err) {
      return fail(res, "load summary", err);
    }
  });

  router.get("/admin/hq/gyms", async (req, res) => {
    try {
      const params = [];
      const where = [];
      const stage = String(req.query?.stage || "").trim();
      if (stage && HQ_STAGES.includes(stage)) {
        params.push(stage);
        where.push(`g.stage = $${params.length}`);
      }
      const q = String(req.query?.q || "").trim().slice(0, 80);
      if (q) {
        params.push(`%${q}%`);
        where.push(
          `(g.name ILIKE $${params.length} OR g.coach ILIKE $${params.length} OR g.city ILIKE $${params.length})`,
        );
      }
      const result = await dbQuery(
        `${gymRollupSql}
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY (g.next_action_at IS NULL), g.next_action_at, g.updated_at DESC
         LIMIT 500`,
        params,
      );
      const gyms = (result.rows || []).map((g) => ({
        ...g,
        escalations_7d: escalationsFor(g.tenant_id).length,
      }));
      return res.json({ ok: true, gyms });
    } catch (err) {
      return fail(res, "list gyms", err);
    }
  });

  router.post("/admin/hq/gyms", async (req, res) => {
    try {
      const checked = validateGymInput(req.body, {
        requireName: true,
        tenantIds: tenantIdSet(),
      });
      if (checked.error) return res.status(400).json({ error: checked.error });
      const cols = Object.keys(checked.fields);
      const result = await dbQuery(
        `INSERT INTO hq_gyms (${cols.join(", ")})
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})
         RETURNING id`,
        cols.map((c) => checked.fields[c]),
      );
      const id = result.rows?.[0]?.id;
      await dbQuery(
        "INSERT INTO hq_activity (gym_id, kind, body) VALUES ($1, 'stage', $2)",
        [id, `Added as ${checked.fields.stage || "prospect"}`],
      );
      return res.json({ ok: true, id });
    } catch (err) {
      if (err?.code === "23505") {
        return res
          .status(409)
          .json({ error: "That site is already linked to another gym" });
      }
      return fail(res, "create gym", err);
    }
  });

  router.get("/admin/hq/gyms/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
      const g = await dbQuery(`${gymRollupSql} WHERE g.id = $1`, [id]);
      const gym = g.rows?.[0];
      if (!gym) return res.status(404).json({ error: "Gym not found" });
      const [activity, payments] = await Promise.all([
        dbQuery(
          "SELECT id, kind, body, at FROM hq_activity WHERE gym_id = $1 ORDER BY at DESC LIMIT 200",
          [id],
        ),
        gym.tenant_id
          ? dbQuery(
              "SELECT id, kind, status, method, amount, currency, period_start, period_end, note, created_at FROM platform_payments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100",
              [gym.tenant_id],
            )
          : Promise.resolve({ rows: [] }),
      ]);
      return res.json({
        ok: true,
        gym,
        activity: activity.rows,
        payments: payments.rows,
        escalations: escalationsFor(gym.tenant_id, 30),
      });
    } catch (err) {
      return fail(res, "load gym", err);
    }
  });

  router.patch("/admin/hq/gyms/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
      const checked = validateGymInput(req.body, {
        requireName: false,
        tenantIds: tenantIdSet(),
      });
      if (checked.error) return res.status(400).json({ error: checked.error });
      const cols = Object.keys(checked.fields);
      if (cols.length === 0) return res.status(400).json({ error: "nothing to update" });

      const before = await dbQuery("SELECT stage FROM hq_gyms WHERE id = $1", [id]);
      if (!before.rows?.[0]) return res.status(404).json({ error: "Gym not found" });

      await dbQuery(
        `UPDATE hq_gyms SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")}, updated_at = now()
         WHERE id = $${cols.length + 1}`,
        [...cols.map((c) => checked.fields[c]), id],
      );
      const oldStage = before.rows[0].stage;
      if (checked.fields.stage && checked.fields.stage !== oldStage) {
        await dbQuery(
          "INSERT INTO hq_activity (gym_id, kind, body) VALUES ($1, 'stage', $2)",
          [id, `Stage: ${oldStage} → ${checked.fields.stage}`],
        );
      }
      return res.json({ ok: true });
    } catch (err) {
      if (err?.code === "23505") {
        return res
          .status(409)
          .json({ error: "That site is already linked to another gym" });
      }
      return fail(res, "update gym", err);
    }
  });

  router.post("/admin/hq/gyms/:id/activity", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
      const kind = ACTIVITY_KINDS.has(req.body?.kind) ? req.body.kind : "note";
      const body = cleanText(req.body?.body, 5000);
      if (!body) return res.status(400).json({ error: "body is required" });
      const exists = await dbQuery("SELECT 1 FROM hq_gyms WHERE id = $1", [id]);
      if (!exists.rows?.[0]) return res.status(404).json({ error: "Gym not found" });
      await dbQuery(
        "INSERT INTO hq_activity (gym_id, kind, body) VALUES ($1, $2, $3)",
        [id, kind, body],
      );
      await dbQuery("UPDATE hq_gyms SET updated_at = now() WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch (err) {
      return fail(res, "add activity", err);
    }
  });

  // Record money a gym has paid us. Lands in platform_payments (so the
  // platform billing reports see it) attributed to the gym's site.
  router.post("/admin/hq/gyms/:id/payments", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
      const g = await dbQuery(
        "SELECT tenant_id, currency FROM hq_gyms WHERE id = $1",
        [id],
      );
      const gym = g.rows?.[0];
      if (!gym) return res.status(404).json({ error: "Gym not found" });
      if (!gym.tenant_id) {
        return res
          .status(400)
          .json({ error: "Link this gym to its site before recording payments" });
      }
      const amount = cleanMinor(req.body?.amount);
      if (!amount) {
        return res
          .status(400)
          .json({ error: "amount must be a positive whole number (pence)" });
      }
      const kind = PAYMENT_KINDS.has(req.body?.kind) ? req.body.kind : "other";
      const method = PAYMENT_METHODS.has(req.body?.method)
        ? req.body.method
        : "bank_transfer";
      const periodStart = cleanDate(req.body?.period_start) || null;
      const periodEnd = cleanDate(req.body?.period_end) || null;
      const note = cleanText(req.body?.note, 500);
      const currency = String(gym.currency || "gbp");
      await dbQuery(
        `INSERT INTO platform_payments
           (tenant_id, kind, status, method, amount, currency, period_start, period_end, note)
         VALUES ($1, $2, 'paid', $3, $4, $5, $6, $7, $8)`,
        [gym.tenant_id, kind, method, amount, currency, periodStart, periodEnd, note],
      );
      await dbQuery(
        "INSERT INTO hq_activity (gym_id, kind, body) VALUES ($1, 'payment', $2)",
        [
          id,
          `Paid ${(amount / 100).toFixed(2)} ${currency.toUpperCase()} (${kind}, ${method.replace("_", " ")})${note ? ` — ${note}` : ""}`,
        ],
      );
      return res.json({ ok: true });
    } catch (err) {
      return fail(res, "record payment", err);
    }
  });

  return router;
}
