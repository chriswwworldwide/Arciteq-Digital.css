// Cheltenham Hybrid Scene — renders racetoframe/data/scene.json with a Race it /
// Watch it / All filter. Dated items sort first (soonest), then undated.
(function () {
  const root = document.getElementById("scene-list");
  const tabsEl = document.getElementById("scene-tabs");
  if (!root || !tabsEl) return;

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
  const TYPE = {
    race: "Race resmi",
    sim: "Simulasi",
    brand: "Brand event",
    venue: "Tempat latihan",
    meetup: "Meetup",
  };
  const FILTERS = [
    ["all", "Semua"],
    ["race", "Ikutan"],
    ["watch", "Nontonin"],
  ];
  const today = new Date().toISOString().slice(0, 10);
  const isPast = (i) =>
    i.dateEnd ? i.dateEnd < today : i.date ? i.date < today : false;

  function card(i) {
    const when = i.date
      ? `<time datetime="${esc(i.date)}">${esc(i.when || i.date)}</time>`
      : `<time class="plan-tbc">${esc(i.when || "Tanggal TBC")}</time>`;
    const ext = /^https?:/.test(i.link || "");
    return `<li class="event scene-card" data-mode="${esc(i.mode || "both")}">
      ${when}
      <div>
        <span class="kind">${esc(TYPE[i.type] || i.type)}${i.organiser ? ` · ${esc(i.organiser)}` : ""}</span>
        <h4>${esc(i.name)}</h4>
        <p>${esc(i.blurb)}</p>
        ${i.venue ? `<p class="scene-venue">${esc(i.venue)}${i.last ? ` · edisi terakhir ${esc(i.last)}` : ""}</p>` : ""}
        ${(i.tags || []).length ? `<p class="scene-tags">${i.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
        <p class="scene-links">
          ${i.link ? `<a href="${esc(i.link)}"${ext ? ' rel="noopener nofollow" target="_blank"' : ""}>${ext ? "Halaman penyelenggara ↗" : "Detail"}</a>` : ""}
          ${i.guide ? `<a href="${esc(i.guide)}">Guide kita</a>` : ""}
        </p>
      </div>
    </li>`;
  }

  function render(items, mode) {
    const shown = items.filter(
      (i) => mode === "all" || i.mode === mode || i.mode === "both",
    );
    root.innerHTML = shown.length
      ? shown.map((i) => card(i)).join("")
      : `<li class="event"><time>—</time><div><p>Nothing on the list yet.</p></div></li>`;
  }

  fetch("/racetoframe/data/scene.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
    .then((json) => {
      const items = (Array.isArray(json?.items) ? json.items : [])
        .filter((i) => i && i.name && !isPast(i))
        .sort((a, b) => {
          const ad = a.date || "9999",
            bd = b.date || "9999";
          return ad.localeCompare(bd);
        });

      let mode = (location.hash || "").replace("#", "");
      if (!FILTERS.some(([k]) => k === mode)) mode = "all";
      tabsEl.innerHTML = FILTERS.map(
        ([k, label]) =>
          `<button class="city-tab${k === mode ? " is-active" : ""}" data-mode="${k}" aria-pressed="${k === mode}">${label}</button>`,
      ).join("");
      render(items, mode);
      tabsEl.addEventListener("click", (e) => {
        const b = e.target.closest("[data-mode]");
        if (!b) return;
        mode = b.dataset.mode;
        tabsEl.querySelectorAll(".city-tab").forEach((t) => {
          const on = t.dataset.mode === mode;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-pressed", String(on));
        });
        history.replaceState(null, "", mode === "all" ? " " : `#${mode}`);
        render(items, mode);
      });
    })
    .catch(() => {
      root.innerHTML = `<li class="event"><time>Hmm</time><div><p>Nggak bisa load scene-nya sekarang — coba lagi bentar ya.</p></div></li>`;
    });
})();
