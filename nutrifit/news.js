// Hyrox the UK news page. Renders nutrifit/data/news.json — items only get there
// when Coach taps Publish on the Coach's desk. No fetching of other sites here.
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
        '<li class="event"><time>Soon</time><div><p>Nothing published yet — new items land most weeks during the season.</p></div></li>';
      return;
    }
    list.innerHTML = items
      .map((n, i) => {
        const src = n.source
          ? `<a href="${esc(n.source)}" rel="noopener nofollow" target="_blank">${esc(n.sourceName || host(n.source) || "Source")} ↗</a>`
          : "";
        const take = n.take
          ? `<p class="news-take"><strong>Coach's playbook:</strong> ${esc(n.take)}</p>`
          : "";
        const guide = n.link
          ? `<p class="news-src"><a href="${esc(n.link)}">${esc(n.linkLabel || "Race guide →")}</a></p>`
          : "";
        return `<li class="event" data-i="${i}"><time datetime="${esc(n.date || "")}">${esc(when(n.date))}</time><div><h4>${esc(n.title)}</h4><p>${esc(n.summary)}</p>${take}<p class="news-src">${guide} ${src}<button class="share-btn" type="button">Share</button></p></div></li>`;
      })
      .join("");
    list.querySelectorAll(".share-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        const n = items[Number(btn.closest("li").dataset.i)];
        window.roxShare?.(btn, {
          title: n.title,
          text: `${n.title} — ${n.take || n.summary}`,
          url: `${location.origin}/nutrifit/news/`,
        });
      }),
    );
  }

  fetch("/nutrifit/data/news.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
    .then((json) => {
      const today = new Date().toISOString().slice(0, 10);
      const items = (Array.isArray(json?.items) ? json.items : [])
        .filter(
          (n) =>
            n && n.title && n.summary && (!n.date || String(n.date) <= today),
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      render(items);
    })
    .catch(() => {
      list.innerHTML =
        '<li class="event"><time>Hmm</time><div><p>News failed to load — try again in a bit.</p></div></li>';
    });
})();
