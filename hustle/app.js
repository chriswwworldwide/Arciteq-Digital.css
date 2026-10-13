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

  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    closeAll();
  }

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    menu.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", closeMenu);
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

  document.addEventListener("click", (e) => {
    closeAll();
    if (menu && menu.classList.contains("open") && !e.target.closest(".nav")) {
      closeMenu();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAll();
      closeMenu();
    }
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
        tenant_id: "hustle",
        utm: {
          utm_source: utm.utm_source || "hustle",
          utm_medium: utm.utm_medium || "ask-coach",
          utm_campaign: utm.utm_campaign || "",
          utm_content: utm.utm_content || "",
          utm_term: utm.utm_term || "",
        },
        ...payload,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
  }

  // FAQ receptionist — the 10 questions every gym gets asked, answered
  // instantly from data/faq.json. Anything it can't match still lands in
  // the coach's inbox via the normal capture below.
  const faqQuick = document.getElementById("faq-quick");
  const faqChips = document.getElementById("faq-chips");
  const faqAnswer = document.getElementById("faq-answer");
  let faqItems = [];
  const showFaq = (item) => {
    if (!faqAnswer) return;
    faqAnswer.hidden = false;
    faqAnswer.innerHTML = `<strong>${item.q}</strong><p>${item.a}</p>`;
    faqChips?.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("on", b.dataset.q === item.q)
    );
  };
  const matchFaq = (txt) => {
    const t = ` ${String(txt || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ")} `;
    let best = null;
    let score = 0;
    for (const item of faqItems) {
      const s = (item.keywords || []).reduce(
        (n, k) => n + (t.includes(k.toLowerCase()) ? 1 : 0),
        0
      );
      if (s > score) {
        score = s;
        best = item;
      }
    }
    return score >= 2 ? best : null;
  };
  if (faqQuick && faqChips && faqAnswer) {
    fetch("/hustle/data/faq.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        faqItems = (data && data.items) || [];
        if (!faqItems.length) return;
        faqQuick.hidden = false;
        for (const item of faqItems) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "faq-chip";
          b.dataset.q = item.q;
          b.textContent = item.q;
          b.addEventListener("click", () => showFaq(item));
          faqChips.appendChild(b);
        }
      })
      .catch(() => {});
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
        note.textContent = "Got it — Bobby will reply to your inbox.";
        const hit = matchFaq(data.get("question"));
        if (hit) {
          faqQuick.hidden = false;
          showFaq(hit);
        }
        form.reset();
        if (onboard) {
          onboard.hidden = false;
          const first = onboard.querySelector("select, input");
          if (first) first.focus({ preventScroll: true });
        }
      } catch {
        note.textContent =
          "Couldn't send just now. DM @hustlewarriors on Instagram instead.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  const PLANS = {
    crew: {
      id: "hustle-plan-crew-001",
      name: "Rookie Crew",
      cta: "Join the Crew",
    },
    program: {
      id: "hustle-plan-warrior-001",
      name: "Warrior Program",
      cta: "Start the Program",
    },
    hybrid: {
      id: "hustle-plan-hybrid-001",
      name: "Hybrid Coaching",
      cta: "Start Hybrid Coaching",
    },
    elite: {
      id: "hustle-plan-elite-001",
      name: "Elite Race Prep",
      cta: "Enquire about Elite",
    },
  };

  function recommend(p) {
    const goal = String(p.goal || "");
    const exp = String(p.experience || "");
    const days = String(p.days_per_week || "");
    const inNorwich = /london|jkt|tangerang|bekasi|depok|bogor/i.test(
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
        key: inNorwich ? "hybrid" : "program",
        why: inNorwich
          ? "Training through pregnancy or a comeback is exactly where Bobby's own experience counts — floor time for form checks plus weekly video review."
          : "Bobby programmes around your stage and checks your form on video each week; tell him in the notes where you are and he'll adjust.",
      };
    }
    if (inNorwich && exp === "Never raced") {
      return {
        key: "crew",
        why: "You've never raced and you're in Norwich — that's exactly who the Rookie Crew is for: a weekly group session at your own pace, and a crew that grows as people join. No experience needed.",
      };
    }
    if (days === "2") {
      return {
        key: "program",
        why: "Two sessions a week is best spent on a tight, structured programme you can actually stick to — upgrade when life gives you a third day.",
      };
    }
    if (
      inNorwich &&
      (goal === "First Hyrox" ||
        goal === "Faster time" ||
        goal === "Doubles / relay")
    ) {
      return {
        key: "hybrid",
        why: "You're in Norwich, so two floor sessions a month with Bobby fix the station technique that costs first-timers and PB-chasers the most time.",
      };
    }
    return {
      key: "program",
      why: "A structured weekly programme with the station library and monthly Q&A covers your goal — and Bobby can move you to 1:1 coaching any time.",
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
          "Thanks — Bobby has your details and will reply with a plan. Coached athletes get their programme in the Hustle app app.";
      } catch {
        note.textContent =
          "Couldn't save that just now — your email still went through.";
      }
    });
  }

  const planButtons = Array.from(document.querySelectorAll("[data-plan]"));
  const plansNote = document.getElementById("plans-note");

  // Payment is by bank transfer to Bobby (Stripe can't onboard an British
  // freelancer). The card checkout below stays for the day a gateway exists.
  const PAY_BY_TRANSFER = true;

  planButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const planId = btn.dataset.plan;
      if (!planId) return;
      if (PAY_BY_TRANSFER) {
        window.location.href = `/hustle/pay/?plan=${encodeURIComponent(planId)}`;
        return;
      }
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
            tenant_id: "hustle",
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
            "Checkout isn't open yet — send Bobby a message below and he'll set you up. (" +
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

  // WhatsApp: Bobby's number in international format, digits only. Every
  // .chat-zone link and any a[data-whatsapp] becomes a wa.me deep-link with a
  // greeting; the floating bubble is added to every page except the coach desk.
  const ROX_WHATSAPP = "447701385444";
  const CHAT_GREETING =
    "Hi Hustle! I found you on the site — I'm interested in HYROX training.";
  const waHref = `https://wa.me/${ROX_WHATSAPP}?text=${encodeURIComponent(CHAT_GREETING)}`;
  document.querySelectorAll("a[data-whatsapp]").forEach((a) => {
    a.dataset.whatsapp = ROX_WHATSAPP;
    a.href = waHref;
    a.target = "_blank";
    a.rel = "noopener";
    if (
      a.classList.contains("chat-zone") &&
      !a.classList.contains("chat-zone-inline")
    ) {
      a.innerHTML = '<span class="dot"></span> WhatsApp Bobby';
    }
  });
  if (
    !/\/coach(\.html|\/)?$/.test(location.pathname) &&
    !document.querySelector(".wa-fab")
  ) {
    const fab = document.createElement("a");
    fab.className = "wa-fab";
    fab.href = waHref;
    fab.target = "_blank";
    fab.rel = "noopener";
    fab.setAttribute("aria-label", "Message Bobby on WhatsApp");
    fab.innerHTML =
      '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.5.7 4.9 2 7L3 29l6.5-2.1a12.7 12.7 0 0 0 6.5 1.8c7 0 12.7-5.7 12.7-12.7S23 3 16 3zm0 23.2c-2 0-4-.5-5.7-1.6l-.4-.2-3.9 1.3 1.3-3.8-.3-.4a10.4 10.4 0 1 1 9 5zm5.8-7.8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.6l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.2 3.2 1.3 3.4c.2.2 2.3 3.5 5.6 4.9 2.8 1.1 3.3.9 3.9.8.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5l-.6-.3z"/></svg><span>WhatsApp Bobby</span>';
    document.body.appendChild(fab);
  }
})();

// Founding-member seat counts: hustle/data/seats.json, hidden until "taken" is set.
(function () {
  const slots = document.querySelectorAll("[data-seats]");
  if (!slots.length) return;
  fetch("/hustle/data/seats.json", { cache: "no-cache" })
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

// External tool links (Hustle app etc.): hustle/data/links.json, hidden until a URL is set.
(function () {
  const links = document.querySelectorAll("[data-link]");
  if (!links.length) return;
  fetch("/hustle/data/links.json", { cache: "no-cache" })
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

// Results wall + Bobby's week from hustle/data/wall.json (consented entries only; empty lists stay hidden).
(function () {
  const section = document.getElementById("wall");
  if (!section) return;
  const esc = (v) => String(v || "");
  fetch("/hustle/data/wall.json", { cache: "no-cache" })
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

// Race countdown from hustle/data/events.json — hidden unless 'next' has a confirmed date.
(function () {
  const box = document.getElementById("countdown");
  if (!box) return;
  const fromPlanner = () =>
    fetch("/hustle/data/cities.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const today = new Date().toISOString().slice(0, 10);
        const races = ((json && json.cities) || [])
          .map((c) => c.race || {})
          .filter((r) => r.status === "confirmed" && r.start >= today)
          .sort((a, b) => a.start.localeCompare(b.start));
        const r = races[0];
        return r ? { name: r.name, date: r.start, url: r.source } : null;
      });
  fetch("/hustle/data/events.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => (json && json.next) || fromPlanner())
    .then((next) => {
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
        timeZone: "the UK/Norwich",
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

// Share helper — one handler, three homes: news items, race rows, Warriors Wall
// photos. Mobile: Web Share API, with the real image file for IG/WhatsApp when
// the browser supports sharing files. Otherwise a small popover offers a
// prefilled WhatsApp message, copy link, and (for photos) a download.
window.roxShare = (function () {
  let pop = null;
  const onDoc = (e) => {
    if (pop && !pop.contains(e.target)) closePop();
  };
  function closePop() {
    pop?.remove();
    pop = null;
    document.removeEventListener("click", onDoc);
  }
  function popover(anchor, { text, url, fileUrl }) {
    closePop();
    pop = document.createElement("div");
    pop.className = "share-pop";
    const wa = document.createElement("a");
    wa.className = "share-opt";
    wa.href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`;
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.textContent = "Kirim di WhatsApp";
    const cp = document.createElement("button");
    cp.type = "button";
    cp.className = "share-opt";
    cp.textContent = "Copy link";
    cp.addEventListener("click", () => {
      navigator.clipboard?.writeText(url).then(
        () => (cp.textContent = "Copied ✓"),
        () => (cp.textContent = url),
      );
    });
    pop.append(wa, cp);
    if (fileUrl) {
      const dl = document.createElement("a");
      dl.className = "share-opt";
      dl.href = fileUrl;
      dl.target = "_blank";
      dl.rel = "noopener";
      dl.textContent = "Download foto";
      pop.appendChild(dl);
    }
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const x = Math.min(
      r.left + window.scrollX,
      window.scrollX + document.documentElement.clientWidth - 200,
    );
    pop.style.top = `${r.bottom + window.scrollY + 6}px`;
    pop.style.left = `${Math.max(x, window.scrollX + 8)}px`;
    setTimeout(() => document.addEventListener("click", onDoc), 0);
  }
  return function roxShare(anchor, { title, text, url, fileUrl }) {
    const abs = url ? new URL(url, location.href).href : location.href;
    if (navigator.canShare && fileUrl) {
      return fetch(fileUrl)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("img"))))
        .then((blob) => {
          const file = new File(
            [blob],
            fileUrl.split("/").pop() || "hustle.jpg",
            { type: blob.type || "image/jpeg" },
          );
          if (navigator.canShare({ files: [file] }))
            return navigator
              .share({ files: [file], title, text })
              .catch(() => {});
          if (navigator.share)
            return navigator.share({ title, text, url: abs }).catch(() => {});
          return popover(anchor, { text, url: abs, fileUrl });
        })
        .catch(() => {
          if (navigator.share)
            return navigator.share({ title, text, url: abs }).catch(() => {});
          return popover(anchor, { text, url: abs, fileUrl });
        });
    }
    if (navigator.share)
      return navigator.share({ title, text, url: abs }).catch(() => {});
    return popover(anchor, { text, url: abs, fileUrl });
  };
})();

// Warriors Wall: IG-style photos from hustle/data/gallery.json, grouped by event
// (tabs), shown as a tilted polaroid scatter with a lightbox. "Send your shot"
// saves caption/name/event/consent as a generic submission (kind wall_photo) on
// the athlete's record, then hands off to WhatsApp/email for the photo itself.
(function () {
  const section = document.getElementById("wall-photos");
  if (!section) return;
  const grid = document.getElementById("polaroids");
  const tabs = document.getElementById("event-tabs");
  const dialog = document.getElementById("lightbox");
  const options = document.getElementById("event-options");
  const ALL = "All";

  function polaroid(p, i) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "polaroid reveal";
    btn.dataset.event = p.event || "";
    const tilt =
      typeof p.tilt === "number" ? p.tilt : ((i * 7919) % 11) / 2 - 2.5;
    btn.style.setProperty("--tilt", `${tilt}deg`);
    const img = document.createElement("img");
    img.src = String(p.src || "");
    img.alt = String(p.alt || p.caption || "");
    img.loading = "lazy";
    img.width = 600;
    img.height = 600;
    const cap = document.createElement("p");
    cap.className = "cap";
    cap.textContent = String(p.caption || "");
    const by = document.createElement("p");
    by.className = "by";
    const who = document.createElement("b");
    who.textContent = String(p.by || "");
    by.append(who);
    if (p.event) by.append(` · ${p.event}`);
    btn.append(img, cap, by);
    btn.addEventListener("click", () => open(p));
    return btn;
  }

  function open(p) {
    if (!dialog || typeof dialog.showModal !== "function") return;
    const img = dialog.querySelector("img");
    const cap = dialog.querySelector("figcaption");
    img.src = String(p.src || "");
    img.alt = String(p.alt || p.caption || "");
    cap.textContent = String(p.caption || "");
    const small = document.createElement("small");
    small.textContent = [p.by, p.event].filter(Boolean).join(" · ");
    cap.appendChild(small);
    const share = dialog.querySelector(".lightbox-share");
    if (share)
      share.onclick = () =>
        window.roxShare(share, {
          title: "Hustle Performance Centre",
          text: String(p.caption || "Hustle Performance Centre"),
          url: `${location.origin}/hustle/#wall-photos`,
          fileUrl: p.src,
        });
    dialog.showModal();
  }

  if (dialog) {
    dialog.querySelector(".lightbox-close").addEventListener("click", () => {
      dialog.close();
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  function select(name) {
    tabs.querySelectorAll("button").forEach((b) => {
      b.setAttribute(
        "aria-selected",
        b.dataset.event === name ? "true" : "false",
      );
    });
    grid.querySelectorAll(".polaroid").forEach((el) => {
      el.classList.toggle("is-out", name !== ALL && el.dataset.event !== name);
    });
  }

  function buildTabs(events) {
    const counts = new Map();
    events.forEach((e) => counts.set(e, (counts.get(e) || 0) + 1));
    const names = [ALL, ...counts.keys()];
    if (counts.size < 2) {
      tabs.hidden = true;
      return;
    }
    names.forEach((name) => {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.dataset.event = name;
      b.textContent = name;
      if (name !== ALL) {
        const n = document.createElement("span");
        n.textContent = String(counts.get(name));
        b.appendChild(n);
      }
      b.addEventListener("click", () => select(name));
      tabs.appendChild(b);
    });
    select(ALL);
  }

  fetch("/hustle/data/gallery.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const photos = Array.isArray(json?.photos) ? json.photos : [];
      if (!photos.length) return;
      photos.forEach((p, i) => grid.appendChild(polaroid(p, i)));
      buildTabs(photos.map((p) => String(p.event || "")).filter(Boolean));
      if (options) {
        [...new Set(photos.map((p) => p.event).filter(Boolean))].forEach(
          (e) => {
            const o = document.createElement("option");
            o.value = String(e);
            options.appendChild(o);
          },
        );
      }
      section.hidden = false;
      section
        .querySelectorAll(".reveal")
        .forEach((el) => el.classList.add("in"));
    })
    .catch(() => {});

  // Send your shot
  const toggle = document.getElementById("send-shot-btn");
  const form = document.getElementById("shot-form");
  const note = document.getElementById("shot-note");
  if (!toggle || !form) return;
  toggle.addEventListener("click", () => {
    form.hidden = false;
    toggle.hidden = true;
    form.querySelector("textarea").focus();
  });

  const wa = document.querySelector("a[data-whatsapp]");
  const waDigits = String(wa?.dataset.whatsapp || "").replace(/\D/g, "");
  const fileInput = form.querySelector("input[name=photo]");
  const preview = document.getElementById("shot-preview");

  fileInput?.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f || !preview) return;
    preview.src = URL.createObjectURL(f);
    preview.hidden = false;
  });

  // Shrink the photo for the trip — max 1600px JPEG (~300–500 KB). The file
  // goes to the server as a data URL; it lands as a real image on Bobby's
  // desk, not inside the JSON payload.
  const shrink = (f) =>
    new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, 1600 / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * s);
        c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(im.src);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      im.onerror = () => resolve("");
      im.src = URL.createObjectURL(f);
    });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      caption: String(data.get("caption") || "").trim(),
      by: String(data.get("by") || "").trim(),
      event: String(data.get("event") || "").trim(),
      consent: data.get("consent") ? "yes" : "no",
      source: "warriors_wall",
    };
    const email = String(data.get("email") || "").trim();
    const file = fileInput?.files?.[0];
    note.textContent = "Sending your photo…";
    const photo = file ? await shrink(file) : "";
    let saved = false;
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          kind: "wall_photo",
          payload,
          photo,
          website: String(data.get("website") || ""),
        }),
      });
      saved = res.ok;
    } catch {
      saved = false;
    }
    if (saved) {
      note.textContent =
        "Got it — photo and caption on Bobby's desk. It goes up once he's had a look.";
      form.querySelector("button[type=submit]").disabled = true;
      return;
    }
    // fallback: caption is typed anyway, so offer the WhatsApp route
    const msg = `Hi Bobby — a photo for the Warriors Wall.\nEvent: ${payload.event}\nCaption: ${payload.caption}\nBy: ${payload.by}\nI'm happy for it to go on the site and @hustle.`;
    if (waDigits) {
      window.open(
        `https://wa.me/${waDigits}?text=${encodeURIComponent(msg)}`,
        "_blank",
        "noopener",
      );
      note.textContent =
        "Upload didn't go through — WhatsApp is open, send the photo there instead.";
    } else {
      note.textContent =
        "Upload didn't go through — send the photo and caption to Bobby on Instagram (@hustle_norwich) and he'll put it up.";
    }
  });
})();

// Page-view beacon: cookie-free, no personal data. A random visitor id lives
// in localStorage for 30 days so returning visitors can be counted without
// identifying anyone. Athletes who already have a private splits token are stitched
// onto their own record so Bobby can see which pages her leads read.
(function () {
  if (/\/coach\/?$/.test(location.pathname)) return;
  let visitor = "";
  try {
    const now = Date.now();
    const raw = JSON.parse(localStorage.getItem("hustle.visitor") || "null");
    if (raw && Number(raw.exp) > now && /^[a-f0-9]{16}$/.test(raw.id)) {
      visitor = raw.id;
    } else {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      visitor = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
        "",
      );
      localStorage.setItem(
        "hustle.visitor",
        JSON.stringify({ exp: now + 30 * 24 * 60 * 60 * 1000, id: visitor }),
      );
    }
  } catch {
    visitor = "";
  }
  const params = new URLSearchParams(location.search);
  const utm = {};
  ["source", "medium", "campaign"].forEach((k) => {
    const v = params.get("utm_" + k);
    if (v) utm[k] = v;
  });
  let token = "";
  try {
    token = localStorage.getItem("hustle.splits.token") || "";
  } catch {
    token = "";
  }
  const body = JSON.stringify({
    path: location.pathname,
    referrer: document.referrer,
    utm,
    visitor,
    token,
  });
  try {
    fetch("/api/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
})();

/* Testimonials: real quotes from hustle/data/testimonials.json; the
   section only appears once there is at least one complete row. */
(function () {
  const sec = document.getElementById("athletes-say");
  const mount = document.getElementById("testimonials");
  if (!sec || !mount) return;
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
  fetch("/hustle/data/testimonials.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const rows = (j?.items || [])
        .filter((q) => q && String(q.quote || "").trim() && q.name)
        .slice(0, 3);
      if (!rows.length) return;
      mount.innerHTML = rows
        .map(
          (q) => `<blockquote class="quote">
          <p>${esc(q.quote)}</p>
          <footer><strong>${esc(q.name)}</strong>${q.detail ? " · " + esc(q.detail) : ""}${q.plan ? " · " + esc(q.plan) : ""}</footer>
        </blockquote>`,
        )
        .join("");
      sec.hidden = false;
    })
    .catch(() => {});
})();

// Sticky "Start training" bar: appears once the hero has scrolled away and
// hides again while the plans section (its own destination) is on screen.
(function () {
  const bar = document.getElementById("sticky-cta");
  const hero = document.querySelector(".hero");
  const plans = document.getElementById("plans");
  if (!bar || !hero || !("IntersectionObserver" in window)) return;
  bar.hidden = false;
  document.body.classList.add("has-sticky-cta");
  let heroVisible = true;
  let plansVisible = false;
  const update = () =>
    bar.classList.toggle("is-visible", !heroVisible && !plansVisible);
  new IntersectionObserver(
    (entries) => {
      heroVisible = entries[0].isIntersecting;
      update();
    },
    { threshold: 0.15 },
  ).observe(hero);
  if (plans) {
    new IntersectionObserver(
      (entries) => {
        plansVisible = entries[0].isIntersecting;
        update();
      },
      { threshold: 0.2 },
    ).observe(plans);
  }
})();

// HYROX Norwich date alert — one email when the official date is published.
(() => {
  const form = document.getElementById("date-alert");
  if (!form) return;
  const note = form.querySelector("[data-note]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    if (note) note.textContent = "Saving…";
    let saved = false;
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          kind: "date_alert",
          payload: { race: "hyrox-norwich-2027", source: "hyrox-norwich-page" },
          website: String(data.get("website") || ""),
        }),
      });
      saved = res.ok;
    } catch {
      saved = false;
    }
    if (note)
      note.textContent = saved
        ? "Done — you'll get one email the day HYROX publishes the Norwich 2027 date."
        : "Couldn't save just now — please try again in a minute.";
    if (saved) form.reset();
  });
})();

// Hero reveal lives in hero-reveal.js (a WebGL pixel-resolve over the photo).

// Feather the hero photo's painted edges so the blurred ambient (the same
// photo, defocused) bleeds through — the hard line disappears by colour-
// matching itself. Desktop only: the mobile photo bleeds to the section
// edges by design.
(() => {
  const img = document.querySelector(".hero--bleed .hero-img");
  if (!img) return;
  // The mask goes on the .hero-mask wrapper — the img carries the enter/drift
  // transform animations, and Safari won't composite a masked element that
  // itself (or an ancestor of it) transform-animates. Masked parent + moving
  // child is the safe arrangement.
  const maskEl = img.closest(".hero-mask") || img;
  const wide = window.matchMedia("(min-width: 801px)");
  let nt;
  const photo = new Image();
  const clear = () => {
    maskEl.style.maskImage = maskEl.style.webkitMaskImage = "";
    maskEl.style.maskSize = maskEl.style.webkitMaskSize = "";
  };
  const mask = () => {
    if (!wide.matches) return clear();
    const iw = photo.naturalWidth,
      ih = photo.naturalHeight;
    // canvas size from the wrapper (never transform-animated); the painted
    // rect from the img's LAYOUT geometry — offset* ignores the drift
    // animation's scale, getBoundingClientRect would not
    const box = maskEl.getBoundingClientRect();
    const cW = img.offsetWidth,
      cHp = img.offsetHeight;
    if (!box.width || !box.height || !cW || !cHp || !iw || !ih) return;
    const cs = getComputedStyle(img);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const cH = cHp - pt - pb;
    const s = Math.min(cW / iw, cH / ih);
    const rw = iw * s;
    const rh = ih * s;
    const [px = "50%"] = String(cs.objectPosition || "50%")
      .trim()
      .split(/\s+/);
    const pos =
      px === "center"
        ? (cW - rw) / 2
        : px.endsWith("%")
          ? (parseFloat(px) / 100) * (cW - rw)
          : (cW - rw) / 2;
    // Bake a single-layer feather mask matching the shader's 0.025 edge
    // fade — one mask image, no compositing (works in every Safari).
    const fw = rw * 0.025;
    const fy = rh * 0.025;
    const mc = document.createElement("canvas");
    mc.width = Math.round(box.width);
    mc.height = Math.round(box.height);
    const g2 = mc.getContext("2d");
    const x0 = img.offsetLeft + pos,
      x1 = img.offsetLeft + pos + rw,
      y0 = img.offsetTop + pt,
      y1 = img.offsetTop + pt + rh;
    g2.fillStyle = "#000";
    g2.fillRect(x0, y0, rw, rh);
    // destination-out: each band ERASES toward the outer edge — fully clear
    // at the photo edge, fading to keep at fw/fy in. (destination-in would
    // erase everything outside each band, leaving an empty mask.)
    g2.globalCompositeOperation = "destination-out";
    const edge = (x1g, y1g, x2g, y2g) => {
      const gr = g2.createLinearGradient(x1g, y1g, x2g, y2g);
      gr.addColorStop(0, "rgba(0,0,0,1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g2.fillStyle = gr;
      g2.fillRect(0, 0, mc.width, mc.height);
    };
    edge(x0, 0, x0 + fw, 0); // left: clear at x0, keep by x0+fw
    edge(x1, 0, x1 - fw, 0); // right
    edge(0, y0, 0, y0 + fy); // top
    // bottom fades ~3x deeper — a hard photo→ink line reads during the
    // hero-reveal sweep; the sheet bake uses the same 0.08 depth
    edge(0, y1, 0, y1 - Math.max(fy, rh * 0.08)); // bottom
    const url = `url(${mc.toDataURL("image/png")})`;
    maskEl.style.maskImage = maskEl.style.webkitMaskImage = url;
    maskEl.style.maskSize = maskEl.style.webkitMaskSize = "100% 100%";
    maskEl.style.maskRepeat = maskEl.style.webkitMaskRepeat = "no-repeat";
  };
  photo.onload = mask;
  photo.src = img.currentSrc || img.src;
  const rerun = () => {
    clearTimeout(nt);
    nt = setTimeout(mask, 150);
  };
  window.addEventListener("resize", rerun);
  wide.addEventListener("change", rerun);
})();
