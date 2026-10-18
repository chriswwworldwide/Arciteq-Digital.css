(function () {
  const root = document.getElementById("results-root");
  const toc = document.getElementById("results-toc");
  const search = document.getElementById("results-search");
  const updated = document.getElementById("results-updated");
  const modeInputs = document.querySelectorAll('input[name="results-mode"]');
  if (!root) return;
  let data = null;
  let athletes = null;
  let mode = "pb";

  function toSeconds(t) {
    const parts = String(t || "")
      .split(":")
      .map((n) => Number(n));
    if (parts.some((n) => !Number.isFinite(n))) return Infinity;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }

  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  }

  function personalBests(rows) {
    const best = new Map();
    rows.forEach((r) => {
      const key = String(r.athlete || "")
        .trim()
        .toLowerCase();
      const cur = best.get(key);
      if (!cur || toSeconds(r.time) < toSeconds(cur.time)) best.set(key, r);
    });
    return Array.from(best.values());
  }

  function profileFor(name) {
    if (!athletes) return null;
    const lower = String(name || "").toLowerCase();
    let best = null;
    Object.keys(athletes).forEach((k) => {
      if (lower.includes(k.toLowerCase()) && (!best || k.length > best.length))
        best = k;
    });
    return best;
  }

  function athleteCell(r) {
    const prof = profileFor(r.athlete);
    return prof
      ? `<button type="button" class="athlete-link" data-athlete="${esc(prof)}">${esc(r.athlete)}</button>`
      : esc(r.athlete);
  }

  function openAthlete(key) {
    const modal = document.getElementById("athlete-modal");
    const a = athletes?.[key];
    if (!modal || !a) return;
    modal.innerHTML = `<h3>${esc(key)}</h3>
      <p class="athlete-tag">${esc(a.tag || "")}</p>
      <div class="results-scroll"><table class="results-table">
        <thead><tr><th>Race</th><th>Division</th><th>Time</th><th>Note</th></tr></thead>
        <tbody>${(a.races || [])
          .map(
            (r) =>
              `<tr><td>${esc(r.event || "")}${r.date ? ` <span class="muted">· ${esc(r.date)}</span>` : ""}</td><td>${esc(r.division || "")}</td><td class="time">${esc(r.time || "")}</td><td>${esc(r.note || "")}</td></tr>`,
          )
          .join("")}</tbody></table></div>
      <p class="plan-source">Record trail only — the results we hold verified data for. Full history lives on <a href="https://hyranking.com/hyrox-national-records" rel="noopener" target="_blank">hyranking.com</a>.</p>
      <button type="button" class="btn athlete-close">Close</button>`;
    modal
      .querySelector(".athlete-close")
      .addEventListener("click", () => modal.close());
    modal.showModal();
  }

  function render() {
    if (!data) return;
    if (updated && data.updated) {
      updated.textContent = data.updated;
      updated.setAttribute("datetime", data.updated);
    }
    const divisions = data.divisions || {};
    const keys = Object.keys(divisions);
    root.innerHTML = "";
    if (toc) toc.innerHTML = "";

    keys.forEach((key) => {
      const div = divisions[key];
      const all = div.results || [];
      const rows = (mode === "pb" ? personalBests(all) : all.slice()).sort(
        (a, b) => toSeconds(a.time) - toSeconds(b.time),
      );

      if (toc) {
        const li = document.createElement("li");
        li.innerHTML = `<a href="#div-${esc(key)}">${esc(div.label)}</a>`;
        toc.appendChild(li);
      }

      const art = document.createElement("article");
      art.className = "station results-division";
      art.id = `div-${key}`;
      let body;
      if (rows.length === 0) {
        body = `<p class="results-empty">No verified British results in this division yet. Raced it? <a href="/georgegrayson/#ask">Send us your time</a>.</p>`;
      } else {
        body = `<div class="results-scroll"><table class="results-table">
          <thead><tr><th>#</th><th>Athlete</th><th>Time</th><th>Category</th><th>Race</th></tr></thead>
          <tbody>${rows
            .map(
              (
                r,
                i,
              ) => `<tr data-name="${esc(String(r.athlete).toLowerCase())}">
              <td class="rank">${i + 1}</td>
              <td class="athlete">${athleteCell(r)}</td>
              <td class="time">${esc(r.time)}</td>
              <td>${esc(r.category || "")}</td>
              <td>${esc(r.event || "")}${r.date ? ` <span class="muted">· ${esc(r.date)}</span>` : ""}</td>
            </tr>`,
            )
            .join("")}</tbody></table></div>`;
      }
      art.innerHTML = `<span class="num">${esc(div.label)}</span>
        <h3>${esc(div.label)} — ${mode === "pb" ? "personal bests" : "all finishes"}</h3>${body}`;
      if (rows.length && mode === "pb") {
        const note = document.createElement("p");
        note.className = "results-record";
        note.innerHTML = `Fastest verified British ${esc(div.label)} time we have: <strong>${esc(rows[0].time)}</strong> — ${esc(rows[0].athlete)}. Know an earlier or faster one? <a href="#fix">Tell us</a>.`;
        art.appendChild(note);
      }
      root.appendChild(art);
    });

    if (toc && document.getElementById("roundups-root")) {
      const li = document.createElement("li");
      li.innerHTML = `<a href="#roundups">Race weekend roundups</a>`;
      toc.appendChild(li);
    }
  }

  function renderRoundups(items) {
    const rroot = document.getElementById("roundups-root");
    if (!rroot) return;
    const today = new Date().toISOString().slice(0, 10);
    const rows = (items || [])
      .filter((n) => n && n.race && (!n.date || String(n.date) <= today))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!rows.length) {
      rroot.innerHTML = `<p class="results-empty">No roundups yet — the first one lands after the next race weekend.</p>`;
      return;
    }
    rroot.innerHTML = rows
      .map(
        (n) => `<div class="roundup">
        <p class="roundup-meta"><strong>${esc(n.race)}</strong>${
          n.weekend ? ` · ${esc(n.weekend)}` : ""
        }</p>
        <ul class="plan-list roundup-list">${(n.highlights || [])
          .map((h) => `<li>${esc(h)}</li>`)
          .join("")}</ul>
        ${
          n.take
            ? `<p class="roundup-take"><strong>George's take:</strong> ${esc(n.take)}</p>`
            : ""
        }
        ${
          n.source
            ? `<p class="news-src"><a href="${esc(n.source)}" rel="noopener nofollow" target="_blank">${esc(n.sourceName || "Source")} ↗</a></p>`
            : ""
        }
      </div>`,
      )
      .join("");
  }

  fetch("/georgegrayson/data/roundups.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((json) => renderRoundups(json?.items))
    .catch(() => {});

  fetch("/georgegrayson/data/athletes.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      athletes = json?.athletes || null;
      if (data && athletes) render();
    })
    .catch(() => {});

  root.addEventListener("click", (e) => {
    const b = e.target.closest(".athlete-link");
    if (b) openAthlete(b.dataset.athlete);
  });

  const modal = document.getElementById("athlete-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.close();
    });
  }

  function filter(q) {
    const needle = q.trim().toLowerCase();
    root.querySelectorAll("tr[data-name]").forEach((tr) => {
      tr.hidden = needle !== "" && !tr.dataset.name.includes(needle);
    });
  }

  if (search) search.addEventListener("input", () => filter(search.value));
  modeInputs.forEach((input) =>
    input.addEventListener("change", () => {
      mode = input.value === "all" ? "all" : "pb";
      render();
      if (search) filter(search.value);
    }),
  );

  // "Send your time" — athletes report their own finish; lands as a
  // race_result submission on the desk. George verifies against the official
  // results and adds the row by hand.
  const timeForm = document.getElementById("time-form");
  const timeNote = document.getElementById("time-note");
  timeForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!timeForm.reportValidity()) return;
    const data = new FormData(timeForm);
    const [division, category] = String(data.get("division") || "")
      .split("·")
      .map((s) => s.trim());
    timeNote.textContent = "Sending…";
    let ok = false;
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") || "").trim(),
          kind: "race_result",
          payload: {
            athlete: String(data.get("athlete") || "").trim(),
            event: String(data.get("event") || "").trim(),
            division: division || "",
            category: category || "",
            time: String(data.get("time") || "").trim(),
            proof_url: String(data.get("proof_url") || "").trim(),
            consent: data.get("consent") ? "yes" : "no",
            source: "results_board",
          },
          website: String(data.get("website") || ""),
        }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    timeNote.textContent = ok
      ? "Got it — George'll check it against the official results and add it."
      : "Couldn't send just now — DM your time to @georgegraysonfit instead.";
    if (ok) timeForm.querySelector("button[type=submit]").disabled = true;
  });

  fetch("/georgegrayson/data/results.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((json) => {
      data = json;
      render();
    })
    .catch(() => {
      root.innerHTML =
        '<p class="results-empty">Results are being updated — check back shortly.</p>';
    });
})();
