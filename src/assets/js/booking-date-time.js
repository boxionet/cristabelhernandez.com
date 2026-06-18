// Booking Date & Time Selection Logic

document.addEventListener("DOMContentLoaded", function () {
  const dateCarousel = document.querySelector(".booking-date-carousel");
  const dateTileWrappers = document.querySelectorAll(
    ".booking-date-tile-wrapper",
  );
  const dateTiles = document.querySelectorAll(".booking-date-tile");
  const timeSlots = document.querySelectorAll(".booking-time-slot");
  const continueBtn = document.querySelector(".booking-continue-btn");
  const datePrevBtn = document.querySelector(".booking-date-prev");
  const dateNextBtn = document.querySelector(".booking-date-next");

  // Calendar elements
  const calendarTrigger = document.getElementById("calendar-trigger");
  const calendarModal = document.getElementById("calendar-modal");
  const calendarOverlay = document.getElementById("calendar-overlay");
  const calendarTitle = document.getElementById("calendar-title");
  const calendarDays = document.getElementById("calendar-days");
  const calendarPrevMonth = document.getElementById("calendar-prev-month");
  const calendarNextMonth = document.getElementById("calendar-next-month");

  // Initialize currentCalendarDate in Dominican Republic timezone
  const today = new Date();
  const dominicanNow = new Date(
    today.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }),
  );
  let currentCalendarDate = new Date(
    dominicanNow.getFullYear(),
    dominicanNow.getMonth(),
    1,
  );

  let selectedDate = null;
  let selectedTime = null;
  let carouselStartDate = new Date();
  carouselStartDate.setDate(carouselStartDate.getDate() - 7);
  let carouselEndDate = new Date();
  carouselEndDate.setDate(carouselEndDate.getDate() + 7);

  // Generate initial carousel dates dynamically
  function generateInitialCarouselDates() {
    const scrollableInner = document.querySelector(
      ".booking-date-scrollable-inner",
    );
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthNames = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];

    // Get today's date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayIso = `${year}-${month}-${day}`;

    // Get today's date in Dominican Republic timezone for comparison
    const dominicanNow = new Date(
      today.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }),
    );
    const todayYear = dominicanNow.getFullYear();
    const todayMonth = dominicanNow.getMonth();
    const todayDay = dominicanNow.getDate();

    // Create 15 dates starting from today (7 before today, today, 7 after today)
    for (let i = -7; i <= 7; i++) {
      const dateToAdd = new Date(today);
      dateToAdd.setDate(dateToAdd.getDate() + i);

      const dateIso = dateToAdd.toISOString().split("T")[0];
      const fullDateIso = dateIso + "T00:00:00.000Z";

      const dayName = dayNames[dateToAdd.getDay()];
      const dayNum = dateToAdd.getDate();
      const monthName = monthNames[dateToAdd.getMonth()];
      const dayOfWeek = dateToAdd.getDay();
      const dateYear = dateToAdd.getFullYear();
      const dateMonth = dateToAdd.getMonth();
      const dateDay = dateToAdd.getDate();

      // Check if date is in the past
      const isPast =
        dateYear < todayYear ||
        (dateYear === todayYear && dateMonth < todayMonth) ||
        (dateYear === todayYear &&
          dateMonth === todayMonth &&
          dateDay < todayDay);

      // Check if weekend
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isUnavailable = isWeekend || isPast;

      // Create wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "booking-date-tile-wrapper";
      wrapper.setAttribute("data-item", "true");
      wrapper.setAttribute("data-iso-date", fullDateIso);
      wrapper.setAttribute("data-selected", i === 0 ? "true" : "false");

      // Create button
      const button = document.createElement("button");
      button.type = "button";
      let buttonClass = "booking-date-tile";
      if (i === 0) buttonClass += " booking-date-tile--selected";
      if (isUnavailable) buttonClass += " booking-date-tile--unavailable";
      button.className = buttonClass;
      button.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      if (isUnavailable) button.disabled = true;
      button.setAttribute(
        "aria-label",
        `Select ${dayName}, ${monthName} ${dayNum}, ${dateToAdd.getFullYear()}`,
      );

      button.innerHTML = `
        <span class="booking-date-day">${dayName}</span>
        <span class="booking-date-number">${dayNum}</span>
        <span class="booking-date-month">${monthName}</span>
      `;

      wrapper.appendChild(button);
      button.addEventListener("click", handleDateTileClick);
      scrollableInner.appendChild(wrapper);
    }
  }

  // Generate initial dates
  generateInitialCarouselDates();

  // Calendar functions
  function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Update title
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    calendarTitle.textContent = `${monthNames[month]} ${year}`;

    // Clear previous days
    calendarDays.innerHTML = "";

    // Get number of days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Add current month's days only
    // Get today's date in Dominican Republic timezone (AST, UTC-4)
    const nowUTC = new Date();
    const dominicanToday = new Date(
      nowUTC.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }),
    );
    const todayYear = dominicanToday.getFullYear();
    const todayMonth = dominicanToday.getMonth();
    const todayDay = dominicanToday.getDate();

    // Get the day of week for the first day of the month (0=Sunday, 6=Saturday)
    const firstDayOfMonth = new Date(year, month, 1);
    const firstDayOfMonthLocale = new Date(
      firstDayOfMonth.toLocaleString("en-US", {
        timeZone: "America/Santo_Domingo",
      }),
    );
    let firstDayOfWeek = firstDayOfMonthLocale.getDay();

    // Convert Sunday (0) to 6, and shift others down by 1 to match Mon-Sun grid (Mon=0, Sun=6)
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "booking-calendar-day other-month";
      calendarDays.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayBtn = document.createElement("button");
      dayBtn.className = "booking-calendar-day";
      dayBtn.textContent = day;
      dayBtn.type = "button";

      // Create date string for comparison
      const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // Get day of week using Dominican Republic timezone
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateInDR = new Date(dateStr + "T12:00:00");
      const dateInDRLocale = new Date(
        dateInDR.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }),
      );
      const dayOfWeek = dateInDRLocale.getDay();

      // Check if today
      const isToday =
        day === todayDay && month === todayMonth && year === todayYear;

      if (isToday) {
        dayBtn.classList.add("today");
      }

      // Check if Saturday (6) or Sunday (0)
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Check if date is in the past (before today)
      const isPast =
        year < todayYear ||
        (year === todayYear && month < todayMonth) ||
        (year === todayYear && month === todayMonth && day < todayDay);

      // Check if disabled (past dates or weekend)
      if (isPast) {
        dayBtn.classList.add("disabled");
        dayBtn.disabled = true;
      } else if (isWeekend) {
        dayBtn.classList.add("disabled");
        dayBtn.disabled = true;
      } else {
        dayBtn.addEventListener("click", function () {
          selectDateFromCalendar(isoDate);
        });
      }

      calendarDays.appendChild(dayBtn);
    }
  }

  function selectDateFromCalendar(isoDate) {
    // Close calendar
    calendarModal.classList.remove("active");

    const fullIsoDate = isoDate + "T00:00:00.000Z";
    // Parse the date string (YYYY-MM-DD) without timezone conversion
    const [year, month, day] = isoDate.split("-").map(Number);
    const selectedDateObj = new Date(year, month - 1, day);

    // Format date for localStorage using long day/month names
    const dayNamesLong = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    const monthNamesLong = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const dayName = dayNamesLong[selectedDateObj.getDay()];
    const monthName = monthNamesLong[selectedDateObj.getMonth()];
    const formattedDate = `${dayName}, ${monthName} ${day}`;

    // Store the newly selected date as pending (like carousel)
    // It will be saved to localStorage only when user picks a time
    if (typeof window !== "undefined") {
      window.pendingDate = formattedDate;
      console.log("✓ Date selected from calendar (pending):", formattedDate);
      console.log("✓ Cart will update when you select a time");

      // Clear time slot selections visually
      const timeSlots = document.querySelectorAll(".booking-time-slot");
      timeSlots.forEach((slot) => {
        slot.classList.remove("booking-time-slot--selected");
        slot.setAttribute("aria-pressed", "false");
      });

      // Trigger animation on time slots
      const timeSlotWrappers = document.querySelectorAll(
        ".booking-time-slot-wrapper",
      );
      timeSlotWrappers.forEach((wrapper, index) => {
        wrapper.classList.remove("animate");
        setTimeout(
          () => {
            wrapper.classList.add("animate");
          },
          10 + index * 120,
        );
      });
    }

    // Clear existing carousel and rebuild with dates around selected date
    const scrollableInner = document.querySelector(
      ".booking-date-scrollable-inner",
    );
    if (scrollableInner) {
      scrollableInner.innerHTML = "";
    }

    // Create tiles for 7 days before and 7 days after the selected date
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthNames = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];

    for (let i = -7; i <= 7; i++) {
      const dateToAdd = new Date(selectedDateObj);
      dateToAdd.setDate(dateToAdd.getDate() + i);

      const dateIso = dateToAdd.toISOString().split("T")[0];
      const fullDateIso = dateIso + "T00:00:00.000Z";

      const dayName = dayNames[dateToAdd.getDay()];
      const dayNum = dateToAdd.getDate();
      const monthName = monthNames[dateToAdd.getMonth()];
      const dayOfWeek = dateToAdd.getDay(); // 0 = Sunday, 6 = Saturday
      const isUnavailable = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

      // Create wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "booking-date-tile-wrapper";
      wrapper.setAttribute("data-item", "true");
      wrapper.setAttribute("data-iso-date", fullDateIso);
      wrapper.setAttribute("data-selected", i === 0 ? "true" : "false");

      // Create button
      const button = document.createElement("button");
      button.type = "button";
      let buttonClass = "booking-date-tile";
      if (i === 0) buttonClass += " booking-date-tile--selected";
      if (isUnavailable) buttonClass += " booking-date-tile--unavailable";
      button.className = buttonClass;
      button.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      if (isUnavailable) button.disabled = true;
      button.setAttribute(
        "aria-label",
        `Select ${dayName}, ${monthName} ${dayNum}, ${dateToAdd.getFullYear()}`,
      );

      button.innerHTML = `
        <span class="booking-date-day">${dayName}</span>
        <span class="booking-date-number">${dayNum}</span>
        <span class="booking-date-month">${monthName}</span>
      `;

      wrapper.appendChild(button);

      // Add event listener
      button.addEventListener("click", function () {
        if (this.classList.contains("booking-date-tile--unavailable")) return;

        // Remove previous selection from all tiles
        document.querySelectorAll(".booking-date-tile").forEach((t) => {
          t.classList.remove("booking-date-tile--selected");
          t.setAttribute("aria-pressed", "false");
        });

        // Remove previous selection from all wrappers
        document.querySelectorAll(".booking-date-tile-wrapper").forEach((w) => {
          w.setAttribute("data-selected", "false");
        });

        // Add selection to clicked tile
        this.classList.add("booking-date-tile--selected");
        this.setAttribute("aria-pressed", "true");

        // Add selection to parent wrapper
        const parentWrapper = this.closest(".booking-date-tile-wrapper");
        parentWrapper.setAttribute("data-selected", "true");

        // Update selected date
        selectedDate = parentWrapper.getAttribute("data-iso-date");

        // Check if both date and time are selected
        checkFormCompletion();
      });

      if (scrollableInner) {
        scrollableInner.appendChild(wrapper);
      }
    }

    // Update selected date
    selectedDate = fullIsoDate;
    checkFormCompletion();

    // Scroll to position the selected date as the first visible date
    const carousel = document.querySelector(".booking-date-carousel");
    if (carousel) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        const selectedButton = document.querySelector(
          ".booking-date-tile--selected",
        );

        if (selectedButton) {
          const selectedWrapper = selectedButton.closest(
            ".booking-date-tile-wrapper",
          );
          if (selectedWrapper) {
            // Get the position relative to the scrollable container
            const wrapperLeft = selectedWrapper.offsetLeft;
            const gap = 12; // gap between tiles in pixels
            const scrollPosition = wrapperLeft - gap;

            // Set scroll position immediately
            carousel.scrollLeft = scrollPosition;

            // Also apply smooth scroll
            setTimeout(() => {
              carousel.scrollTo({
                left: scrollPosition,
                behavior: "smooth",
              });
            }, 100);
          }
        }

        // Reattach date/time listeners after carousel is rebuilt
        if (typeof attachDateTimeListeners === "function") {
          attachDateTimeListeners();
        }
      });
    }
  }

  // Calendar event listeners
  if (calendarTrigger) {
    calendarTrigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Calendar trigger clicked");
      console.log("Calendar modal element:", calendarModal);

      // Toggle calendar open/close
      const isOpen = calendarModal.classList.contains("active");

      if (!isOpen) {
        // Position calendar below the icon
        const rect = calendarTrigger.getBoundingClientRect();
        const windowWidth = window.innerWidth;

        calendarModal.style.top = rect.bottom + 8 + "px";

        // Mobile: center the calendar
        if (windowWidth < 600) {
          const calendarWidth = 380;
          const centerLeft = (windowWidth - calendarWidth) / 2;
          calendarModal.style.left = centerLeft + "px";
        }
        // Tablet: move to the left
        else if (windowWidth < 1024) {
          calendarModal.style.left = "410px";
        }
        // Desktop: position near the icon
        else {
          calendarModal.style.left = rect.right - 220 + "px";
        }

        calendarModal.classList.add("active");
        renderCalendar();
      } else {
        calendarModal.classList.remove("active");
      }
    });
  } else {
    console.warn("Calendar trigger not found");
  }

  // Close calendar when clicking outside
  document.addEventListener("click", function (e) {
    if (calendarModal && calendarModal.classList.contains("active")) {
      if (
        !calendarModal.contains(e.target) &&
        !calendarTrigger.contains(e.target)
      ) {
        calendarModal.classList.remove("active");
      }
    }
  });

  if (calendarPrevMonth) {
    calendarPrevMonth.addEventListener("click", function () {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (calendarNextMonth) {
    calendarNextMonth.addEventListener("click", function () {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendar();
    });
  }

  // Date selection
  dateTiles.forEach((tile) => {
    tile.addEventListener("click", function () {
      if (this.classList.contains("booking-date-tile--unavailable")) return;

      // Remove previous selection from all tiles
      dateTiles.forEach((t) => {
        t.classList.remove("booking-date-tile--selected");
        t.setAttribute("aria-pressed", "false");
      });

      // Remove previous selection from all wrappers
      dateTileWrappers.forEach((wrapper) => {
        wrapper.setAttribute("data-selected", "false");
      });

      // Add selection to clicked tile
      this.classList.add("booking-date-tile--selected");
      this.setAttribute("aria-pressed", "true");

      // Add selection to parent wrapper
      const wrapper = this.closest(".booking-date-tile-wrapper");
      wrapper.setAttribute("data-selected", "true");

      // Update selected date
      selectedDate = wrapper.getAttribute("data-iso-date");

      // Check if both date and time are selected
      checkFormCompletion();
    });
  });

  // Set today's date as initial selection and scroll carousel to show it at the start
  const todayDate = new Date();
  const year = todayDate.getFullYear();
  const month = String(todayDate.getMonth() + 1).padStart(2, "0");
  const day = String(todayDate.getDate()).padStart(2, "0");
  const todayIso = `${year}-${month}-${day}T00:00:00.000Z`;
  const todayTile = Array.from(
    document.querySelectorAll(".booking-date-tile-wrapper"),
  ).find((w) => w.getAttribute("data-iso-date") === todayIso);

  if (todayTile) {
    const todayButton = todayTile.querySelector(".booking-date-tile");
    if (todayButton) {
      todayButton.click();

      // Scroll carousel to position today's date
      if (dateCarousel) {
        requestAnimationFrame(() => {
          const todayWrapper = todayButton.closest(
            ".booking-date-tile-wrapper",
          );
          if (todayWrapper) {
            const wrapperLeft = todayWrapper.offsetLeft;
            const gap = 12; // gap between tiles in pixels
            const carouselWidth = dateCarousel.clientWidth;

            // Calculate scroll position based on screen size
            let scrollPosition;
            if (window.innerWidth < 600) {
              // Mobile: position today's date more to the right (about 60% across)
              scrollPosition = wrapperLeft - carouselWidth * 0.4 + gap;
            } else if (window.innerWidth < 1024) {
              // Tablet: position today's date more to the right (about 50% across)
              scrollPosition = wrapperLeft - carouselWidth * 0.5 + gap;
            } else {
              // Desktop: position at the start
              scrollPosition = wrapperLeft - gap;
            }

            dateCarousel.scrollTo({
              left: Math.max(0, scrollPosition),
              behavior: "smooth",
            });
          }
        });
      }
    }
  } else {
    // If today's date is not in the carousel, select the first available date
    const firstTile = document.querySelector(".booking-date-tile");
    if (firstTile) {
      firstTile.click();
    }
  }

  // Time selection
  timeSlots.forEach((slot) => {
    slot.addEventListener("click", function () {
      if (this.disabled) return;

      // Remove previous selection from all slots
      timeSlots.forEach((s) => {
        s.setAttribute("aria-pressed", "false");
      });

      // Find and uncheck all radio inputs
      const radioInputs = document.querySelectorAll(".booking-time-input");
      radioInputs.forEach((input) => {
        input.checked = false;
        input.setAttribute("aria-checked", "false");
      });

      // Add selection to clicked slot
      this.setAttribute("aria-pressed", "true");

      // Check the corresponding radio input
      const wrapper = this.closest(".booking-time-slot-wrapper");
      const radioInput = wrapper.querySelector(".booking-time-input");
      if (radioInput) {
        radioInput.checked = true;
        radioInput.setAttribute("aria-checked", "true");
      }

      // Update selected time
      selectedTime = this.textContent.trim();

      // Check if both date and time are selected
      checkFormCompletion();
    });
  });

  // Function to add more dates to carousel
  function addMoreDatesToCarousel(direction) {
    const scrollableInner = document.querySelector(
      ".booking-date-scrollable-inner",
    );
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthNames = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];

    // Get today's date in Dominican Republic timezone for comparison
    const nowUTC = new Date();
    const dominicanNow = new Date(
      nowUTC.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }),
    );
    const todayYear = dominicanNow.getFullYear();
    const todayMonth = dominicanNow.getMonth();
    const todayDay = dominicanNow.getDate();

    if (direction === "prev") {
      // Add dates before the current start
      for (let i = 7; i > 0; i--) {
        const dateToAdd = new Date(carouselStartDate);
        dateToAdd.setDate(dateToAdd.getDate() - i);

        const dateIso = dateToAdd.toISOString().split("T")[0];
        const fullDateIso = dateIso + "T00:00:00.000Z";

        // Check if tile already exists
        const exists = Array.from(
          document.querySelectorAll(".booking-date-tile-wrapper"),
        ).some((w) => w.getAttribute("data-iso-date") === fullDateIso);

        if (!exists) {
          const dayName = dayNames[dateToAdd.getDay()];
          const dayNum = dateToAdd.getDate();
          const monthName = monthNames[dateToAdd.getMonth()];
          const dayOfWeek = dateToAdd.getDay();
          const dateYear = dateToAdd.getFullYear();
          const dateMonth = dateToAdd.getMonth();
          const dateDay = dateToAdd.getDate();

          // Check if date is in the past
          const isPast =
            dateYear < todayYear ||
            (dateYear === todayYear && dateMonth < todayMonth) ||
            (dateYear === todayYear &&
              dateMonth === todayMonth &&
              dateDay < todayDay);

          // Check if weekend
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isUnavailable = isWeekend || isPast;

          const wrapper = document.createElement("div");
          wrapper.className = "booking-date-tile-wrapper";
          wrapper.setAttribute("data-item", "true");
          wrapper.setAttribute("data-iso-date", fullDateIso);
          wrapper.setAttribute("data-selected", "false");

          const button = document.createElement("button");
          button.type = "button";
          let buttonClass = "booking-date-tile";
          if (isUnavailable) buttonClass += " booking-date-tile--unavailable";
          button.className = buttonClass;
          button.setAttribute("aria-pressed", "false");
          if (isUnavailable) button.disabled = true;
          button.setAttribute(
            "aria-label",
            `Select ${dayName}, ${monthName} ${dayNum}, ${dateToAdd.getFullYear()}`,
          );

          button.innerHTML = `
            <span class="booking-date-day">${dayName}</span>
            <span class="booking-date-number">${dayNum}</span>
            <span class="booking-date-month">${monthName}</span>
          `;

          wrapper.appendChild(button);
          button.addEventListener("click", handleDateTileClick);
          scrollableInner.insertBefore(wrapper, scrollableInner.firstChild);
        }
      }
      carouselStartDate.setDate(carouselStartDate.getDate() - 7);
    } else {
      // Add dates after the current end
      for (let i = 1; i <= 7; i++) {
        const dateToAdd = new Date(carouselEndDate);
        dateToAdd.setDate(dateToAdd.getDate() + i);

        const dateIso = dateToAdd.toISOString().split("T")[0];
        const fullDateIso = dateIso + "T00:00:00.000Z";

        // Check if tile already exists
        const exists = Array.from(
          document.querySelectorAll(".booking-date-tile-wrapper"),
        ).some((w) => w.getAttribute("data-iso-date") === fullDateIso);

        if (!exists) {
          const dayName = dayNames[dateToAdd.getDay()];
          const dayNum = dateToAdd.getDate();
          const monthName = monthNames[dateToAdd.getMonth()];
          const dayOfWeek = dateToAdd.getDay();
          const dateYear = dateToAdd.getFullYear();
          const dateMonth = dateToAdd.getMonth();
          const dateDay = dateToAdd.getDate();

          // Check if date is in the past
          const isPast =
            dateYear < todayYear ||
            (dateYear === todayYear && dateMonth < todayMonth) ||
            (dateYear === todayYear &&
              dateMonth === todayMonth &&
              dateDay < todayDay);

          // Check if weekend
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isUnavailable = isWeekend || isPast;

          const wrapper = document.createElement("div");
          wrapper.className = "booking-date-tile-wrapper";
          wrapper.setAttribute("data-item", "true");
          wrapper.setAttribute("data-iso-date", fullDateIso);
          wrapper.setAttribute("data-selected", "false");

          const button = document.createElement("button");
          button.type = "button";
          let buttonClass = "booking-date-tile";
          if (isUnavailable) buttonClass += " booking-date-tile--unavailable";
          button.className = buttonClass;
          button.setAttribute("aria-pressed", "false");
          if (isUnavailable) button.disabled = true;
          button.setAttribute(
            "aria-label",
            `Select ${dayName}, ${monthName} ${dayNum}, ${dateToAdd.getFullYear()}`,
          );

          button.innerHTML = `
            <span class="booking-date-day">${dayName}</span>
            <span class="booking-date-number">${dayNum}</span>
            <span class="booking-date-month">${monthName}</span>
          `;

          wrapper.appendChild(button);
          button.addEventListener("click", handleDateTileClick);
          scrollableInner.appendChild(wrapper);
        }
      }
      carouselEndDate.setDate(carouselEndDate.getDate() + 7);
    }
  }

  // Handle date tile clicks
  function handleDateTileClick() {
    if (this.classList.contains("booking-date-tile--unavailable")) return;

    // Remove previous selection from all tiles
    document.querySelectorAll(".booking-date-tile").forEach((t) => {
      t.classList.remove("booking-date-tile--selected");
      t.setAttribute("aria-pressed", "false");
    });

    // Remove previous selection from all wrappers
    document.querySelectorAll(".booking-date-tile-wrapper").forEach((w) => {
      w.setAttribute("data-selected", "false");
    });

    // Add selection to clicked tile
    this.classList.add("booking-date-tile--selected");
    this.setAttribute("aria-pressed", "true");

    // Add selection to parent wrapper
    const parentWrapper = this.closest(".booking-date-tile-wrapper");
    parentWrapper.setAttribute("data-selected", "true");

    // Update selected date
    selectedDate = parentWrapper.getAttribute("data-iso-date");

    // Check if both date and time are selected
    checkFormCompletion();
  }

  // Date carousel navigation
  if (datePrevBtn) {
    datePrevBtn.addEventListener("click", function () {
      dateCarousel.scrollBy({
        left: -120,
        behavior: "smooth",
      });
    });
  }

  if (dateNextBtn) {
    dateNextBtn.addEventListener("click", function () {
      addMoreDatesToCarousel("next");
      dateCarousel.scrollBy({
        left: 120,
        behavior: "smooth",
      });
    });
  }

  // Carousel drag functionality
  if (dateCarousel) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let isDragging = false;
    const dragThreshold = 2; // pixels to move before considering it a drag

    dateCarousel.addEventListener("mousedown", (e) => {
      isDown = true;
      isDragging = false;
      startX = e.pageX;
      scrollLeft = dateCarousel.scrollLeft;
      dateCarousel.style.cursor = "grabbing";
      dateCarousel.style.userSelect = "none";
    });

    dateCarousel.addEventListener("mousemove", (e) => {
      if (!isDown) return;

      const walk = startX - e.pageX;

      // Check if movement exceeds threshold to consider it a drag
      if (Math.abs(walk) > dragThreshold) {
        isDragging = true;
        e.preventDefault();
      }

      if (isDragging) {
        e.preventDefault();
        dateCarousel.scrollLeft = scrollLeft + walk;
      }
    });

    dateCarousel.addEventListener("mouseup", () => {
      isDown = false;
      dateCarousel.style.cursor = "grab";
      dateCarousel.style.userSelect = "auto";
    });

    dateCarousel.addEventListener("mouseleave", () => {
      isDown = false;
      dateCarousel.style.cursor = "grab";
      dateCarousel.style.userSelect = "auto";
    });

    // Prevent click on date tiles if dragging
    const dateTiles = dateCarousel.querySelectorAll(".booking-date-tile");
    dateTiles.forEach((tile) => {
      tile.addEventListener(
        "click",
        (e) => {
          if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
          }
        },
        true,
      );
    });

    // Add grab cursor by default
    dateCarousel.style.cursor = "grab";
  }

  // Check form completion
  function checkFormCompletion() {
    if (selectedDate && selectedTime) {
      continueBtn.disabled = false;
    } else {
      continueBtn.disabled = true;
    }
  }

  // Continue button
  if (continueBtn) {
    continueBtn.addEventListener("click", function () {
      if (!this.disabled) {
        // Store selected date and time in sessionStorage for next step
        sessionStorage.setItem("bookingDate", selectedDate);
        sessionStorage.setItem("bookingTime", selectedTime);

        // Navigate to next step (customer info form)
        window.location.href = "/reservar/informacion/";
      }
    });
  }

  // Close calendar modal on scroll
  document.addEventListener(
    "scroll",
    function () {
      if (calendarModal && calendarModal.classList.contains("active")) {
        calendarModal.classList.remove("active");
      }
    },
    true,
  );
});
