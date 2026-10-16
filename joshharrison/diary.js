// Diary — renders data/diary.json (the coach's bookings for the week)
// into a day-grouped list. The bulletin's engagement feed stitches from
// this same file, so the Katie sign-off has real receipts.
(() => {
  const mount = document.getElementById("diary-list");
  if (!mount) return;
  const src = mount.dataset.src || "/joshharrison/data/diary.json";

  const dayFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    })[c]);

  fetch(src)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => {
      const sessions = (d && d.sessions) || [];
      if (!sessions.length) {
        mount.innerHTML =
          '<p class="plan-source">A gloriously empty week. Suspicious.</p>';
        return;
      }
      // group by date, keep file order within a day
      const days = new Map();
      for (const s of sessions) {
        const k = s.date;
        if (!days.has(k)) days.set(k, []);
        days.get(k).push(s);
      }
      const today = new Date().toISOString().slice(0, 10);
      mount.innerHTML = [...days.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, items]) => {
          const dt = new Date(date + "T12:00:00");
          const label = isNaN(dt) ? date : dayFmt.format(dt);
          const rows = items
            .map(
              (s) =>
                `<li class="event${date === today ? " diary-today" : ""}">` +
                `<time>${esc(s.time || "")}</time>` +
                `<div><p><strong>${esc(s.type || "Session")}</strong>` +
                (s.who ? ` — ${esc(s.who)}` : "") +
                (s.note ? `<br><span class="diary-note">${esc(s.note)}</span>` : "") +
                `</p></div></li>`,
            )
            .join("");
          return `<h4 class="diary-day">${esc(label)}${
            date === today ? ' <span class="bc-type">Today</span>' : ""
          }</h4><ul class="events-list">${rows}</ul>`;
        })
        .join("");
    })
    .catch(() => {
      mount.innerHTML =
        '<p class="plan-source">The diary\'s gone walkabout — check data/diary.json.</p>';
    });
})();
