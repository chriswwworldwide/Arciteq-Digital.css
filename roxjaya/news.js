// Hyrox Asia news page. Renders roxjaya/data/news.json — items only get there
// when Dina taps Publish on the Coach's desk. No fetching of other sites here.
(function () {
  const list = document.getElementById("news-list");
  if (!list) return;

  function esc(s) {
    return String(s ?? "").replace(
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
  }

  function when(iso) {
    const d = new Date(String(iso || ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function host(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function render(items) {
    if (!items.length) {
      list.innerHTML =
        '<li class="event"><time>Soon</time><div><p>Nothing published yet — Dina adds a handful of items a week once the season gets going.</p></div></li>';
      return;
    }
    list.innerHTML = items
      .map((n) => {
        const src = n.source
          ? `<a href="${esc(n.source)}" rel="noopener nofollow" target="_blank">${esc(n.sourceName || host(n.source) || "Source")} ↗</a>`
          : "";
        const take = n.take
          ? `<p class="news-take"><strong>Dina's take:</strong> ${esc(n.take)}</p>`
          : "";
        return `<li class="event"><time datetime="${esc(n.date || "")}">${esc(when(n.date))}</time><div><h4>${esc(n.title)}</h4><p>${esc(n.summary)}</p>${take}<p class="news-src">${src}</p></div></li>`;
      })
      .join("");
  }

  fetch("/roxjaya/data/news.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
    .then((json) => {
      const items = (Array.isArray(json?.items) ? json.items : [])
        .filter((n) => n && n.title && n.summary)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      render(items);
    })
    .catch(() => {
      list.innerHTML =
        '<li class="event"><time>Hmm</time><div><p>Couldn\'t load the news just now — try again in a moment.</p></div></li>';
    });
})();
