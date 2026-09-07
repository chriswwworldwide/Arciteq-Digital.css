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
