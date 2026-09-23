/* Book Dina: upcoming appearances from appearances.json (confirmed only,
   past ones hide) + an inquiry form that lands in the same lead flow as
   Ask Dina, tagged source=book-dina so it stands out on the desk. */
(function () {
  "use strict";
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
  const KIND = {
    sim: "Squad sim",
    clinic: "Clinic",
    race: "Racing",
    talk: "Talk",
    brand: "Brand day",
    other: "Appearance",
  };
  const fmtDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };

  const list = document.getElementById("appearances");
  const empty = document.getElementById("appearances-note");
  if (list) {
    fetch("/roxjaya/data/appearances.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const today = new Date().toISOString().slice(0, 10);
        const rows = (j?.items || [])
          .filter((a) => a && a.title && a.date && a.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (!rows.length) {
          list.hidden = true;
          if (empty) empty.hidden = false;
          return;
        }
        list.innerHTML = rows
          .map(
            (a) => `<li class="event">
            <time datetime="${esc(a.date)}">${esc(fmtDate(a.date))}</time>
            <div>
              <h4>${esc(a.title)}</h4>
              <p>${esc(KIND[a.kind] || KIND.other)}${a.where ? " · " + esc(a.where) : ""}${a.note ? " — " + esc(a.note) : ""}</p>
              ${a.link && /^https?:\/\//i.test(a.link) ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">Details →</a>` : ""}
            </div>
          </li>`,
          )
          .join("");
      })
      .catch(() => {
        list.hidden = true;
        if (empty) empty.hidden = false;
      });
  }

  const form = document.getElementById("booking-form");
  const note = document.getElementById("booking-note");
  if (!form || !note) return;
  const q = new URLSearchParams(location.search);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim();
    const profile = {
      source: "book-dina",
      org_type: String(fd.get("org_type") || ""),
      format: String(fd.get("format") || ""),
      org: String(fd.get("org") || "").trim(),
      when: String(fd.get("when") || "").trim(),
      contact: String(fd.get("contact") || "").trim(),
    };
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    note.classList.remove("error");
    note.textContent = "Sending\u2026";
    try {
      const res = await fetch("/api/capture-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "roxjaya",
          email,
          profile,
          message: String(fd.get("message") || "").trim(),
          utm: {
            utm_source: q.get("utm_source") || "roxjaya",
            utm_medium: q.get("utm_medium") || "book-dina",
            utm_campaign: q.get("utm_campaign") || "",
            utm_content: q.get("utm_content") || "",
            utm_term: q.get("utm_term") || "",
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      note.textContent =
        "Sent \u2014 Dina has it and will reply by email within a couple of days.";
    } catch {
      note.classList.add("error");
      note.textContent =
        "Couldn\u2019t send just now \u2014 message Dina on Instagram (@dinabawden87) instead.";
      if (btn) btn.disabled = false;
    }
  });
})();
