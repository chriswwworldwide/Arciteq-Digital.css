// Responsive Navigation
const toggleButton = document.getElementById("menu-toggle");
const navMenu = document.querySelector("nav ul");

if (toggleButton && navMenu) {
  toggleButton.addEventListener("click", () => {
    navMenu.classList.toggle("visible");
  });
}
