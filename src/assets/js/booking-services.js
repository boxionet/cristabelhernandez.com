document.addEventListener("DOMContentLoaded", function () {
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

  const services = {
    1: { name: "Botox Preventivo", price: 425, duration: 30 },
    2: { name: "Relleno de Labios", price: 350, duration: 45 },
    3: { name: "Relleno de Mejillas", price: 400, duration: 45 },
    4: { name: "Microagujas", price: 300, duration: 60 },
    5: { name: "Peeling Químico", price: 250, duration: 30 },
    6: { name: "Consulta Complementaria", price: 0, duration: 30 },
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
                  <span class="booking-cart-item-price">$${itemTotal}</span>
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
                  <span class="booking-cart-item-price">$${itemTotal}</span>
                  <button class="booking-cart-item-remove" data-service-id="${serviceId}" aria-label="Eliminar servicio">×</button>
              `;
        cartItemsMobile.appendChild(mobileItemEl);
      }
    });

    // Always update cart totals
    if (cartSubtotalDesktop) cartSubtotalDesktop.textContent = `$${total}`;
    if (cartTotalDesktop) cartTotalDesktop.textContent = `$${total}`;
    if (cartTotalMobile) cartTotalMobile.textContent = `$${total}`;
    if (cartBottomPrice) cartBottomPrice.textContent = `$${total}`;

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

  serviceCards.forEach((card) => {
    const addBtn = card.querySelector(".booking-service-add-btn");
    const serviceId = card.dataset.serviceId;

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
});
