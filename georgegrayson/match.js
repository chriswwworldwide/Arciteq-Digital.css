// match.js — Find a Partner: fills the race dropdown from cities.json,
// renders the approved public board from data/matchboard.json, and posts
// partner_search submissions. Contact details never reach the board —
// intros go through George on WhatsApp.
(() => {
  const KIND = "partner_search";
  const WA = "";
  const FORMATS = {
    open: "Open doubles",
    pro: "Pro doubles",
    mixed: "Mixed doubles",
    relay: "Relay (team of 4)",
    buddies: "Training & race trips",
  };
  const $ = (id) => document.getElementById(id);
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

  // "1:28" / "88:00" / "95" -> seconds. A Hyrox total is 60–150 min, so a
  // single-colon entry reads as h:mm when the first part is short, mm:ss
  // when it isn't. Blank is fine — the card just shows "no time yet".
  const toSec = (v) => {
    const s = String(v || "").trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return Number(s) * 60;
    const m = s.match(/^(\d{1,3}):(\d{1,2})$/);
    if (!m) return NaN;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a <= 9 ? a * 3600 + b * 60 : a * 60 + b;
  };

  async function fillEvents() {
    const sel = $("event-select");
    try {
      const res = await fetch("/georgegrayson/data/cities.json", {
        cache: "no-store",
      });
      const data = await res.json();
      const cities = Array.isArray(data.cities) ? data.cities : [];
      const today = new Date().toISOString().slice(0, 10);
      cities
        .filter(
          (c) => c?.race?.name && (!c.race.start || c.race.start >= today),
        )
        .forEach((c) => {
          const o = document.createElement("option");
          o.value = c.race.name;
          o.dataset.until =
            c.race.start || (c.slug === "london" ? "2027-08-01" : "");
          o.textContent = c.race.dates
            ? `${c.race.name} — ${c.race.dates}`
            : `${c.race.name} (date TBC)`;
          sel.appendChild(o);
        });
    } catch {
      /* dropdown still gets the fallback below */
    }
    const other = document.createElement("option");
    other.value = "Somewhere else / any race";
    other.textContent = "Somewhere else / any race";
    sel.appendChild(other);
  }

  function waLink(card) {
    const fmt = FORMATS[card.format] || card.format;
    const msg = `Halo George! I saw ${card.name}'s card on Find a Partner — ${fmt}${card.event ? ` for ${card.event}` : ""}. Can you intro us?`;
    return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  }

  function renderBoard(items) {
    const box = $("match-board");
    const intro = $("board-intro");
    const today = new Date().toISOString().slice(0, 10);
    const live = (Array.isArray(items) ? items : []).filter(
      (c) => c && (!c.until || c.until >= today),
    );
    if (!live.length) {
      intro.textContent =
        "The board is empty — which means the first card posted gets the most eyes. Be the brave one.";
      box.innerHTML = "";
      return;
    }
    intro.textContent = `${live.length} athlete${live.length === 1 ? "" : "s"} looking right now. First name, pace, what they're after — that's all anyone sees.`;
    const byEvent = new Map();
    for (const c of live) {
      const k = c.event || "Any race";
      if (!byEvent.has(k)) byEvent.set(k, []);
      byEvent.get(k).push(c);
    }
    box.innerHTML = [...byEvent.entries()]
      .map(
        ([event, cards]) => `
        <div class="match-group">
          <h4>${esc(event)}</h4>
          ${cards
            .map(
              (c) => `
            <div class="match-card">
              <div class="match-head">
                <b>${esc(c.name)}</b>
                ${c.gender ? `<span class="chip">${esc(c.gender)}</span>` : ""}
                <span class="chip chip-accent">${esc(FORMATS[c.format] || c.format)}</span>
                <span class="chip">${esc(c.pace)}</span>
              </div>
              ${c.note ? `<p class="match-note">“${esc(c.note)}”</p>` : ""}
              <div class="match-foot">
                <span class="match-posted">posted ${esc(c.posted || "")}</span>
                <a class="btn btn-primary btn-sm" href="${waLink(c)}" target="_blank" rel="noopener">Ask George to intro us</a>
              </div>
            </div>`,
            )
            .join("")}
        </div>`,
      )
      .join("");
  }

  async function loadBoard() {
    try {
      const res = await fetch("/georgegrayson/data/matchboard.json", {
        cache: "no-store",
      });
      const data = await res.json();
      renderBoard(data.items);
    } catch {
      $("board-intro").textContent =
        "The board can't load right now — your card still reaches George below.";
    }
  }

  const form = $("partner-form");
  const note = $("form-note");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    note.textContent = "";
    const data = new FormData(form);
    const total = toSec(data.get("total"));
    if (Number.isNaN(total)) {
      note.textContent =
        "Check the total — use h:mm or mm:ss, e.g. 1:28 or 88:00. Or leave it blank.";
      return;
    }
    const payload = {
      name: String(data.get("name") || "").trim(),
      whatsapp: String(data.get("whatsapp") || "").trim(),
      gender: String(data.get("gender") || ""),
      event: String(data.get("event") || ""),
      format: String(data.get("format") || ""),
      total: total || undefined,
      until: form.querySelector("#event-select option:checked")?.dataset?.until,
      note: String(data.get("note") || "").trim(),
      consent: data.get("consent") ? "yes" : "no",
    };
    note.textContent = "Sending your card to George's desk…";
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") || "").trim(),
          kind: KIND,
          payload,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "save failed");
      form.reset();
      note.textContent =
        payload.consent === "yes"
          ? "Got it — your card is on George's desk. She lists every approved card herself, so give her a day or two."
          : "Got it — private card sent. George will reach out if she spots a match for you.";
    } catch {
      note.textContent =
        "Couldn't send just now — try again in a bit, or message George directly on WhatsApp.";
    }
  });

  // ---- Team GG Coaching travel board: trips land on data/travelboard.json
  // once George approves them on her desk. Same privacy rule as partner
  // cards — first name + initial only, intros via WhatsApp.
  const TRAVEL_MODES = {
    have: "join me",
    looking: "looking to join",
  };

  function waTravel(card) {
    const msg = `Halo George! I saw ${card.name}'s trip on the travel board — ${card.race}${card.hotel ? `, staying around ${card.hotel}` : ""}. Can you intro us?`;
    return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  }

  function renderTravel(items) {
    const box = $("travel-board");
    const intro = $("travel-intro");
    if (!box) return;
    const today = new Date().toISOString().slice(0, 10);
    const live = (Array.isArray(items) ? items : []).filter(
      (c) => c && (!c.until || c.until >= today),
    );
    if (!live.length) {
      intro.textContent =
        "No trips posted yet — the first one up starts the convoy.";
      box.innerHTML = "";
      return;
    }
    intro.textContent = `${live.length} trip${live.length === 1 ? "" : "s"} on the board. Name, race, rough plans — that's all anyone sees.`;
    const byRace = new Map();
    for (const c of live) {
      const k = c.race || "Any race";
      if (!byRace.has(k)) byRace.set(k, []);
      byRace.get(k).push(c);
    }
    box.innerHTML = [...byRace.entries()]
      .map(
        ([race, cards]) => `
        <div class="match-group">
          <h4>${esc(race)}</h4>
          ${cards
            .map(
              (c) => `
            <div class="match-card">
              <div class="match-head">
                <b>${esc(c.name)}</b>
                <span class="chip chip-accent">${esc(TRAVEL_MODES[c.mode] || c.mode)}</span>
                ${c.dates ? `<span class="chip">${esc(c.dates)}</span>` : ""}
              </div>
              ${c.hotel ? `<p class="match-note">${esc(c.hotel)}</p>` : ""}
              ${c.note ? `<p class="match-note">“${esc(c.note)}”</p>` : ""}
              <div class="match-foot">
                <span class="match-posted">posted ${esc(c.posted || "")}</span>
                <a class="btn btn-primary btn-sm" href="${waTravel(c)}" target="_blank" rel="noopener">Ask George to intro us</a>
              </div>
            </div>`,
            )
            .join("")}
        </div>`,
      )
      .join("");
  }

  async function loadTravel() {
    try {
      const res = await fetch("/georgegrayson/data/travelboard.json", {
        cache: "no-store",
      });
      const data = await res.json();
      renderTravel(data.items);
    } catch {
      const intro = $("travel-intro");
      if (intro)
        intro.textContent =
          "The board can't load right now — your trip still reaches George below.";
    }
  }

  async function fillTravelRaces() {
    const sel = $("travel-race-select");
    if (!sel) return;
    try {
      const res = await fetch("/georgegrayson/data/cities.json", {
        cache: "no-store",
      });
      const data = await res.json();
      const cities = Array.isArray(data.cities) ? data.cities : [];
      const today = new Date().toISOString().slice(0, 10);
      cities
        .filter(
          (c) => c?.race?.name && (!c.race.start || c.race.start >= today),
        )
        .forEach((c) => {
          const o = document.createElement("option");
          o.value = c.race.name;
          o.dataset.until =
            c.race.start || (c.slug === "london" ? "2027-08-01" : "");
          o.textContent = c.race.dates
            ? `${c.race.name} — ${c.race.dates}`
            : `${c.race.name} (date TBC)`;
          sel.appendChild(o);
        });
    } catch {
      /* fallback option below still works */
    }
    const other = document.createElement("option");
    other.value = "Somewhere else / any race";
    other.textContent = "Somewhere else / any race";
    sel.appendChild(other);
  }

  const travelForm = $("travel-form");
  const travelNote = $("travel-note");
  if (travelForm)
    travelForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      travelNote.textContent = "";
      const data = new FormData(travelForm);
      const payload = {
        name: String(data.get("name") || "").trim(),
        whatsapp: String(data.get("whatsapp") || "").trim(),
        race: String(data.get("race") || ""),
        mode: String(data.get("mode") || ""),
        dates: String(data.get("dates") || "").trim(),
        hotel: String(data.get("hotel") || "").trim(),
        note: String(data.get("note") || "").trim(),
        until: travelForm.querySelector("#travel-race-select option:checked")
          ?.dataset?.until,
        consent: data.get("consent") ? "yes" : "no",
      };
      travelNote.textContent = "Sending your trip to George's desk…";
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(data.get("email") || "").trim(),
            kind: "travel_party",
            payload,
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "save failed");
        travelForm.reset();
        travelNote.textContent =
          payload.consent === "yes"
            ? "Got it — your trip is on George's desk. She lists every approved one herself, so give her a day or two."
            : "Got it — private trip sent. George will reach out if someone matches your plans.";
      } catch {
        travelNote.textContent =
          "Couldn't send just now — try again in a bit, or message George directly on WhatsApp.";
      }
    });

  fillEvents();
  loadBoard();
  fillTravelRaces();
  loadTravel();
  initPace();

  // Boards refresh themselves: re-poll every minute and whenever the tab
  // comes back into view, so an approved card swaps the "empty" panel for
  // real entries without anyone needing to reload — and expired cards drop
  // back off the same way.
  setInterval(() => {
    if (!document.hidden) {
      loadBoard();
      loadTravel();
    }
  }, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadBoard();
      loadTravel();
    }
  });

  // ---- "Prove your pace": compact race-splits entry that feeds the same
  // race_splits pipeline as the split analyser, then fills the card's total.
  function initPace() {
    const grid = $("pace-grid");
    const paceForm = $("pace-form");
    if (!grid || !paceForm) return;
    const SEGMENTS = [
      ["run_1", "Run 1"],
      ["skierg", "SkiErg"],
      ["run_2", "Run 2"],
      ["sled_push", "Sled Push"],
      ["run_3", "Run 3"],
      ["sled_pull", "Sled Pull"],
      ["run_4", "Run 4"],
      ["burpee_broad_jumps", "Burpee BJs"],
      ["run_5", "Run 5"],
      ["rowing", "Rowing"],
      ["run_6", "Run 6"],
      ["farmers_carry", "Farmers"],
      ["run_7", "Run 7"],
      ["sandbag_lunges", "Lunges"],
      ["run_8", "Run 8"],
      ["wall_balls", "Wall Balls"],
    ];
    const STORE = "georgegrayson.splits.token";
    const RUN_KEYS = new Set(
      SEGMENTS.map(([k]) => k).filter((k) => k.startsWith("run_")),
    );
    const SPLIT_RE = /^\d{1,2}:\d{2}$/;
    const splitSec = (v) => {
      const s = String(v || "").trim();
      if (!SPLIT_RE.test(s)) return null;
      const [m, sec] = s.split(":").map(Number);
      return sec < 60 ? m * 60 + sec : null;
    };
    const bandOf = (s) =>
      !s || s <= 0
        ? "no time yet"
        : s < 4200
          ? "sub-1:10"
          : s < 4800
            ? "1:10–1:20"
            : s < 5400
              ? "1:20–1:30"
              : s < 6300
                ? "1:30–1:45"
                : s < 7200
                  ? "1:45–2:00"
                  : "2:00+";

    SEGMENTS.forEach(([key, label]) => {
      const lab = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = label;
      const input = document.createElement("input");
      input.type = "text";
      input.name = key;
      input.inputMode = "numeric";
      input.placeholder = "5:12";
      input.pattern = "\\d{1,2}:\\d{2}";
      input.required = true;
      lab.appendChild(span);
      lab.appendChild(input);
      grid.appendChild(lab);
    });

    // Same email as the card — prefill and keep it synced until they edit it.
    const cardEmail = form.querySelector('[name="email"]');
    const paceEmail = paceForm.querySelector('[name="pace_email"]');
    cardEmail.addEventListener("input", () => {
      if (!paceEmail.dataset.touched) paceEmail.value = cardEmail.value;
    });
    paceEmail.addEventListener("input", () => {
      paceEmail.dataset.touched = "1";
    });

    const paceNote = $("pace-note");
    paceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      paceNote.textContent = "";
      const data = new FormData(paceForm);
      const payload = {};
      for (const [key, label] of SEGMENTS) {
        const v = splitSec(data.get(key));
        if (v == null || v <= 0) {
          paceNote.textContent = `Check ${label} — use m:ss, e.g. 5:12.`;
          return;
        }
        payload[key] = v;
      }
      const rz = splitSec(data.get("roxzone"));
      if (rz) payload.roxzone = rz;
      payload.event = String(data.get("event") || "").trim();
      payload.race_date = String(data.get("race_date") || "");
      payload.division = String(data.get("division") || "");
      payload.name = String(
        form.querySelector('[name="name"]')?.value || "",
      ).trim();
      payload.newsletter = "no";
      payload.run_total = SEGMENTS.filter(([k]) => RUN_KEYS.has(k)).reduce(
        (s, [k]) => s + payload[k],
        0,
      );
      payload.station_total = SEGMENTS.filter(([k]) => !RUN_KEYS.has(k)).reduce(
        (s, [k]) => s + payload[k],
        0,
      );
      payload.total = payload.run_total + payload.station_total + (rz || 0);

      paceNote.textContent = "Saving to your athlete record…";
      try {
        const token = localStorage.getItem(STORE) || "";
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(data.get("pace_email") || "").trim(),
            kind: "race_splits",
            payload,
            token: token || undefined,
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "save failed");
        if (out.token) localStorage.setItem(STORE, out.token);
        const band = bandOf(payload.total);
        const mmss = `${Math.floor(payload.total / 60)}:${String(payload.total % 60).padStart(2, "0")}`;
        const cardTotal = form.querySelector('[name="total"]');
        if (cardTotal) cardTotal.value = mmss;
        paceNote.textContent = `Saved — ${mmss} total puts you in the ${band} band, and your card is updated. George sees these real numbers on her desk.`;
      } catch {
        paceNote.textContent =
          "Couldn't save just now — try again in a bit. Your card above still works with an estimate.";
      }
    });
  }
})();
