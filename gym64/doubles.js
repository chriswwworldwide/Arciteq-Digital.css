(function () {
  const timesForm = document.getElementById("times-form");
  if (!timesForm) return;

  const STATIONS = [
    { key: "skierg", label: "SkiErg", ref: 270 },
    { key: "sled_push", label: "Sled Push", ref: 210 },
    { key: "sled_pull", label: "Sled Pull", ref: 270 },
    { key: "burpee_broad_jumps", label: "Burpee Broad Jumps", ref: 270 },
    { key: "rowing", label: "Rowing", ref: 285 },
    { key: "farmers_carry", label: "Farmers Carry", ref: 135 },
    { key: "sandbag_lunges", label: "Sandbag Lunges", ref: 240 },
    { key: "wall_balls", label: "Wall Balls", ref: 330 },
  ];
  const DEFAULT_NAMES = ["Athlete A", "Athlete B", "Athlete C", "Athlete D"];

  const formatSel = document.getElementById("format");
  const names = document.getElementById("names");
  const table = document.getElementById("times-table");
  const note = document.getElementById("plan-note");
  const plan = document.getElementById("plan");

  function toSec(t) {
    const m = String(t || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function fmt(sec) {
    if (!Number.isFinite(sec)) return "—";
    const neg = sec < 0;
    const s = Math.round(Math.abs(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${neg ? "−" : ""}${m}:${String(r).padStart(2, "0")}`;
  }
  function pct(x) {
    return `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`;
  }
  function el(tag, text, cls) {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  function clear(n) {
    while (n.firstChild) n.removeChild(n.firstChild);
  }
  function count() {
    return Number(formatSel.value) === 4 ? 4 : 2;
  }
  function nameOf(i) {
    const v = names.querySelector(`[name="name_${i}"]`);
    return (v && v.value.trim()) || DEFAULT_NAMES[i];
  }

  function buildInputs() {
    const n = count();
    const keep = {};
    timesForm
      .querySelectorAll("input")
      .forEach((i) => (keep[i.name] = i.value));
    names.querySelectorAll("input").forEach((i) => (keep[i.name] = i.value));
    clear(names);
    for (let i = 0; i < n; i++) {
      const lab = el("label");
      lab.appendChild(el("span", `Name ${i + 1}`));
      const inp = el("input");
      inp.name = `name_${i}`;
      inp.placeholder = DEFAULT_NAMES[i];
      inp.maxLength = 24;
      inp.value = keep[inp.name] || "";
      inp.addEventListener("input", () => {
        table.querySelectorAll(`[data-name="${i}"]`).forEach((h) => {
          h.textContent = nameOf(i);
        });
      });
      lab.appendChild(inp);
      names.appendChild(lab);
    }
    clear(table);
    const thead = el("thead");
    const hr = el("tr");
    hr.appendChild(el("th", "Station"));
    for (let i = 0; i < n; i++) {
      const th = el("th", nameOf(i));
      th.dataset.name = String(i);
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    const tb = el("tbody");
    for (const s of STATIONS) {
      const tr = el("tr");
      tr.appendChild(el("td", s.label));
      for (let i = 0; i < n; i++) {
        const td = el("td");
        const inp = el("input");
        inp.name = `${s.key}_${i}`;
        inp.inputMode = "numeric";
        inp.placeholder = "m:ss";
        inp.pattern = "\\d{1,2}:\\d{2}";
        inp.value = keep[inp.name] || "";
        td.appendChild(inp);
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    plan.hidden = true;
  }

  function readTimes() {
    const n = count();
    const data = new FormData(timesForm);
    const t = [];
    for (let i = 0; i < n; i++) {
      const row = {};
      let any = false;
      for (const s of STATIONS) {
        const raw = String(data.get(`${s.key}_${i}`) || "").trim();
        if (!raw) continue;
        const v = toSec(raw);
        if (v == null || v <= 0) {
          return {
            error: `Check ${nameOf(i)} — ${s.label}: use m:ss, e.g. 4:12.`,
          };
        }
        row[s.key] = v;
        any = true;
      }
      if (!any) return { error: `${nameOf(i)} has no station times yet.` };
      t.push(row);
    }
    return { t };
  }

  // Doubles: share each station in proportion to relative speed, capped so
  // nobody does the whole thing unless the partner has no time for it.
  function planDoubles(t) {
    const rows = STATIONS.map((s) => {
      const a = t[0][s.key];
      const b = t[1][s.key];
      if (!a && !b) return null;
      if (!a || !b) {
        const who = a ? 0 : 1;
        const only = a || b;
        return {
          ...s,
          a,
          b,
          who,
          shareA: who === 0 ? 1 : 0,
          best: only,
          even: only,
          solo: only,
          gap: null,
        };
      }
      const rawA = b / (a + b);
      const shareA = Math.min(0.75, Math.max(0.25, 0.5 + 2 * (rawA - 0.5)));
      const who = a <= b ? 0 : 1;
      const best = shareA * a + (1 - shareA) * b;
      const even = 0.5 * a + 0.5 * b;
      const solo = Math.min(a, b);
      return {
        ...s,
        a,
        b,
        who,
        shareA,
        best,
        even,
        solo,
        gap: Math.abs(a - b) / Math.max(a, b),
      };
    }).filter(Boolean);
    const sum = (k) => rows.reduce((x, r) => x + r[k], 0);
    const totA = rows.filter((r) => r.a).reduce((x, r) => x + r.a, 0);
    const totB = rows.filter((r) => r.b).reduce((x, r) => x + r.b, 0);
    const stronger = totA <= totB ? 0 : 1;
    return {
      rows,
      best: sum("best"),
      even: sum("even"),
      solo: sum("solo"),
      stronger,
      totA,
      totB,
    };
  }

  // Relay: brute-force every 2-stations-each assignment, fastest total wins.
  function planRelay(t) {
    const n = t.length;
    const m = STATIONS.length;
    const per = m / n;
    let best = null;
    const assign = new Array(m);
    const load = new Array(n).fill(0);
    function rec(i, total) {
      if (best && total >= best.total) return;
      if (i === m) {
        best = { total, assign: assign.slice() };
        return;
      }
      for (let a = 0; a < n; a++) {
        if (load[a] >= per) continue;
        const v = t[a][STATIONS[i].key];
        if (!v) continue;
        load[a]++;
        assign[i] = a;
        rec(i + 1, total + v);
        load[a]--;
      }
    }
    rec(0, 0);
    if (!best) return null;
    // "Everyone picks their favourite": each athlete claims their own two
    // fastest stations in order of overall strength; clashes go to whoever
    // is stronger overall.
    const strength = t
      .map((row, a) => ({
        a,
        tot: STATIONS.reduce((x, s) => x + (row[s.key] || 9999), 0),
      }))
      .sort((x, y) => x.tot - y.tot)
      .map((x) => x.a);
    const naive = new Array(m).fill(-1);
    const taken = new Array(n).fill(0);
    for (const a of strength) {
      const prefs = STATIONS.map((s, i) => ({
        i,
        v: t[a][s.key] || Infinity,
      })).sort((x, y) => x.v - y.v);
      for (const p of prefs) {
        if (taken[a] >= per) break;
        if (naive[p.i] === -1 && Number.isFinite(p.v)) {
          naive[p.i] = a;
          taken[a]++;
        }
      }
    }
    const naiveTotal = naive.every((a) => a >= 0)
      ? naive.reduce((x, a, i) => x + t[a][STATIONS[i].key], 0)
      : null;
    return { ...best, naive, naiveTotal };
  }

  function renderDoubles(p) {
    const n0 = nameOf(0);
    const n1 = nameOf(1);
    const summary = document.getElementById("plan-summary");
    const ptable = document.getElementById("plan-table");
    const surprises = document.getElementById("plan-surprises");
    const coaching = document.getElementById("plan-coaching");
    [summary, ptable, surprises, coaching].forEach(clear);

    const saveEven = p.even - p.best;
    const items = [
      ["Planned station time", fmt(p.best)],
      [
        "vs splitting every station 50/50",
        `${fmt(p.even)} (saves ${fmt(saveEven)})`,
      ],
      [
        "vs strongest takes it all",
        `${fmt(p.solo)} on paper — then two dead runs`,
      ],
    ];
    for (const [k, v] of items) {
      const li = el("li");
      li.appendChild(el("strong", v));
      li.appendChild(el("span", k));
      summary.appendChild(li);
    }

    const thead = el("thead");
    const hr = el("tr");
    ["Station", n0, n1, "Who leads", "Share"].forEach((h) =>
      hr.appendChild(el("th", h)),
    );
    thead.appendChild(hr);
    ptable.appendChild(thead);
    const tb = el("tbody");
    for (const r of p.rows) {
      const tr = el("tr");
      tr.appendChild(el("td", r.label));
      tr.appendChild(el("td", fmt(r.a), r.who === 0 ? "dev-strong" : ""));
      tr.appendChild(el("td", fmt(r.b), r.who === 1 ? "dev-strong" : ""));
      const lead =
        r.gap == null
          ? `${r.who === 0 ? n0 : n1} (only time)`
          : `${r.who === 0 ? n0 : n1} · ${Math.round(r.gap * 100)}% faster`;
      tr.appendChild(el("td", lead));
      const sa = Math.round(r.shareA * 100);
      tr.appendChild(el("td", `${n0} ${sa}% · ${n1} ${100 - sa}%`));
      tb.appendChild(tr);
    }
    ptable.appendChild(tb);

    const strongerName = p.stronger === 0 ? n0 : n1;
    const weakerName = p.stronger === 0 ? n1 : n0;
    const upsets = p.rows.filter((r) => r.gap != null && r.who !== p.stronger);
    if (upsets.length) {
      surprises.appendChild(
        el(
          "li",
          `${strongerName} is faster overall (${fmt(p.stronger === 0 ? p.totA : p.totB)} vs ${fmt(p.stronger === 0 ? p.totB : p.totA)} across the stations) — but ${weakerName} should lead ${upsets.map((r) => r.label).join(", ")}. Most teams get this backwards.`,
        ),
      );
    } else {
      surprises.appendChild(
        el(
          "li",
          `${strongerName} is faster on every station entered. The surprise is that ${strongerName} should still only take 55–75% of each one: the metres they give away cost less than the run they'd lose.`,
        ),
      );
    }
    const close = p.rows.filter((r) => r.gap != null && r.gap < 0.05);
    if (close.length) {
      surprises.appendChild(
        el(
          "li",
          `Dead heats (under 5% apart): ${close.map((r) => r.label).join(", ")}. Split these by who feels fresher off the run, not by plan.`,
        ),
      );
    }
    const biggest = p.rows
      .filter((r) => r.gap != null)
      .sort((a, b) => b.gap - a.gap)[0];
    if (biggest) {
      surprises.appendChild(
        el(
          "li",
          `Biggest gap: ${biggest.label}, ${pct(biggest.gap)} between you. That's the station your split actually decides — and where the slower partner's training time pays most.`,
        ),
      );
    }

    const tips = [
      `Agree the shares before the start and say them out loud at each station — "${n0} first, swap at halfway". Decisions made at station six are made by whoever is more tired.`,
      "Swap on fixed numbers (metres, calories, reps), not on feel. The one who feels fine is usually the one who should rest.",
      `Walk the Roxzone as a pair: ${weakerName} runs the stations' first reps when ${strongerName} is cooked from pacing the runs.`,
      `Train the gap: four weeks of ${biggest ? biggest.label : "your weakest station"} for ${weakerName} moves the team more than anything ${strongerName} can do.`,
    ];
    tips.forEach((t) => coaching.appendChild(el("li", t)));
  }

  function renderRelay(p, t) {
    const summary = document.getElementById("plan-summary");
    const ptable = document.getElementById("plan-table");
    const surprises = document.getElementById("plan-surprises");
    const coaching = document.getElementById("plan-coaching");
    [summary, ptable, surprises, coaching].forEach(clear);

    const items = [["Best station total", fmt(p.total)]];
    if (p.naiveTotal != null) {
      items.push([
        "If each athlete just grabs their own best two",
        `${fmt(p.naiveTotal)} (${fmt(p.naiveTotal - p.total)} slower)`,
      ]);
    }
    for (const [k, v] of items) {
      const li = el("li");
      li.appendChild(el("strong", v));
      li.appendChild(el("span", k));
      summary.appendChild(li);
    }

    const thead = el("thead");
    const hr = el("tr");
    ["Station", "Takes it", "Time", "Next fastest", "Margin"].forEach((h) =>
      hr.appendChild(el("th", h)),
    );
    thead.appendChild(hr);
    ptable.appendChild(thead);
    const tb = el("tbody");
    const changed = [];
    STATIONS.forEach((s, i) => {
      const a = p.assign[i];
      const v = t[a][s.key];
      const others = t
        .map((row, j) => ({ j, v: row[s.key] }))
        .filter((o) => o.j !== a && o.v)
        .sort((x, y) => x.v - y.v)[0];
      const tr = el("tr");
      tr.appendChild(el("td", s.label));
      tr.appendChild(el("td", nameOf(a), "dev-strong"));
      tr.appendChild(el("td", fmt(v)));
      tr.appendChild(
        el("td", others ? `${nameOf(others.j)} ${fmt(others.v)}` : "—"),
      );
      tr.appendChild(el("td", others ? fmt(others.v - v) : "—"));
      tb.appendChild(tr);
      if (others && others.v < v)
        changed.push({ s, a, o: others.j, cost: v - others.v });
      if (p.naive[i] >= 0 && p.naive[i] !== a)
        changed.push({ s, a, o: p.naive[i], naive: true });
    });
    ptable.appendChild(tb);

    const notFastest = changed.filter((c) => !c.naive);
    if (notFastest.length) {
      surprises.appendChild(
        el(
          "li",
          `${notFastest.map((c) => `${nameOf(c.a)} takes ${c.s.label} even though ${nameOf(c.o)} is ${fmt(c.cost)} quicker on it`).join("; ")} — because ${notFastest
            .map((c) => nameOf(c.o))
            .filter((x, i, arr) => arr.indexOf(x) === i)
            .join(
              " and ",
            )} saves more time somewhere else. Two stations each, so the fastest person can't have them all.`,
        ),
      );
    } else {
      surprises.appendChild(
        el(
          "li",
          "Every station goes to its fastest athlete and it still fits two-each. Rare — enjoy it.",
        ),
      );
    }
    const swaps = changed.filter((c) => c.naive);
    if (swaps.length) {
      surprises.appendChild(
        el(
          "li",
          `"Everyone picks their favourite" gives ${swaps.map((c) => `${c.s.label} to ${nameOf(c.o)}`).join(", ")} — the plan moves those and gains ${fmt(p.naiveTotal - p.total)}.`,
        ),
      );
    }
    const per = {};
    p.assign.forEach((a, i) => {
      per[a] = per[a] || [];
      per[a].push(STATIONS[i].label);
    });
    Object.keys(per).forEach((a) => {
      coaching.appendChild(
        el(
          "li",
          `${nameOf(Number(a))}: ${per[a].join(" + ")}, and the 1 km runs into each.`,
        ),
      );
    });
    coaching.appendChild(
      el(
        "li",
        "Order the legs so nobody does two heavy legs back to back; rehearse the hand-over in the Roxzone once before race day.",
      ),
    );
  }

  formatSel.addEventListener("change", buildInputs);
  timesForm.addEventListener("submit", (e) => {
    e.preventDefault();
    note.textContent = "";
    const r = readTimes();
    if (r.error) {
      note.textContent = r.error;
      return;
    }
    if (count() === 2) {
      renderDoubles(planDoubles(r.t));
    } else {
      const p = planRelay(r.t);
      if (!p) {
        note.textContent =
          "Not enough times to give everyone two stations — fill a few more blanks.";
        return;
      }
      renderRelay(p, r.t);
    }
    plan.hidden = false;
    plan.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const url = new URLSearchParams(window.location.search);
  if (url.get("format") === "4") formatSel.value = "4";
  buildInputs();
})();
