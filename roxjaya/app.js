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
        tenant_id: "roxjaya",
        utm: {
          utm_source: utm.utm_source || "roxjaya",
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
          "Couldn't send just now. DM @roxjayawarriors on Instagram instead.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  const PLANS = {
    program: {
      id: "roxjaya-plan-warrior-001",
      name: "Warrior Program",
      cta: "Start the Program",
    },
    hybrid: {
      id: "roxjaya-plan-hybrid-001",
      name: "Hybrid Coaching",
      cta: "Start Hybrid Coaching",
    },
    elite: {
      id: "roxjaya-plan-elite-001",
      name: "Elite Race Prep",
      cta: "Enquire about Elite",
    },
  };

  function recommend(p) {
    const goal = String(p.goal || "");
    const exp = String(p.experience || "");
    const days = String(p.days_per_week || "");
    const inJakarta = /jakarta|jkt|tangerang|bekasi|depok|bogor/i.test(
      String(p.city || ""),
    );
    const raced = exp === "2–4 races" || exp === "5+ races";
    let weeksOut = null;
    if (p.race_date) {
      const t = new Date(`${p.race_date}T00:00:00`).getTime();
      if (Number.isFinite(t)) weeksOut = (t - Date.now()) / (7 * 864e5);
    }
    if (
      goal === "Podium / elite" ||
      (raced && weeksOut !== null && weeksOut <= 16 && weeksOut > 0)
    ) {
      return {
        key: "elite",
        why:
          goal === "Podium / elite"
            ? "You're racing for a place, not a finish — that needs a fully individualised build with pacing and station strategy."
            : "You've raced before and your race is inside 16 weeks — a dedicated race build gets more out of that window than general programming.",
      };
    }
    if (/pregnan|post-natal/i.test(goal)) {
      return {
        key: inJakarta ? "hybrid" : "program",
        why: inJakarta
          ? "Training through pregnancy or a comeback is exactly where Dina's own experience counts — floor time for form checks plus weekly video review."
          : "Dina programmes around your stage and checks your form on video each week; tell her in the notes where you are and she'll adjust.",
      };
    }
    if (days === "2") {
      return {
        key: "program",
        why: "Two sessions a week is best spent on a tight, structured programme you can actually stick to — upgrade when life gives you a third day.",
      };
    }
    if (
      inJakarta &&
      (goal === "First Hyrox" ||
        goal === "Faster time" ||
        goal === "Doubles / relay")
    ) {
      return {
        key: "hybrid",
        why: "You're in Jakarta, so two floor sessions a month with Dina fix the station technique that costs first-timers and PB-chasers the most time.",
      };
    }
    return {
      key: "program",
      why: "A structured weekly programme with the station library and monthly Q&A covers your goal — and Dina can move you to 1:1 coaching any time.",
    };
  }

  function showZone(profile) {
    const box = document.getElementById("zone-result");
    if (!box) return null;
    const rec = recommend(profile);
    const plan = PLANS[rec.key];
    document.getElementById("zone-plan").textContent = plan.name;
    document.getElementById("zone-why").textContent = rec.why;
    const cta = document.getElementById("zone-cta");
    cta.textContent = plan.cta;
    cta.href = "#plans";
    box.hidden = false;
    const card = document.querySelector(`[data-plan="${plan.id}"]`);
    document
      .querySelectorAll(".plan.recommended")
      .forEach((el) => el.classList.remove("recommended"));
    if (card && card.closest(".plan"))
      card.closest(".plan").classList.add("recommended");
    return plan.id;
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
      const data = new FormData(onboard);
      const profile = {};
      data.forEach((v, k) => {
        const s = String(v || "").trim();
        if (s) profile[k] = s;
      });
      const recommended = showZone(profile);
      if (recommended) profile.recommended_plan = recommended;
      onboard.hidden = true;
      if (!leadEmail) return;
      try {
        await capture({ email: leadEmail, profile });
        note.textContent =
          "Thanks — Dina has your details and will reply with a plan. Coached athletes get their programme in the TrueCoach app.";
      } catch {
        note.textContent =
          "Couldn't save that just now — your email still went through.";
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
            tenant_id: "roxjaya",
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
  const CHAT_GREETING = "Hi Dina, I found you on Roxjaya Warriors — ";
  document.querySelectorAll("a[data-whatsapp]").forEach((a) => {
    const digits = String(a.dataset.whatsapp || "").replace(/\D/g, "");
    if (!digits) return;
    a.href = `https://wa.me/${digits}?text=${encodeURIComponent(CHAT_GREETING)}`;
    a.target = "_blank";
    a.rel = "noopener";
  });
})();

// Founding-member seat counts: roxjaya/data/seats.json, hidden until "taken" is set.
(function () {
  const slots = document.querySelectorAll("[data-seats]");
  if (!slots.length) return;
  fetch("/roxjaya/data/seats.json", { cache: "no-cache" })
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

// External tool links (TrueCoach etc.): roxjaya/data/links.json, hidden until a URL is set.
(function () {
  const links = document.querySelectorAll("[data-link]");
  if (!links.length) return;
  fetch("/roxjaya/data/links.json", { cache: "no-cache" })
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

// Results wall + Dina's week from roxjaya/data/wall.json (consented entries only; empty lists stay hidden).
(function () {
  const section = document.getElementById("wall");
  if (!section) return;
  const esc = (v) => String(v || "");
  fetch("/roxjaya/data/wall.json", { cache: "no-cache" })
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

// Race countdown from roxjaya/data/events.json — hidden unless 'next' has a confirmed date.
(function () {
  const box = document.getElementById("countdown");
  if (!box) return;
  fetch("/roxjaya/data/events.json", { cache: "no-cache" })
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
