// ============ PRODUCT DATA ============
// NOTE: prices are stored in cents for Stripe
const products = [
  {
    id: "p1",
    name: "Lace Lingerie Set",
    description: "Elegant lace lingerie set designed to empower and seduce.",
    image: "/images/products/lace-lingerie.jpg",
    price: 12900, // EUR 129.00
    currency: "eur",
    availability: "https://schema.org/InStock",
    brand: "L'art de la Séduction",
  },
  {
    id: "p2",
    name: "Luxury Corset",
    description: "Handcrafted corset with premium silk blend.",
    image: "/images/products/luxury-corset.jpg",
    price: 18900, // EUR 189.00
    currency: "eur",
    availability: "https://schema.org/PreOrder",
    brand: "L'art de la Séduction",
  },
  // ➕ Add more products here later
];

// ============ CART ============
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem("cart")) || [];
} catch (err) {
  console.warn("� ️ localStorage not available, using in‑memory cart.");
  cart = [];
}

function saveCart() {
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
  } catch (err) {
    console.error("� ️ Failed to save cart:", err);
  }
}

function updateCartBadge() {
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const el = document.getElementById("cart-count");
  if (el) el.textContent = count;
}

// ============ CART ACTIONS ============
function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  // Block adding if not InStock or PreOrder
  if (
    product.availability !== "https://schema.org/InStock" &&
    product.availability !== "https://schema.org/PreOrder"
  ) {
    alert(`❌ ${product.name} is not available for purchase.`);
    return;
  }

  const item = cart.find((i) => i.id === productId);
  if (item) item.qty += 1;
  else cart.push({ id: productId, qty: 1 });

  saveCart();
  updateCartBadge();
  alert(`🛍️ Added ${product.name} to your cart.`);
}

function removeFromCart(productId) {
  cart = cart.filter((i) => i.id !== productId);
  saveCart();
  updateCartBadge();
  renderCartPage();
}

function updateQuantity(productId, qty) {
  const item = cart.find((i) => i.id === productId);
  if (item) {
    item.qty = Math.max(1, Number(qty)); // ensure numeric value
    saveCart();
    updateCartBadge();
    renderCartPage();
  }
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartBadge();
  renderCartPage();
}

// ============ SANITIZE HELPER ============
function sanitizeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============ RENDER PRODUCTS ============
function renderProducts() {
  const container = document.getElementById("product-list");
  if (!container) return;

  container.innerHTML = "";
  products.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product";

    // Check availability
    let actionEl = "";
    if (p.availability === "https://schema.org/InStock") {
      actionEl = `<button aria-label="Add ${sanitizeHTML(p.name)} to cart" onclick="addToCart('${p.id}')">Add to Cart</button>`;
    } else if (p.availability === "https://schema.org/PreOrder") {
      actionEl = `<button aria-label="Pre‑order ${sanitizeHTML(p.name)}" onclick="addToCart('${p.id}')">Pre‑Order</button>`;
    } else {
      actionEl = `<span class="out-of-stock" aria-label="Out of stock for ${sanitizeHTML(p.name)}">Out of Stock</span>`;
    }

    card.innerHTML = `
      <img src="${p.image}" alt="${sanitizeHTML(p.name)}">
      <h2>${sanitizeHTML(p.name)}</h2>
      <p>${sanitizeHTML(p.description)}</p>
      <p><strong>${(p.price / 100).toFixed(2)} ${p.currency.toUpperCase()}</strong></p>
      ${actionEl}
    `;
    container.appendChild(card);
  });

  // Batch inject structured data once per render
  injectAllSchema(products);
}

// ============ RENDER CART PAGE ============
function renderCartPage() {
  const container = document.getElementById("cart-items");
  if (!container) return;

  container.innerHTML = "";
  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    const totalEl = document.getElementById("cart-total");
    if (totalEl) totalEl.textContent = `Subtotal: 0.00 EUR`;
    return;
  }

  let total = 0;
  cart.forEach((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return;
    total += product.price * item.qty;

    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <img src="${product.image}" alt="${sanitizeHTML(product.name)}" class="cart-thumb">
      <div class="cart-info">
        <h3>${sanitizeHTML(product.name)}</h3>
        <p><strong>${(product.price / 100).toFixed(2)} ${product.currency.toUpperCase()}</strong></p>
        <label>
          Qty: 
          <input type="number" value="${item.qty}" min="1"
            aria-label="Quantity for ${sanitizeHTML(product.name)}"
            onchange="updateQuantity('${item.id}', this.value)">
        </label>
        <button aria-label="Remove ${sanitizeHTML(product.name)} from cart"
          onclick="removeFromCart('${item.id}')">Remove</button>
      </div>
    `;
    container.appendChild(row);
  });

  const totalEl = document.getElementById("cart-total");
  if (totalEl)
    totalEl.textContent = `Subtotal: ${(total / 100).toFixed(2)} EUR`;
}

// ============ CHECKOUT (Stripe) ============
async function checkout() {
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }
  try {
    const res = await fetch("/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandKey: "default",
        items: cart.map((i) => ({ id: i.id, quantity: i.qty })),
      }),
    });

    const data = await res.json();
    if (data.sessionUrl) {
      window.location.href = data.sessionUrl;
    } else {
      alert("Checkout failed. Please try again.");
    }
  } catch (err) {
    console.error("❌ Checkout error:", err);
    alert("Something went wrong during checkout.");
  }
}

// ============ SEO JSON‑LD ============
function injectAllSchema(list) {
  // Remove any old schema blocks first
  document
    .querySelectorAll("script[data-schema='product']")
    .forEach((s) => s.remove());

  const scripts = list.map((p) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `https://www.seductionstore.com/product/${p.id}`,
    name: p.name,
    description: p.description,
    image: [`https://www.seductionstore.com${p.image}`],
    brand: { "@type": "Brand", name: p.brand },
    offers: {
      "@type": "Offer",
      "@id": `https://www.seductionstore.com/product/${p.id}#offer`,
      priceCurrency: p.currency.toUpperCase(),
      price: (p.price / 100).toFixed(2),
      availability: p.availability,
      url: `https://www.seductionstore.com/product/${p.id}`,
    },
  }));

  const block = document.createElement("script");
  block.type = "application/ld+json";
  block.dataset.schema = "product";
  block.textContent = JSON.stringify(scripts, null, 2);
  document.head.appendChild(block);
}

// ============ INIT ============
document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  updateCartBadge();
  renderCartPage();

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", checkout);

  const clearBtn = document.getElementById("clear-cart");
  if (clearBtn) clearBtn.addEventListener("click", clearCart);
});
