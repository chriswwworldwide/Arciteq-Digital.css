(() => {
  const form = document.getElementById("platform-form"), summary = document.querySelector("[data-training-platform]");
  if (!form && !summary) return;
  const key = "racetoframe:training-platform-preview:v1";
  const $ = id => document.getElementById(id);
  const safeURL = value => {
    try {
      const url = new URL(String(value).trim());
      return url.protocol === "https:" && !url.username && !url.password && ![...url.searchParams.keys()].some(name => /^(?:api[_-]?key|access[_-]?token|token|password|secret)$/i.test(name)) && !/(?:token|password|secret)=/i.test(url.hash) ? url.href : "";
    } catch { return ""; }
  };
  const validated = data => {
    if (!data || !["Trainerize", "FITR", "Other", "I haven’t chosen one"].includes(data.provider)) return null;
    if (data.provider === "I haven’t chosen one") return { provider: data.provider, name: "", coachURL: "", clientURL: "" };
    const coachURL = safeURL(data.coachURL), clientURL = safeURL(data.clientURL), name = String(data.name || data.provider).trim().slice(0, 80);
    return coachURL && clientURL && name ? { provider: data.provider, name, coachURL, clientURL } : null;
  };
  let saved;
  try { saved = validated(JSON.parse(localStorage.getItem(key))); } catch { saved = null; }
  if (summary && saved?.coachURL) {
    summary.querySelector("[data-platform-heading]").textContent = saved.name;
    summary.querySelector("[data-platform-summary]").textContent = "Open your coaching software to manage programmes, review check-ins and follow client progress. Check the client access link whenever you update your onboarding.";
    for (const [selector, url] of [["[data-platform-coach]", saved.coachURL], ["[data-platform-client]", saved.clientURL]]) {
      const link = summary.querySelector(selector); link.href = url; link.hidden = false;
    }
    summary.querySelector("[data-platform-status]").textContent = "Your platform links are ready in this browser preview.";
    summary.querySelector('a[href="/racetoframe/platform-setup.html"]').textContent = "Edit platform setup";
  }
  if (!form) return;
  const provider = $("platform-provider"), name = $("platform-name"), coach = $("platform-coach-url"), client = $("platform-client-url");
  const update = () => {
    const chosen = provider.value && provider.value !== "I haven’t chosen one";
    $("platform-links").hidden = !chosen;
    coach.required = client.required = Boolean(chosen);
    $("platform-name-label").hidden = provider.value !== "Other";
    name.required = provider.value === "Other";
  };
  if (saved) { provider.value = saved.provider; name.value = saved.name; coach.value = saved.coachURL; client.value = saved.clientURL; }
  update();
  provider.addEventListener("change", () => { update(); $("platform-save-status").textContent = ""; });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = validated({ provider: provider.value, name: provider.value === "Other" ? name.value : provider.value, coachURL: coach.value, clientURL: client.value });
    const status = $("platform-save-status");
    if (!data) { status.textContent = "Choose your platform and add valid HTTPS coach and client links, without passwords or access tokens."; return; }
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { status.textContent = "Your browser could not save these links. Check its storage settings and try again."; return; }
    status.textContent = data.coachURL ? "Platform setup saved. Return to your coaching workspace to try the links." : "Choice saved. Explore the options here and add your links when you are ready.";
  });
})();
