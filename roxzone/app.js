(function () {
  const menu = document.getElementById("menu");
  const toggle = document.querySelector(".nav-toggle");
  const dropdowns = Array.from(
    document.querySelectorAll(".menu > li > button[aria-haspopup]"),
  );

  function closeAll(except) {
    dropdowns.forEach((b) => {
      if (b !== except) b.setAttribute("aria-expanded", "false");
    });
  }

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  dropdowns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = btn.getAttribute("aria-expanded") === "true";
      closeAll(btn);
      btn.setAttribute("aria-expanded", String(!open));
    });
  });

  document.addEventListener("click", () => closeAll());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  const params = new URLSearchParams(window.location.search);
  const utm = {};
  [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ].forEach((k) => {
    const v = String(params.get(k) || "").trim();
    if (v) utm[k] = v;
  });

  const form = document.getElementById("ask-form");
  const note = document.getElementById("ask-note");
  const onboard = document.getElementById("onboard-form");
  let leadEmail = "";

  async function capture(payload) {
    const res = await fetch("/api/capture-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: "roxzone",
        utm: {
          utm_source: utm.utm_source || "roxzone",
          utm_medium: utm.utm_medium || "ask-dina",
          utm_campaign: utm.utm_campaign || "",
          utm_content: utm.utm_content || "",
          utm_term: utm.utm_term || "",
        },
        ...payload,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
  }

  if (form && note) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      note.textContent = "Sending…";
      try {
        leadEmail = String(data.get("email") || "").trim();
        await capture({
          email: leadEmail,
          message: String(data.get("question") || ""),
        });
        note.textContent = "Got it — Dina will reply to your inbox.";
        form.reset();
        if (onboard) {
          onboard.hidden = false;
          const first = onboard.querySelector("select, input");
          if (first) first.focus({ preventScroll: true });
        }
      } catch {
        note.textContent =
          "Couldn't send just now. DM @roxzonewarriors on Instagram instead.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  if (onboard && note) {
    const skip = onboard.querySelector("[data-skip]");
    if (skip) {
      skip.addEventListener("click", () => {
        onboard.hidden = true;
      });
    }
    onboard.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!leadEmail) return;
      const data = new FormData(onboard);
      const profile = {};
      data.forEach((v, k) => {
        const s = String(v || "").trim();
        if (s) profile[k] = s;
      });
      const btn = onboard.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      try {
        await capture({ email: leadEmail, profile });
        onboard.hidden = true;
        note.textContent =
          "Thanks — Dina has your details and will reply with a plan. Coached athletes get their programme in the TrueCoach app.";
      } catch {
        note.textContent =
          "Couldn't save that just now — your email still went through.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  const planButtons = Array.from(document.querySelectorAll("[data-plan]"));
  const plansNote = document.getElementById("plans-note");

  planButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const planId = btn.dataset.plan;
      if (!planId) return;
      planButtons.forEach((b) => (b.disabled = true));
      if (plansNote) {
        plansNote.classList.remove("error");
        plansNote.textContent = "Opening secure checkout…";
      }
      try {
        const res = await fetch("/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: "roxzone",
            items: [{ id: planId, quantity: 1 }],
            ...utm,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.sessionUrl) {
          throw new Error(String(data?.error || "Checkout unavailable"));
        }
        window.location.href = data.sessionUrl;
      } catch (err) {
        if (plansNote) {
          plansNote.classList.add("error");
          plansNote.textContent =
            "Checkout isn't open yet — send Dina a message below and she'll set you up. (" +
            String(err && err.message ? err.message : "error") +
            ")";
        }
        planButtons.forEach((b) => (b.disabled = false));
      }
    });
  });

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const reveals = document.querySelectorAll(".reveal");
  if (
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  // Chat Zone: becomes a WhatsApp deep-link once data-whatsapp holds Dina's
  // number in international format (e.g. 628123456789). Empty = fall back to Ask Dina.
  const CHAT_GREETING = "Hi Dina, I found you on Rox Zone Warriors — ";
  document.querySelectorAll("a[data-whatsapp]").forEach((a) => {
    const digits = String(a.dataset.whatsapp || "").replace(/\D/g, "");
    if (!digits) return;
    a.href = `https://wa.me/${digits}?text=${encodeURIComponent(CHAT_GREETING)}`;
    a.target = "_blank";
    a.rel = "noopener";
  });
})();

// Founding-member seat counts: roxzone/data/seats.json, hidden until "taken" is set.
(function () {
  const slots = document.querySelectorAll("[data-seats]");
  if (!slots.length) return;
  fetch("/roxzone/data/seats.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (!json || !json.plans) return;
      slots.forEach((el) => {
        const plan = json.plans[el.dataset.seats];
        if (!plan || typeof plan.taken !== "number" || !plan.capacity) return;
        const left = Math.max(0, plan.capacity - plan.taken);
        el.textContent =
          left === 0
            ? `All ${plan.capacity} founding seats taken — join the waitlist`
            : `${left} of ${plan.capacity} founding seats left`;
        el.classList.toggle("seats-full", left === 0);
        el.hidden = false;
      });
    })
    .catch(() => {});
})();

// External tool links (TrueCoach etc.): roxzone/data/links.json, hidden until a URL is set.
(function () {
  const links = document.querySelectorAll("[data-link]");
  if (!links.length) return;
  fetch("/roxzone/data/links.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (!json) return;
      links.forEach((el) => {
        const url = json[el.dataset.link];
        if (typeof url !== "string" || !/^https:\/\//.test(url)) return;
        el.href = url;
        el.hidden = false;
      });
    })
    .catch(() => {});
})();

// Results wall + Dina's week from roxzone/data/wall.json (consented entries only; empty lists stay hidden).
(function () {
  const section = document.getElementById("wall");
  if (!section) return;
  const esc = (v) => String(v || "");
  fetch("/roxzone/data/wall.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (!json) return;
      const athletes = Array.isArray(json.athletes) ? json.athletes : [];
      const weeks = Array.isArray(json.weeks) ? json.weeks.slice(0, 3) : [];
      if (!athletes.length && !weeks.length) return;
      const list = document.getElementById("wall-list");
      athletes.forEach((a) => {
        const li = document.createElement("li");
        li.className = "wall-item reveal";
        const times = document.createElement("div");
        times.className = "wall-times";
        if (a.before) {
          const b = document.createElement("s");
          b.textContent = esc(a.before);
          times.appendChild(b);
        }
        const after = document.createElement("strong");
        after.textContent = esc(a.after);
        times.appendChild(after);
        const who = document.createElement("div");
        who.className = "wall-who";
        const name = document.createElement("h4");
        name.textContent = `${esc(a.name)} · ${esc(a.division)}`;
        const meta = document.createElement("p");
        meta.textContent = [a.event, a.date, a.note]
          .filter(Boolean)
          .join(" · ");
        who.append(name, meta);
        li.append(times, who);
        list.appendChild(li);
      });
      if (weeks.length) {
        const wl = document.getElementById("week-list");
        weeks.forEach((w) => {
          const li = document.createElement("li");
          const d = document.createElement("time");
          d.textContent = esc(w.date);
          const p = document.createElement("p");
          p.textContent = esc(w.text);
          li.append(d, p);
          wl.appendChild(li);
        });
        document.getElementById("week").hidden = false;
      }
      section.hidden = false;
      section
        .querySelectorAll(".reveal")
        .forEach((el) => el.classList.add("in"));
    })
    .catch(() => {});
})();

// Race countdown from roxzone/data/events.json — hidden unless 'next' has a confirmed date.
(function () {
  const box = document.getElementById("countdown");
  if (!box) return;
  fetch("/roxzone/data/events.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const next = json && json.next;
      if (!next || !/^\d{4}-\d{2}-\d{2}$/.test(String(next.date || ""))) return;
      const target = new Date(`${next.date}T00:00:00+07:00`).getTime();
      if (!Number.isFinite(target) || target < Date.now()) return;
      document.getElementById("countdown-name").textContent = String(
        next.name || "",
      );
      const dateEl = document.getElementById("countdown-date");
      dateEl.dateTime = next.date;
      dateEl.textContent = new Date(target).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      });
      if (typeof next.url === "string" && /^https:\/\//.test(next.url)) {
        const link = document.getElementById("countdown-link");
        link.href = next.url;
        link.textContent = "Official race page";
        link.rel = "noopener";
        link.target = "_blank";
      }
      const tick = () => {
        const left = Math.max(0, target - Date.now());
        document.getElementById("cd-days").textContent = String(
          Math.floor(left / 864e5),
        );
        document.getElementById("cd-hours").textContent = String(
          Math.floor((left % 864e5) / 36e5),
        );
        document.getElementById("cd-mins").textContent = String(
          Math.floor((left % 36e5) / 6e4),
        );
      };
      tick();
      setInterval(tick, 30000);
      box.hidden = false;
    })
    .catch(() => {});
})();
