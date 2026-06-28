const serviceCards = document.querySelectorAll(".booking-service-card");

// Desktop cart elements
const cartItemsDesktop = document.getElementById("cart-items-desktop");
const cartSubtotalDesktop = document.getElementById("cart-subtotal-desktop");
const cartTotalDesktop = document.getElementById("cart-total-desktop");
const continueBtnDesktop = document.getElementById("continue-btn-desktop");

// Mobile cart elements
const cartBottomBar = document.getElementById("cart-bottom-bar");
const cartBottomPrice = document.getElementById("cart-bottom-price");
const cartBottomDetails = document.getElementById("cart-bottom-details");
const cartItemsMobile = document.getElementById("cart-items-mobile");
const cartTotalMobile = document.getElementById("cart-total-mobile");
const continueBtnMobile = document.getElementById("continue-btn-mobile");
const cartBottomToggle = document.getElementById("cart-bottom-toggle");
const cartBottomPanel = document.getElementById("cart-bottom-panel");
const cartBottomClose = document.getElementById("cart-bottom-close");

let cart = {};
let totalDuration = 0;

// Format price with RD$ currency and comma separator
function formatPrice(amount) {
  const formatted = Math.round(amount).toLocaleString("en-US");
  return `RD$ ${formatted}`;
}

const services = {
  "toxina-botulinica": {
    name: "Toxina Botulínica",
    price: 15000,
    duration: 30,
  },
  "acido-hialuronico": {
    name: "Ácido Hialurónico",
    price: 12000,
    duration: 45,
  },
  "rellenos-dermicos": {
    name: "Rellenos Dérmicos",
    price: 10000,
    duration: 45,
  },
  "hilos-tensores": { name: "Hilos Tensores", price: 8000, duration: 60 },
  microneedling: { name: "Microneedling", price: 6000, duration: 60 },
  "mesoterapia-facial": {
    name: "Mesoterapia Facial",
    price: 5000,
    duration: 45,
  },
  "prp-facial": {
    name: "Plasma Rico en Plaquetas (PRP)",
    price: 9000,
    duration: 60,
  },
  "peelings-quimicos": {
    name: "Peelings Químicos",
    price: 4500,
    duration: 45,
  },
  "rejuvenecimiento-cuello": {
    name: "Rejuvenecimiento de Cuello",
    price: 7000,
    duration: 60,
  },
  "rejuvenecimiento-escote": {
    name: "Rejuvenecimiento de Escote",
    price: 7500,
    duration: 60,
  },
  "rejuvenecimiento-manos": {
    name: "Rejuvenecimiento de Manos",
    price: 8500,
    duration: 60,
  },
  "flebologia-linfologia": {
    name: "Flebología y Linfología",
    price: 3000,
    duration: 30,
  },
  escleroterapia: { name: "Escleroterapia", price: 5500, duration: 45 },
  "laser-facial": { name: "Láser Facial", price: 8000, duration: 60 },
  "laser-manchas": { name: "Láser para Manchas", price: 6500, duration: 45 },
  "laser-lesiones-vasculares": {
    name: "Láser para Lesiones Vasculares",
    price: 7500,
    duration: 45,
  },
  "rejuvenecimiento-laser": {
    name: "Rejuvenecimiento con Láser",
    price: 12000,
    duration: 60,
  },
};

// Load cart from localStorage on page load
function loadCartFromStorage() {
  const storedServices = BookingStorage.getServices();
  cart = {};
  Object.keys(storedServices).forEach((serviceId) => {
    cart[serviceId] = storedServices[serviceId].quantity || 1;
  });
}

// Save cart to localStorage
function saveCartToStorage() {
  const servicesData = {};
  Object.keys(cart).forEach((serviceId) => {
    const service = services[serviceId];
    servicesData[serviceId] = {
      name: service.name,
      price: service.price,
      duration: service.duration,
      quantity: cart[serviceId],
    };
  });
  BookingStorage.setServices(servicesData);
}

function updateCart() {
  let total = 0;
  let itemCount = 0;
  totalDuration = 0;

  // Update desktop cart
  if (cartItemsDesktop) {
    cartItemsDesktop.innerHTML = "";
  }

  // Update mobile cart
  if (cartItemsMobile) {
    cartItemsMobile.innerHTML = "";
  }

  Object.keys(cart).forEach((serviceId) => {
    const service = services[serviceId];
    const quantity = cart[serviceId];
    const itemTotal = service.price * quantity;
    total += itemTotal;
    itemCount++;
    totalDuration += service.duration * quantity;

    // Desktop cart item
    if (cartItemsDesktop) {
      const desktopItemEl = document.createElement("div");
      desktopItemEl.className = "booking-cart-item";
      desktopItemEl.innerHTML = `
                  <div class="booking-cart-item-content">
                    <span class="booking-cart-item-name">${service.name}</span>
                    <span class="booking-cart-item-duration">${service.duration} min</span>
                  </div>
                  <span class="booking-cart-item-price">${formatPrice(itemTotal)}</span>
                  <button class="booking-cart-item-remove" data-service-id="${serviceId}" aria-label="Eliminar servicio">×</button>
              `;
      cartItemsDesktop.appendChild(desktopItemEl);
    }

    // Mobile cart item
    if (cartItemsMobile) {
      const mobileItemEl = document.createElement("div");
      mobileItemEl.className = "booking-cart-item";
      mobileItemEl.innerHTML = `
                  <div class="booking-cart-item-content">
                    <span class="booking-cart-item-name">${service.name}</span>
                    <span class="booking-cart-item-duration">${service.duration} min</span>
                  </div>
                  <span class="booking-cart-item-price">${formatPrice(itemTotal)}</span>
                  <button class="booking-cart-item-remove" data-service-id="${serviceId}" aria-label="Eliminar servicio">×</button>
              `;
      cartItemsMobile.appendChild(mobileItemEl);
    }
  });

  // Always update cart totals
  if (cartSubtotalDesktop) cartSubtotalDesktop.textContent = formatPrice(total);
  if (cartTotalDesktop) cartTotalDesktop.textContent = formatPrice(total);
  if (cartTotalMobile) cartTotalMobile.textContent = formatPrice(total);
  if (cartBottomPrice) cartBottomPrice.textContent = formatPrice(total);

  if (itemCount === 0) {
    if (cartItemsDesktop) {
      cartItemsDesktop.innerHTML =
        '<p class="booking-cart-empty">Selecciona un servicio para comenzar</p>';
    }
    if (cartItemsMobile) {
      cartItemsMobile.innerHTML =
        '<p class="booking-cart-empty">Selecciona un servicio para comenzar</p>';
    }
    if (continueBtnDesktop) continueBtnDesktop.disabled = true;
    if (continueBtnMobile) continueBtnMobile.disabled = true;
    if (cartBottomBar) cartBottomBar.classList.remove("visible");
  } else {
    if (continueBtnDesktop) continueBtnDesktop.disabled = false;
    if (continueBtnMobile) continueBtnMobile.disabled = false;
    if (cartBottomBar) cartBottomBar.classList.add("visible");

    // Update mobile bottom bar details
    const hours = Math.floor(totalDuration / 60);
    const mins = totalDuration % 60;
    let durationText = `${itemCount} item`;
    if (itemCount > 1) durationText += "s";
    if (hours > 0) durationText += ` • ${hours}h`;
    if (mins > 0) durationText += ` ${mins}m`;
    if (cartBottomDetails) cartBottomDetails.textContent = durationText;
  }

  // Add remove button listeners
  document.querySelectorAll(".booking-cart-item-remove").forEach((btn) => {
    btn.addEventListener("click", function () {
      const serviceId = this.dataset.serviceId;
      removeFromCart(serviceId);
    });
  });
}

function addToCart(serviceId) {
  if (cart[serviceId]) {
    // If already in cart, remove it instead
    delete cart[serviceId];
  } else {
    // Add to cart with quantity 1 (no duplicates)
    cart[serviceId] = 1;
  }
  saveCartToStorage();
  updateCart();
  updateCardStates();
}

function removeFromCart(serviceId) {
  if (cart[serviceId]) {
    delete cart[serviceId];
  }
  saveCartToStorage();
  updateCart();
  updateCardStates();
}

function updateCardStates() {
  serviceCards.forEach((card) => {
    const serviceId = card.dataset.serviceId;
    const addBtn = card.querySelector(".booking-service-add-btn");
    const svg = addBtn.querySelector("svg");

    if (cart[serviceId]) {
      card.classList.add("selected");
      addBtn.classList.add("selected");
      // Change to checkmark
      svg.innerHTML =
        '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    } else {
      card.classList.remove("selected");
      addBtn.classList.remove("selected");
      // Change back to plus
      svg.innerHTML =
        '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    }
  });
}

// Mobile cart toggle functionality
if (cartBottomToggle) {
  cartBottomToggle.addEventListener("click", function () {
    cartBottomPanel.classList.toggle("visible");
  });
}

if (cartBottomClose) {
  cartBottomClose.addEventListener("click", function () {
    cartBottomPanel.classList.remove("visible");
  });
}

// Category tabs scrolling and active state
const categoryTabs = document.querySelectorAll(".booking-services-tab");
const categorySections = document.querySelectorAll(
  ".booking-services-category",
);

function scrollToCategory(targetId) {
  const targetSection = document.getElementById(targetId);
  if (!targetSection) return;

  targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateActiveTab(targetId, scrollTabIntoView = false) {
  categoryTabs.forEach((tab) => {
    if (tab.dataset.target === targetId) {
      tab.classList.add("active");
      if (scrollTabIntoView) {
        tab.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    } else {
      tab.classList.remove("active");
    }
  });
}

let isProgrammaticScroll = false;
let scrollEndTimeout;

function endProgrammaticScroll() {
  isProgrammaticScroll = false;
}

window.addEventListener(
  "scroll",
  () => {
    if (isProgrammaticScroll) {
      clearTimeout(scrollEndTimeout);
      scrollEndTimeout = setTimeout(endProgrammaticScroll, 150);
    }
  },
  { passive: true },
);

categoryTabs.forEach((tab) => {
  tab.addEventListener("click", function () {
    const targetId = this.dataset.target;
    isProgrammaticScroll = true;
    clearTimeout(scrollEndTimeout);
    updateActiveTab(targetId, true);
    scrollToCategory(targetId);
  });
});

// Update active tab based on scroll position
if ("IntersectionObserver" in window && categorySections.length > 0) {
  const observerOptions = {
    root: null,
    rootMargin: "-140px 0px -60% 0px",
    threshold: 0,
  };

  const categoryObserver = new IntersectionObserver((entries) => {
    if (isProgrammaticScroll) return;
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        updateActiveTab(entry.target.id);
      }
    });
  }, observerOptions);

  categorySections.forEach((section) => categoryObserver.observe(section));
}

serviceCards.forEach((card) => {
  const addBtn = card.querySelector(".booking-service-add-btn");
  const serviceId = card.dataset.serviceId;

  // Click on card to add/remove service
  card.addEventListener("click", function (e) {
    // Don't trigger if clicking on the button itself (button has its own handler)
    if (e.target.closest(".booking-service-add-btn")) {
      return;
    }
    addToCart(serviceId);
  });

  // Also keep button click for accessibility
  addBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    addToCart(serviceId);
  });
});

continueBtnDesktop.addEventListener("click", function () {
  if (Object.keys(cart).length > 0) {
    saveCartToStorage();
    // Navigate to date/time selection page
    window.location.href = "/reservar/fecha-hora/";
  }
});

continueBtnMobile.addEventListener("click", function () {
  if (Object.keys(cart).length > 0) {
    saveCartToStorage();
    // Navigate to date/time selection page
    window.location.href = "/reservar/fecha-hora/";
  }
});

// Load cart from storage on page load
loadCartFromStorage();
updateCart();
