// Jakarta Hybrid Scene — renders roxjaya/data/scene.json with a Race it /
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
    race: "Official race",
    sim: "Race sim",
    brand: "Brand event",
    venue: "Where to train",
  };
  const FILTERS = [
    ["all", "All"],
    ["race", "Race it"],
    ["watch", "Watch it"],
  ];
  const today = new Date().toISOString().slice(0, 10);

  function card(i, checked) {
    const past = i.dateEnd
      ? i.dateEnd < today
      : i.date
        ? i.date < today
        : false;
    const when = i.date
      ? `<time datetime="${esc(i.date)}">${esc(i.when || i.date)}</time>`
      : `<time class="plan-tbc">${esc(i.when || "Date TBC")}</time>`;
    const ext = /^https?:/.test(i.link || "");
    return `<li class="event scene-card${past ? " past" : ""}" data-mode="${esc(i.mode || "both")}">
      ${when}
      <div>
        <span class="kind">${esc(TYPE[i.type] || i.type)}${i.organiser ? ` · ${esc(i.organiser)}` : ""}</span>
        <h4>${esc(i.name)}</h4>
        <p>${esc(i.blurb)}</p>
        ${i.venue ? `<p class="scene-venue">${esc(i.venue)}${i.last ? ` · last edition ${esc(i.last)}` : ""}</p>` : ""}
        ${(i.tags || []).length ? `<p class="scene-tags">${i.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
        <p class="scene-links">
          ${i.link ? `<a href="${esc(i.link)}"${ext ? ' rel="noopener nofollow" target="_blank"' : ""}>${ext ? "Organiser page ↗" : "Details"}</a>` : ""}
          ${i.guide ? `<a href="${esc(i.guide)}">Our guide</a>` : ""}
        </p>
        ${past ? `<p class="plan-source">Past edition — kept for reference, checked ${esc(checked)}.</p>` : ""}
      </div>
    </li>`;
  }

  function render(items, checked, mode) {
    const shown = items.filter(
      (i) => mode === "all" || i.mode === mode || i.mode === "both",
    );
    root.innerHTML = shown.length
      ? shown.map((i) => card(i, checked)).join("")
      : `<li class="event"><time>—</time><div><p>Nothing in this list yet.</p></div></li>`;
  }

  fetch("/roxjaya/data/scene.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
    .then((json) => {
      const items = (Array.isArray(json?.items) ? json.items : [])
        .filter((i) => i && i.name)
        .sort((a, b) => {
          const ad = a.date || "9999",
            bd = b.date || "9999";
          return ad.localeCompare(bd);
        });
      const checked = json.checked || "";
      let mode = (location.hash || "").replace("#", "");
      if (!FILTERS.some(([k]) => k === mode)) mode = "all";
      tabsEl.innerHTML = FILTERS.map(
        ([k, label]) =>
          `<button class="city-tab${k === mode ? " is-active" : ""}" data-mode="${k}" aria-pressed="${k === mode}">${label}</button>`,
      ).join("");
      render(items, checked, mode);
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
        render(items, checked, mode);
      });
    })
    .catch(() => {
      root.innerHTML = `<li class="event"><time>Hmm</time><div><p>Couldn't load the scene list just now — try again in a moment.</p></div></li>`;
    });
})();
