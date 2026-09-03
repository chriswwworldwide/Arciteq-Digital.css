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

  const form = document.getElementById("ask-form");
  const note = document.getElementById("ask-note");
  if (form && note) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      note.textContent = "Sending…";
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.get("email"),
            tenant_id: form.dataset.tenant,
            utm: {
              source: "roxzone",
              medium: "ask-dina",
              content: data.get("question") || "",
            },
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        note.textContent = "Got it — Dina will reply to your inbox.";
        form.reset();
      } catch {
        note.textContent =
          "Couldn't send just now. DM @roxzonewarriors on Instagram instead.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

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
})();
