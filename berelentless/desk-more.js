/* desk-more.js — long-list capper for the Desk. Renderers call
   window.deskCap(list, { noun, limit }) after filling a container: it adds a
   total count at the top and folds everything past `limit` into an obvious
   "Show all N …" details row. Safe to call after every re-render — it rebuilds
   from whatever children the list currently has. */
(() => {
  window.deskCap = (list, { noun = "items", limit = 6 } = {}) => {
    if (!list) return;
    list
      .querySelectorAll(":scope > .desk-count, :scope > .desk-more")
      .forEach((el) => el.remove());
    const total = list.children.length;
    if (!total) return;

    const count = document.createElement("p");
    count.className = "desk-count";
    count.textContent =
      total > limit ? `${total} ${noun} — first ${limit} shown` : `${total} ${noun}`;
    list.prepend(count);

    if (total <= limit) return;
    const det = document.createElement("details");
    det.className = "desk-more";
    const sum = document.createElement("summary");
    sum.textContent = `Show all ${total} ${noun}`;
    const rest = document.createElement("div");
    rest.className = "desk-more-items";
    det.append(sum, rest);
    list.appendChild(det);
    while (list.children[limit + 1] && !list.children[limit + 1].matches(".desk-more")) {
      rest.appendChild(list.children[limit + 1]);
    }
  };
})();
