(() => {
  const library = document.getElementById("video-library");
  const manager = document.getElementById("video-manager");
  if (!library && !manager) return;
  const key = "joshharrison:video-library-preview:v1";
  const previewEnabled = document.documentElement.dataset.coachPreview === "true";
  const podcastEnabled = !manager || manager.dataset.podcastEnabled !== "false";
  const categories = ["Training", "Race stories", "Podcast clips", "Podcast episodes"];
  let kind = podcastEnabled && new URLSearchParams(location.search).get("type") === "podcast" ? "podcast" : "video";
  const matchesKind = item => kind === "podcast" ? item.category.startsWith("Podcast") : !item.category.startsWith("Podcast");
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const text = (value, limit) => String(value || "").trim().slice(0, limit);
  const safeURL = value => {
    if (!value) return "";
    try { const url = new URL(value, location.origin); return !url.username && !url.password && ![...url.searchParams.keys()].some(name => /^(?:api[_-]?key|access[_-]?token|token|password|secret)$/i.test(name)) && (url.protocol === "https:" || (url.origin === location.origin && url.protocol === "http:")) ? url.href : ""; } catch { return ""; }
  };
  const safeImage = value => /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(String(value)) && value.length < 700000 ? value : safeURL(value);
  function metadata(item) {
    if (!item || typeof item !== "object") return null;
    const value = { title: text(item.title, 100), description: text(item.description, 500), category: categories.includes(item.category) ? item.category : "Training", url: safeURL(item.url), thumbnail: safeImage(item.thumbnail), episodeURL: safeURL(item.episodeURL), sample: item.sample === true, linkLabel: text(item.linkLabel, 60), publishedAt: text(item.publishedAt, 40) };
    return value.title && value.url ? value : null;
  }
  let records = [], seed = [], activeId = null, uploadedThumbnail = "", filter = library?.dataset.category || "All";
  function readSaved() {
    if (previewEnabled) {
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved?.version === 1 && Array.isArray(saved.records)) return saved.records.slice(0, 100).map(record => ({ id: text(record.id, 100), published: metadata(record.published), draft: metadata(record.draft) })).filter(record => record.id && (record.published || record.draft));
      } catch { return structuredClone(seed); }
    }
    return structuredClone(seed);
  }
  function card(item) {
    const image = item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="${esc(item.title)} thumbnail" loading="lazy" />` : '<div class="video-poster-empty" aria-hidden="true">Play content</div>';
    const episode = item.category === "Podcast clips" && item.episodeURL ? `<a href="${esc(item.episodeURL)}" target="_blank" rel="noopener">Listen to the full episode →</a>` : "";
    return `<article class="video-card" data-video-title="${esc(item.title)}">${image}<div class="video-card-body"><p class="eyebrow">${item.sample ? "Sample video layout · " : ""}${esc(item.category)}</p><h4>${esc(item.title)}</h4><p>${esc(item.description)}</p><a class="btn btn-ghost" href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.linkLabel || (item.category === "Podcast episodes" ? "Listen / watch episode" : "Watch clip"))} ↗</a>${episode}</div></article>`;
  }
  function renderLibrary() {
    if (!library) return;
    const published = records.map(record => record.published).filter(Boolean).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const visible = published.filter(item => (!manager || matchesKind(item)) && (filter === "All" || item.category === filter || (filter === "Podcast" && item.category.startsWith("Podcast"))));
    library.innerHTML = visible.map(card).join("");
    const status = $("video-library-status");
    if (status) status.textContent = visible.length ? `${visible.length} ${visible.length === 1 ? "item" : "items"}${filter === "All" ? "" : ` · ${filter}`}` : "Your published cards will appear here. Start by adding a video or podcast episode.";
    document.querySelectorAll("[data-video-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.videoFilter === filter)));
  }
  function renderManager() {
    if (!manager) return;
    $("video-records").innerHTML = records.filter(record => matchesKind(record.draft || record.published)).map(record => {
      const item = record.draft || record.published;
      const state = record.published ? record.draft ? "Published · draft changes saved" : "Published" : "Draft — not on the owner-only preview";
      return `<article class="video-record" data-video-id="${esc(record.id)}"><h4>${esc(item.title)}</h4><p>${esc(state)} · ${esc(item.category)}</p><div class="video-record-actions"><button class="btn btn-ghost" type="button" data-video-action="edit" data-id="${esc(record.id)}">Edit</button>${record.published ? `<button class="btn btn-ghost" type="button" data-video-action="unpublish" data-id="${esc(record.id)}">Unpublish</button>` : ""}</div></article>`;
    }).join("");
  }
  function persist(next) {
    if (!previewEnabled) return false;
    try { localStorage.setItem(key, JSON.stringify({ version: 1, records: next })); } catch { $("video-manager-status").textContent = "Could not save in browser storage. Try a smaller thumbnail or use an image link."; return false; }
    records = next;
    renderManager();
    renderLibrary();
    return true;
  }
  if (library) {
    document.querySelectorAll("[data-video-filter]").forEach(button => button.addEventListener("click", () => { filter = button.dataset.videoFilter; renderLibrary(); }));
    addEventListener("storage", event => { if (event.key === key) { records = readSaved(); renderLibrary(); } });
    addEventListener("pageshow", () => { if (seed.length) { records = readSaved(); renderLibrary(); } });
  }
  if (manager && previewEnabled) {
    const form = $("video-form"), status = $("video-manager-status");
    const values = () => metadata({ title: $("video-title").value, description: $("video-description").value, category: $("video-category").value, url: $("video-url").value, thumbnail: uploadedThumbnail || $("video-thumbnail").value, episodeURL: $("video-episode").value });
    const readForm = () => {
      if (!form.reportValidity()) return null;
      const item = values();
      if (!item) { status.textContent = "Add a title and a valid HTTPS video link. Local preview links are also supported."; return null; }
      if ($("video-thumbnail").value && !safeURL($("video-thumbnail").value)) { status.textContent = "Use a valid HTTPS thumbnail link or upload a JPG, PNG or WebP."; return null; }
      if ($("video-episode").value && !safeURL($("video-episode").value)) { status.textContent = "Use a valid HTTPS link for the full episode."; return null; }
      return item;
    };
    const previewCard = item => { $("video-card-preview").innerHTML = card(item); $("video-preview-panel").hidden = false; };
    const newVideo = () => { activeId = null; uploadedThumbnail = ""; form.reset(); $("video-category").value = kind === "podcast" ? "Podcast episodes" : "Training"; $("video-preview-panel").hidden = true; $("video-editing-label").textContent = kind === "podcast" ? "Add a podcast episode or teaser" : "Add a video"; status.textContent = ""; updateEpisodeField(); };
    const updateEpisodeField = () => { $("video-episode").closest("label").hidden = $("video-category").value !== "Podcast clips"; };
    const setKind = value => {
      kind = value;
      document.querySelectorAll("[data-content-kind]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.contentKind === kind)));
      for (const option of $("video-category").options) { option.hidden = option.disabled = !matchesKind({category:option.value}); }
      $("video-new").textContent = kind === "podcast" ? "Add another episode or teaser" : "Add another video";
      newVideo(); renderManager(); renderLibrary();
    };
    document.querySelectorAll('[data-content-kind="podcast"]').forEach(button => { button.hidden = !podcastEnabled; });
    document.querySelectorAll("[data-content-kind]").forEach(button => button.addEventListener("click", () => setKind(button.dataset.contentKind)));
    $("video-category").addEventListener("change", updateEpisodeField);
    const save = publish => {
      const item = readForm();
      if (!item) return;
      const id = activeId || crypto.randomUUID();
      const next = structuredClone(records);
      let record = next.find(record => record.id === id);
      if (!record) { record = { id, published: null, draft: null }; next.push(record); }
      if (publish) { record.published = { ...item, publishedAt: new Date().toISOString() }; record.draft = null; }
      else record.draft = item;
      if (!persist(next)) return;
      activeId = id;
      $("video-editing-label").textContent = "Edit content";
      previewCard(item);
      status.textContent = publish ? "Published to your card preview." : "Draft saved. Your published card is unchanged.";
    };
    form.addEventListener("submit", event => { event.preventDefault(); save(false); });
    $("video-publish").addEventListener("click", () => save(true));
    $("video-preview-button").addEventListener("click", () => { const item = readForm(); if (item) { previewCard(item); $("video-preview-panel").scrollIntoView({ behavior: "smooth", block: "start" }); } });
    $("video-new").addEventListener("click", newVideo);
    $("video-thumbnail").addEventListener("input", () => { uploadedThumbnail = ""; $("video-thumbnail-file").value = ""; });
    $("video-thumbnail-file").addEventListener("change", () => {
      const file = $("video-thumbnail-file").files[0];
      uploadedThumbnail = "";
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 500 * 1024) { $("video-thumbnail-file").value = ""; status.textContent = "Choose a JPG, PNG or WebP thumbnail up to 500 KB for this browser preview."; return; }
      const reader = new FileReader();
      reader.onload = () => { if ($("video-thumbnail-file").files[0] !== file) return; uploadedThumbnail = safeImage(reader.result); status.textContent = "Thumbnail ready. Preview the card before publishing."; };
      reader.onerror = () => { status.textContent = "Could not read that thumbnail. Try another image."; };
      reader.readAsDataURL(file);
    });
    $("video-records").addEventListener("click", event => {
      const button = event.target.closest("button[data-video-action]");
      if (!button) return;
      const record = records.find(record => record.id === button.dataset.id);
      if (!record) return;
      if (button.dataset.videoAction === "unpublish") {
        const next = structuredClone(records);
        const target = next.find(item => item.id === record.id);
        target.draft = target.draft || target.published;
        target.published = null;
        if (persist(next)) status.textContent = "Card unpublished. Your content is kept as a draft.";
        return;
      }
      const item = record.draft || record.published;
      activeId = record.id;
      uploadedThumbnail = item.thumbnail.startsWith("data:") ? item.thumbnail : "";
      $("video-title").value = item.title;
      $("video-url").value = item.url;
      $("video-category").value = item.category;
      updateEpisodeField();
      $("video-description").value = item.description;
      $("video-thumbnail").value = uploadedThumbnail ? "" : item.thumbnail;
      $("video-thumbnail-file").value = "";
      $("video-episode").value = item.episodeURL;
      $("video-editing-label").textContent = "Edit content";
      previewCard(item);
      status.textContent = "Editing content. Save a draft to keep working, or publish the updated card when ready.";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setKind(kind);
  }
  fetch("/joshharrison/data/videos.json", { cache: "no-cache" }).then(response => response.ok ? response.json() : Promise.reject(new Error("load"))).then(data => {
    seed = (data.items || []).map((item, index) => {
      const value = metadata(item);
      return value ? { id: text(item.id || `seed-${index}`, 100), published: item.status === "draft" ? null : value, draft: item.status === "draft" ? value : null } : null;
    }).filter(Boolean);
    records = readSaved();
    renderLibrary();
    renderManager();
  }).catch(() => { const status = manager ? $("video-manager-status") : $("video-library-status"); if (status) status.textContent = "The video library could not load. Try refreshing the preview."; });
})();
