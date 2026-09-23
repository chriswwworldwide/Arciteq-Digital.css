/* Pay page: manual bank transfer. Reads roxjaya/data/payment.json (bank,
   optional QRIS image, plans), records the reservation as a `bank_transfer`
   submission so it shows on Dina's desk as pending, then reveals the bank
   details with a short reference the athlete puts in the transfer note. */
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
  const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

  const form = document.getElementById("pay-form");
  const select = document.getElementById("pay-plan");
  const summary = document.getElementById("pay-plan-summary");
  const note = document.getElementById("pay-note");
  if (!form || !select || !note) return;

  let cfg = null;
  const wanted = new URLSearchParams(location.search).get("plan") || "";

  function showSummary() {
    const plan = (cfg?.plans || []).find((p) => p.id === select.value);
    if (!summary) return;
    summary.textContent = plan
      ? `${rupiah(plan.amountIdr)} ${plan.per}. ${plan.summary || ""}`
      : "";
  }

  fetch("/roxjaya/data/payment.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      cfg = json || {};
      const plans = Array.isArray(cfg.plans) ? cfg.plans : [];
      select.innerHTML =
        `<option value="">Choose a plan…</option>` +
        plans
          .map(
            (p) =>
              `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(rupiah(p.amountIdr))} ${esc(p.per)}</option>`,
          )
          .join("");
      if (plans.some((p) => p.id === wanted)) select.value = wanted;
      showSummary();
    })
    .catch(() => {
      select.innerHTML = `<option value="">Plans unavailable — message Dina</option>`;
    });
  select.addEventListener("change", showSummary);

  function makeRef() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    return "RJ-" + Array.from(bytes, (b) => alphabet[b % 32]).join("");
  }

  function row(label, value, copy) {
    return `<div><dt>${esc(label)}</dt><dd><span>${esc(value)}</span>${
      copy
        ? `<button type="button" class="copy" data-copy="${esc(copy)}">Copy</button>`
        : ""
    }</dd></div>`;
  }

  function reveal(plan, ref, email) {
    const bank = cfg.bank || {};
    const details = document.getElementById("pay-details");
    document.getElementById("pay-ref").textContent = ref;
    details.innerHTML = [
      row("Bank", bank.name || ""),
      row(
        "Account number",
        bank.accountNumber || "",
        String(bank.accountNumber || "").replace(/\s/g, ""),
      ),
      row("Account name", bank.accountName || ""),
      row("Amount", rupiah(plan.amountIdr), String(plan.amountIdr)),
      row("Transfer note", ref, ref),
    ].join("");
    details.querySelectorAll("[data-copy]").forEach((b) => {
      b.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy);
          b.textContent = "Copied";
          setTimeout(() => (b.textContent = "Copy"), 1500);
        } catch {
          b.textContent = "Select & copy";
        }
      });
    });
    const nameNote = document.getElementById("pay-name-note");
    if (nameNote) nameNote.textContent = bank.accountNameNote || "";

    const qris = document.getElementById("pay-qris");
    const qrisImg = document.getElementById("pay-qris-img");
    if (qris && qrisImg && cfg.qris && cfg.qris.src) {
      qrisImg.src = cfg.qris.src;
      qrisImg.alt = cfg.qris.alt || "QRIS code";
      qris.hidden = false;
    }

    const msg = `Hi Dina — I've reserved ${plan.name} (${rupiah(plan.amountIdr)}). Reference ${ref}. Transfer proof attached. Email: ${email}`;
    const wa = document.getElementById("pay-wa");
    const digits = String(cfg.whatsapp || "").replace(/\D/g, "");
    if (wa && digits) {
      wa.href = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
      wa.target = "_blank";
      wa.rel = "noopener";
      wa.hidden = false;
    }
    const ig = document.getElementById("pay-ig");
    if (ig) {
      const handle = String(cfg.instagram || "").replace(/^@/, "");
      if (handle) ig.href = `https://ig.me/m/${encodeURIComponent(handle)}`;
      else ig.hidden = true;
    }
    const done = document.getElementById("pay-done");
    if (done)
      done.textContent = `Quote reference ${ref} in your message. A copy of these details is on this page — screenshot it now if you like.`;

    document.getElementById("transfer").hidden = false;
    document.getElementById("proof").hidden = false;
    document
      .getElementById("transfer")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const plan = (cfg?.plans || []).find((p) => p.id === select.value);
    if (!plan) {
      note.textContent = "Pick a plan first.";
      return;
    }
    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim();
    const ref = makeRef();
    const payload = {
      plan_id: plan.id,
      plan_name: plan.name,
      amount_idr: Number(plan.amountIdr),
      reference: ref,
      name: String(fd.get("name") || "").trim(),
      whatsapp: String(fd.get("whatsapp") || "").trim(),
      note: String(fd.get("note") || "").trim(),
      method: "bank_transfer",
      status: "pending",
    };
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    note.classList.remove("error");
    note.textContent = "Reserving your place…";
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          kind: "bank_transfer",
          payload,
          website: String(fd.get("website") || ""),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      note.textContent = `Reserved. Your reference is ${ref} — bank details are below.`;
    } catch {
      note.classList.add("error");
      note.textContent =
        "Couldn't save the reservation, but you can still pay — use the details below and send Dina the proof.";
      if (btn) btn.disabled = false;
    }
    reveal(plan, ref, email);
  });
})();
