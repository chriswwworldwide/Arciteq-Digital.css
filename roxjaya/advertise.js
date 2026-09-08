/* Advertise with Roxjaya: list sponsor slots from products.json, save the
   sponsor's brand details as a `sponsor` submission, then hand off to the
   normal checkout. Nothing goes live until Dina approves on her desk. */
(function () {
  "use strict";
  const list = document.getElementById("slot-list");
  const form = document.getElementById("sponsor-form");
  const select = document.getElementById("sponsor-slot");
  const note = document.getElementById("sponsor-note");
  if (!list || !form || !select || !note) return;

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
  const SLOT_LABEL = {
    results: "Results board + split analyser",
    planner: "Race planner + Hyrox Jakarta page",
    partner: "Community partner (every page)",
  };
  const idr = (amount) =>
    "Rp " + Math.round(Number(amount || 0) / 100).toLocaleString("en-US");

  function utmParams() {
    const q = new URLSearchParams(location.search);
    const out = {};
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ].forEach((k) => {
      const v = q.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  let products = [];
  let taken = new Set();

  function render() {
    if (!products.length) {
      list.innerHTML =
        '<li class="event"><time>Soon</time><div><p>Slots aren\u2019t open yet \u2014 message Dina and she\u2019ll set you up by hand.</p></div></li>';
      return;
    }
    list.innerHTML = products
      .map((p) => {
        const slot = p.attributes.sponsorSlot;
        const busy = taken.has(slot);
        return `<li class="event slot-card">
          <time>${esc(SLOT_LABEL[slot] || slot)}</time>
          <div>
            <h4>${esc(p.title)}</h4>
            <p>${esc(p.description || "")}</p>
            <p class="price">${idr(p.price?.amount)} / month</p>
            ${busy ? '<p class="taken">Taken right now \u2014 book and you go live when it frees up.</p>' : ""}
            <button class="btn btn-light" type="button" data-pick="${esc(p.id)}">Pick this slot</button>
          </div>
        </li>`;
      })
      .join("");
    select.innerHTML =
      '<option value="">Choose\u2026</option>' +
      products
        .map(
          (p) =>
            `<option value="${esc(p.id)}">${esc(p.title)} \u2014 ${idr(p.price?.amount)}/mo</option>`,
        )
        .join("");
  }

  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    select.value = b.dataset.pick;
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
    form.querySelector('[name="name"]')?.focus({ preventScroll: true });
  });

  Promise.all([
    fetch("/data/products.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch("/roxjaya/data/partners.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]).then(([prods, partners]) => {
    const all = Array.isArray(prods) ? prods : prods?.products || [];
    products = all.filter(
      (p) =>
        p &&
        String(p.tenant_id || "") === "roxjaya" &&
        p.attributes &&
        p.attributes.sponsorSlot &&
        p.active !== false,
    );
    const today = new Date().toISOString().slice(0, 10);
    (partners?.items || []).forEach((row) => {
      if (row && (!row.until || row.until >= today) && row.slot)
        taken.add(row.slot);
    });
    render();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const productId = String(fd.get("slot") || "");
    const email = String(fd.get("email") || "").trim();
    const payload = {
      name: String(fd.get("name") || "").trim(),
      url: String(fd.get("url") || "").trim(),
      logo: String(fd.get("logo") || "").trim(),
      tagline: String(fd.get("tagline") || "").trim(),
      productId,
      consent: fd.get("consent") ? "yes" : "no",
      source: "advertise",
    };
    note.classList.remove("error");
    if (!productId) {
      note.classList.add("error");
      note.textContent = "Pick a slot first.";
      return;
    }
    if (!/^https?:\/\//i.test(payload.url)) {
      note.classList.add("error");
      note.textContent = "Website must start with http:// or https://";
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    note.textContent = "Saving your details\u2026";
    try {
      const saved = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, kind: "sponsor", payload }),
      });
      if (!saved.ok) {
        const d = await saved.json().catch(() => ({}));
        throw new Error(String(d?.error || "Couldn\u2019t save your details"));
      }
      note.textContent = "Opening secure checkout\u2026";
      const res = await fetch("/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "roxjaya",
          items: [{ id: productId, quantity: 1 }],
          customer_email: email,
          ...utmParams(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sessionUrl)
        throw new Error(String(data?.error || "Checkout unavailable"));
      window.location.href = data.sessionUrl;
    } catch (err) {
      note.classList.add("error");
      note.textContent =
        "Couldn\u2019t start checkout \u2014 your details are saved; message Dina and she\u2019ll finish it by hand. (" +
        String(err && err.message ? err.message : "error") +
        ")";
      if (btn) btn.disabled = false;
    }
  });
})();
