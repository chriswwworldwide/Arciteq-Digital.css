// ============ PRODUCT DATA ============
let products = [];
let reviewRatings = new Map();
let tenant = {
  tenant_id: "default",
  currency: "eur",
  language: "en",
  catalog: null,
  seo: null,
  offers: null,
};

function getTenantId() {
  return String(tenant?.tenant_id || "default");
}

function scrollToMount(id) {
  try {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    // ignore
  }
}

function renderAdGuardrailsPanel({ guardrails, currency, summaryRows, spendByKey, adminKey, onSaved }) {
  const mount = document.getElementById("admin-ad-guardrails");
  if (!mount) return;

  const ccy = String(currency || "eur").toLowerCase();
  const g = guardrails && typeof guardrails === "object" ? guardrails : null;

  const rangeDays = Number(g?.range_days || 7) || 7;
  const stopSpendNoRevenueMinor = Number(g?.stop_spend_no_revenue_minor ?? 2000);
  const warnRoasBelow = Number(g?.warn_roas_below ?? 1.5);
  const warnProfitBelowMinor = Number(g?.warn_profit_below_minor ?? -500);
  const note = String(g?.note || "");

  const rows = Array.isArray(summaryRows) ? summaryRows : [];
  const spendMap = spendByKey && typeof spendByKey === "object" ? spendByKey : {};

  let paidRevenueMinor = 0;
  let spendMinor = 0;
  rows.forEach((r) => {
    const source = String(r?.utm_source || "—");
    const medium = String(r?.utm_medium || "—");
    const campaign = String(r?.utm_campaign || "—");
    const ad = String(r?.utm_content || "—");
    const key = `${source}||${medium}||${campaign}||${ad}`;

    const revenue = Number(r?.revenue_minor || 0) || 0;
    paidRevenueMinor += revenue;

    const s = Number(spendMap[key] || 0) || 0;
    spendMinor += s;
  });

  const roas = spendMinor > 0 ? paidRevenueMinor / spendMinor : NaN;
  const profitMinor = paidRevenueMinor - spendMinor;

  const stopTriggered = spendMinor >= stopSpendNoRevenueMinor && paidRevenueMinor <= 0;
  const warnRoas = Number.isFinite(roas) && roas < warnRoasBelow;
  const warnProfit = profitMinor < warnProfitBelowMinor;

  let status = "OK";
  let statusColor = "#065f46";
  let statusMsg = "No guardrails triggered.";

  if (stopTriggered) {
    status = "STOP";
    statusColor = "#b91c1c";
    statusMsg = "Spend is above the stop threshold but paid revenue is zero.";
  } else if (warnRoas || warnProfit) {
    status = "WARNING";
    statusColor = "#92400e";
    statusMsg = warnProfit
      ? "Profit is below your warning threshold."
      : "ROAS is below your warning threshold.";
  }

  const revenueText = formatMoneyMinor(paidRevenueMinor, ccy);
  const spendText = spendMinor > 0 ? formatMoneyMinor(spendMinor, ccy) : "—";
  const profitText = Number.isFinite(profitMinor) ? formatMoneyMinor(profitMinor, ccy) : "—";
  const roasText = spendMinor > 0 ? (paidRevenueMinor / spendMinor).toFixed(2) : "—";

  mount.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;">Ad Guardrails (Stop-loss)</div>
        <div style="margin-top:6px;color:#4b5563;line-height:1.35;">Rules that warn you when ad spend is drifting into loss.</div>
      </div>
      <div style="font-weight:700;color:${sanitizeHTML(statusColor)};">${sanitizeHTML(status)}</div>
    </div>

    <div style="margin-top:10px;color:${sanitizeHTML(statusColor)};">${sanitizeHTML(statusMsg)}</div>

    <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">
      <div style="font-weight:600;">Current totals (range: last ${sanitizeHTML(String(rangeDays))} days)</div>
      <div style="margin-top:8px;color:#111827;">
        <div><strong>Paid revenue:</strong> ${sanitizeHTML(revenueText)}</div>
        <div><strong>Spend (manual):</strong> ${sanitizeHTML(spendText)}</div>
        <div><strong>ROAS:</strong> ${sanitizeHTML(roasText)}</div>
        <div><strong>Profit:</strong> ${sanitizeHTML(profitText)}</div>
      </div>
    </div>

    <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">
      <div style="font-weight:600;">Settings</div>
      <div style="margin-top:10px;display:grid;gap:10px;grid-template-columns:1fr;">
        <label style="display:grid;gap:6px;">
          <span style="color:#4b5563;">Range (days)</span>
          <input id="ag-range" type="number" min="1" max="365" value="${sanitizeHTML(String(rangeDays))}" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
        </label>

        <label style="display:grid;gap:6px;">
          <span style="color:#4b5563;">STOP if spend ≥ (and paid revenue = 0)</span>
          <input id="ag-stop" type="text" value="${sanitizeHTML(
            formatMoneyMinor(Number.isInteger(stopSpendNoRevenueMinor) ? stopSpendNoRevenueMinor : 0, ccy).replace(/[^0-9.,-]/g, ""),
          )}" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
        </label>

        <label style="display:grid;gap:6px;">
          <span style="color:#4b5563;">WARN if ROAS below</span>
          <input id="ag-roas" type="number" step="0.01" min="0" value="${sanitizeHTML(String(warnRoasBelow))}" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
        </label>

        <label style="display:grid;gap:6px;">
          <span style="color:#4b5563;">WARN if profit below</span>
          <input id="ag-profit" type="text" value="${sanitizeHTML(
            formatMoneyMinor(Number.isInteger(warnProfitBelowMinor) ? warnProfitBelowMinor : 0, ccy).replace(/[^0-9.,-]/g, ""),
          )}" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
        </label>

        <label style="display:grid;gap:6px;">
          <span style="color:#4b5563;">Note (optional)</span>
          <input id="ag-note" type="text" value="${sanitizeHTML(note)}" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
        </label>

        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <button id="ag-save" type="button" style="padding:10px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;font:inherit;">Save guardrails</button>
          <span id="ag-status" style="color:#4b5563;"></span>
        </div>
      </div>
    </div>
  `;

  const btn = document.getElementById("ag-save");
  const statusEl = document.getElementById("ag-status");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        if (statusEl) statusEl.textContent = "Saving...";
        const rangeEl = document.getElementById("ag-range");
        const stopEl = document.getElementById("ag-stop");
        const roasEl = document.getElementById("ag-roas");
        const profitEl = document.getElementById("ag-profit");
        const noteEl = document.getElementById("ag-note");

        const nextRange = Number(rangeEl?.value || 7) || 7;
        const stopMinor = parseMoneyToMinorUnits(stopEl?.value || "");
        const profitMinor = parseMoneyToMinorUnits(profitEl?.value || "");
        const roasVal = Number(roasEl?.value || 0);
        if (!Number.isFinite(stopMinor) || !Number.isFinite(profitMinor) || !Number.isFinite(roasVal) || roasVal < 0) {
          throw new Error("Please enter valid numbers.");
        }

        await saveAdGuardrails({
          adminKey,
          currency: ccy,
          rangeDays: nextRange,
          stopSpendNoRevenueMinor: stopMinor,
          warnRoasBelow: roasVal,
          warnProfitBelowMinor: profitMinor,
          note: String(noteEl?.value || "").trim(),
        });

        if (statusEl) statusEl.textContent = "Saved.";
        if (typeof onSaved === "function") onSaved();
      } catch (err) {
        if (statusEl) statusEl.textContent = String(err?.message || "Save failed.");
      }
    });
  }
}

function renderOpsHealthPanel(data) {
  const mount = document.getElementById("admin-ops-health");
  if (!mount) return;

  const serverTime = String(data?.server_time || "");
  const tenantId = String(data?.tenant_id || "");
  const pendingHours = Number(data?.pending_hours || 0) || 0;
  const errText = String(data?._error || "").trim();

  const stripeLast = data?.stripe?.last_webhook_at ? new Date(data.stripe.last_webhook_at) : null;
  const stripeLastText = stripeLast && Number.isFinite(stripeLast.getTime()) ? stripeLast.toLocaleString("en-GB") : "—";
  const stripeCount24h = Number(data?.stripe?.webhooks_24h || 0) || 0;

  const now = Date.now();
  const stripeLastMs = stripeLast && Number.isFinite(stripeLast.getTime()) ? stripeLast.getTime() : Number.NaN;
  const webhookAgeMs = Number.isFinite(stripeLastMs) ? now - stripeLastMs : Number.NaN;
  const webhookColor =
    !Number.isFinite(webhookAgeMs) ? "#b91c1c" : webhookAgeMs > 6 * 60 * 60 * 1000 ? "#b91c1c" : webhookAgeMs > 60 * 60 * 1000 ? "#92400e" : "#065f46";

  const o24 = data?.orders?.last_24h || {};
  const o7 = data?.orders?.last_7d || {};
  const stale = data?.orders?.stale_pending || {};
  const staleCount = Number(stale?.count || 0) || 0;
  const staleColor = staleCount >= 6 ? "#b91c1c" : staleCount > 0 ? "#92400e" : "#065f46";
  const staleAction = staleCount > 0;

  mount.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;">Ops Health</div>
        <div style="margin-top:6px;color:#4b5563;line-height:1.35;">Quick tripwires so issues don’t creep up quietly.</div>
      </div>
      <div style="color:#6b7280;font-size:0.95rem;">${sanitizeHTML(
        `${serverTime ? new Date(serverTime).toLocaleString("en-GB") : ""}${tenantId ? ` • ${tenantId}` : ""}`.trim(),
      )}</div>
    </div>

    ${
      errText
        ? `<div style="margin-top:10px;color:#b91c1c;">${sanitizeHTML(errText)}</div>`
        : ""
    }

    <div style="margin-top:12px;display:grid;gap:10px;grid-template-columns:1fr;">
      <div style="border-top:1px solid #e5e7eb;padding-top:10px;">
        <div style="font-weight:600;">Stripe webhooks</div>
        <div style="margin-top:6px;color:#111827;">
          <div><strong>Last webhook:</strong> <span style="color:${sanitizeHTML(webhookColor)};font-weight:700;">${sanitizeHTML(
            stripeLastText,
          )}</span></div>
          <div><strong>Webhooks (24h):</strong> ${sanitizeHTML(String(stripeCount24h))}</div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:10px;">
        <div style="font-weight:600;">Orders (last 24h)</div>
        <div style="margin-top:6px;color:#111827;">
          <div><strong>Started:</strong> ${sanitizeHTML(String(Number(o24?.started || 0) || 0))}</div>
          <div><strong>Paid:</strong> ${sanitizeHTML(String(Number(o24?.paid || 0) || 0))}</div>
          <div><strong>Pending:</strong> ${sanitizeHTML(String(Number(o24?.pending || 0) || 0))}</div>
          <div><strong>Abandoned:</strong> ${sanitizeHTML(String(Number(o24?.abandoned || 0) || 0))}</div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:10px;">
        <div style="font-weight:600;">Orders (last 7 days)</div>
        <div style="margin-top:6px;color:#111827;">
          <div><strong>Started:</strong> ${sanitizeHTML(String(Number(o7?.started || 0) || 0))}</div>
          <div><strong>Paid:</strong> ${sanitizeHTML(String(Number(o7?.paid || 0) || 0))}</div>
          <div><strong>Pending:</strong> ${sanitizeHTML(String(Number(o7?.pending || 0) || 0))}</div>
          <div><strong>Abandoned:</strong> ${sanitizeHTML(String(Number(o7?.abandoned || 0) || 0))}</div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:10px;">
        <div style="font-weight:600;">Stale pending</div>
        <div style="margin-top:6px;color:#111827;">
          <div><strong>Pending older than ${sanitizeHTML(String(pendingHours || 1))}h:</strong> ${
            staleAction
              ? `<button id="ops-stale-pending" type="button" style="padding:0;border:0;background:transparent;cursor:pointer;color:${sanitizeHTML(
                  staleColor,
                )};font-weight:700;font:inherit;">${sanitizeHTML(String(staleCount))}</button>`
              : `<span style="color:${sanitizeHTML(staleColor)};font-weight:700;">${sanitizeHTML(String(staleCount))}</span>`
          }</div>
        </div>
      </div>
    </div>
  `;

  const staleBtn = document.getElementById("ops-stale-pending");
  if (staleBtn) {
    staleBtn.addEventListener("click", () => {
      const statusEl = document.getElementById("admin-status");
      const refreshBtn = document.getElementById("admin-refresh");
      if (statusEl) statusEl.value = "pending";
      if (refreshBtn) refreshBtn.click();
      showNotice("Showing pending orders.");
      scrollToMount("admin-orders");
    });
  }
}

function renderAlertsPanel({ data, heartbeat, opsHealth, adminKey, onRun }) {
  const mount = document.getElementById("admin-alerts");
  if (!mount) return;

  const errText = String(data?._error || "").trim();
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
  const emailStatus = String(data?.alert_email_to || "");

  const hb = heartbeat && typeof heartbeat === "object" ? heartbeat.heartbeat : null;
  const hbLastRunAt = String(hb?.lastRunAt || "");
  const hbLastOk = hb?.lastOk;
  const hbInterval = Number(hb?.intervalMinutes || 0) || 0;
  const hbCreated = Number(hb?.lastCreatedCount || 0) || 0;
  const hbErr = String(hb?.lastError || "").trim();

  const stripeLast = opsHealth?.stripe?.last_webhook_at ? new Date(opsHealth.stripe.last_webhook_at) : null;
  const stripeLastMs = stripeLast && Number.isFinite(stripeLast.getTime()) ? stripeLast.getTime() : Number.NaN;
  const webhookAgeMs = Number.isFinite(stripeLastMs) ? Date.now() - stripeLastMs : Number.NaN;
  const webhookStaleNow = !Number.isFinite(webhookAgeMs) || webhookAgeMs > 6 * 60 * 60 * 1000;

  const hbLine = hb
    ? `Heartbeat: every ${hbInterval || "?"} min • last run ${hbLastRunAt ? new Date(hbLastRunAt).toLocaleString("en-GB") : "—"} • ${
        hbLastOk === true ? "ok" : hbLastOk === false ? "error" : "unknown"
      } • new alerts ${hbCreated}`
    : "Heartbeat: not loaded";

  const headerRight = emailStatus === "configured" ? "Email enabled" : "Email disabled (set ALERT_EMAIL_TO)";

  const listHtml = alerts.length
    ? alerts
        .map((a) => {
          const at = String(a?.createdAt || "");
          const when = at ? new Date(at).toLocaleString("en-GB") : "—";
          const type = String(a?.type || "—");
          const sev = String(a?.severity || "warning");
          const msg = String(a?.message || "");
          const email = String(a?.emailStatus || "");
          const sevColor = sev === "stop" ? "#b91c1c" : "#92400e";
          const resolved = type === "stripe_webhooks_stale" && !webhookStaleNow;
          return `
            <div style="padding:10px 0;border-top:1px solid #e5e7eb;">
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <div style="font-weight:700;color:${sanitizeHTML(sevColor)};">${sanitizeHTML(sev.toUpperCase())}${
                  resolved ? ` <span style="color:#065f46;font-weight:700;">(RESOLVED)</span>` : ""
                }</div>
                <div style="color:#6b7280;font-size:0.95rem;">${sanitizeHTML(when)}</div>
              </div>
              <div style="margin-top:6px;"><strong>${sanitizeHTML(type)}</strong> — ${sanitizeHTML(msg)}</div>
              ${email ? `<div style="margin-top:6px;color:#6b7280;font-size:0.95rem;">Email: ${sanitizeHTML(email)}</div>` : ""}
            </div>
          `;
        })
        .join("")
    : `<div style="margin-top:10px;color:#4b5563;">No alerts logged yet.</div>`;

  mount.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;">Recent Alerts</div>
        <div style="margin-top:6px;color:#4b5563;line-height:1.35;">Incidents that would trigger notifications.</div>
        <div style="margin-top:6px;color:#6b7280;font-size:0.95rem;">${sanitizeHTML(hbLine)}</div>
        ${hbLastOk === false && hbErr ? `<div style="margin-top:6px;color:#b91c1c;font-size:0.95rem;">${sanitizeHTML(hbErr)}</div>` : ""}
      </div>
      <div style="color:#6b7280;font-size:0.95rem;">${sanitizeHTML(headerRight)}</div>
    </div>

    ${errText ? `<div style="margin-top:10px;color:#b91c1c;">${sanitizeHTML(errText)}</div>` : ""}

    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <button id="alerts-run" type="button" style="padding:10px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;font:inherit;">Run checks now</button>
      <span id="alerts-run-status" style="color:#4b5563;"></span>
    </div>

    <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">
      ${listHtml}
    </div>
  `;

  const btn = document.getElementById("alerts-run");
  const statusEl = document.getElementById("alerts-run-status");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        if (statusEl) statusEl.textContent = "Running...";
        await runAdminAlerts({ adminKey });
        if (statusEl) statusEl.textContent = "Done.";
        if (typeof onRun === "function") onRun();
      } catch (err) {
        if (statusEl) statusEl.textContent = String(err?.message || "Failed.");
      }
    });
  }
}

function renderOpsTrendsPanel(data) {
  const mount = document.getElementById("admin-ops-trends");
  if (!mount) return;

  const errText = String(data?._error || "").trim();
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const currency = String(data?.currency || "eur").toLowerCase();
  const days = Number(data?.days || 7) || 7;
  const start = String(data?.start || "");
  const end = String(data?.end || "");

  const headerRight = `${start ? new Date(start).toLocaleDateString("en-GB") : ""}${end ? ` → ${new Date(end).toLocaleDateString("en-GB")}` : ""}`.trim();

  const totals = rows.reduce(
    (acc, r) => {
      acc.started += Number(r?.started || 0) || 0;
      acc.paid += Number(r?.paid || 0) || 0;
      acc.pending += Number(r?.pending || 0) || 0;
      acc.abandoned += Number(r?.abandoned || 0) || 0;
      acc.failed += Number(r?.failed || 0) || 0;
      acc.revenue_minor += Number(r?.revenue_minor || 0) || 0;
      acc.spend_minor += Number(r?.spend_minor || 0) || 0;
      acc.profit_minor += Number(r?.profit_minor || 0) || 0;
      acc.webhooks += Number(r?.webhooks || 0) || 0;
      return acc;
    },
    {
      started: 0,
      paid: 0,
      pending: 0,
      abandoned: 0,
      failed: 0,
      revenue_minor: 0,
      spend_minor: 0,
      profit_minor: 0,
      webhooks: 0,
    },
  );

  const tableRowsHtml = rows
    .map((r) => {
      const day = String(r?.day || "");
      const revenueMinor = Number(r?.revenue_minor || 0) || 0;
      const spendMinor = Number(r?.spend_minor || 0) || 0;
      const profitMinor = Number(r?.profit_minor || 0) || 0;
      const profitColor = profitMinor < 0 ? "#b91c1c" : "#065f46";

      const revenueColor = revenueMinor > 0 ? "#065f46" : "#111827";
      const spendColor = spendMinor > 0 && revenueMinor <= 0 ? "#b91c1c" : "#111827";
      const abandoned = Number(r?.abandoned || 0) || 0;
      const failed = Number(r?.failed || 0) || 0;
      const abandonedColor = abandoned >= 3 ? "#b91c1c" : abandoned > 0 ? "#92400e" : "#111827";
      const failedColor = failed >= 3 ? "#b91c1c" : failed > 0 ? "#92400e" : "#111827";

      return `
        <tr>
          <td style="padding:8px 6px;border-top:1px solid #eee;white-space:nowrap;">${sanitizeHTML(day)}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;">${sanitizeHTML(String(Number(r?.started || 0) || 0))}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;">${sanitizeHTML(String(Number(r?.paid || 0) || 0))}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;">${sanitizeHTML(String(Number(r?.pending || 0) || 0))}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;color:${sanitizeHTML(abandonedColor)};font-weight:${sanitizeHTML(
            abandoned > 0 ? "700" : "400",
          )};">${sanitizeHTML(String(abandoned))}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;color:${sanitizeHTML(failedColor)};font-weight:${sanitizeHTML(
            failed > 0 ? "700" : "400",
          )};">${sanitizeHTML(String(failed))}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;color:${sanitizeHTML(revenueColor)};font-weight:${sanitizeHTML(
            revenueMinor > 0 ? "700" : "400",
          )};">${sanitizeHTML(formatMoneyMinor(revenueMinor, currency))}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;color:${sanitizeHTML(spendColor)};font-weight:${sanitizeHTML(
            spendMinor > 0 && revenueMinor <= 0 ? "700" : "400",
          )};">${sanitizeHTML(spendMinor > 0 ? formatMoneyMinor(spendMinor, currency) : "—")}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;color:${sanitizeHTML(profitColor)};">${sanitizeHTML(
            spendMinor > 0 || revenueMinor !== 0 ? formatMoneyMinor(profitMinor, currency) : "—",
          )}</td>
          <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;">${sanitizeHTML(String(Number(r?.webhooks || 0) || 0))}</td>
        </tr>
      `;
    })
    .join("");

  mount.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;">Ops Trends (last ${sanitizeHTML(String(days))} days)</div>
        <div style="margin-top:6px;color:#4b5563;line-height:1.35;">Daily pulse for orders, revenue, spend, and webhooks.</div>
      </div>
      <div style="color:#6b7280;font-size:0.95rem;">${sanitizeHTML(headerRight)}</div>
    </div>

    ${
      errText
        ? `<div style="margin-top:10px;color:#b91c1c;">${sanitizeHTML(errText)}</div>`
        : ""
    }

    <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:820px;">
        <thead>
          <tr style="text-align:right;color:#4b5563;">
            <th style="text-align:left;padding:8px 6px;">Day</th>
            <th style="padding:8px 6px;">Started</th>
            <th style="padding:8px 6px;">Paid</th>
            <th style="padding:8px 6px;">Pending</th>
            <th style="padding:8px 6px;">Abandoned</th>
            <th style="padding:8px 6px;">Failed</th>
            <th style="padding:8px 6px;">Revenue</th>
            <th style="padding:8px 6px;">Spend</th>
            <th style="padding:8px 6px;">Profit</th>
            <th style="padding:8px 6px;">Webhooks</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          <tr>
            <td style="padding:8px 6px;border-top:1px solid #ddd;font-weight:700;">Total</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(String(totals.started))}</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(String(totals.paid))}</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(String(totals.pending))}</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(String(totals.abandoned))}</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(String(totals.failed))}</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(formatMoneyMinor(totals.revenue_minor, currency))}</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(
              totals.spend_minor > 0 ? formatMoneyMinor(totals.spend_minor, currency) : "—",
            )}</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(
              totals.spend_minor > 0 || totals.revenue_minor !== 0 ? formatMoneyMinor(totals.profit_minor, currency) : "—",
            )}</td>
            <td style="padding:8px 6px;border-top:1px solid #ddd;text-align:right;font-weight:700;">${sanitizeHTML(String(totals.webhooks))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function getCheckoutEmailStorageKey() {
  return `checkout_email:${getTenantId()}`;
}

function getUtmStorageKey() {
  return `utm:${getTenantId()}`;
}

function captureUtmFromUrl() {
  try {
    const params = new URLSearchParams(String(globalThis.location.search || ""));
    const utm_source = String(params.get("utm_source") || "").trim();
    const utm_medium = String(params.get("utm_medium") || "").trim();
    const utm_campaign = String(params.get("utm_campaign") || "").trim();
    const utm_content = String(params.get("utm_content") || params.get("ref") || "").trim();
    const utm_term = String(params.get("utm_term") || "").trim();

    const hasAny = utm_source || utm_medium || utm_campaign || utm_content || utm_term;
    if (!hasAny) return;

    const payload = {
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      captured_at: new Date().toISOString(),
      landing_path: String(globalThis.location.pathname || ""),
    };

    localStorage.setItem(getUtmStorageKey(), JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function readUtmFromStorage() {
  try {
    const raw = localStorage.getItem(getUtmStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCheckoutEmailFromStorage() {
  try {
    return String(localStorage.getItem(getCheckoutEmailStorageKey()) || "").trim();
  } catch {
    return "";
  }
}

function writeCheckoutEmailToStorage(email) {
  try {
    const safe = String(email || "").trim();
    if (!safe) {
      localStorage.removeItem(getCheckoutEmailStorageKey());
      return;
    }
    localStorage.setItem(getCheckoutEmailStorageKey(), safe);
  } catch {
    // ignore
  }
}

function saveCheckoutEmail(email) {
  writeCheckoutEmailToStorage(email);
  const safe = String(email || "").trim().toLowerCase();
  if (!safe) return;
  try {
    const cartPayload = Array.isArray(cart)
      ? cart.map((i) => ({ id: String(i?.id || ""), qty: Number(i?.qty || 1) }))
      : [];
    fetch("/api/capture-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: safe, cart: cartPayload }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

function injectSharedHeader() {
  const mount = document.getElementById("header-mount");
  if (!mount) return;

  const title = String(mount.getAttribute("data-title") || "").trim();
  const pageTitle = title || "Shop";
  const brandName = String(tenant?.seo?.brandName || "").trim();
  const safeBrand = brandName || pageTitle;

  mount.innerHTML = `
    <header>
      <div>
        <h1 style="margin:0;">${sanitizeHTML(safeBrand)}</h1>
        <div style="margin-top:2px;font-size:0.95rem;opacity:0.85;">${sanitizeHTML(pageTitle)}</div>
      </div>
      <nav>
        <ul>
          <li><a href="/index.html">Home</a></li>
          <li><a href="/shop.html">Shop</a></li>
          <li><a href="/cart.html">Cart</a></li>
        </ul>
      </nav>
      <div>
        Cart: <span id="cart-count">0</span>
      </div>
    </header>
  `;
}

function ensureNoticeMount() {
  let mount = document.getElementById("notice-mount");
  if (mount) return mount;

  mount = document.createElement("div");
  mount.id = "notice-mount";
  mount.setAttribute("role", "status");
  mount.setAttribute("aria-live", "polite");
  mount.style.display = "none";
  mount.style.margin = "12px auto";
  mount.style.maxWidth = "1000px";
  mount.style.padding = "12px 14px";
  mount.style.border = "1px solid #e5e7eb";
  mount.style.borderRadius = "10px";
  mount.style.background = "#fff7ed";
  mount.style.color = "#111827";
  mount.style.boxShadow = "0 1px 2px rgba(0,0,0,0.06)";
  mount.style.fontSize = "0.95rem";
  mount.style.lineHeight = "1.25rem";

  const headerMount = document.getElementById("header-mount");
  if (headerMount && headerMount.parentNode) {
    headerMount.parentNode.insertBefore(mount, headerMount.nextSibling);
  } else {
    document.body.insertBefore(mount, document.body.firstChild);
  }

  return mount;
}

function showNotice(message, options = {}) {
  const mount = ensureNoticeMount();
  if (!mount) return;

  const safeMessage = sanitizeHTML(String(message || ""));
  const actionLabel = options?.actionLabel ? String(options.actionLabel) : "";

  mount.style.display = "block";
  mount.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;">
      <div style="min-width:240px;flex:1;">${safeMessage}</div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${
          actionLabel
            ? `<button id="notice-action" type="button" style="padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;">${sanitizeHTML(actionLabel)}</button>`
            : ""
        }
        <button id="notice-dismiss" type="button" aria-label="Dismiss" style="padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;">OK</button>
      </div>
    </div>
  `;

  const dismissBtn = mount.querySelector("#notice-dismiss");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      mount.style.display = "none";
      mount.innerHTML = "";
    });
  }

  const actionBtn = mount.querySelector("#notice-action");
  if (actionBtn && typeof options?.onAction === "function") {
    actionBtn.addEventListener("click", () => {
      options.onAction();
    });
  }
}

function ensureAbsoluteCanonical() {
  try {
    const pathname = String(globalThis?.location?.pathname || "/");

    const looksLikeProductRoute = /^\/[^/]+\/[^/]+\/?$/.test(pathname);
    if (looksLikeProductRoute) return;

    let canonicalPath = pathname;
    if (canonicalPath.endsWith("/index.html")) canonicalPath = "/";
    if (!canonicalPath.startsWith("/")) canonicalPath = `/${canonicalPath}`;

    const absolute = `${globalThis.location.origin}${canonicalPath}`;

    let link = document.querySelector("link[rel='canonical']");
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", absolute);
  } catch {
    // ignore
  }
}

async function loadTenant() {
  const res = await fetch("/api/tenant", { cache: "no-cache" });
  if (!res.ok) {
    tenant = {
      tenant_id: "default",
      currency: "eur",
      language: "en",
      catalog: null,
      seo: null,
    };
    return;
  }

  const data = await res.json();
  tenant = {
    tenant_id: String(data?.tenant_id || "default"),
    currency: String(data?.currency || "eur").toLowerCase(),
    language: String(data?.language || "en").toLowerCase(),
    catalog: data?.catalog && typeof data.catalog === "object" ? data.catalog : null,
    seo: data?.seo && typeof data.seo === "object" ? data.seo : null,
    offers: data?.offers && typeof data.offers === "object" ? data.offers : null,
    payment_methods: Array.isArray(data?.payment_methods) ? data.payment_methods : ["card"],
  };
}

function renderTrustStrip() {
  const mount = document.getElementById("trust-strip");
  if (!mount) return;

  const offers = tenant?.offers && typeof tenant.offers === "object" ? tenant.offers : null;
  const items = Array.isArray(offers?.trustStrip?.items) ? offers.trustStrip.items : [];
  const clean = items
    .map((i) => ({ title: String(i?.title || "").trim(), text: String(i?.text || "").trim() }))
    .filter((i) => i.title && i.text);

  if (clean.length === 0) {
    mount.innerHTML = "";
    return;
  }

  const hasPaypal = Array.isArray(tenant?.payment_methods) && tenant.payment_methods.includes("paypal");
  const cells = clean
    .map((i) => {
      let text = i.text;
      if (i.title.toLowerCase() === "secure checkout" && hasPaypal && !text.toLowerCase().includes("paypal")) {
        text = `${text.replace(/\.$/, "")} + PayPal.`;
      }
      return `<div><strong>${sanitizeHTML(i.title)}:</strong> ${sanitizeHTML(text)}</div>`;
    })
    .join("");

  mount.innerHTML = `
    <div style="margin:12px auto 0;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));text-align:left;">
      ${cells}
    </div>
  `;
}

function renderStarterKits() {
  const mount = document.getElementById("starter-kits");
  if (!mount) return;

  const offers = tenant?.offers && typeof tenant.offers === "object" ? tenant.offers : null;
  const starter = offers?.starterKits && typeof offers.starterKits === "object" ? offers.starterKits : null;
  const kits = Array.isArray(starter?.kits) ? starter.kits : [];
  const selectedPet = String(mount.getAttribute("data-kits-pet") || "all").trim() || "all";
  const cleanKits = kits
    .map((k) => ({
      id: String(k?.id || "").trim(),
      title: String(k?.title || "").trim(),
      description: String(k?.description || "").trim(),
      petTypes: Array.isArray(k?.petTypes) ? k.petTypes.map((x) => String(x || "").trim()).filter(Boolean) : [],
      productIds: Array.isArray(k?.productIds) ? k.productIds.map((x) => String(x || "").trim()).filter(Boolean) : [],
    }))
    .filter((k) => k.id && k.title && k.productIds.length > 0);

  const visibleKits = cleanKits.filter((k) => {
    if (selectedPet === "all") return true;
    return k.petTypes.includes(selectedPet);
  });

  if (cleanKits.length === 0) {
    mount.innerHTML = "";
    return;
  }

  const subtitle = String(starter?.subtitle || "").trim();
  const howItWorks = String(starter?.howItWorks || "").trim();

  const kitRows = visibleKits
    .map((k) => {
      const included = k.productIds
        .map((pid) => products.find((p) => String(p?.id || "") === pid))
        .filter(Boolean);

      const priceMinor = included.reduce((sum, p) => sum + (Number(p?.price) || 0), 0);
      const currency = String(tenant?.currency || "eur");
      const priceLabel = sanitizeHTML(formatMoneyMinorBasic(priceMinor, currency));

      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #e5e7eb;">
          <div style="min-width:0;">
            <div style="font-weight:800;line-height:1.15;">${sanitizeHTML(k.title)}</div>
            <div style="margin-top:4px;color:#4b5563;font-size:0.92rem;line-height:1.25;">${priceLabel}</div>
          </div>
          <div style="flex:0 0 auto;">
            <button type="button" data-kit-id="${sanitizeHTML(k.id)}" style="padding:10px 12px;border:1px solid #111827;border-radius:10px;background:#111827;color:#ffffff;cursor:pointer;">Add</button>
          </div>
        </div>
      `;
    })
    .join("");

  mount.innerHTML = `
    <div style="margin:14px 0 0;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;position:sticky;top:12px;">
      <div style="font-weight:900;font-size:1.05rem;">Starter kits</div>
      ${subtitle ? `<div style="margin-top:6px;color:#4b5563;line-height:1.35;">${sanitizeHTML(subtitle)}</div>` : ""}
      ${howItWorks ? `<details style="margin-top:8px;"><summary style="cursor:pointer;color:#374151;">How savings works</summary><div style="margin-top:6px;color:#4b5563;line-height:1.35;">${sanitizeHTML(howItWorks)}</div></details>` : ""}
      <div style="margin-top:10px;border-top:1px solid #e5e7eb;">${kitRows}</div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <a href="/kits/dog.html" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;display:inline-block;color:inherit;text-decoration:none;">All Dog Kits</a>
        <a href="/kits/cat.html" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;display:inline-block;color:inherit;text-decoration:none;">All Cat Kits</a>
        <button type="button" data-kits-filter="all" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;">All Kits</button>
      </div>
    </div>
  `;

  mount.querySelectorAll("button[data-kit-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kitId = String(btn.getAttribute("data-kit-id") || "").trim();
      if (!kitId) return;
      const kit = cleanKits.find((k) => k.id === kitId);
      if (!kit) return;

      kit.productIds.forEach((pid) => addToCart(pid));
    });
  });

  mount.querySelectorAll("button[data-kits-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pet = String(btn.getAttribute("data-kits-filter") || "all").trim() || "all";
      mount.setAttribute("data-kits-pet", pet);

      const petTypeEl = document.getElementById("pet-type");
      if (petTypeEl && (pet === "Dog" || pet === "Cat" || pet === "all")) {
        petTypeEl.value = pet;
      }

      renderStarterKits();
      renderProducts();
    });
  });
}

function isShopPage() {
  const pathname = String(globalThis?.location?.pathname || "");
  return pathname.endsWith("/shop.html") || pathname === "/shop.html";
}

function getHeroProductIds() {
  const ids = Array.isArray(tenant?.catalog?.heroProductIds) ? tenant.catalog.heroProductIds : [];
  return ids.map((x) => String(x || "").trim()).filter(Boolean);
}

function readShowAllProductsPreference() {
  try {
    return String(localStorage.getItem("shop_show_all") || "") === "1";
  } catch {
    return false;
  }
}

function writeShowAllProductsPreference(v) {
  try {
    localStorage.setItem("shop_show_all", v ? "1" : "0");
  } catch {
    // ignore
  }
}

function applyShopFeaturedQueryParam() {
  if (!isShopPage()) return;
  try {
    const params = new URLSearchParams(String(globalThis.location && globalThis.location.search ? globalThis.location.search : ""));
    const featured = String(params.get("featured") || "").trim();
    if (featured !== "1") return;

    writeShowAllProductsPreference(false);
    params.delete("featured");
    const qs = params.toString();
    const pathname = String(globalThis.location && globalThis.location.pathname ? globalThis.location.pathname : "/shop.html");
    const hash = String(globalThis.location && globalThis.location.hash ? globalThis.location.hash : "");
    const next = pathname + (qs ? "?" + qs : "") + hash;
    if (globalThis.history && typeof globalThis.history.replaceState === "function") {
      globalThis.history.replaceState({}, "", next);
    }
  } catch {
    // ignore
  }
}

function renderHeroBanner({ isActive, canShow, onShowAll, onShowFeatured }) {
  const mount = document.getElementById("hero-banner");
  if (!mount) return;

  if (!canShow) {
    mount.innerHTML = "";
    return;
  }

  const label = isActive ? "Showing featured picks" : "Showing all products";
  mount.innerHTML = `
    <div style="margin:12px 0 10px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div style="font-weight:700;">${sanitizeHTML(label)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button id="shop-show-featured" type="button" style="padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;" ${
          isActive ? "disabled" : ""
        }>Show featured</button>
        <button id="shop-show-all" type="button" style="padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;" ${
          !isActive ? "disabled" : ""
        }>Show all</button>
      </div>
    </div>
  `;

  const btnAll = document.getElementById("shop-show-all");
  if (btnAll) btnAll.addEventListener("click", onShowAll);
  const btnFeatured = document.getElementById("shop-show-featured");
  if (btnFeatured) btnFeatured.addEventListener("click", onShowFeatured);
}

function renderKitsLandingPage() {
  const mount = document.getElementById("kits-landing");
  if (!mount) return;

  const pet = String(mount.getAttribute("data-kits-pet") || "").trim();
  const kitIdFilter = String(mount.getAttribute("data-kit-id") || "").trim();
  const offers = tenant?.offers && typeof tenant.offers === "object" ? tenant.offers : null;
  const starter = offers?.starterKits && typeof offers.starterKits === "object" ? offers.starterKits : null;
  const kits = Array.isArray(starter?.kits) ? starter.kits : [];

  const cleanKits = kits
    .map((k) => ({
      id: String(k?.id || "").trim(),
      title: String(k?.title || "").trim(),
      description: String(k?.description || "").trim(),
      petTypes: Array.isArray(k?.petTypes) ? k.petTypes.map((x) => String(x || "").trim()).filter(Boolean) : [],
      productIds: Array.isArray(k?.productIds) ? k.productIds.map((x) => String(x || "").trim()).filter(Boolean) : [],
    }))
    .filter((k) => k.id && k.title && k.productIds.length > 0);

  const visibleKits = cleanKits.filter((k) => {
    if (kitIdFilter) return k.id === kitIdFilter;
    if (!pet) return true;
    return k.petTypes.includes(pet);
  });

  const currency = String(tenant?.currency || "eur");
  const brandName = String(tenant?.seo?.brandName || "").trim() || "Shop";
  const heading = kitIdFilter
    ? (visibleKits[0]?.title ? String(visibleKits[0].title) : "Starter kit")
    : pet
      ? `${pet} starter kits`
      : "Starter kits";

  const intro = kitIdFilter
    ? "A simple kit built around a common need. Add the whole kit to your cart in one tap, or open each item to check the details."
    : pet
      ? `Browse ${pet.toLowerCase()} starter kits built around common needs. Add a whole kit to your cart in one tap.`
      : "Browse starter kits built around common needs. Add a whole kit to your cart in one tap.";

  if (visibleKits.length === 0) {
    mount.innerHTML = `
      <div style="padding:18px 0;">
        <h1 style="margin:0;font-size:1.5rem;">${sanitizeHTML(heading)}</h1>
        <p style="margin:10px 0 0;color:#4b5563;line-height:1.5;">${sanitizeHTML(intro)}</p>
        <div style="margin-top:14px;">
          <a href="/shop.html" style="color:inherit;">Back to shop</a>
        </div>
      </div>
    `;
    return;
  }

  const kitCards = visibleKits
    .map((k) => {
      const included = k.productIds
        .map((pid) => products.find((p) => String(p?.id || "") === pid))
        .filter(Boolean);

      const priceMinor = included.reduce((sum, p) => sum + (Number(p?.price) || 0), 0);
      const priceLabel = sanitizeHTML(formatMoneyMinorBasic(priceMinor, currency));

      const includedList = included
        .map((p) => `<li style="margin:6px 0;">${sanitizeHTML(String(p?.name || p?.title || "Item").trim())}</li>`)
        .join("");

      return `
        <article style="border:1px solid #e5e7eb;border-radius:14px;padding:14px;background:#ffffff;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="min-width:0;">
              <h2 style="margin:0;font-size:1.1rem;line-height:1.25;">${sanitizeHTML(k.title)}</h2>
              ${k.description ? `<p style="margin:8px 0 0;color:#4b5563;line-height:1.45;">${sanitizeHTML(k.description)}</p>` : ""}
              <div style="margin-top:10px;font-weight:800;">${priceLabel}</div>
            </div>
            <div style="flex:0 0 auto;">
              <button type="button" data-kit-add="${sanitizeHTML(k.id)}" style="padding:12px 14px;border:1px solid #111827;border-radius:12px;background:#111827;color:#ffffff;cursor:pointer;">Add kit</button>
            </div>
          </div>

          <details style="margin-top:12px;">
            <summary style="cursor:pointer;color:#374151;">What’s included</summary>
            <ul style="margin:10px 0 0;padding-left:20px;color:#374151;">${includedList}</ul>
          </details>
        </article>
      `;
    })
    .join("");

  const faq = [
    {
      q: "Can I buy the items individually?",
      a: "Yes. The kit is just a convenient way to add a set of items quickly. You can also add products one by one in the shop.",
    },
    {
      q: "Is this safe for puppies/kittens?",
      a: "It depends on your pet’s age and size. Check each product page for the specific safety notes and size guidance.",
    },
    {
      q: "Can I remove items from a kit?",
      a: "Right now kits are a one-tap add. If you want a custom set, add items individually from the shop.",
    },
  ];

  const pathname = String(globalThis?.location?.pathname || "");
  const moreLinks = [
    { href: "/kits/dog.html", label: "All Dog Kits" },
    { href: "/kits/cat.html", label: "All Cat Kits" },
    { href: "/kits/senior-comfort-dog.html", label: "Senior Comfort (Dog)" },
    { href: "/kits/senior-comfort-cat.html", label: "Senior Comfort (Cat)" },
    { href: "/kits/home-monitoring.html", label: "Home Monitoring (Dog or Cat)" },
  ]
    .filter((x) => x && x.href && x.label)
    .filter((x) => String(x.href) !== pathname);

  const moreLinksHtml = moreLinks
    .map(
      (x) =>
        `<a href="${sanitizeHTML(String(x.href))}" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:12px;background:#ffffff;display:inline-block;color:inherit;text-decoration:none;">${sanitizeHTML(String(x.label))}</a>`,
    )
    .join("");

  mount.innerHTML = `
    <div style="padding:18px 0;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="min-width:0;">
          <h1 style="margin:0;font-size:1.6rem;">${sanitizeHTML(heading)}</h1>
          <p style="margin:10px 0 0;color:#4b5563;line-height:1.55;max-width:70ch;">${sanitizeHTML(intro)}</p>
        </div>
        <div style="flex:0 0 auto;margin-top:2px;">
          <a href="/shop.html" style="color:inherit;">Back to shop</a>
        </div>
      </div>

      <div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">${kitCards}</div>

      <section aria-label="FAQs" style="margin-top:22px;border-top:1px solid #e5e7eb;padding-top:18px;">
        <h2 style="margin:0;font-size:1.2rem;">FAQs</h2>
        <div style="margin-top:10px;display:grid;gap:10px;max-width:78ch;">
          ${faq
            .map(
              (x) => `
                <details>
                  <summary style="cursor:pointer;font-weight:700;color:#111827;">${sanitizeHTML(x.q)}</summary>
                  <div style="margin-top:6px;color:#4b5563;line-height:1.5;">${sanitizeHTML(x.a)}</div>
                </details>
              `,
            )
            .join("")}
        </div>
      </section>

      ${
        moreLinksHtml
          ? `
            <section aria-label="More kits" style="margin-top:22px;border-top:1px solid #e5e7eb;padding-top:18px;">
              <h2 style="margin:0;font-size:1.2rem;">More kits</h2>
              <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">${moreLinksHtml}</div>
            </section>
          `
          : ""
      }
    </div>
  `;

  mount.querySelectorAll("button[data-kit-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kitId = String(btn.getAttribute("data-kit-add") || "").trim();
      const kit = visibleKits.find((k) => k.id === kitId);
      if (!kit) return;
      kit.productIds.forEach((pid) => addToCart(pid));
    });
  });

  document
    .querySelectorAll("script[data-schema='kits_faq']")
    .forEach((s) => s.remove());

  const faqPayload = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: x.a,
      },
    })),
  };

  const block = document.createElement("script");
  block.type = "application/ld+json";
  block.dataset.schema = "kits_faq";
  block.textContent = JSON.stringify(faqPayload, null, 2);
  document.head.appendChild(block);
}

function upsertMetaTag(attrName, attrValue, content) {
  const safeAttrValue = String(attrValue || "");
  const safeContent = String(content || "");
  if (!safeAttrValue) return;

  let el = document.querySelector(`meta[${attrName}='${CSS.escape(safeAttrValue)}']`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, safeAttrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", safeContent);
}

function applyTenantSeo() {
  const seo = tenant?.seo && typeof tenant.seo === "object" ? tenant.seo : null;
  const brandName = String(seo?.brandName || "").trim() || "Shop";
  const tagline = String(seo?.tagline || "").trim();

  const pathname = String(globalThis?.location?.pathname || "/");
  const isHome = pathname === "/" || pathname.endsWith("/index.html");
  const isShop = pathname.endsWith("/shop.html") || pathname === "/shop.html";
  const isCart = pathname.endsWith("/cart.html") || pathname === "/cart.html";
  const isDogKits = pathname.endsWith("/kits/dog.html") || pathname === "/kits/dog.html";
  const isCatKits = pathname.endsWith("/kits/cat.html") || pathname === "/kits/cat.html";
  const isSeniorComfortDog = pathname.endsWith("/kits/senior-comfort-dog.html") || pathname === "/kits/senior-comfort-dog.html";
  const isSeniorComfortCat = pathname.endsWith("/kits/senior-comfort-cat.html") || pathname === "/kits/senior-comfort-cat.html";
  const isSeniorDogComfortGuide = pathname.endsWith("/kits/senior-dog-comfort.html") || pathname === "/kits/senior-dog-comfort.html";
  const isNightWalkSafetyDog = pathname.endsWith("/kits/night-walk-safety-dog.html") || pathname === "/kits/night-walk-safety-dog.html";
  const isHomeMonitoring = pathname.endsWith("/kits/home-monitoring.html") || pathname === "/kits/home-monitoring.html";
  const isKits = isDogKits || isCatKits;
  const isKitDetail = isSeniorComfortDog || isSeniorComfortCat || isHomeMonitoring;

  let pageTitle = brandName;
  if (isShop) pageTitle = `${brandName} | Shop`;
  else if (isCart) pageTitle = `${brandName} | Cart`;
  else if (isDogKits) pageTitle = `${brandName} | Dog Kits`;
  else if (isCatKits) pageTitle = `${brandName} | Cat Kits`;
  else if (isSeniorComfortDog) pageTitle = `${brandName} | Senior Comfort Kit (Dog)`;
  else if (isSeniorComfortCat) pageTitle = `${brandName} | Senior Comfort Kit (Cat)`;
  else if (isSeniorDogComfortGuide) pageTitle = `${brandName} | Senior Dog Comfort Guide`;
  else if (isNightWalkSafetyDog) pageTitle = `${brandName} | Night Walk Safety for Dogs`;
  else if (isHomeMonitoring) pageTitle = `${brandName} | Home Monitoring Kit`;

  document.title = pageTitle;

  const meta = seo?.meta && typeof seo.meta === "object" ? seo.meta : null;
  const description =
    (isHome && meta?.homeDescription) ||
    (isShop && meta?.shopDescription) ||
    (isCart && meta?.cartDescription) ||
    (isDogKits && `Browse dog starter kits from ${brandName}. Add a whole kit to your cart in one tap.`) ||
    (isCatKits && `Browse cat starter kits from ${brandName}. Add a whole kit to your cart in one tap.`) ||
    (isSeniorComfortDog && `A simple comfort kit for older dogs from ${brandName}: softer rest plus gentle routine support. Add the whole kit in one tap.`) ||
    (isSeniorComfortCat && `A simple comfort kit for older cats from ${brandName}: calmer rest plus gentle routine support. Add the whole kit in one tap.`) ||
    (isSeniorDogComfortGuide && `A simple comfort guide for senior dogs: reduce stiffness, improve rest, and build a calmer routine with practical, non-ingestible picks.`) ||
    (isNightWalkSafetyDog && `A simple night-walk safety guide for dogs: visibility, calm control, and peace of mind — with practical, non-ingestible picks.`) ||
    (isHomeMonitoring && `A simple home monitoring kit from ${brandName} for peace of mind while you’re out. Add the whole kit in one tap.`) ||
    "";

  if (description) {
    upsertMetaTag("name", "description", description);
  }

  const url = String(globalThis?.location?.href || "");
  const ogTitle = tagline ? `${brandName} — ${tagline}` : brandName;
  const ogDesc = description || tagline;

  upsertMetaTag("property", "og:site_name", brandName);
  upsertMetaTag("property", "og:title", ogTitle);
  if (ogDesc) upsertMetaTag("property", "og:description", ogDesc);
  if (url) upsertMetaTag("property", "og:url", url);
  upsertMetaTag("property", "og:type", isHome ? "website" : isKits || isKitDetail ? "website" : "article");

  upsertMetaTag("name", "twitter:card", "summary_large_image");
  upsertMetaTag("name", "twitter:title", ogTitle);
  if (ogDesc) upsertMetaTag("name", "twitter:description", ogDesc);

  document
    .querySelectorAll("script[data-schema='tenant']")
    .forEach((s) => s.remove());

  const sameAs = Array.isArray(seo?.sameAs)
    ? seo.sameAs.map(String).filter(Boolean)
    : [];

  const baseUrl = globalThis.location.origin;
  const payload = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: `${baseUrl}/`,
        name: brandName,
      },
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: brandName,
        url: `${baseUrl}/`,
        sameAs,
      },
    ],
  };

  const block = document.createElement("script");
  block.type = "application/ld+json";
  block.dataset.schema = "tenant";
  block.textContent = JSON.stringify(payload, null, 2);
  document.head.appendChild(block);
}

// ============ ADMIN ORDERS PAGE ============
function formatMoneyMinor(amountMinor, currency) {
  const amount = Number(amountMinor);
  if (!Number.isFinite(amount)) return "—";
  const c = String(currency || "").toUpperCase() || "EUR";
  return `${(amount / 100).toFixed(2)} ${c}`;
}

function formatLocalDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "—";

  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw;

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      timeZoneName: "short",
    }).formatToParts(d);
    const tz = String(parts.find((p) => p.type === "timeZoneName")?.value || "")
      .trim();

    const when = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);

    return tz ? `${when} (${tz})` : when;
  } catch {
    return d.toLocaleString();
  }
}

function getSavedAdminKey() {
  try {
    return String(localStorage.getItem("admin_api_key") || "").trim();
  } catch {
    return "";
  }
}

function setSavedAdminKey(value) {
  try {
    localStorage.setItem("admin_api_key", String(value || "").trim());
  } catch {
    // ignore
  }
}

function clearSavedAdminKey() {
  try {
    localStorage.removeItem("admin_api_key");
  } catch {
    // ignore
  }
}

async function fetchAdminOrders({ adminKey, status, limit }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/orders", globalThis.location.origin);
  if (status) u.searchParams.set("status", String(status));
  if (limit) u.searchParams.set("limit", String(limit));

  const res = await fetch(String(u), {
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function fetchAdminHeartbeat({ adminKey }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/heartbeat", globalThis.location.origin);
  const res = await fetch(String(u), {
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function fetchAdminAlerts({ adminKey, limit }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/alerts", globalThis.location.origin);
  if (Number.isFinite(limit) && limit > 0) {
    u.searchParams.set("limit", String(limit));
  }

  const res = await fetch(String(u), {
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function runAdminAlerts({ adminKey }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const res = await fetch("/admin/alerts/run", {
    method: "POST",
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function fetchOpsTrends({ adminKey, days }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/ops-trends", globalThis.location.origin);
  if (Number.isFinite(days) && days > 0) {
    u.searchParams.set("days", String(days));
  }

  const res = await fetch(String(u), {
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function fetchAdGuardrails({ adminKey }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/ad-guardrails", globalThis.location.origin);
  const res = await fetch(String(u), {
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function saveAdGuardrails({
  adminKey,
  currency,
  rangeDays,
  stopSpendNoRevenueMinor,
  warnRoasBelow,
  warnProfitBelowMinor,
  note,
}) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const res = await fetch("/admin/ad-guardrails", {
    method: "POST",
    headers: {
      "x-admin-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currency,
      range_days: rangeDays,
      stop_spend_no_revenue_minor: stopSpendNoRevenueMinor,
      warn_roas_below: warnRoasBelow,
      warn_profit_below_minor: warnProfitBelowMinor,
      note,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function fetchOpsHealth({ adminKey, pendingHours }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/ops-health", globalThis.location.origin);
  if (Number.isFinite(pendingHours) && pendingHours > 0) {
    u.searchParams.set("pending_hours", String(pendingHours));
  }

  const res = await fetch(String(u), {
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function fetchAttributionSummary({ adminKey, start, end, limit, mode }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/attribution-summary", globalThis.location.origin);
  if (start) u.searchParams.set("start", String(start));
  if (end) u.searchParams.set("end", String(end));
  if (limit) u.searchParams.set("limit", String(limit));
  if (mode) u.searchParams.set("mode", String(mode));

  const res = await fetch(String(u), {
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function fetchAdSpend({ adminKey }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/ad-spend", globalThis.location.origin);
  const res = await fetch(String(u), {
    headers: {
      "x-admin-key": key,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

async function saveAdSpend({ adminKey, currency, utmSource, utmMedium, utmCampaign, utmContent, spendMinor }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const res = await fetch("/admin/ad-spend", {
    method: "POST",
    headers: {
      "x-admin-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currency,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      spend_minor: spendMinor,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

function parseMoneyToMinorUnits(value) {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  const cleaned = raw.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

function getAttributionRangePreset() {
  try {
    const v = String(localStorage.getItem("admin_attr_range") || "").trim();
    return v || "30";
  } catch {
    return "30";
  }
}

function getAttributionMode() {
  try {
    const v = String(localStorage.getItem("admin_attr_mode") || "").trim();
    return v || "funnel";
  } catch {
    return "funnel";
  }
}

function setAttributionMode(value) {
  try {
    localStorage.setItem("admin_attr_mode", String(value || "funnel"));
  } catch {
    // ignore
  }
}

function setAttributionRangePreset(value) {
  try {
    localStorage.setItem("admin_attr_range", String(value || "30"));
  } catch {
    // ignore
  }
}

function computeRangeFromPreset(preset) {
  const now = new Date();
  const end = now;

  if (String(preset) === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (String(preset) === "yesterday") {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const endY = new Date(start);
    endY.setHours(23, 59, 59, 999);
    return { start, end: endY };
  }

  if (String(preset) === "7") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  if (String(preset) === "365") {
    const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function renderAttributionSummaryPanel({ rows, start, end, spendByKey, currency, rangePreset, mode }) {
  const mount = document.getElementById("admin-attribution");
  if (!mount) return;

  const list = Array.isArray(rows) ? rows : [];
  const spendMap = spendByKey && typeof spendByKey === "object" ? spendByKey : {};
  const defaultCurrency = String(currency || "EUR");

  const calcTotals = () => {
    const totals = {
      started: 0,
      paid: 0,
      revenueMinor: 0,
      spendMinor: 0,
    };

    list.forEach((r) => {
      const source = String(r?.utm_source || "—");
      const medium = String(r?.utm_medium || "—");
      const campaign = String(r?.utm_campaign || "—");
      const ad = String(r?.utm_content || "—");
      const started = Number(r?.started || 0) || 0;
      const paid = Number(r?.paid || 0) || 0;
      const revenueMinor = Number(r?.revenue_minor || 0) || 0;
      const key = `${source}||${medium}||${campaign}||${ad}`;
      const spendMinor = Number(spendMap[key] || 0) || 0;

      totals.started += started;
      totals.paid += paid;
      totals.revenueMinor += revenueMinor;
      totals.spendMinor += spendMinor;
    });

    return totals;
  };

  const totals = calcTotals();
  const totalConv = totals.started > 0 ? `${((totals.paid / totals.started) * 100).toFixed(1)}%` : "—";
  const totalRevenue = formatMoneyMinor(totals.revenueMinor, defaultCurrency);
  const totalSpend = totals.spendMinor > 0 ? formatMoneyMinor(totals.spendMinor, defaultCurrency) : "—";
  const totalProfitMinor = totals.spendMinor > 0 ? totals.revenueMinor - totals.spendMinor : Number.NaN;
  const totalProfit = Number.isFinite(totalProfitMinor) ? formatMoneyMinor(totalProfitMinor, defaultCurrency) : "—";
  const totalRoas = totals.spendMinor > 0 ? (totals.revenueMinor / totals.spendMinor).toFixed(2) : "—";

  const totalSpendBad = totals.spendMinor > 0 && totals.revenueMinor <= 0;
  const totalSpendColor = totalSpendBad ? "#b91c1c" : totals.spendMinor > 0 ? "#111827" : "#111827";

  const totalProfitColor = Number.isFinite(totalProfitMinor)
    ? totalProfitMinor < 0
      ? "#b91c1c"
      : "#065f46"
    : "#111827";

  const totalRoasNum = totals.spendMinor > 0 ? totals.revenueMinor / totals.spendMinor : Number.NaN;
  const totalRoasColor = Number.isFinite(totalRoasNum)
    ? totalRoasNum < 1
      ? "#b91c1c"
      : totalRoasNum < 1.5
        ? "#92400e"
        : totalRoasNum >= 2
          ? "#065f46"
          : "#111827"
    : "#111827";

  const totalConvNum = totals.started > 0 ? (totals.paid / totals.started) * 100 : Number.NaN;
  const totalConvColor = Number.isFinite(totalConvNum)
    ? totalConvNum < 1
      ? "#b91c1c"
      : totalConvNum < 2
        ? "#92400e"
        : totalConvNum >= 3
          ? "#065f46"
          : "#111827"
    : "#111827";

  const kpis = `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;flex-wrap:wrap;gap:14px;color:#111827;">
      <div><strong>Started:</strong> ${sanitizeHTML(String(totals.started))}</div>
      <div><strong>Paid:</strong> ${sanitizeHTML(String(totals.paid))}</div>
      <div><strong>Conv:</strong> <span style="color:${sanitizeHTML(totalConvColor)};font-weight:${sanitizeHTML(
        totalConvColor === "#b91c1c" || totalConvColor === "#92400e" || totalConvColor === "#065f46" ? "700" : "400",
      )};">${sanitizeHTML(totalConv)}</span></div>
      <div><strong>Revenue:</strong> ${sanitizeHTML(totalRevenue)}</div>
      <div><strong>Spend:</strong> <button id="kpi-spend" type="button" style="padding:0;border:0;background:transparent;cursor:pointer;font:inherit;color:${sanitizeHTML(
        totalSpendColor,
      )};font-weight:${sanitizeHTML(totalSpendBad ? "700" : "400")};">${sanitizeHTML(totalSpend)}</button></div>
      <div><strong>ROAS:</strong> <button id="kpi-roas" type="button" style="padding:0;border:0;background:transparent;cursor:pointer;font:inherit;color:${sanitizeHTML(
        totalRoasColor,
      )};font-weight:${sanitizeHTML(
        totalRoasColor === "#b91c1c" || totalRoasColor === "#92400e" || totalRoasColor === "#065f46" ? "700" : "400",
      )};">${sanitizeHTML(String(totalRoas))}</button></div>
      <div><strong>Profit:</strong> <button id="kpi-profit" type="button" style="padding:0;border:0;background:transparent;cursor:pointer;font:inherit;color:${sanitizeHTML(
        totalProfitColor,
      )};font-weight:${sanitizeHTML(
        totalProfitColor === "#b91c1c" || totalProfitColor === "#065f46" ? "700" : "400",
      )};">${sanitizeHTML(totalProfit)}</button></div>
    </div>
  `;

  const exportBtn = `
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
      <button id="attr-copy-csv" type="button" style="padding:10px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;font:inherit;">Copy CSV</button>
      <span id="attr-copy-status" style="color:#4b5563;align-self:center;"></span>
    </div>
  `;

  const form = `
    <div style="margin-top:12px;display:grid;gap:10px;grid-template-columns:1fr;">
      <div style="display:grid;gap:8px;grid-template-columns:1fr;">
        <div style="font-weight:600;">Add / update spend (manual)</div>
        <div style="display:grid;gap:8px;grid-template-columns:1fr;">
          <input id="adspend-source" placeholder="utm_source (e.g. facebook)" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
          <input id="adspend-medium" placeholder="utm_medium (e.g. cpc)" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
          <input id="adspend-campaign" placeholder="utm_campaign (e.g. senior_comfort_launch)" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
          <input id="adspend-ad" placeholder="utm_content (ad) (e.g. video_ad_1)" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
          <input id="adspend-spend" placeholder="Spend (${sanitizeHTML(defaultCurrency.toUpperCase())}) e.g. 25.00" style="padding:10px;border-radius:8px;border:1px solid #ddd;font:inherit;" />
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button id="adspend-save" type="button" style="padding:10px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;font:inherit;">Save spend</button>
          <span id="adspend-status" style="color:#4b5563;align-self:center;"></span>
        </div>
      </div>
    </div>
  `;

  const header = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;">Attribution Summary</div>
        <div style="margin-top:6px;color:#4b5563;line-height:1.35;">Grouped by campaign + ad.</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
        <label style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:0.95rem;">
          <span>View</span>
          <select id="attr-mode" style="padding:10px 12px;border-radius:8px;border:1px solid #ddd;font:inherit;">
            <option value="funnel">Funnel</option>
            <option value="paid">Paid only</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:0.95rem;">
          <span>Range</span>
          <select id="attr-range" style="padding:10px 12px;border-radius:8px;border:1px solid #ddd;font:inherit;">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="365">Last 365 days</option>
          </select>
        </label>
        <div style="color:#6b7280;font-size:0.95rem;">${sanitizeHTML(
          `${start ? new Date(start).toLocaleDateString("en-GB") : ""}${end ? ` → ${new Date(end).toLocaleDateString("en-GB")}` : ""}`.trim(),
        )}</div>
      </div>
    </div>
  `;

  if (list.length === 0) {
    mount.innerHTML = `${header}${kpis}${exportBtn}${form}<div style="margin-top:12px;color:#4b5563;">No attributed orders found for this range.</div>`;
    const modeEl = document.getElementById("attr-mode");
    if (modeEl) modeEl.value = String(mode || "funnel");
    const rangeEl = document.getElementById("attr-range");
    if (rangeEl) rangeEl.value = String(rangePreset || "30");
    return;
  }

  const rowHtml = list
    .slice(0, 50)
    .map((r) => {
      const source = String(r?.utm_source || "—");
      const medium = String(r?.utm_medium || "—");
      const campaign = String(r?.utm_campaign || "—");
      const ad = String(r?.utm_content || "—");
      const started = Number(r?.started || 0) || 0;
      const paid = Number(r?.paid || 0) || 0;
      const rowCurrency = String(r?.currency || defaultCurrency);
      const revenueMinor = Number(r?.revenue_minor || 0) || 0;
      const revenue = formatMoneyMinor(revenueMinor, rowCurrency);
      const cr = started > 0 ? `${((paid / started) * 100).toFixed(1)}%` : "—";

      const key = `${source}||${medium}||${campaign}||${ad}`;
      const spendMinor = Number(spendMap[key] || 0) || 0;
      const spend = spendMinor > 0 ? formatMoneyMinor(spendMinor, rowCurrency) : "—";
      const roas = spendMinor > 0 ? (revenueMinor / spendMinor).toFixed(2) : "—";
      const profitMinor = spendMinor > 0 ? revenueMinor - spendMinor : Number.NaN;
      const profit = Number.isFinite(profitMinor) ? formatMoneyMinor(profitMinor, rowCurrency) : "—";

      const profitColor = Number.isFinite(profitMinor) ? (profitMinor < 0 ? "#b91c1c" : "#065f46") : "#111827";
      const spendColor = spendMinor > 0 && revenueMinor <= 0 ? "#b91c1c" : "#111827";
      const roasNum = spendMinor > 0 ? revenueMinor / spendMinor : Number.NaN;
      const roasColor = Number.isFinite(roasNum)
        ? roasNum < 1
          ? "#b91c1c"
          : roasNum < 1.5
            ? "#92400e"
            : roasNum >= 2
              ? "#065f46"
              : "#111827"
        : "#111827";

      return `
        <div style="display:grid;gap:6px;padding:10px 0;border-top:1px solid #e5e7eb;">
          <div style="font-weight:650;">${sanitizeHTML(`${campaign} | ${ad}`)}</div>
          <div style="color:#4b5563;">${sanitizeHTML(`${source} / ${medium}`)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:14px;color:#111827;">
            <div><strong>Started:</strong> ${sanitizeHTML(String(started))}</div>
            <div><strong>Paid:</strong> ${sanitizeHTML(String(paid))}</div>
            <div><strong>Conv:</strong> ${sanitizeHTML(cr)}</div>
            <div><strong>Revenue:</strong> ${sanitizeHTML(revenue)}</div>
            <div><strong>Spend:</strong> <span style="color:${sanitizeHTML(spendColor)};font-weight:${sanitizeHTML(
              spendMinor > 0 && revenueMinor <= 0 ? "700" : "400",
            )};">${sanitizeHTML(spend)}</span></div>
            <div><strong>ROAS:</strong> <span style="color:${sanitizeHTML(roasColor)};font-weight:${sanitizeHTML(
              roasColor === "#b91c1c" || roasColor === "#065f46" ? "700" : "400",
            )};">${sanitizeHTML(String(roas))}</span></div>
            <div><strong>Profit:</strong> <span style="color:${sanitizeHTML(profitColor)};font-weight:${sanitizeHTML(
              profitColor === "#b91c1c" || profitColor === "#065f46" ? "700" : "400",
            )};">${sanitizeHTML(profit)}</span></div>
          </div>
        </div>
      `;
    })
    .join("\n");

  mount.innerHTML = `${header}${kpis}${exportBtn}${form}<div style="margin-top:12px;">${rowHtml}</div>`;
  const modeEl = document.getElementById("attr-mode");
  if (modeEl) modeEl.value = String(mode || "funnel");
  const rangeEl = document.getElementById("attr-range");
  if (rangeEl) rangeEl.value = String(rangePreset || "30");

  const kpiSpendBtn = document.getElementById("kpi-spend");
  if (kpiSpendBtn) {
    kpiSpendBtn.addEventListener("click", () => {
      if (totalSpendBad) scrollToMount("admin-ad-guardrails");
      else scrollToMount("admin-attribution");
    });
  }

  const kpiRoasBtn = document.getElementById("kpi-roas");
  if (kpiRoasBtn) {
    kpiRoasBtn.addEventListener("click", () => {
      const modeSelect = document.getElementById("attr-mode");
      if (modeSelect) {
        modeSelect.value = "paid";
        setAttributionMode("paid");
      }
      scrollToMount("admin-attribution");
    });
  }

  const kpiProfitBtn = document.getElementById("kpi-profit");
  if (kpiProfitBtn) {
    kpiProfitBtn.addEventListener("click", () => {
      const modeSelect = document.getElementById("attr-mode");
      if (modeSelect) {
        modeSelect.value = "paid";
        setAttributionMode("paid");
      }
      scrollToMount("admin-attribution");
    });
  }
}

async function cleanupStalePendingOrders({ adminKey, minutes }) {
  const key = String(adminKey || "").trim();
  if (!key) throw new Error("Missing admin key");

  const u = new URL("/admin/orders/cleanup-stale", globalThis.location.origin);
  if (Number.isFinite(minutes) && minutes > 0) {
    u.searchParams.set("minutes", String(Math.floor(minutes)));
  }

  const res = await fetch(String(u), {
    method: "POST",
    headers: {
      "x-admin-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ minutes }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

function renderAdminOrders(list) {
  const container = document.getElementById("admin-orders");
  if (!container) return;

  const items = Array.isArray(list) ? list : [];
  container.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "order";
    empty.textContent = "No orders found.";
    container.appendChild(empty);
    return;
  }

  items.forEach((o) => {
    const div = document.createElement("div");
    div.className = "order";

    const orderId = String(o?.order_id || "");
    const status = String(o?.status || "");
    const email = String(o?.customer_email || "");
    const createdAt = formatLocalDateTime(o?.created_at);
    const amount = formatMoneyMinor(o?.amount_total, o?.currency);
    const sessionId = String(o?.stripe_checkout_session_id || "");
    const paymentIntentId = String(o?.stripe_payment_intent_id || "");
    const utmSource = String(o?.utm_source || "").trim();
    const utmMedium = String(o?.utm_medium || "").trim();
    const utmCampaign = String(o?.utm_campaign || "").trim();
    const utmContent = String(o?.utm_content || "").trim();

    const createdRaw = String(o?.created_at || "");
    const createdMs = createdRaw ? new Date(createdRaw).getTime() : Number.NaN;
    const ageMs = Number.isFinite(createdMs) ? Date.now() - createdMs : Number.NaN;
    const ageMin = Number.isFinite(ageMs) ? Math.floor(ageMs / 60000) : null;
    const ageText = ageMin === null ? "—" : ageMin >= 1440 ? `${Math.floor(ageMin / 1440)}d` : ageMin >= 60 ? `${Math.floor(ageMin / 60)}h ${ageMin % 60}m` : `${ageMin}m`;
    const ageColor = ageMin === null ? "#111827" : ageMin >= 120 ? "#b91c1c" : ageMin >= 30 ? "#92400e" : "#065f46";
    const ageLine = status === "pending" ? `<div><strong>Age:</strong> <span style="color:${sanitizeHTML(ageColor)};font-weight:700;">${sanitizeHTML(ageText)}</span></div>` : "";

    const attributionBits = [utmSource, utmMedium, utmCampaign].filter(Boolean);
    const adLabel = utmContent ? ` | Ad: ${utmContent}` : "";
    const utmLine =
      attributionBits.length > 0 || utmContent
        ? `<div><strong>Attribution:</strong> ${sanitizeHTML(
            `${attributionBits.length > 0 ? attributionBits.join(" / ") : "—"}${adLabel}`,
          )}</div>`
        : "";

    const copyBtn = email
      ? `<button type="button" data-copy-email="${sanitizeHTML(email)}" style="margin-top:8px;padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;">Copy email</button>`
      : "";

    div.innerHTML = `
      <div><strong>Status:</strong> ${sanitizeHTML(status || "—")}</div>
      <div><strong>Total:</strong> ${sanitizeHTML(amount)}</div>
      <div><strong>Email:</strong> ${sanitizeHTML(email || "—")}</div>
      ${utmLine}
      <div><strong>Created:</strong> ${sanitizeHTML(createdAt || "—")}</div>
      ${ageLine}
      <div><strong>Order ID:</strong> <span class="mono">${sanitizeHTML(orderId || "—")}</span></div>
      <div><strong>Stripe session:</strong> <span class="mono">${sanitizeHTML(sessionId || "—")}</span></div>
      <div><strong>Stripe payment intent:</strong> <span class="mono">${sanitizeHTML(paymentIntentId || "—")}</span></div>
      ${copyBtn}
    `;
    container.appendChild(div);
  });

  container.querySelectorAll("button[data-copy-email]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = String(btn.getAttribute("data-copy-email") || "").trim();
      if (!value) return;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          const ta = document.createElement("textarea");
          ta.value = value;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        showNotice("Email copied.");
      } catch {
        showNotice("Couldn’t copy email.");
      }
    });
  });
}

function renderNeedsAttentionPanel({ orders, onPreset }) {
  const mount = document.getElementById("admin-needs-attention");
  if (!mount) return;

  const list = Array.isArray(orders) ? orders : [];
  const now = Date.now();
  const pendingTooLong = [];
  const abandonedWithEmail = [];
  const paidMissingPaymentIntent = [];

  list.forEach((o) => {
    const status = String(o?.status || "");
    const email = String(o?.customer_email || "").trim();
    const created = String(o?.created_at || "");
    const createdMs = created ? new Date(created).getTime() : NaN;
    const ageMs = Number.isFinite(createdMs) ? now - createdMs : NaN;
    const paymentIntentId = String(o?.stripe_payment_intent_id || "").trim();

    if (status === "pending" && Number.isFinite(ageMs) && ageMs > 30 * 60 * 1000) {
      pendingTooLong.push(o);
    }

    if (status === "abandoned" && email) {
      abandonedWithEmail.push(o);
    }

    if (status === "paid" && !paymentIntentId) {
      paidMissingPaymentIntent.push(o);
    }
  });

  const row = (title, count, preset) => {
    const safeTitle = sanitizeHTML(title);
    const safeCount = sanitizeHTML(String(count));
    const countNum = Number(count || 0) || 0;
    const countColor = countNum >= 3 ? "#b91c1c" : countNum > 0 ? "#92400e" : "#065f46";

    const actionDisabled = !preset || countNum <= 0;
    const action = preset
      ? `<button type="button" data-na-preset="${sanitizeHTML(preset)}" ${
          actionDisabled ? "disabled" : ""
        } style="padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:${
          actionDisabled ? "not-allowed" : "pointer"
        };opacity:${actionDisabled ? "0.5" : "1"};">Show</button>`
      : "";

    const countHtml = `<div style="font-variant-numeric:tabular-nums;color:${sanitizeHTML(
      countColor,
    )};font-weight:700;">${safeCount}</div>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #e5e7eb;">
        <div style="font-weight:600;">${safeTitle}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${countHtml}
          ${action}
        </div>
      </div>
    `;
  };

  mount.innerHTML = `
    <div style="font-weight:700;">Needs Attention</div>
    <div style="margin-top:6px;color:#4b5563;line-height:1.35;">Auto flags to stop margin leaks and missed recoveries.</div>
    <div style="margin-top:12px;">
      ${row("Pending > 30 minutes", pendingTooLong.length, "pending_too_long")}
      ${row("Abandoned with email (recoverable)", abandonedWithEmail.length, "abandoned_with_email")}
      ${row("Paid but missing Stripe payment intent", paidMissingPaymentIntent.length, "paid_missing_pi")}
    </div>
  `;

  mount.onclick = (ev) => {
    const target = ev?.target;
    const btn = target && typeof target.closest === "function" ? target.closest("button[data-na-preset]") : null;
    if (!btn) return;
    if (btn.disabled) return;
    const preset = String(btn.getAttribute("data-na-preset") || "").trim();
    if (!preset) return;
    if (typeof onPreset === "function") onPreset(preset);
  };
}

function initAdminOrdersPage() {
  const keyEl = document.getElementById("admin-key");
  const filterEl = document.getElementById("admin-filter");
  const statusEl = document.getElementById("admin-status");
  const focusEl = document.getElementById("admin-focus");
  const hasEmailEl = document.getElementById("admin-has-email");
  const limitEl = document.getElementById("admin-limit");
  const cleanupMinutesEl = document.getElementById("admin-cleanup-minutes");
  const cleanupBtn = document.getElementById("admin-cleanup");
  const statusText = document.getElementById("admin-status-text");
  const refreshBtn = document.getElementById("admin-refresh");
  const saveBtn = document.getElementById("admin-save");
  const clearBtn = document.getElementById("admin-clear");

  if (
    !keyEl ||
    !filterEl ||
    !statusEl ||
    !focusEl ||
    !hasEmailEl ||
    !limitEl ||
    !cleanupMinutesEl ||
    !cleanupBtn ||
    !statusText ||
    !refreshBtn ||
    !saveBtn ||
    !clearBtn
  ) {
    return;
  }

  const saved = getSavedAdminKey();
  if (saved) keyEl.value = saved;

  const setStatus = (text) => {
    statusText.textContent = String(text || "");
  };

  const doFetch = async () => {
    try {
      setStatus("Loading...");
      const payload = await fetchAdminOrders({
        adminKey: keyEl.value,
        status: String(statusEl.value || ""),
        limit: Number(limitEl.value || 50) || 50,
      });

      try {
        const preset = getAttributionRangePreset();
        const desiredMode = getAttributionMode();
        const range = computeRangeFromPreset(preset);
        const [summary, spend, guardrails] = await Promise.all([
          fetchAttributionSummary({
            adminKey: keyEl.value,
            limit: 100,
            start: range?.start ? range.start.toISOString() : "",
            end: range?.end ? range.end.toISOString() : "",
            mode: desiredMode === "paid" ? "paid" : "",
          }),
          fetchAdSpend({ adminKey: keyEl.value }),
          fetchAdGuardrails({ adminKey: keyEl.value }),
        ]);

        const guardrailsRangeDays = Number(guardrails?.guardrails?.range_days || 7) || 7;
        const guardrailsNow = new Date();
        const guardrailsStart = new Date(guardrailsNow.getTime() - guardrailsRangeDays * 24 * 60 * 60 * 1000);
        const guardrailsSummary = await fetchAttributionSummary({
          adminKey: keyEl.value,
          limit: 500,
          start: guardrailsStart.toISOString(),
          end: guardrailsNow.toISOString(),
          mode: "paid",
        });

        const opsResult = await Promise.allSettled([fetchOpsHealth({ adminKey: keyEl.value, pendingHours: 1 })]);
        const opsHealthData = opsResult[0]?.status === "fulfilled" ? opsResult[0].value : null;
        if (opsResult[0]?.status === "fulfilled") {
          renderOpsHealthPanel(opsResult[0].value);
        } else {
          renderOpsHealthPanel({
            server_time: new Date().toISOString(),
            tenant_id: "",
            pending_hours: 1,
            stripe: { last_webhook_at: null, webhooks_24h: 0 },
            orders: {
              last_24h: { started: 0, paid: 0, pending: 0, abandoned: 0 },
              last_7d: { started: 0, paid: 0, pending: 0, abandoned: 0 },
              stale_pending: { count: 0, before: new Date().toISOString() },
            },
            _error: String(opsResult[0]?.reason?.message || "Failed to load ops health."),
          });
        }

        const opsTrendsSettled = await Promise.allSettled([fetchOpsTrends({ adminKey: keyEl.value, days: 7 })]);
        if (opsTrendsSettled[0]?.status === "fulfilled") {
          renderOpsTrendsPanel(opsTrendsSettled[0].value);
        } else {
          renderOpsTrendsPanel({
            days: 7,
            rows: [],
            currency: "eur",
            start: new Date().toISOString(),
            end: new Date().toISOString(),
            _error: String(opsTrendsSettled[0]?.reason?.message || "Failed to load ops trends."),
          });
        }

        const alertsSettled = await Promise.allSettled([fetchAdminAlerts({ adminKey: keyEl.value, limit: 25 })]);
        const hbSettled = await Promise.allSettled([fetchAdminHeartbeat({ adminKey: keyEl.value })]);
        if (alertsSettled[0]?.status === "fulfilled") {
          renderAlertsPanel({
            data: alertsSettled[0].value,
            heartbeat: hbSettled[0]?.status === "fulfilled" ? hbSettled[0].value : null,
            opsHealth: opsHealthData,
            adminKey: keyEl.value,
            onRun: () => {
              void doFetch();
            },
          });
        } else {
          renderAlertsPanel({
            data: { alerts: [], alert_email_to: "not_configured", _error: String(alertsSettled[0]?.reason?.message || "Failed to load alerts.") },
            heartbeat: hbSettled[0]?.status === "fulfilled" ? hbSettled[0].value : null,
            opsHealth: opsHealthData,
            adminKey: keyEl.value,
            onRun: () => {
              void doFetch();
            },
          });
        }

        const serverModeRaw = String(summary?.mode || "").trim().toLowerCase();
        const mode = serverModeRaw === "paid" ? "paid" : desiredMode;
        setAttributionMode(mode);

        const spends = Array.isArray(spend?.spends) ? spend.spends : [];
        const spendByKey = {};
        const norm = (v) => {
          const s = String(v || "").trim();
          return s ? s : "—";
        };
        spends.forEach((s) => {
          const source = norm(s?.utm_source);
          const medium = norm(s?.utm_medium);
          const campaign = norm(s?.utm_campaign);
          const ad = norm(s?.utm_content);
          const key = `${source}||${medium}||${campaign}||${ad}`;
          spendByKey[key] = Number(s?.spend_minor || 0) || 0;
        });

        renderAttributionSummaryPanel({
          rows: summary?.rows,
          start: summary?.start,
          end: summary?.end,
          currency: String(spend?.currency || "EUR"),
          spendByKey,
          rangePreset: preset,
          mode,
        });

        renderAdGuardrailsPanel({
          guardrails: guardrails?.guardrails,
          currency: String(guardrails?.currency || spend?.currency || "eur"),
          summaryRows: guardrailsSummary?.rows,
          spendByKey,
          adminKey: keyEl.value,
          onSaved: () => {
            void doFetch();
          },
        });

        const modeEl = document.getElementById("attr-mode");
        if (modeEl) {
          modeEl.addEventListener("change", () => {
            setAttributionMode(String(modeEl.value || "funnel"));
            void doFetch();
          });
        }

        const rangeEl = document.getElementById("attr-range");
        if (rangeEl) {
          rangeEl.addEventListener("change", () => {
            setAttributionRangePreset(String(rangeEl.value || "30"));
            void doFetch();
          });
        }

        const copyBtn = document.getElementById("attr-copy-csv");
        const copyStatus = document.getElementById("attr-copy-status");
        if (copyBtn) {
          copyBtn.addEventListener("click", async () => {
            try {
              if (copyStatus) copyStatus.textContent = "Copying...";
              const rows = Array.isArray(summary?.rows) ? summary.rows : [];
              const headerRow = [
                "utm_source",
                "utm_medium",
                "utm_campaign",
                "utm_content",
                "started",
                "paid",
                "conversion_rate",
                "revenue_minor",
                "spend_minor",
                "profit_minor",
                "roas",
                "currency",
                "start",
                "end",
              ];

              const csvLine = (cells) => {
                return cells
                  .map((c) => {
                    const s = String(c ?? "");
                    const escaped = s.replace(/"/g, '""');
                    return `"${escaped}"`;
                  })
                  .join(",");
              };

              const start = String(summary?.start || "");
              const end = String(summary?.end || "");
              const currency = String(spend?.currency || "eur");
              const lines = [csvLine(headerRow)];

              rows.forEach((r) => {
                const source = String(r?.utm_source || "—");
                const medium = String(r?.utm_medium || "—");
                const campaign = String(r?.utm_campaign || "—");
                const ad = String(r?.utm_content || "—");
                const started = Number(r?.started || 0) || 0;
                const paid = Number(r?.paid || 0) || 0;
                const revenueMinor = Number(r?.revenue_minor || 0) || 0;
                const key = `${source}||${medium}||${campaign}||${ad}`;
                const spendMinor = Number(spendByKey[key] || 0) || 0;
                const profitMinor = spendMinor > 0 ? revenueMinor - spendMinor : "";
                const roas = spendMinor > 0 ? (revenueMinor / spendMinor).toFixed(4) : "";
                const cr = started > 0 ? (paid / started).toFixed(4) : "";

                lines.push(
                  csvLine([
                    source,
                    medium,
                    campaign,
                    ad,
                    started,
                    paid,
                    cr,
                    revenueMinor,
                    spendMinor,
                    profitMinor,
                    roas,
                    currency,
                    start,
                    end,
                  ]),
                );
              });

              const csv = lines.join("\n");
              if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(csv);
              } else {
                const ta = document.createElement("textarea");
                ta.value = csv;
                ta.style.position = "fixed";
                ta.style.left = "-9999px";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                ta.remove();
              }

              if (copyStatus) copyStatus.textContent = "Copied.";
              showNotice("Copied CSV.");
            } catch (err) {
              if (copyStatus) copyStatus.textContent = String(err?.message || "Copy failed.");
              showNotice("Copy failed.");
            }
          });
        }

        const saveBtn = document.getElementById("adspend-save");
        const sourceEl = document.getElementById("adspend-source");
        const mediumEl = document.getElementById("adspend-medium");
        const campaignEl = document.getElementById("adspend-campaign");
        const adEl = document.getElementById("adspend-ad");
        const spendEl = document.getElementById("adspend-spend");
        const statusEl2 = document.getElementById("adspend-status");
        if (saveBtn && sourceEl && mediumEl && campaignEl && adEl && spendEl) {
          saveBtn.addEventListener("click", async () => {
            try {
              if (statusEl2) statusEl2.textContent = "Saving...";
              const minor = parseMoneyToMinorUnits(spendEl.value);
              if (!Number.isInteger(minor) || minor < 0) {
                throw new Error("Enter a valid spend amount, e.g. 25.00");
              }

              const utmSource = String(sourceEl.value || "").trim();
              const utmMedium = String(mediumEl.value || "").trim();

              const utmCampaign = String(campaignEl.value || "").trim();
              const utmContent = String(adEl.value || "").trim();
              if (!utmCampaign && !utmContent) {
                throw new Error("Enter at least a campaign or an ad");
              }

              await saveAdSpend({
                adminKey: keyEl.value,
                currency: String(spend?.currency || "eur").toLowerCase(),
                utmSource,
                utmMedium,
                utmCampaign,
                utmContent,
                spendMinor: minor,
              });

              if (statusEl2) statusEl2.textContent = "Saved.";
              void doFetch();
            } catch (err) {
              if (statusEl2) statusEl2.textContent = String(err?.message || "Save failed.");
            }
          });
        }
      } catch (err) {
        const mount = document.getElementById("admin-attribution");
        if (mount) {
          mount.innerHTML = `
            <div style="font-weight:700;">Attribution Summary</div>
            <div style="margin-top:6px;color:#b91c1c;line-height:1.35;">${sanitizeHTML(
              String(err?.message || "Failed to load attribution summary."),
            )}</div>
          `;
        }
      }

      const raw = Array.isArray(payload?.orders) ? payload.orders : [];

      renderNeedsAttentionPanel({
        orders: raw,
        onPreset: (preset) => {
          let notice = "";
          if (preset === "pending_too_long") {
            focusEl.value = "";
            statusEl.value = "pending";
            hasEmailEl.value = "";
            filterEl.value = "__pending_too_long";
            notice = "Showing pending orders older than 30 minutes.";
          } else if (preset === "abandoned_with_email") {
            focusEl.value = "";
            statusEl.value = "abandoned";
            hasEmailEl.value = "yes";
            filterEl.value = "";
            notice = "Showing abandoned orders with email.";
          } else if (preset === "paid_missing_pi") {
            focusEl.value = "";
            statusEl.value = "paid";
            hasEmailEl.value = "";
            filterEl.value = "";
            notice = "Showing paid orders missing payment intent.";
          }
          void doFetch();
          if (notice) showNotice(notice);
          scrollToMount("admin-orders");
        },
      });

      const focus = String(focusEl.value || "");
      const onlyEmail = String(hasEmailEl.value || "") === "yes";
      const filterText = String(filterEl.value || "").trim().toLowerCase();
      const filtered = raw.filter((o) => {
        if (filterText === "__pending_too_long") {
          const s = String(o?.status || "");
          if (s !== "pending") return false;
          const created = String(o?.created_at || "");
          const createdMs = created ? new Date(created).getTime() : Number.NaN;
          if (!Number.isFinite(createdMs)) return false;
          return Date.now() - createdMs > 30 * 60 * 1000;
        }

        if (focus === "recover") {
          const s = String(o?.status || "");
          if (s !== "pending" && s !== "abandoned") return false;
        }
        if (onlyEmail) {
          const e = String(o?.customer_email || "").trim();
          if (!e) return false;
        }

        if (filterText) {
          const haystack = [
            String(o?.status || ""),
            String(o?.customer_email || ""),
            String(o?.order_id || ""),
            String(o?.stripe_checkout_session_id || ""),
            String(o?.stripe_payment_intent_id || ""),
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(filterText)) return false;
        }

        return true;
      });

      renderAdminOrders(filtered);
      if (filterText === "__pending_too_long") {
        setStatus(`Pending >30m: ${filtered.length} order(s).`);
      } else {
        setStatus(`Loaded ${filtered.length} order(s).`);
      }
    } catch (err) {
      renderAdminOrders([]);
      setStatus(String(err?.message || "Failed to load orders."));
    }
  };

  refreshBtn.addEventListener("click", doFetch);
  saveBtn.addEventListener("click", () => {
    setSavedAdminKey(keyEl.value);
    setStatus("Saved.");
  });
  clearBtn.addEventListener("click", () => {
    clearSavedAdminKey();
    keyEl.value = "";
    setStatus("Cleared.");
  });

  cleanupBtn.addEventListener("click", async () => {
    try {
      const minutes = Number(cleanupMinutesEl.value || 60) || 60;
      setStatus("Cleaning...");
      const result = await cleanupStalePendingOrders({
        adminKey: keyEl.value,
        minutes,
      });
      const cleaned = Number(result?.cleaned || 0) || 0;
      showNotice(cleaned > 0 ? `Cleanup complete: marked ${cleaned} stale pending order(s) as abandoned.` : "Cleanup complete: nothing to clean.");
      void doFetch();
    } catch (err) {
      showNotice(String(err?.message || "Cleanup failed."));
      setStatus(String(err?.message || "Cleanup failed."));
    }
  });

  statusEl.addEventListener("change", doFetch);
  focusEl.addEventListener("change", doFetch);
  hasEmailEl.addEventListener("change", doFetch);
  limitEl.addEventListener("change", doFetch);
  filterEl.addEventListener("input", doFetch);

  void doFetch();
}

function renderTenantAboutSnippet() {
  const seo = tenant?.seo && typeof tenant.seo === "object" ? tenant.seo : null;
  const about = String(seo?.about || "").trim();
  if (!about) return;

  const pathname = String(globalThis?.location?.pathname || "/");
  const isHome = pathname === "/" || pathname.endsWith("/index.html");
  const isShop = pathname.endsWith("/shop.html") || pathname === "/shop.html";
  if (!isHome && !isShop) return;

  const main = document.querySelector("main");
  if (!main) return;

  const existing = document.getElementById("tenant-about");
  if (existing) return;

  const box = document.createElement("section");
  box.id = "tenant-about";
  box.style.maxWidth = "1000px";
  box.style.margin = "12px auto 0";
  box.style.padding = "12px 14px";
  box.style.border = "1px solid #e5e7eb";
  box.style.borderRadius = "10px";
  box.style.background = "#ffffff";
  box.style.color = "#111827";
  box.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
  box.style.fontSize = "0.95rem";
  box.style.lineHeight = "1.35rem";
  box.innerHTML = `<p style="margin:0;">${sanitizeHTML(about)}</p>`;

  main.insertBefore(box, main.firstChild);
}

async function loadProducts() {
  const res = await fetch("/data/products.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load products.json (${res.status})`);
  const parsed = await res.json();
  const list = Array.isArray(parsed?.products) ? parsed.products : [];
  const tenantId = getTenantId();
  const tenantCurrency = String(tenant?.currency || "").toLowerCase();
  const allowedNicheSlugs = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
    ? tenant.catalog.nicheCategorySlugs.map((s) => String(s || "").toLowerCase()).filter(Boolean)
    : null;
  const allowedProductTypes = Array.isArray(tenant?.catalog?.productTypeSlugs)
    ? tenant.catalog.productTypeSlugs.map((s) => String(s || "").toLowerCase()).filter(Boolean)
    : null;

  products = list
    .filter((p) => String(p?.tenant_id || "default") === tenantId)
    .filter((p) => {
      if (!allowedNicheSlugs || allowedNicheSlugs.length === 0) return true;
      const slug = String(p?.nicheCategory?.slug || "").toLowerCase();
      return allowedNicheSlugs.includes(slug);
    })
    .filter((p) => {
      if (!allowedProductTypes || allowedProductTypes.length === 0) return true;
      const slug = String(p?.productType?.slug || "").toLowerCase();
      return allowedProductTypes.includes(slug);
    })
    .map((p) => ({
      id: String(p.productId),
      name: String(p.title || "Product"),
      description: String(p.description || ""),
      image: String(p?.images?.[0]?.src || ""),
      canonicalPath: String(p?.seo?.canonicalPath || ""),
      productType: String(p?.productType?.slug || ""),
      nicheCategory: String(p?.nicheCategory?.slug || ""),
      price: Number(p?.price?.amount || 0),
      currency: String(p?.price?.currency || "").toLowerCase(),
      availability: String(p.availability || "https://schema.org/InStock"),
      brand: String(p.brand || ""),
      petType: Array.isArray(p?.petType) ? p.petType.map(String) : [],
      lifeStage: Array.isArray(p?.lifeStage) ? p.lifeStage.map(String) : [],
      sizeRequirement: Array.isArray(p?.sizeRequirement)
        ? p.sizeRequirement.map(String)
        : [],
    }))
    .filter((p) => {
      if (!tenantCurrency) return true;
      return String(p?.currency || "").toLowerCase() === tenantCurrency;
    });
}

async function loadReviews() {
  try {
    const res = await fetch("/data/reviews.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load reviews.json (${res.status})`);
    const parsed = await res.json();
    const list = Array.isArray(parsed?.reviews) ? parsed.reviews : [];
    const tenantId = getTenantId();
    const byProduct = new Map();
    for (const r of list) {
      if (String(r?.tenant_id || "default") !== tenantId) continue;
      const productId = String(r?.productId || "");
      if (!productId) continue;
      if (!byProduct.has(productId)) byProduct.set(productId, []);
      byProduct.get(productId).push(Number(r?.rating || 0));
    }
    reviewRatings = new Map();
    for (const [productId, ratings] of byProduct.entries()) {
      const valid = ratings.filter((n) => Number.isFinite(n) && n > 0);
      const avg = valid.length > 0 ? valid.reduce((s, n) => s + n, 0) / valid.length : 0;
      reviewRatings.set(productId, { avg, count: valid.length });
    }
  } catch (err) {
    console.error("Failed to load reviews:", err);
    reviewRatings = new Map();
  }
}

function getShopFilters() {
  const petTypeEl = document.getElementById("pet-type");
  const productTypeEl = document.getElementById("product-type");
  const lifeStageEl = document.getElementById("life-stage");
  const sizeEl = document.getElementById("size-req");

  const petType = petTypeEl ? String(petTypeEl.value || "all") : "all";
  const productType = productTypeEl
    ? String(productTypeEl.value || "all")
    : "all";
  const lifeStage = lifeStageEl ? String(lifeStageEl.value || "all") : "all";
  const size = sizeEl ? String(sizeEl.value || "all") : "all";

  return { petType, productType, lifeStage, size };
}

function applyShopFilters(list) {
  const { petType, productType, lifeStage, size } = getShopFilters();

  return list.filter((p) => {
    if (petType !== "all" && !p.petType.includes(petType)) return false;
    if (productType !== "all" && p.productType !== productType) return false;
    if (lifeStage !== "all" && !p.lifeStage.includes(lifeStage)) return false;
    if (size !== "all" && !p.sizeRequirement.includes(size)) return false;
    return true;
  });
}

// ============ CART ============
let cart = [];
cart = JSON.parse(localStorage.getItem("cart") || "[]");

function readCartTenantIdFromStorage() {
  try {
    return String(localStorage.getItem("cart_tenant_id") || "");
  } catch {
    return "";
  }
}

function writeCartTenantIdToStorage(tenantId) {
  try {
    localStorage.setItem("cart_tenant_id", String(tenantId || ""));
  } catch {
    // ignore
  }
}

function readCartFromStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCartToStorage(nextCart) {
  cart = Array.isArray(nextCart) ? nextCart : [];
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
    writeCartTenantIdToStorage(getTenantId());
  } catch (err) {
    console.error("Failed to save cart:", err);
  }
}

function saveCart() {
  writeCartToStorage(cart);
}

function updateCartBadge() {
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const el = document.getElementById("cart-count");
  if (el) el.textContent = count;
}

// ============ CART ACTIONS ============
function addToCart(productId) {
  const id = String(productId || "");
  if (!id) return;

  const product = products.find((p) => p.id === id);
  if (product) {
    const tenantCurrency = String(tenant?.currency || "").toLowerCase();
    if (tenantCurrency && String(product?.currency || "") !== tenantCurrency) {
      showNotice(
        `This store uses ${tenantCurrency.toUpperCase()} pricing. Switch storefront to buy in a different currency.`,
      );
      return;
    }

    // Block adding if not InStock or PreOrder
    if (
      product.availability !== "https://schema.org/InStock" &&
      product.availability !== "https://schema.org/PreOrder"
    ) {
      showNotice(`${product.name} is not available for purchase.`);
      return;
    }
  }

  const next = readCartFromStorage();
  const item = next.find((i) => String(i?.id || "") === id);
  if (item) item.qty = Number(item.qty || 0) + 1;
  else next.push({ id, qty: 1 });

  writeCartToStorage(next);
  updateCartBadge();
  if (product?.name) {
    showNotice(`Added ${product.name} to your cart.`, {
      actionLabel: "Checkout",
      onAction: () => {
        window.location.href = "/cart.html";
      },
    });
  }
}

function removeFromCart(productId) {
  cart = cart.filter((i) => i.id !== productId);
  saveCart();
  updateCartBadge();
  renderCartPage();
}

function updateQuantity(productId, qty) {
  const item = cart.find((i) => i.id === productId);
  if (item) {
    item.qty = Math.max(1, Number(qty)); // ensure numeric value
    saveCart();
    updateCartBadge();
    renderCartPage();
  }
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartBadge();
  renderCartPage();
}

// ============ SANITIZE HELPER ============
function sanitizeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatMoneyMinorBasic(amountMinor, currency) {
  const amount = Number(amountMinor);
  if (!Number.isFinite(amount)) return "—";
  const c = String(currency || "").toUpperCase() || "EUR";
  return `${(amount / 100).toFixed(2)} ${c}`;
}

// ============ RENDER PRODUCTS ============
function renderProducts() {
  const container = document.getElementById("product-list");
  if (!container) return;

  container.innerHTML = "";
  const filteredBase = applyShopFilters(products);

  const heroIds = getHeroProductIds();
  const canUseHero = isShopPage() && heroIds.length > 0;
  const { petType, productType, lifeStage, size } = getShopFilters();
  const filtersAreDefault = petType === "all" && productType === "all" && lifeStage === "all" && size === "all";
  const showAllPref = readShowAllProductsPreference();
  const useHeroOnly = canUseHero && filtersAreDefault && !showAllPref;

  const filtered = useHeroOnly
    ? filteredBase
        .filter((p) => heroIds.includes(String(p?.id || "")))
        .concat(filteredBase.filter((p) => !heroIds.includes(String(p?.id || ""))))
        .slice(0, heroIds.length)
    : filteredBase;

  renderHeroBanner({
    isActive: useHeroOnly,
    canShow: canUseHero && filtersAreDefault,
    onShowAll: () => {
      writeShowAllProductsPreference(true);
      renderProducts();
    },
    onShowFeatured: () => {
      writeShowAllProductsPreference(false);
      renderProducts();
    },
  });

  filtered.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product";

    // Check availability
    let actionEl = "";
    if (p.availability === "https://schema.org/InStock") {
      actionEl = `<button aria-label="Add ${sanitizeHTML(p.name)} to cart" onclick="addToCart('${p.id}')">Add to Cart</button>`;
    } else if (p.availability === "https://schema.org/PreOrder") {
      actionEl = `<button aria-label="Pre-order ${sanitizeHTML(p.name)}" onclick="addToCart('${p.id}')">Pre-Order</button>`;
    } else {
      actionEl = `<span class="out-of-stock" aria-label="Out of stock for ${sanitizeHTML(p.name)}">Out of Stock</span>`;
    }

    const href = p.canonicalPath || "#";
    const imgSrc = String(p.image || "");
    const isDemoPlaceholder = imgSrc.startsWith("/images2/");
    const imageEl = isDemoPlaceholder
      ? `<div style="width:100%;height:260px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#374151;font-size:0.95rem;text-decoration:none;">Product image coming soon</div>`
      : `<img src="${imgSrc}" alt="${sanitizeHTML(p.name)}">`;

    const rating = reviewRatings.get(p.id);
    const starEl =
      rating && rating.count > 0
        ? `<p style="margin:4px 0;color:#f59e0b;letter-spacing:1px;">${"★".repeat(Math.round(rating.avg))}${"☆".repeat(5 - Math.round(rating.avg))} <span style="color:#6b7280;font-size:0.9rem;letter-spacing:0;">(${rating.count} verified pet parent${rating.count === 1 ? "" : "s"})</span></p>`
        : "";

    card.innerHTML = `
      <a href="${sanitizeHTML(href)}">
        ${imageEl}
        <h2>${sanitizeHTML(p.name)}</h2>
      </a>
      ${starEl}
      <p>${sanitizeHTML(p.description)}</p>
      <p><strong>${(p.price / 100).toFixed(2)} ${p.currency.toUpperCase()}</strong></p>
      ${actionEl}
    `;
    container.appendChild(card);
  });

  // Batch inject structured data once per render
  injectAllSchema(filtered);
  injectShopSchema(filtered);
}

// ============ RENDER CART PAGE ============
function renderCartPage() {
  const container = document.getElementById("cart-items");
  if (!container) return;

  container.innerHTML = "";
  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    const totalEl = document.getElementById("cart-total");
    const tenantCurrency = String(tenant?.currency || "eur").toUpperCase();
    if (totalEl) totalEl.textContent = `Subtotal: 0.00 ${tenantCurrency}`;

    const shippingMount = document.getElementById("cart-shipping-progress");
    if (shippingMount) shippingMount.innerHTML = "";
    const addonsMount = document.getElementById("cart-addons");
    if (addonsMount) addonsMount.innerHTML = "";
    return;
  }

  const tenantCurrency = String(tenant?.currency || "").toLowerCase();
  const missingOrMismatched = cart.filter((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return true;
    if (tenantCurrency && String(product?.currency || "").toLowerCase() !== tenantCurrency)
      return true;
    return false;
  });
  if (missingOrMismatched.length > 0) {
    showNotice(
      "Some items in your cart aren’t available on this storefront. Clear your cart to continue.",
      {
        actionLabel: "Clear cart",
        onAction: clearCart,
      },
    );
  }

  let total = 0;
  cart.forEach((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return;
    total += product.price * item.qty;

    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <img src="${product.image}" alt="${sanitizeHTML(product.name)}" class="cart-thumb">
      <div class="cart-info">
        <h3>${sanitizeHTML(product.name)}</h3>
        <p><strong>${(product.price / 100).toFixed(2)} ${product.currency.toUpperCase()}</strong></p>
        <label>
          Qty: 
          <input type="number" value="${item.qty}" min="1"
            aria-label="Quantity for ${sanitizeHTML(product.name)}"
            onchange="updateQuantity('${item.id}', this.value)">
        </label>
        <button aria-label="Remove ${sanitizeHTML(product.name)} from cart"
          onclick="removeFromCart('${item.id}')">Remove</button>
      </div>
    `;
    container.appendChild(row);
  });

  const totalEl = document.getElementById("cart-total");
  const tenantCurrencyLabel = String(tenant?.currency || "eur").toUpperCase();
  if (totalEl)
    totalEl.textContent = `Subtotal: ${(total / 100).toFixed(2)} ${tenantCurrencyLabel}`;

  {
    const shippingMount = document.getElementById("cart-shipping-progress");
    if (shippingMount) {
      const currency = String(tenant?.currency || "eur").toLowerCase();
      const offers = tenant?.offers && typeof tenant.offers === "object" ? tenant.offers : null;
      const thresholdMinorRaw = Number(offers?.freeShipping?.thresholdMinor ?? 4000);
      const thresholdMinor = Number.isFinite(thresholdMinorRaw) && thresholdMinorRaw > 0 ? Math.floor(thresholdMinorRaw) : 4000;
      const thresholdLabel = String(offers?.freeShipping?.label || "").trim();
      const remaining = Math.max(0, thresholdMinor - total);
      const isFree = remaining <= 0;
      const percent = Math.max(0, Math.min(100, (total / thresholdMinor) * 100));

      const headline = isFree
        ? "Free UK delivery unlocked."
        : `Add ${sanitizeHTML(formatMoneyMinorBasic(remaining, currency))} for free UK delivery.`;

      shippingMount.innerHTML = `
        <div style="padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
          <div style="font-weight:700;">${headline}</div>
          <div style="margin-top:10px;height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden;">
            <div style="height:100%;width:${percent.toFixed(0)}%;background:#111827;"></div>
          </div>
          <div style="margin-top:8px;color:#4b5563;font-size:0.92rem;line-height:1.35;">${
            thresholdLabel
              ? sanitizeHTML(`Offer: ${thresholdLabel}.`)
              : sanitizeHTML(`Threshold: ${formatMoneyMinorBasic(thresholdMinor, currency)}.`)
          }</div>
        </div>
      `;
    }
  }

  {
    const mount = document.getElementById("cart-addons");
    if (mount) {
      const inCartIds = new Set(cart.map((i) => String(i?.id || "")));
      const cartProducts = cart
        .map((i) => products.find((p) => String(p?.id || "") === String(i?.id || "")))
        .filter(Boolean);

      const petTypes = new Set();
      const lifeStages = new Set();
      const sizes = new Set();
      cartProducts.forEach((p) => {
        (Array.isArray(p?.petType) ? p.petType : []).forEach((v) => petTypes.add(String(v)));
        (Array.isArray(p?.lifeStage) ? p.lifeStage : []).forEach((v) => lifeStages.add(String(v)));
        (Array.isArray(p?.sizeRequirement) ? p.sizeRequirement : []).forEach((v) => sizes.add(String(v)));
      });

      const scoreCandidate = (p) => {
        let score = 0;
        if (Array.isArray(p?.petType)) {
          for (const v of p.petType) if (petTypes.has(String(v))) score += 3;
        }
        if (Array.isArray(p?.lifeStage)) {
          for (const v of p.lifeStage) if (lifeStages.has(String(v))) score += 2;
        }
        if (Array.isArray(p?.sizeRequirement)) {
          for (const v of p.sizeRequirement) if (sizes.has(String(v))) score += 1;
        }
        return score;
      };

      const candidates = (Array.isArray(products) ? products : [])
        .filter((p) => !inCartIds.has(String(p?.id || "")))
        .filter((p) => String(p?.availability || "") === "https://schema.org/InStock")
        .map((p) => ({ p, score: scoreCandidate(p) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((x) => x.p);

      if (candidates.length === 0) {
        mount.innerHTML = "";
      } else {
        const cards = candidates
          .map((p) => {
            const imgSrc = String(p?.image || "");
            const name = sanitizeHTML(String(p?.name || "Product"));
            const price = sanitizeHTML(formatMoneyMinorBasic(p?.price, p?.currency));
            return `
              <div style="display:flex;gap:12px;align-items:center;border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#ffffff;">
                <div style="width:64px;height:64px;flex:0 0 auto;border-radius:10px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;">
                  ${
                    imgSrc
                      ? `<img src="${sanitizeHTML(imgSrc)}" alt="${name}" style="width:100%;height:100%;object-fit:cover;" />`
                      : ""
                  }
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:700;line-height:1.2;">${name}</div>
                  <div style="margin-top:4px;color:#374151;">${price}</div>
                </div>
                <div>
                  <button type="button" data-addon-id="${sanitizeHTML(String(p?.id || ""))}" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;background:#ffffff;cursor:pointer;">Add</button>
                </div>
              </div>
            `;
          })
          .join("");

        mount.innerHTML = `
          <div style="padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
            <div style="font-weight:700;">Recommended add-ons</div>
            <div style="margin-top:6px;color:#4b5563;font-size:0.92rem;line-height:1.35;">Quick upgrades that match your pet.</div>
            <div style="margin-top:12px;display:grid;gap:10px;">${cards}</div>
          </div>
        `;

        mount.querySelectorAll("button[data-addon-id]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = String(btn.getAttribute("data-addon-id") || "").trim();
            if (!id) return;
            addToCart(id);
          });
        });
      }
    }
  }

  const emailEl = document.getElementById("customer-email");
  if (emailEl) {
    const stored = readCheckoutEmailFromStorage();
    if (!String(emailEl.value || "").trim() && stored) {
      emailEl.value = stored;
    }
  }
}

// ============ CHECKOUT (Stripe) ============
async function checkout() {
  if (cart.length === 0) {
    showNotice("Your cart is empty!");
    return;
  }

  console.log("checkout: started", { cartCount: Array.isArray(cart) ? cart.length : 0 });
  showNotice("Opening secure checkout...");

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.style.opacity = "0.7";
    checkoutBtn.style.cursor = "not-allowed";
  }

  const emailEl = document.getElementById("customer-email");
  const customerEmail = emailEl ? String(emailEl.value || "").trim() : "";
  if (customerEmail) {
    saveCheckoutEmail(customerEmail);
  }

  const tenantCurrency = String(tenant?.currency || "").toLowerCase();
  const invalidItems = cart.filter((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return true;
    if (tenantCurrency && String(product?.currency || "").toLowerCase() !== tenantCurrency) return true;
    return false;
  });
  if (invalidItems.length > 0) {
    const example = String(invalidItems[0]?.id || "");
    showNotice(example ? `Unknown productId: ${example}` : "Some items in your cart aren’t available.", {
      actionLabel: "Clear cart",
      onAction: clearCart,
    });
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.style.opacity = "1";
      checkoutBtn.style.cursor = "pointer";
    }
    return;
  }

  try {
    const utm = readUtmFromStorage();
    const res = await fetch("/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: getTenantId(),
        items: cart.map((i) => ({ id: i.id, quantity: i.qty })),
        customer_email: customerEmail,
        utm,
      }),
    });

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    const isJson = contentType.includes("application/json");
    const data = isJson ? await res.json() : { error: await res.text() };

    if (!res.ok) {
      const serverError = String(data?.error || "Checkout failed. Please try again.");
      console.error("Checkout failed:", { status: res.status, serverError });
      showNotice(serverError);
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.style.opacity = "1";
        checkoutBtn.style.cursor = "pointer";
      }
      return;
    }

    if (data.sessionUrl) {
      window.location.href = data.sessionUrl;
      return;
    }

    showNotice(String(data?.error || "Checkout failed. Please try again."), {
      actionLabel: "Clear cart",
      onAction: clearCart,
    });
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.style.opacity = "1";
      checkoutBtn.style.cursor = "pointer";
    }
  } catch (err) {
    console.error("Checkout error:", err);
    showNotice(String(err?.message || "Something went wrong during checkout."));
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.style.opacity = "1";
      checkoutBtn.style.cursor = "pointer";
    }
  }
}

// ============ SEO JSON-LD ============
function injectAllSchema(list) {
  // Remove any old schema blocks first
  document
    .querySelectorAll("script[data-schema='product']")
    .forEach((s) => s.remove());

  const origin = globalThis.location.origin;

  const graph = list.map((p) => ({
    "@type": "Product",
    "@id": `${origin}${String(p?.canonicalPath || "")}`,
    name: p.name,
    description: p.description,
    image: [`${origin}${p.image}`],
    brand: { "@type": "Brand", name: p.brand },
    offers: {
      "@type": "Offer",
      "@id": `${origin}${String(p?.canonicalPath || "")}#offer`,
      priceCurrency: p.currency.toUpperCase(),
      price: (p.price / 100).toFixed(2),
      availability: p.availability,
      url: `${origin}${String(p?.canonicalPath || "")}`,
    },
  }));

  const payload = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  const block = document.createElement("script");
  block.type = "application/ld+json";
  block.dataset.schema = "product";
  block.textContent = JSON.stringify(payload, null, 2);
  document.head.appendChild(block);
}

function injectShopSchema(list) {
  const path = String(globalThis?.location?.pathname || "");
  if (!path.endsWith("/shop.html") && !path.endsWith("shop.html")) return;

  document
    .querySelectorAll("script[data-schema='shop']")
    .forEach((s) => s.remove());

  const origin = globalThis.location.origin;
  const tenantCurrency = String(tenant?.currency || "").toUpperCase();

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: tenantCurrency
      ? `Shop products (${tenantCurrency})`
      : "Shop products",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: Array.isArray(list) ? list.length : 0,
    itemListElement: (Array.isArray(list) ? list : []).map((p, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${origin}${String(p?.canonicalPath || "")}`,
      name: String(p?.name || "Product"),
    })),
  };

  const block = document.createElement("script");
  block.type = "application/ld+json";
  block.dataset.schema = "shop";
  block.textContent = JSON.stringify(itemList, null, 2);
  document.head.appendChild(block);
}

// ============ INIT ============
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadTenant();
    await loadProducts();
    await loadReviews();
  } catch (err) {
    console.error("Failed to load products:", err);
  }

  const emailEl = document.getElementById("customer-email");
  if (emailEl) {
    const stored = readCheckoutEmailFromStorage();
    if (!String(emailEl.value || "").trim() && stored) {
      emailEl.value = stored;
    }
  }

  const storedCartTenantId = readCartTenantIdFromStorage();
  const activeTenantId = getTenantId();
  if (storedCartTenantId && storedCartTenantId !== activeTenantId) {
    try {
      localStorage.removeItem("cart");
    } catch {
      // ignore
    }
    cart = [];
    writeCartTenantIdToStorage(activeTenantId);
    showNotice("You switched storefronts, so we cleared your cart to match this store.");
  } else if (!storedCartTenantId) {
    writeCartTenantIdToStorage(activeTenantId);
  }

  cart = readCartFromStorage();

  captureUtmFromUrl();

  applyShopFeaturedQueryParam();

  injectSharedHeader();
  ensureAbsoluteCanonical();
  applyTenantSeo();
  renderTrustStrip();
  renderStarterKits();
  renderKitsLandingPage();
  renderTenantAboutSnippet();

  const applyHashCategoryFilter = () => {
    const hash = String(globalThis.location.hash || "").replace(/^#/, "");
    if (!hash) return;

    const productTypeEl = document.getElementById("product-type");
    if (!productTypeEl) return;

    const match = Array.from(productTypeEl.options || []).some(
      (o) => String(o?.value || "") === hash,
    );
    if (!match) return;

    productTypeEl.value = hash;
  };

  applyHashCategoryFilter();
  renderProducts();
  updateCartBadge();
  renderCartPage();
  initAdminOrdersPage();

  const petTypeEl = document.getElementById("pet-type");
  if (petTypeEl) petTypeEl.addEventListener("change", renderProducts);
  const productTypeEl = document.getElementById("product-type");
  if (productTypeEl) productTypeEl.addEventListener("change", renderProducts);

  const lifeStageEl = document.getElementById("life-stage");
  if (lifeStageEl) lifeStageEl.addEventListener("change", renderProducts);

  const sizeEl = document.getElementById("size-req");
  if (sizeEl) sizeEl.addEventListener("change", renderProducts);

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", checkout);

  const clearBtn = document.getElementById("clear-cart");
  if (clearBtn) clearBtn.addEventListener("click", clearCart);

  if (emailEl) {
    emailEl.addEventListener("change", () => {
      saveCheckoutEmail(String(emailEl.value || "").trim());
    });
  }

  globalThis.addEventListener("hashchange", () => {
    applyHashCategoryFilter();
    renderProducts();
  });
});
