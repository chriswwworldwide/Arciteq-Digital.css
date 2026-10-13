// predictor.js — HYROX race-time predictor. Athlete commits their own
// predicted finish for a target race; we return our prediction for that
// race and their next two, pulled live from data/cities.json. Optional
// dossier fields feed small real modifiers and one honest joke reveal.
// Page is unlisted until launch; email capture posts kind "predictor".
(() => {
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

  const STATION_BASE = 2160;
  const RATING = {
    weak: { run: 1.22, station: 1.25, roxzone: 480 },
    balanced: { run: 1.13, station: 1.0, roxzone: 360 },
    strong: { run: 1.06, station: 0.8, roxzone: 280 },
  };
  const DIV = {
    open: { station: 1.0, label: "Open" },
    pro: { station: 1.08, label: "Pro" },
    doubles: { station: 0.92, label: "Doubles" },
  };
  const VENUE = {
    london: { mod: 1.0, note: "ExCeL aircon is kind — no excuses here." },
    manchester: { mod: 1.0, note: "Flat, fast, friendly — PB territory." },
    birmingham: { mod: 1.01, note: "NEC halls run warm — the crowd makes up for it." },
    cardiff: { mod: 1.0, note: "Compact venue — the noise stays close." },
    glasgow: { mod: 0.99, note: "Scottish air is free PB. Layers for the queue." },
  };
  const MONTHS = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  const fmt = (secs) => {
    secs = Math.round(secs);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };
  const paceFmt = (secPerKm) => {
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, "0")}/km`;
  };

  function parseClock(str) {
    const m = String(str || "").trim().match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3] || 0);
    if (b >= 60 || c >= 60) return null;
    if (m[3] !== undefined) return a * 3600 + b * 60 + c;
    return a <= 3 ? a * 3600 + b * 60 : a * 60 + b;
  }

  function parseTime(str) {
    const m = String(str || "").trim().match(/^(\d{1,2}):([0-5]\d)$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function parseRaceDate(dates) {
    const m = String(dates || "").match(/(\d{1,2})[^\d]*?(\w+)\s+(\d{4})/);
    if (!m) return null;
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon === undefined) return null;
    return new Date(Date.UTC(Number(m[3]), mon, Number(m[1])));
  }

  let races = [];
  let last = null;

  async function loadRaces() {
    const sel = $("race-select");
    try {
      const res = await fetch("/nutrifit/data/cities.json", { cache: "no-store" });
      const data = await res.json();
      const cities = Array.isArray(data.cities) ? data.cities : [];
      const now = Date.now();
      races = cities
        .map((c) => ({
          slug: c.slug,
          name: c.name,
          dates: c.race?.dates || "",
          expected: c.race?.expected || "",
          when: parseRaceDate(c.race?.dates),
        }))
        .filter((r) => r.when || r.expected);
      races.sort((a, b) => (a.when || 9e15) - (b.when || 9e15));
      races = races.filter((r) => !r.when || r.when.getTime() > now - 86400000);
      sel.innerHTML = '<option value="">Pick one…</option>';
      races.forEach((r, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = `${r.name}${r.dates ? ` — ${r.dates}` : " (date TBC)"}`;
        sel.appendChild(o);
      });
    } catch {
      sel.innerHTML = '<option value="">Couldn\'t load races — try refresh</option>';
    }
  }

  function init() {
    loadRaces();

    const bench = $("bench");
    bench?.addEventListener("change", () => {
      const none = bench.value === "none";
      $("bench-time-row").hidden = none;
      $("fitness-row").hidden = !none;
    });

    $("predict-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = $("predict-note");
      note.textContent = "";
      const d = new FormData(e.target);
      const raceIdx = Number(d.get("race"));
      const race = races[raceIdx];
      const myPred = parseClock(d.get("mypred"));
      const division = String(d.get("division") || "");
      const rating = String(d.get("stations") || "");
      const benchVal = d.get("bench");

      if (!race) { note.textContent = "Pick your target race."; return; }
      if (!myPred || myPred < 2400 || myPred > 14400) {
        note.textContent = "Your prediction should look like 1:30 or 88:00 — between 40 min and 4 hours.";
        return;
      }
      if (!DIV[division] || !RATING[rating]) {
        note.textContent = "Division and the honest stations answer — both needed.";
        return;
      }

      let pace5k = null;
      let benchLabel = "";
      if (benchVal === "none") {
        const fit = Number(d.get("fitness") || 0);
        if (!fit) { note.textContent = "Pick a fitness guess — honesty only."; return; }
        pace5k = (fit * 60) / 5;
        benchLabel = `~${fit}-min 5K fitness`;
      } else {
        const t = parseTime(d.get("benchtime"));
        if (!t || t < 720 || t > 3600) {
          note.textContent = "Benchmark should look like 24:30 — between 12:00 and 60:00.";
          return;
        }
        pace5k = benchVal === "10k" ? (t / 10) * 0.96 : t / 5;
        benchLabel = `${benchVal === "10k" ? "10K" : "5K"} in ${fmt(t)}`;
      }

      const vo2 = Number(d.get("vo2") || 0);
      if (vo2) {
        const vo2Pace = 60000 / (vo2 * 4.5);
        pace5k = benchVal === "none" ? vo2Pace : (pace5k + vo2Pace) / 2;
        benchLabel += benchVal === "none" ? `VO2 ${vo2}` : ` + VO2 ${vo2}`;
      }

      const age = Number(d.get("age") || 0);
      let ageMult = 1;
      if (age) {
        if (age > 35) ageMult += Math.min((age - 35) * 0.008, 0.08);
        else if (age < 25) ageMult += Math.min((25 - age) * 0.005, 0.04);
      }

      const height = Number(d.get("height") || 0);
      const weight = Number(d.get("weight") || 0);
      const weightAgo = Number(d.get("weight_ago") || 0);
      let bmiMult = 1;
      let bmi = null;
      if (height && weight) {
        bmi = weight / Math.pow(height / 100, 2);
        if (bmi < 18.5 || bmi > 32) bmiMult = 1.015;
      }

      const wrist = Number(d.get("wrist") || 0);
      const calf = Number(d.get("calf") || 0);
      let frameMult = 1;
      if (calf >= 40) frameMult -= 0.03;
      if (wrist >= 18) frameMult -= 0.02;

      const status = String(d.get("status") || "");
      const statusMult = { married: 0.99, complicated: 1.01, single: 1.0 }[status] || 1.0;
      const hair = String(d.get("hair") || "");

      const r = RATING[rating];
      const runS = 8 * pace5k * r.run * ageMult * bmiMult;
      const stationS =
        STATION_BASE * r.station * DIV[division].station * frameMult * statusMult;
      const roxS = r.roxzone;
      const base = runS + stationS + roxS;

      const picks = [races[raceIdx]];
      for (let i = raceIdx + 1; i < races.length && picks.length < 3; i++) {
        picks.push(races[i]);
      }
      const predictions = picks.map((p) => {
        const v = VENUE[p.slug] || { mod: 1.0, note: "Neutral ground — it's all on you." };
        return { ...p, secs: Math.round(base * v.mod), note: v.note };
      });

      const ours = predictions[0].secs;
      const delta = myPred - ours;
      const verdict =
        delta > 180
          ? `You said ${fmt(myPred)}. We say ${fmt(ours)} — we believe in you more than you do.`
          : delta < -180
            ? `You said ${fmt(myPred)}. We say ${fmt(ours)} — bold. We rate the confidence; now prove us wrong.`
            : `You said ${fmt(myPred)}, we say ${fmt(ours)} — spooky alignment. No excuses left.`;

      const jokes = [];
      if (hair) {
        jokes.push(
          `Hair colour (${esc(hair)}): measured at exactly 0% impact. Collected anyway, for science.`,
        );
      }
      if (status === "married") {
        jokes.push("Married: −1% — data says married athletes suffer better.");
      } else if (status === "complicated") {
        jokes.push("It's complicated: +1% — complicated costs you at the sled.");
      } else if (status === "single") {
        jokes.push("Single: neutral — the wall balls don't care either way.");
      }
      if (calf) {
        jokes.push(
          calf >= 40
            ? `Calves at ${calf}cm: −3% on stations. Wall ball country, as suspected.`
            : `Calves at ${calf}cm: noted respectfully. The wall balls have been informed.`,
        );
      }
      if (weight && weightAgo) {
        const trend = weight - weightAgo;
        jokes.push(
          trend < -1
            ? "Down a few kilos on last year — trending the right way for the run."
            : trend > 1
              ? "Up a few kilos on last year — if it's muscle, the sled says thanks; if not, the run noticed."
              : "Weight steady on last year — consistency is its own flex.",
        );
      }
      if (bmi !== null && bmiMult > 1) {
        jokes.push(
          bmi < 18.5
            ? "BMI's on the light side — free speed on the run, watch the sled tax."
            : "BMI's on the heavy side — the stations will love you; the run will file a complaint.",
        );
      }

      const share = Math.round((stationS / base) * 100);
      last = {
        race: race.name,
        race_dates: race.dates || "",
        my_prediction_s: myPred,
        division: DIV[division].label,
        rating,
        bench: benchLabel,
        age: age || null,
        sex: String(d.get("sex") || "") || null,
        height_cm: height || null,
        weight_kg: weight || null,
        weight_ago_kg: weightAgo || null,
        bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        vo2: vo2 || null,
        wrist_cm: wrist || null,
        calf_cm: calf || null,
        status: status || null,
        hair: hair || null,
        run_s: Math.round(runS),
        station_s: Math.round(stationS),
        roxzone_s: Math.round(roxS),
        predictions: predictions.map((p) => ({
          race: p.name,
          dates: p.dates || "",
          predicted_s: p.secs,
        })),
      };

      $("result-card").innerHTML = `
        <div class="pred-total">
          <p class="pred-eyebrow">${esc(race.name)} — the verdict</p>
          <p class="pred-time">${fmt(ours)}</p>
          <p class="pred-range">${esc(verdict)}</p>
        </div>
        <table class="pred-table">
          <tbody>
            <tr><td>Run — 8 × 1km</td><td>${fmt(runS)}</td><td>${paceFmt(runS / 8)}</td></tr>
            <tr><td>Stations — all eight</td><td>${fmt(stationS)}</td><td>${share}% of race</td></tr>
            <tr><td>Roxzone — transitions</td><td>${fmt(roxS)}</td><td>free time if you move</td></tr>
          </tbody>
        </table>
        <p class="pred-eyebrow" style="margin-bottom:6px">Same you, next races</p>
        <table class="pred-table">
          <tbody>
            ${predictions
              .map(
                (p) => `<tr><td>${esc(p.name)}${p.dates ? ` · ${esc(p.dates)}` : ""}</td><td>${fmt(p.secs)}</td><td>${esc(p.note)}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
        ${
          jokes.length
            ? `<ul class="roundup-list" style="margin-top:14px">${jokes.map((j) => `<li>${j}</li>`).join("")}</ul>`
            : ""
        }
        <p class="pred-line" style="margin-top:12px">
          Based on ${esc(benchLabel)} — ${esc(DIV[division].label)} division. Typical
          ${esc(DIV[division].label)} finishes cluster around 1:25–1:45; your
          number says ${ours < 5100 ? "you're ahead of the pack" : ours > 6300 ? "there's a pack worth chasing — which is the point" : "you're mid-pack, where races are won"}.
        </p>`;
      $("result").hidden = false;
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("send-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = $("send-note");
      const email = String(new FormData(e.target).get("email") || "").trim();
      if (!email) {
        note.textContent = "Pop an email in — it only reaches Coach's desk.";
        return;
      }
      if (!last) return;
      note.textContent = "Sending your split card…";
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, kind: "predictor", payload: last }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "save failed");
        e.target.reset();
        note.textContent =
          "Done — split card's with Coach. If the number needs talking through, she'll know where to find you.";
      } catch {
        note.textContent = "Couldn't send just now — try again in a bit.";
      }
    });
  }

  init();
})();
