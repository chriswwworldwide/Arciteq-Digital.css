// Coach's desk: Dina's private view of traffic + people, built on the engine's
// admin endpoints (/admin/traffic, /admin/people). The coach key is the
// server's ADMIN_API_KEY, kept in localStorage on her device only.
// Deep links: /roxjaya/coach/#traffic, #people, #people?q=someone@x.com, #howto.
(function () {
  const KEY = "roxjaya.coach.key";
  const login = document.getElementById("login");
  const tabs = document.getElementById("tabs");
  const panels = Array.from(document.querySelectorAll(".desk-panel"));
  const keyForm = document.getElementById("key-form");
  const loginHint = document.getElementById("login-hint");
  let days = 30;
  let people = null;
  let traffic = null;

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmtDate = (v) => {
    const d = new Date(v);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "";
  };
  const ago = (v) => {
    const ms = Date.now() - new Date(v).getTime();
    if (!Number.isFinite(ms)) return "";
    const h = Math.floor(ms / 36e5);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? "yesterday" : `${d} days ago`;
  };
  const money = (minor, cur) => {
    const n = Number(minor || 0);
    if (!n) return "";
    if (String(cur || "").toLowerCase() === "idr") {
      return "Rp " + Math.round(n / 100).toLocaleString("id-ID");
    }
    return (n / 100).toFixed(2) + " " + String(cur || "").toUpperCase();
  };

  async function api(path) {
    const key = localStorage.getItem(KEY) || "";
    const r = await fetch(path, { headers: { "x-admin-key": key } });
    if (r.status === 401) throw new Error("unauthorized");
    if (!r.ok) throw new Error("failed");
    return r.json();
  }

  function show(tab) {
    tabs.querySelectorAll("[role=tab]").forEach((b) => {
      b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false");
    });
    panels.forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (location.hash.replace(/^#/, "").split("?")[0] !== tab) {
      history.replaceState(null, "", "#" + tab);
    }
  }

  // ---- Today -------------------------------------------------------------
  function renderToday() {
    const todo = document.getElementById("todo");
    const stats = document.getElementById("today-stats");
    const since = Date.now() - 7 * 864e5;
    const list = people?.people || [];
    let leads = 0;
    let photos = 0;
    let splits = 0;
    let paid = 0;
    list.forEach((p) => {
      (p.events || []).forEach((e) => {
        const t = new Date(e.at).getTime();
        if (t < since) return;
        if (e.type === "lead_captured") leads += 1;
        if (e.type === "order_completed") paid += 1;
      });
      (p.submissions || []).forEach((s) => {
        if (new Date(s.created_at).getTime() < since) return;
        if (s.kind === "wall_photo") photos += 1;
        if (s.kind === "race_splits") splits += 1;
      });
    });
    const items = [
      {
        n: leads,
        text: "new Ask Dina leads to reply to",
        link: "#people",
        cta: "See who",
        clear: "No new leads this week — post something!",
      },
      {
        n: photos,
        text: "Warriors Wall photos waiting for your OK",
        link: "#people?q=wall_photo",
        cta: "Review",
        clear: "No new wall photos",
      },
      {
        n: splits,
        text: "athletes analysed a race (warm leads)",
        link: "#people?q=race_splits",
        cta: "Look",
        clear: "No new split analyses",
      },
      {
        n: paid,
        text: "new payments — welcome them in TrueCoach",
        link: "#people?q=paid",
        cta: "See",
        clear: "No new payments this week",
      },
    ];
    todo.innerHTML = items
      .map((it) =>
        it.n
          ? `<li><span class="n">${it.n}</span><span>${esc(it.text)}</span><a href="${it.link}">${esc(it.cta)} →</a></li>`
          : `<li class="is-clear"><span class="n">0</span><span>${esc(it.clear)}</span></li>`,
      )
      .join("");
    const week = (traffic?.days || []).slice(-7);
    const views = week.reduce((n, d) => n + d.views, 0);
    const visitors = week.reduce((n, d) => n + d.visitors, 0);
    stats.innerHTML = [
      [views, "page views, last 7 days"],
      [visitors, "visitors, last 7 days"],
      [list.length, `people on your list (${people?.days || 90} days)`],
      [traffic?.sources?.[0]?.key || "—", "top source of visitors"],
    ]
      .map(
        ([b, s]) =>
          `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`,
      )
      .join("");
  }

  // ---- Traffic -----------------------------------------------------------
  function table(el, rows, total, labelFn) {
    if (!rows?.length) {
      el.innerHTML = `<tr><td class="muted">Nothing yet — share a link!</td></tr>`;
      return;
    }
    el.innerHTML = rows
      .map((r) => {
        const pct = total ? Math.round((r.count / total) * 100) : 0;
        return `<tr><td>${labelFn(r.key)}<span class="barline"><i style="width:${pct}%"></i></span></td><td>${r.count}</td></tr>`;
      })
      .join("");
  }
  function pageLabel(path) {
    const names = {
      "/roxjaya/": "Home",
      "/roxjaya/splits/": "Split analyser",
      "/roxjaya/results/": "Results board",
      "/roxjaya/events/": "Events",
      "/roxjaya/stations-prep/": "Stations Prep",
      "/roxjaya/run-zone/": "Run Zone",
      "/roxjaya/fuel-zone/": "Fuel Zone",
      "/roxjaya/taper-zone/": "Taper Zone",
      "/roxjaya/warrior-program/": "Warrior Program page",
      "/roxjaya/hybrid-coaching-jakarta/": "Hybrid Coaching page",
      "/roxjaya/elite-race-prep/": "Elite Race Prep page",
    };
    return esc(names[path] || path);
  }
  function renderTraffic() {
    const t = traffic || {};
    document.getElementById("traffic-stats").innerHTML = [
      [t.views || 0, `page views, ${t.days || days} days`],
      [t.visitors || 0, "visitors (daily uniques)"],
      [t.identified || 0, "views by people you know"],
      [t.pages?.length || 0, "different pages read"],
    ]
      .map(
        ([b, s]) =>
          `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`,
      )
      .join("");
    const chart = document.getElementById("traffic-chart");
    const series = t.days || [];
    const max = Math.max(1, ...series.map((d) => d.views));
    chart.innerHTML =
      series
        .map(
          (d) =>
            `<div class="bar" tabindex="0" style="height:${Math.max(3, Math.round((d.views / max) * 100))}%" data-label="${esc(fmtDate(d.day))}: ${d.views} views, ${d.visitors} visitors"></div>`,
        )
        .join("") +
      (series.length
        ? `<span class="axis left">${esc(fmtDate(series[0].day))}</span><span class="axis right">${esc(fmtDate(series[series.length - 1].day))}</span>`
        : `<span class="axis left">No visits recorded yet</span>`);
    table(
      document.getElementById("traffic-pages"),
      t.pages,
      t.views,
      pageLabel,
    );
    table(document.getElementById("traffic-sources"), t.sources, t.views, esc);
  }

  // ---- People ------------------------------------------------------------
  function personMatches(p, q) {
    if (!q) return true;
    if (q === "paid")
      return (p.total_orders || 0) > 0 || p.subscriptions?.length;
    if (q === "wall_photo" || q === "race_splits") {
      return (p.submissions || []).some((s) => s.kind === q);
    }
    const hay = [
      p.email,
      p.source,
      p.campaign,
      JSON.stringify(p.profile || {}),
      ...(p.submissions || []).map((s) => JSON.stringify(s.payload || {})),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  }
  function profileList(profile) {
    const nice = {
      goal: "Goal",
      days_per_week: "Days/week",
      city: "City",
      experience: "Experience",
      race: "Next race",
      message: "Said",
      recommended_plan: "Site suggested",
      zone: "Site suggested",
    };
    const entries = Object.entries(profile || {}).filter(([, v]) => v);
    if (!entries.length) return `<li class="muted">Nothing filled in</li>`;
    return entries
      .map(
        ([k, v]) =>
          `<li><b>${esc(nice[k] || k.replace(/_/g, " "))}:</b> ${esc(Array.isArray(v) ? v.join(", ") : v)}</li>`,
      )
      .join("");
  }
  function submissionList(subs) {
    if (!subs?.length) return `<li class="muted">None</li>`;
    return subs
      .slice(0, 8)
      .map((s) => {
        const p = s.payload || {};
        if (s.kind === "wall_photo") {
          return `<li>📷 <b>Wall photo</b> (${esc(fmtDate(s.created_at))}) — “${esc(p.caption || "")}” by ${esc(p.by || "?")}, ${esc(p.event || "no event")}, consent: ${esc(p.consent || "?")}</li>`;
        }
        if (s.kind === "race_splits") {
          const total = Number(p.total) || 0;
          const t = total
            ? `${Math.floor(total / 3600)}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
            : "";
          return `<li>⏱ <b>Race splits</b> (${esc(fmtDate(s.created_at))}) — ${esc(p.division || "")} ${esc(p.event || "")} ${esc(t)}</li>`;
        }
        return `<li><b>${esc(s.kind)}</b> (${esc(fmtDate(s.created_at))})</li>`;
      })
      .join("");
  }
  function eventList(events) {
    const nice = {
      lead_captured: "Sent an Ask Dina message",
      cart_captured: "Left an email at checkout",
      submission: "Made a submission",
      order_completed: "Paid",
      "stripe.invoice.paid": "Renewal paid",
      subscription_payment_failed: "Renewal payment failed",
      subscription_canceled: "Cancelled subscription",
      nudge_sent: "Got a reminder email",
    };
    if (!events?.length) return `<li class="muted">None</li>`;
    return events
      .slice(0, 8)
      .map(
        (e) =>
          `<li>${esc(nice[e.type] || e.type.replace(/_/g, " "))} <span class="muted">· ${esc(ago(e.at))}</span></li>`,
      )
      .join("");
  }
  function pagesList(pages) {
    if (!pages?.length) {
      return `<li class="muted">No page views since they identified themselves</li>`;
    }
    return pages
      .slice(0, 8)
      .map(
        (v) =>
          `<li>${pageLabel(v.path)} <span class="muted">· ${v.views}× · last ${esc(ago(v.last_at))}</span></li>`,
      )
      .join("");
  }
  function renderPeople() {
    const q = String(
      document.getElementById("people-search").value || "",
    ).trim();
    const el = document.getElementById("people-list");
    const list = (people?.people || []).filter((p) => personMatches(p, q));
    if (!list.length) {
      el.innerHTML = `<p class="hint">${
        people?.people?.length
          ? "No one matches that search."
          : "No one yet. The first Ask Dina message, split analysis or wall photo will appear here."
      }</p>`;
      return;
    }
    el.innerHTML = list
      .map((p) => {
        const tags = [];
        const plan = p.profile?.recommended_plan || p.profile?.zone;
        if (plan) tags.push(`<span class="tag hot">${esc(plan)}</span>`);
        if (p.subscriptions?.some((s) => s.status === "active")) {
          tags.push(`<span class="tag paid">subscriber</span>`);
        } else if ((p.total_orders || 0) > 0) {
          tags.push(`<span class="tag paid">paid</span>`);
        }
        (p.submissions || []).some((s) => s.kind === "race_splits") &&
          tags.push(`<span class="tag">splits</span>`);
        (p.submissions || []).some((s) => s.kind === "wall_photo") &&
          tags.push(`<span class="tag">wall photo</span>`);
        if (p.source)
          tags.push(`<span class="tag">via ${esc(p.source)}</span>`);
        const spend = money(p.total_spend_minor, p.currency);
        return `<details class="person">
          <summary><b>${esc(p.email)}</b>${tags.join("")}<span class="when">${esc(ago(p.last_seen_at))}</span></summary>
          <div class="body">
            <div><h4>What they told you</h4><ul>${profileList(p.profile)}</ul>
              <a class="reply" href="mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent("Your Hyrox plan — Dina (Roxjaya)")}">Reply by email →</a></div>
            <div><h4>What they sent</h4><ul>${submissionList(p.submissions)}</ul></div>
            <div><h4>Pages they read</h4><ul>${pagesList(p.pages)}</ul></div>
            <div><h4>Timeline</h4><ul>${eventList(p.events)}</ul>${spend ? `<p class="hint">Total paid: ${esc(spend)}</p>` : ""}</div>
          </div>
        </details>`;
      })
      .join("");
  }

  // ---- Boot --------------------------------------------------------------
  async function load() {
    const [t, p] = await Promise.all([
      api(`/admin/traffic?days=${days}`),
      api("/admin/people?days=365&limit=500"),
    ]);
    traffic = t;
    people = p;
    renderToday();
    renderTraffic();
    renderPeople();
  }

  function openDesk() {
    login.hidden = true;
    tabs.hidden = false;
    const [tab, qs] = location.hash.replace(/^#/, "").split("?");
    const q = new URLSearchParams(qs || "").get("q");
    if (q) document.getElementById("people-search").value = q;
    show(["today", "traffic", "people", "howto"].includes(tab) ? tab : "today");
    return load().catch((err) => {
      if (err.message === "unauthorized") {
        localStorage.removeItem(KEY);
        login.hidden = false;
        tabs.hidden = true;
        panels.forEach((p) => (p.hidden = true));
        loginHint.textContent =
          "That key didn't work — check it and try again.";
      } else {
        document.getElementById("todo").innerHTML =
          `<li class="is-clear">Couldn't load the numbers just now (the site may be running without its database). The How-to tab still works.</li>`;
      }
    });
  }

  keyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const key = String(new FormData(keyForm).get("key") || "").trim();
    if (!key) return;
    localStorage.setItem(KEY, key);
    loginHint.textContent = "";
    openDesk();
  });
  document.getElementById("logout").addEventListener("click", () => {
    localStorage.removeItem(KEY);
    location.hash = "";
    location.reload();
  });
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[role=tab]");
    if (b) show(b.dataset.tab);
  });
  window.addEventListener("hashchange", () => {
    if (tabs.hidden) return;
    const [tab, qs] = location.hash.replace(/^#/, "").split("?");
    const q = new URLSearchParams(qs || "").get("q");
    if (q !== null) {
      document.getElementById("people-search").value = q;
      renderPeople();
    }
    if (["today", "traffic", "people", "howto"].includes(tab)) show(tab);
  });
  document.querySelectorAll(".range .btn").forEach((b) => {
    b.addEventListener("click", () => {
      days = Number(b.dataset.days) || 30;
      document
        .querySelectorAll(".range .btn")
        .forEach((x) =>
          x.setAttribute("aria-pressed", x === b ? "true" : "false"),
        );
      api(`/admin/traffic?days=${days}`)
        .then((t) => {
          traffic = t;
          renderTraffic();
        })
        .catch(() => {});
    });
  });
  document
    .getElementById("people-search")
    .addEventListener("input", renderPeople);

  if (localStorage.getItem(KEY)) openDesk();
})();
