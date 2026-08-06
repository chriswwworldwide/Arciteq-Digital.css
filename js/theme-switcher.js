// Theme Switcher for L’Art‑de‑la‑Séduction

// Available theme list
const themes = [
  "default",
  "maison-de-seduction",
  "amour-noir",
  "rouge-seduction",
  "seductiv-by-lart",
  "nuit-etoilee",
];

// Detect <link data-theme> element
const linkEl = document.querySelector("link[data-theme]");

// Apply a requested theme
export function setTheme(name) {
  if (!themes.includes(name)) name = "default";
  if (linkEl) {
    linkEl.href = `themes/${name}.css`;
    try {
      localStorage.setItem("activeTheme", name);
    } catch (err) {
      console.warn("Could not persist active theme to localStorage:", err);
    }
    document.documentElement.setAttribute("data-theme", name);
  } else {
    console.warn("Theme link element not found!");
  }
}

// Initialize on page load
export function initThemeSwitcher() {
  let saved = "default";
  try {
    saved = localStorage.getItem("activeTheme") || "default";
  } catch (err) {
    console.warn("Could not read active theme from localStorage:", err);
  }
  setTheme(saved);

  // Optional dropdown element
  const select = document.getElementById("themeSelector");
  if (select) {
    select.value = saved;
    select.addEventListener("change", (e) => setTheme(e.target.value));
  }
}

// Auto‑run if imported as <script type="module">
document.addEventListener("DOMContentLoaded", initThemeSwitcher);
