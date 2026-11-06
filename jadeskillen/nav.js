/* Nav manifest — ensures every public page's dropdowns match
   data/desk/nav.json. Adding a module becomes a manifest edit,
   not a dozen hand-edited navs. */
(async () => {
  try {
    const res = await fetch("/jadeskillen/data/nav.json", { cache: "no-cache" });
    if (!res.ok) return;
    const manifest = await res.json();
    const menu = document.getElementById("menu");
    if (!menu) return;
    Object.entries(manifest).forEach(([section, items]) => {
      const parent = [...menu.querySelectorAll(":scope > li")].find(li =>
        (li.querySelector(":scope > a, :scope > button")?.textContent || "").trim().startsWith(section)
      );
      const sub = parent?.querySelector(".sub");
      if (!sub) return;
      items.forEach(item => {
        const exists = [...sub.querySelectorAll("a")].some(a => {
          try { return new URL(a.href, location.href).pathname === item.href; } catch { return false; }
        });
        if (exists) return;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = item.href; a.textContent = item.label;
        li.appendChild(a);
        const idx = item.position ?? (item.first ? 0 : sub.children.length);
        sub.insertBefore(li, sub.children[idx] || null);
      });
    });
  } catch { /* nav is best-effort — page still works without it */ }
})();
