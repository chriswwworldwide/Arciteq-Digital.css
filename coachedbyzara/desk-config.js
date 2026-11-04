/* DeskConfig — loads the split data/desk/*.json files once and exposes
   them as one in-memory config. Coach-specific data lives in the JSON
   files, not in page code, so per-tenant differences are config edits. */
(() => {
  const base = "/coachedbyzara/data/desk/";
  const files = {
    programmes: "programmes.json",
    templates: "templates.json",
    settings: "settings.json",
    prepClubFeed: "prep-club-feed.json"
  };
  const cfg = {};
  const ready = Promise.all(
    Object.entries(files).map(([name, file]) =>
      fetch(base + file).then(r => (r.ok ? r.json() : null)).then(data => { cfg[name] = data; }).catch(() => { cfg[name] = null; })
    )
  );
  window.DeskConfig = {
    ready,
    get: name => cfg[name],
    all: () => cfg
  };
})();
