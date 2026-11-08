(() => {
  const root = "/racetoframe/";
  const html = document.documentElement;
  const enabled = html.dataset.coachPreview === "true";
  const params = new URLSearchParams(location.search);
  const audience = !enabled || params.get("audience") === "public" ? "public" : "coach";
  html.dataset.previewAudience = audience;
  if (audience === "public" && html.dataset.coachPage === "true") {
    location.replace(`${root}?audience=public`);
    return;
  }
  if (audience === "public" && /\/planner(?:\.html|\/)$/.test(location.pathname) && params.get("view") === "coach") {
    const url = new URL(location.href);
    url.searchParams.set("view", "client");
    location.replace(url.href);
    return;
  }
  const publicLink = anchor => {
    if (audience !== "public" || !anchor || anchor.hasAttribute("data-coach-link")) return;
    const raw = anchor.getAttribute("href");
    if (!raw || raw.startsWith("#")) return;
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(root)) return;
      url.searchParams.set("audience", "public");
      if (/\/planner(?:\.html|\/)$/.test(url.pathname)) url.searchParams.set("view", "client");
      anchor.href = url.href;
    } catch { return; }
  };
  const ready = () => {
    if (enabled && audience === "public" && !document.querySelector("[data-public-preview]")) {
      const banner = document.createElement("aside"), text = document.createElement("span"), back = document.createElement("a");
      banner.className = "public-preview-banner"; banner.dataset.publicPreview = "true"; banner.setAttribute("aria-label", "Public-site preview controls");
      text.textContent = "Public-site preview · This is the athlete-facing experience.";
      back.textContent = "Back to coach view"; back.href = `${root}?audience=coach`; back.setAttribute("data-coach-link", "");
      banner.append(text, back); document.body.prepend(banner);
    }
    document.querySelectorAll("[data-coach-view]").forEach(bar => {
      const button = bar.querySelector(".coach-view-toggle");
      if (!button) return;
      const setExpanded = expanded => { bar.dataset.coachExpanded = String(expanded); button.setAttribute("aria-expanded", String(expanded)); button.textContent = expanded ? "Hide tools" : "Show tools"; };
      const mobile = matchMedia("(max-width: 800px)");
      setExpanded(!mobile.matches);
      button.addEventListener("click", () => setExpanded(bar.dataset.coachExpanded !== "true"));
      mobile.addEventListener("change", () => setExpanded(!mobile.matches));
    });
    document.querySelectorAll("a[href]").forEach(publicLink);
    document.addEventListener("click", event => publicLink(event.target.closest("a[href]")));
    document.addEventListener("auxclick", event => publicLink(event.target.closest("a[href]")));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
})();
