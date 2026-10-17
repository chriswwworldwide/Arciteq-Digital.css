// station9.js — the ninth station page: next-edition card from data/station9.json
// and the RSVP form (kind "station9_rsvp" → Jade's desk; numbers for the
// resto booking). Nothing here is public — RSVPs are private.
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

  async function init() {
    const card = $("next-card");
    const sel = $("edition-select");
    let next = null;
    let away = [];
    try {
      const res = await fetch("/jadeskillen/data/station9.json", {
        cache: "no-store",
      });
      const data = await res.json();
      next = data.next || null;
      away = Array.isArray(data.away) ? data.away : [];
    } catch {
      /* TBC state below still works */
    }

    if (card) {
      if (next && next.label) {
        card.innerHTML = `<div class="plan-meetup">
          <p><strong>${esc(next.label)}</strong>${
            next.date ? ` · ${esc(next.date)}` : ""
          }</p>
          ${next.venue ? `<p>${esc(next.venue)}</p>` : ""}
          ${next.note ? `<p>${esc(next.note)}</p>` : ""}
        </div>`;
      } else {
        card.innerHTML = `<p>
          <strong>Every three months — the next venue gets picked soon.</strong>
          The venue lands here (and in the crew broadcast list) once it's booked.
          RSVP below so there's a chair with your name on it either way.
        </p>`;
      }
    }

    if (sel) {
      const opts = [
        next?.label || "Next home edition — United Kingdom",
        ...away.map((a) => a?.label).filter(Boolean),
        "An away-race edition — I'll say which race",
        "Keep me posted for any edition",
      ];
      for (const label of opts) {
        const o = document.createElement("option");
        o.value = label;
        o.textContent = label;
        sel.appendChild(o);
      }
    }

    const form = $("rsvp-form");
    const note = $("rsvp-note");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      note.textContent = "";
      const data = new FormData(form);
      const payload = {
        name: String(data.get("name") || "").trim(),
        whatsapp: String(data.get("whatsapp") || "").trim(),
        edition: String(data.get("edition") || ""),
        seats: String(data.get("seats") || ""),
        note: String(data.get("note") || "").trim(),
      };
      note.textContent = "Saving you a chair…";
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(data.get("email") || "").trim(),
            kind: "station9_rsvp",
            payload,
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "save failed");
        form.reset();
        note.textContent =
          "Done — you're on the list. Venue lands in the crew broadcast list once the table's booked. Station 10 shoes optional.";
      } catch {
        note.textContent =
          "Couldn't send just now — try again in a bit, or message Jade on WhatsApp.";
      }
    });
  }

  init();
})();
