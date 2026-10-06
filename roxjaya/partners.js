// Partners / sponsors. Fills any [data-partners="<slot>"] container from
// partners.json (only rows whose paid window covers today). Nothing renders
// while the file is empty. Clicks are counted as an anonymous page view on
// /roxjaya/out/<partner-id> so the Coach's desk can report clicks per sponsor.
(function () {
  const mounts = Array.from(document.querySelectorAll("[data-partners]"));
  if (!mounts.length) return;

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

  const today = new Date().toISOString().slice(0, 10);
  const live = (p) =>
    p &&
    p.name &&
    /^https?:\/\//i.test(String(p.url || "")) &&
    (!p.from || p.from <= today) &&
    (!p.until || p.until >= today);

  function card(p) {
    const logo = /^https?:\/\//i.test(String(p.logo || ""))
      ? `<img src="${esc(p.logo)}" alt="${esc(p.name)} logo" loading="lazy" height="40" />`
      : `<b>${esc(p.name)}</b>`;
    return `<a class="partner" href="${esc(p.url)}" target="_blank" rel="sponsored noopener" data-partner="${esc(p.id || "")}">${logo}${
      p.tagline ? `<span>${esc(p.tagline)}</span>` : ""
    }</a>`;
  }

  function beacon(id) {
    try {
      fetch("/api/pageview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `/roxjaya/out/${id}`,
          referrer: "",
          utm: {},
          visitor: "",
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never block the click */
    }
  }

  fetch("/roxjaya/data/partners.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
    .then((json) => {
      const items = (Array.isArray(json?.items) ? json.items : []).filter(live);
      mounts.forEach((el) => {
        const slot = el.dataset.partners;
        const rows = items.filter((p) => slot === "partner" || p.slot === slot);
        if (!rows.length) {
          el.hidden = true;
          return;
        }
        el.hidden = false;
        const label = el.dataset.label || "Partners";
        el.innerHTML = `<p class="partners-label">${esc(label)}</p><div class="partners-row">${rows
          .map(card)
          .join("")}</div>`;
      });
      document.addEventListener("click", (e) => {
        const a = e.target.closest("a[data-partner]");
        if (a && a.dataset.partner) beacon(a.dataset.partner);
      });
    })
    .catch(() => {
      mounts.forEach((el) => (el.hidden = true));
    });
})();
