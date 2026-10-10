// Example: Dynamic filtering
const products = document.querySelectorAll(".product");
const filterInput = document.getElementById("filter-input");

if (filterInput) {
  filterInput.addEventListener("input", () => {
    const keyword = filterInput.value.toLowerCase();
    products.forEach((product) => {
      const nameEl = product.querySelector(".product-name");
      if (!nameEl) return;
      const productName = nameEl.textContent.toLowerCase();
      if (productName.includes(keyword)) {
        product.style.display = "block";
      } else {
        product.style.display = "none";
      }
    });
  });
}

// Example: Wishlist/Cart persistence using localStorage
function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (err) {
    console.warn(`Could not read "${key}" from localStorage:`, err);
    return [];
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Could not persist "${key}" to localStorage:`, err);
  }
}

const wishlist = readStore("wishlist");
const cart = readStore("cart");

function addToWishlist(productId) {
  if (!wishlist.includes(productId)) {
    wishlist.push(productId);
    writeStore("wishlist", wishlist);
  }
}

function addToCart(productId) {
  if (!cart.includes(productId)) {
    cart.push(productId);
    writeStore("cart", cart);
  }
}
