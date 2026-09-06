(function () {
  const root = document.getElementById("results-root");
  const toc = document.getElementById("results-toc");
  const search = document.getElementById("results-search");
  const updated = document.getElementById("results-updated");
  if (!root) return;

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

  function render(data) {
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
      const rows = (div.results || [])
        .slice()
        .sort((a, b) => toSeconds(a.time) - toSeconds(b.time));

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
        body = `<p class="results-empty">No verified Indonesian results in this division yet. Raced it? <a href="/roxzone/#ask">Send us your time</a>.</p>`;
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
              <td class="athlete">${esc(r.athlete)}</td>
              <td class="time">${esc(r.time)}</td>
              <td>${esc(r.category || "")}</td>
              <td>${esc(r.event || "")}${r.date ? ` <span class="muted">· ${esc(r.date)}</span>` : ""}</td>
            </tr>`,
            )
            .join("")}</tbody></table></div>`;
      }
      art.innerHTML = `<span class="num">${esc(div.label)}</span>
        <h3>${esc(div.label)} — fastest Indonesians</h3>${body}`;
      root.appendChild(art);
    });
  }

  function filter(q) {
    const needle = q.trim().toLowerCase();
    root.querySelectorAll("tr[data-name]").forEach((tr) => {
      tr.hidden = needle !== "" && !tr.dataset.name.includes(needle);
    });
  }

  if (search) search.addEventListener("input", () => filter(search.value));

  fetch("/roxzone/data/results.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then(render)
    .catch(() => {
      root.innerHTML =
        '<p class="results-empty">Results are being updated — check back shortly.</p>';
    });
})();
