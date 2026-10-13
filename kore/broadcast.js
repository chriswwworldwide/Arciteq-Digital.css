// Broadcast — locked teaser on the source site, playable demo on tenants.
// Live mode stitches data/bulletin.json (the engagement feed: PBs,
// birthdays, deadlines, gossip, a personal sign-off) into the on-air
// script, then plays it teleprompter-style — browser speech as a labelled
// stand-in for the coach's real voice note.
(() => {
  const body = document.body;
  if (!body || body.dataset.broadcast !== "live") return;
  const list = document.getElementById("bc-script");
  const play = document.getElementById("bc-play");
  const card = document.getElementById("bc-card");
  if (!list || !play || !card) return;

  const TYPES = {
    pb: "PB",
    birthday: "Birthday",
    welcome: "New faces",
    deadline: "Deadline",
    gossip: "Gossip",
    event: "Event",
    signoff: "Yours",
  };

  // swap the inline sample for the real feed whenever it's there — same
  // items the pipeline will write weekly once it exists
  fetch(list.dataset.src || "data/bulletin.json")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => {
      if (!d || !Array.isArray(d.items) || !d.items.length) return;
      list.innerHTML = d.items
        .map(
          (i) =>
            `<li${i.type === "signoff" ? ' class="bc-signoff"' : ""}>` +
            (i.type
              ? `<span class="bc-type">${TYPES[i.type] || "News"}</span> `
              : "") +
            `<span class="bc-line">${i.text}</span></li>`,
        )
        .join("");
      // a sign-off can carry a promised follow-up — the pic that lands on
      // the board to prove it happened. Receipts or it didn't happen.
      const fu = d.items.find((i) => i.followUp)?.followUp;
      const fuEl = document.getElementById("bc-followup");
      if (fu && fuEl) {
        fuEl.innerHTML =
          `<span class="bc-fu-badge">Drops ${fu.when} · ${fu.board}</span>` +
          `<span class="bc-fu-text">📷 ${fu.text}</span>`;
      }
    })
    .catch(() => {
      /* inline sample stays */
    });

  const lines = () => [...list.querySelectorAll("li")];
  const lineText = (li) =>
    (li.querySelector(".bc-line") || li).textContent.trim();
  let playing = false,
    cancelled = false;

  const reset = () => {
    playing = false;
    cancelled = false;
    card.classList.remove("bc-speaking");
    lines().forEach((li) => li.classList.remove("bc-now", "bc-read"));
    play.textContent = "▶ Play the bulletin";
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const next = (els, i) => {
    if (cancelled || i >= els.length) {
      reset();
      return;
    }
    const li = els[i];
    li.classList.add("bc-now");
    li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const finish = () => {
      li.classList.remove("bc-now");
      li.classList.add("bc-read");
      next(els, i + 1);
    };
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(lineText(li));
      u.rate = 1.02;
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    } else {
      setTimeout(finish, 2600);
    }
  };

  play.addEventListener("click", () => {
    if (playing) {
      cancelled = true;
      reset();
      return;
    }
    playing = true;
    cancelled = false;
    card.classList.add("bc-speaking");
    play.textContent = "■ Stop";
    lines().forEach((li) => li.classList.remove("bc-now", "bc-read"));
    next(lines(), 0);
  });
})();
