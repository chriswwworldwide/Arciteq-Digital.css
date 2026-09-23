(function () {
  const form = document.getElementById("splits-form");
  if (!form) return;
  const note = document.getElementById("splits-note");
  const grid = document.getElementById("splits-grid");
  const KIND = "race_splits";
  const STORE = "roxjaya.splits.token";

  // Segment order as raced. `ref` = typical split (seconds) for a ~80-minute
  // athlete; scaled to the submitted finish time to give "expected".
  const SEGMENTS = [
    { key: "run_1", label: "Run 1", ref: 300, kind: "run" },
    {
      key: "skierg",
      label: "SkiErg",
      ref: 270,
      kind: "station",
      anchor: "skierg",
    },
    { key: "run_2", label: "Run 2", ref: 330, kind: "run" },
    {
      key: "sled_push",
      label: "Sled Push",
      ref: 210,
      kind: "station",
      anchor: "sled-push",
    },
    { key: "run_3", label: "Run 3", ref: 340, kind: "run" },
    {
      key: "sled_pull",
      label: "Sled Pull",
      ref: 270,
      kind: "station",
      anchor: "sled-pull",
    },
    { key: "run_4", label: "Run 4", ref: 340, kind: "run" },
    {
      key: "burpee_broad_jumps",
      label: "Burpee Broad Jumps",
      ref: 270,
      kind: "station",
      anchor: "burpee-broad-jumps",
    },
    { key: "run_5", label: "Run 5", ref: 345, kind: "run" },
    {
      key: "rowing",
      label: "Rowing",
      ref: 285,
      kind: "station",
      anchor: "rowing",
    },
    { key: "run_6", label: "Run 6", ref: 345, kind: "run" },
    {
      key: "farmers_carry",
      label: "Farmers Carry",
      ref: 135,
      kind: "station",
      anchor: "farmers-carry",
    },
    { key: "run_7", label: "Run 7", ref: 350, kind: "run" },
    {
      key: "sandbag_lunges",
      label: "Sandbag Lunges",
      ref: 240,
      kind: "station",
      anchor: "sandbag-lunges",
    },
    { key: "run_8", label: "Run 8", ref: 340, kind: "run" },
    {
      key: "wall_balls",
      label: "Wall Balls",
      ref: 330,
      kind: "station",
      anchor: "wall-balls",
    },
  ];
  const REF_TOTAL = SEGMENTS.reduce((a, s) => a + s.ref, 0);
  const WEAK = 0.1;
  const STRONG = -0.08;

  // What Dina works on when a segment is slow. Keep it specific.
  const COACHING = {
    skierg: {
      fix: "SkiErg is a hip-hinge, not an arm pull. Dina fixes the hinge and rhythm on the floor, then builds it with weighted hinges and pull-downs in Strength Zone.",
      link: "/roxjaya/stations-prep/#skierg",
    },
    sled_push: {
      fix: "Low body angle and short, fast steps — plus leg strength: Bulgarian split squats and heavy sled work twice a week.",
      link: "/roxjaya/stations-prep/#sled-push",
    },
    sled_pull: {
      fix: "Hand-over-hand rope technique and grip endurance. Sled-drag rows and towel pull-ups in Strength Zone; a floor session to stop you sitting down on the rope.",
      link: "/roxjaya/stations-prep/#sled-pull",
    },
    burpee_broad_jumps: {
      fix: "Landing with feet already staggered so hands drop straight down, and hip-thrust power for the jump. Usually the biggest single time-save for first-timers.",
      link: "/roxjaya/stations-prep/#burpee-broad-jumps",
    },
    rowing: {
      fix: "Stroke rate and damper setting for your size, and getting in and out of the straps fast. A 1,000 m row under fatigue is programmed most weeks.",
      link: "/roxjaya/stations-prep/#rowing",
    },
    farmers_carry: {
      fix: "Grip and trunk. Heavy suitcase carries and dead hangs in Strength Zone, and the tempo of the set-down/pick-up.",
      link: "/roxjaya/stations-prep/#farmers-carry",
    },
    sandbag_lunges: {
      fix: "Stride length and breathing rhythm. Bulgarian split squats, walking lunges under load, and a weekly sandbag block.",
      link: "/roxjaya/stations-prep/#sandbag-lunges",
    },
    wall_balls: {
      fix: "Squat depth to the line first time, sets that match your breathing, and shoulder endurance from deficit push-ups and thrusters.",
      link: "/roxjaya/stations-prep/#wall-balls",
    },
    runs: {
      fix: "Compromised running — run–station–run sessions so your legs know what a run after a sled feels like, and a pace you can hold on run eight.",
      link: "/roxjaya/run-zone/#compromised",
    },
    fade: {
      fix: "Pacing: your late runs cost more than any station. Dina sets your run-one pace from your data and builds the aerobic base to hold it.",
      link: "/roxjaya/run-zone/#pacing",
    },
    hot_start: {
      fix: "You went out too fast. A first-run cap and a pre-race routine so run one is the slowest run of the day, not the fastest.",
      link: "/roxjaya/run-zone/#pacing",
    },
  };

  function toSec(t) {
    const m = String(t || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function fmt(sec) {
    if (!Number.isFinite(sec)) return "—";
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h
      ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
      : `${m}:${String(r).padStart(2, "0")}`;
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

  // Build the 16 split inputs.
  SEGMENTS.forEach((s) => {
    const label = el("label");
    label.appendChild(el("span", s.label));
    const input = document.createElement("input");
    input.type = "text";
    input.name = s.key;
    input.inputMode = "numeric";
    input.placeholder = fmt(s.ref);
    input.pattern = "\\d{1,2}:\\d{2}";
    input.required = true;
    label.appendChild(input);
    grid.appendChild(label);
  });

  function analyse(p) {
    const total = SEGMENTS.reduce((a, s) => a + (p[s.key] || 0), 0);
    const scale = total / REF_TOTAL;
    const rows = SEGMENTS.map((s) => {
      const actual = p[s.key];
      const expected = s.ref * scale;
      return { ...s, actual, expected, dev: actual / expected - 1 };
    });
    const runs = rows.filter((r) => r.kind === "run");
    const early = runs.slice(0, 4).reduce((a, r) => a + r.actual, 0) / 4;
    const late = runs.slice(4).reduce((a, r) => a + r.actual, 0) / 4;
    const others = runs.slice(1).reduce((a, r) => a + r.actual, 0) / 7;
    const fade = late / early - 1;
    const hotStart = runs[0].actual / others - 1;
    const runShare =
      runs.reduce((a, r) => a + r.actual, 0) /
        runs.reduce((a, r) => a + r.expected, 0) -
      1;
    return { total, rows, fade, hotStart, runShare };
  }

  function render(a, p) {
    const box = document.getElementById("analysis");
    const sum = document.getElementById("analysis-summary");
    const table = document.getElementById("analysis-table");
    const strengths = document.getElementById("analysis-strengths");
    const weaknesses = document.getElementById("analysis-weaknesses");
    const coaching = document.getElementById("analysis-coaching");
    [sum, table, strengths, weaknesses, coaching].forEach(clear);

    const stationTime = a.rows
      .filter((r) => r.kind === "station")
      .reduce((s, r) => s + r.actual, 0);
    const runTime = a.total - stationTime;
    const spec = [
      [fmt(a.total + (p.roxzone || 0)), "Finish (splits + Roxzone)"],
      [fmt(runTime), "Running (8 × 1 km)"],
      [fmt(stationTime), "Stations"],
      [pct(a.fade), "Run fade — runs 5–8 vs runs 1–4"],
    ];
    spec.forEach(([v, l]) => {
      const li = el("li");
      li.appendChild(el("strong", v));
      li.appendChild(document.createTextNode(l));
      sum.appendChild(li);
    });

    const thead = el("thead");
    const hr = el("tr");
    ["Segment", "Your time", "Expected", "vs expected"].forEach((h) =>
      hr.appendChild(el("th", h)),
    );
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el("tbody");
    a.rows.forEach((r) => {
      const tr = el("tr");
      tr.appendChild(el("td", r.label, "athlete"));
      tr.appendChild(el("td", fmt(r.actual), "time"));
      tr.appendChild(el("td", fmt(r.expected), "muted"));
      const cls =
        r.dev >= WEAK ? "dev-weak" : r.dev <= STRONG ? "dev-strong" : "muted";
      tr.appendChild(el("td", pct(r.dev), cls));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const stations = a.rows.filter((r) => r.kind === "station");
    const strong = stations
      .filter((r) => r.dev <= STRONG)
      .sort((x, y) => x.dev - y.dev);
    const weak = stations
      .filter((r) => r.dev >= WEAK)
      .sort((x, y) => y.dev - x.dev);
    if (a.runShare <= STRONG)
      strong.unshift({ label: "Running", dev: a.runShare });

    if (!strong.length)
      strengths.appendChild(
        el("li", "Nothing stands out yet — an even race. That's a good base."),
      );
    strong.forEach((r) => {
      const li = el("li");
      li.appendChild(el("b", `${r.label} `));
      li.appendChild(
        document.createTextNode(
          `${pct(r.dev)} vs expected at your finish time. Keep it — don't over-train what already works.`,
        ),
      );
      strengths.appendChild(li);
    });

    const issues = [];
    weak.forEach((r) => {
      const cost = r.actual - r.expected;
      issues.push({
        label: r.label,
        text: `${pct(r.dev)} — about ${fmt(cost)} slower than expected. `,
        coach: COACHING[r.key],
      });
    });
    if (a.fade >= 0.08) {
      issues.push({
        label: "Run fade",
        text: `Runs 5–8 were ${pct(a.fade)} slower than runs 1–4. That's pacing or aerobic base, and it's usually the cheapest time to get back. `,
        coach: COACHING.fade,
      });
    } else if (a.runShare >= WEAK) {
      issues.push({
        label: "Running",
        text: `${pct(a.runShare)} vs expected across all eight runs — the stations aren't the problem, the running between them is. `,
        coach: COACHING.runs,
      });
    }
    if (a.hotStart <= -0.1) {
      issues.push({
        label: "Hot start",
        text: `Run 1 was ${pct(-a.hotStart)} faster than your other runs. `,
        coach: COACHING.hot_start,
      });
    }
    if (!issues.length)
      weaknesses.appendChild(
        el(
          "li",
          "No segment is more than 10% off — your time is spread evenly. To go faster from here it's fitness across the board, not one fix.",
        ),
      );
    issues.forEach((i) => {
      const li = el("li");
      li.appendChild(el("b", `${i.label} `));
      li.appendChild(document.createTextNode(i.text));
      weaknesses.appendChild(li);
    });

    const top = issues.slice(0, 3);
    if (!top.length) {
      const li = el("li");
      li.appendChild(
        document.createTextNode(
          "A structured block that lifts everything a few percent — the ",
        ),
      );
      const a1 = el("a", "Warrior Program");
      a1.href = "/roxjaya/#plans";
      li.appendChild(a1);
      li.appendChild(document.createTextNode(" is built for exactly that."));
      coaching.appendChild(li);
    }
    top.forEach((i) => {
      const li = el("li");
      li.appendChild(el("b", `${i.label}: `));
      li.appendChild(document.createTextNode(`${i.coach.fix} `));
      const a1 = el("a", "Read the guide →");
      a1.href = i.coach.link;
      li.appendChild(a1);
      coaching.appendChild(li);
    });
    if (top.length) {
      const li = el("li");
      const plan = top.length >= 2 ? "Hybrid Coaching" : "Warrior Program";
      li.appendChild(
        document.createTextNode(
          top.length >= 2
            ? "Two or more technique-heavy stations means floor time pays: "
            : "One clear weakness is a programming fix: ",
        ),
      );
      const a1 = el("a", plan);
      a1.href = "/roxjaya/#plans";
      li.appendChild(a1);
      li.appendChild(
        document.createTextNode(" — or send Dina these splits and ask."),
      );
      coaching.appendChild(li);
    }

    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const HISTORY_COLS = [
    { key: "total", label: "Finish" },
    { key: "run_total", label: "Runs" },
    { key: "station_total", label: "Stations" },
    ...SEGMENTS.filter((s) => s.kind === "station"),
  ];

  function renderHistory(items, token) {
    const box = document.getElementById("history");
    const table = document.getElementById("history-table");
    const intro = document.getElementById("history-intro");
    const link = document.getElementById("history-link");
    clear(table);
    if (!items.length) return;
    const url = new URL(window.location.href);
    url.searchParams.set("t", token);
    url.hash = "history";
    link.href = url.toString();
    intro.textContent =
      items.length === 1
        ? "One race saved. Submit your next one and this table shows what moved."
        : `${items.length} races saved, oldest first. Green = faster than the race before, red = slower.`;
    const thead = el("thead");
    const hr = el("tr");
    hr.appendChild(el("th", "Race"));
    HISTORY_COLS.forEach((c) => hr.appendChild(el("th", c.label)));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el("tbody");
    items.forEach((it, idx) => {
      const p = it.payload || {};
      const prev = idx ? items[idx - 1].payload || {} : null;
      const tr = el("tr");
      const name = el("td", "", "athlete");
      name.appendChild(el("b", String(p.event || "Race")));
      name.appendChild(
        el("span", ` ${String(p.race_date || "").slice(0, 7)}`, "muted"),
      );
      tr.appendChild(name);
      HISTORY_COLS.forEach((c) => {
        const v = p[c.key];
        const td = el("td", fmt(v), "time");
        if (prev && Number.isFinite(prev[c.key]) && Number.isFinite(v)) {
          const d = v - prev[c.key];
          if (d) {
            td.appendChild(
              el(
                "span",
                ` ${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}`,
                d > 0 ? "dev-weak" : "dev-strong",
              ),
            );
          }
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.hidden = false;
  }

  async function loadHistory(token) {
    if (!token) return;
    try {
      const res = await fetch(
        `/api/submissions?kind=${KIND}&token=${encodeURIComponent(token)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      renderHistory(Array.isArray(data.items) ? data.items : [], token);
    } catch {
      /* offline or no DB: history just stays hidden */
    }
  }

  async function loadDatabank(division, mine) {
    const table = document.getElementById("databank-table");
    const intro = document.getElementById("databank-intro");
    clear(table);
    try {
      const q = division
        ? `&field=division&value=${encodeURIComponent(division)}`
        : "";
      const res = await fetch(`/api/submissions/stats?kind=${KIND}${q}`);
      if (!res.ok) throw new Error("stats");
      const data = await res.json();
      const f = data.fields || {};
      if (!f.total) {
        intro.textContent = division
          ? `${data.rows || 0} ${division} race${data.rows === 1 ? "" : "s"} in the databank so far — medians appear at five. Yours counts.`
          : "The databank is growing — medians appear once a division has five races.";
        return;
      }
      intro.textContent = `${division || "All divisions"}: medians from ${f.total.n} Indonesian races. Beat the median and you're in the faster half.`;
      const thead = el("thead");
      const hr = el("tr");
      [
        "Segment",
        "Fastest",
        "Top quarter",
        "Median",
        mine ? "You" : "",
      ].forEach((h) => hr.appendChild(el("th", h)));
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = el("tbody");
      HISTORY_COLS.forEach((c) => {
        const s = f[c.key];
        if (!s) return;
        const tr = el("tr");
        tr.appendChild(el("td", c.label, "athlete"));
        tr.appendChild(el("td", fmt(s.best), "time"));
        tr.appendChild(el("td", fmt(s.p25), "time"));
        tr.appendChild(el("td", fmt(s.median), "time"));
        if (mine && Number.isFinite(mine[c.key])) {
          const v = mine[c.key];
          const where =
            v <= s.p25
              ? "top quarter"
              : v <= s.median
                ? "faster than median"
                : "slower than median";
          tr.appendChild(
            el(
              "td",
              `${fmt(v)} · ${where}`,
              v <= s.median ? "dev-strong" : "dev-weak",
            ),
          );
        } else if (mine) tr.appendChild(el("td", ""));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    } catch {
      intro.textContent =
        "Databank unavailable right now — your analysis above still stands.";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    note.textContent = "";
    const data = new FormData(form);
    const payload = {};
    for (const s of SEGMENTS) {
      const v = toSec(data.get(s.key));
      if (v == null || v <= 0) {
        note.textContent = `Check ${s.label} — use m:ss, e.g. 5:12.`;
        return;
      }
      payload[s.key] = v;
    }
    const rz = toSec(data.get("roxzone"));
    if (rz) payload.roxzone = rz;
    payload.event = String(data.get("event") || "").trim();
    payload.race_date = String(data.get("race_date") || "");
    payload.division = String(data.get("division") || "");
    const a = analyse(payload);
    payload.run_total = a.rows
      .filter((r) => r.kind === "run")
      .reduce((s, r) => s + r.actual, 0);
    payload.station_total = a.total - payload.run_total;
    payload.total = a.total + (rz || 0);

    render(a, payload);

    const email = String(data.get("email") || "").trim();
    const token = localStorage.getItem(STORE) || "";
    note.textContent = "Saving to your athlete record…";
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          kind: KIND,
          payload,
          token: token || undefined,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "save failed");
      if (out.token) localStorage.setItem(STORE, out.token);
      const t = out.token || token;
      note.textContent = t
        ? `Saved — race ${out.count} on your record.`
        : "Saved to your record. To see your race history here, open the private link from your first submission (it's saved in that browser).";
      await loadHistory(t);
      await loadDatabank(payload.division, payload);
    } catch {
      note.textContent =
        "Couldn't save just now — your analysis above still stands. Try again later and it'll join your record.";
      await loadDatabank(payload.division, payload);
    }
  });

  const urlToken = new URLSearchParams(window.location.search).get("t");
  if (urlToken) localStorage.setItem(STORE, urlToken);
  loadHistory(urlToken || localStorage.getItem(STORE));
  loadDatabank("", null);
})();
