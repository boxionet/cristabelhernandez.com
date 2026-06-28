// Booking Date & Time Selection Logic

document.addEventListener("DOMContentLoaded", function () {
  const dateCarousel = document.querySelector(".booking-date-carousel");
  const dateTileWrappers = document.querySelectorAll(
    ".booking-date-tile-wrapper",
  );
  const dateTiles = document.querySelectorAll(".booking-date-tile");
  const timeSlots = document.querySelectorAll(".booking-time-slot");
  const continueBtnDesktop = document.getElementById("continue-btn-desktop");
  const continueBtnMobile = document.getElementById("continue-btn-mobile");
  const continueBtn = continueBtnDesktop || continueBtnMobile; // Fallback for compatibility
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

  // Handle unavailable dates
  function handleDateTileClick(e) {
    const tile = e.currentTarget;
    const wrapper = tile.closest(".booking-date-tile-wrapper");
    const isoDate = wrapper.getAttribute("data-iso-date");
    const isUnavailable = tile.classList.contains(
      "booking-date-tile--unavailable",
    );

    if (isUnavailable) {
      // For unavailable dates, manually update selection without hiding message
      selectedDate = isoDate;

      // Update visual selection
      document
        .querySelectorAll(".booking-date-tile-wrapper")
        .forEach((tile) => {
          const tileDate = tile.getAttribute("data-iso-date");
          const button = tile.querySelector(".booking-date-tile");
          if (tileDate === isoDate) {
            button.classList.add("booking-date-tile--selected");
            button.setAttribute("aria-pressed", "true");
            tile.setAttribute("data-selected", "true");
          } else {
            button.classList.remove("booking-date-tile--selected");
            button.setAttribute("aria-pressed", "false");
            tile.setAttribute("data-selected", "false");
          }
        });

      showUnavailableMessage(isoDate);
      checkFormCompletion();
      return;
    }

    // Handle available date selection
    selectedDate = isoDate;
    updateDateSelection();
  }

  function showUnavailableMessage(isoDate) {
    const unavailableMessage = document.getElementById("unavailable-message");
    const unavailableSubtitle = document.getElementById("unavailable-subtitle");
    const nextAvailableBtn = document.getElementById("next-available-btn");

    // Parse ISO date string (YYYY-MM-DDTHH:mm:ss.sssZ) to get just the date part
    const dateString = isoDate.split("T")[0]; // Get "2026-06-21"
    const [year, month, day] = dateString.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day); // Create date in local timezone

    // Find next available date
    const nextAvailable = getNextAvailableDate(dateObj);
    const formattedDate = formatDateForDisplay(nextAvailable);

    unavailableSubtitle.textContent = `Disponible desde ${formattedDate}`;
    unavailableMessage.style.display = "flex";

    // Hide time section
    const timeSection = document.querySelector(".booking-time-section");
    if (timeSection) {
      timeSection.style.display = "none";
    }

    nextAvailableBtn.onclick = () => {
      goToNextAvailableDate(nextAvailable);
    };
  }

  function hideUnavailableMessage() {
    const unavailableMessage = document.getElementById("unavailable-message");
    unavailableMessage.style.display = "none";

    // Show time section
    const timeSection = document.querySelector(".booking-time-section");
    if (timeSection) {
      timeSection.style.display = "block";
    }
  }

  function getNextAvailableDate(fromDate) {
    let checkDate = new Date(fromDate);
    // Start from the next day after the clicked date
    checkDate.setDate(checkDate.getDate() + 1);

    // Get today's date in Dominican Republic timezone
    const nowUTC = new Date();
    const dominicanToday = new Date(
      nowUTC.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }),
    );
    const todayYear = dominicanToday.getFullYear();
    const todayMonth = dominicanToday.getMonth();
    const todayDay = dominicanToday.getDate();

    // Keep checking until we find an available date (not weekend, not past)
    while (true) {
      const dayOfWeek = checkDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPast =
        checkDate.getFullYear() < todayYear ||
        (checkDate.getFullYear() === todayYear &&
          checkDate.getMonth() < todayMonth) ||
        (checkDate.getFullYear() === todayYear &&
          checkDate.getMonth() === todayMonth &&
          checkDate.getDate() < todayDay);

      if (!isWeekend && !isPast) {
        return checkDate;
      }

      checkDate.setDate(checkDate.getDate() + 1);
    }
  }

  function formatDateForDisplay(date) {
    const dayNames = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
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

    const dayName = dayNames[date.getDay()];
    const monthName = monthNames[date.getMonth()];
    const day = date.getDate();

    return `${dayName}, ${monthName} ${day}`;
  }

  function goToNextAvailableDate(date) {
    const isoDate = date.toISOString().split("T")[0];
    const fullIsoDate = isoDate + "T00:00:00.000Z";

    console.log("🔄 Going to next available date:", isoDate);

    // Update selected date
    selectedDate = fullIsoDate;

    // Update carousel to show this date
    const dateCarousel = document.querySelector(
      ".booking-date-scrollable-inner",
    );
    let dateTiles = dateCarousel.querySelectorAll(".booking-date-tile-wrapper");

    let dateFound = false;
    dateTiles.forEach((tile) => {
      const tileDate = tile.getAttribute("data-iso-date");
      if (tileDate === fullIsoDate) {
        dateFound = true;
        const button = tile.querySelector(".booking-date-tile");
        button.click();
      }
    });

    // If date not found in carousel, fill in missing dates first
    if (!dateFound) {
      console.log("📅 Next available date not in carousel, filling dates...");

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

      // Fill in dates from carousel end to selected date
      let fillDate = new Date(carouselEndDate);
      fillDate.setDate(fillDate.getDate() + 1);

      // Use date comparison by converting to YYYY-MM-DD strings
      const selectedDateString = isoDate;

      let datesFilled = 0;
      while (true) {
        const fillDateIso = fillDate.toISOString().split("T")[0];
        const fillFullDateIso = fillDateIso + "T00:00:00.000Z";

        // Check if tile already exists
        const exists = Array.from(
          document.querySelectorAll(".booking-date-tile-wrapper"),
        ).some((w) => w.getAttribute("data-iso-date") === fillFullDateIso);

        if (!exists) {
          const fillDayName = dayNames[fillDate.getDay()];
          const fillDayNum = fillDate.getDate();
          const fillMonthName = monthNames[fillDate.getMonth()];
          const fillDayOfWeek = fillDate.getDay();

          // Check if weekend
          const fillIsWeekend = fillDayOfWeek === 0 || fillDayOfWeek === 6;

          const wrapper = document.createElement("div");
          wrapper.className = "booking-date-tile-wrapper";
          wrapper.setAttribute("data-item", "true");
          wrapper.setAttribute("data-iso-date", fillFullDateIso);
          wrapper.setAttribute(
            "data-selected",
            fillFullDateIso === fullIsoDate ? "true" : "false",
          );

          const button = document.createElement("button");
          button.type = "button";
          let buttonClass = "booking-date-tile";
          if (fillFullDateIso === fullIsoDate)
            buttonClass += " booking-date-tile--selected";
          if (fillIsWeekend) buttonClass += " booking-date-tile--unavailable";
          button.className = buttonClass;
          button.setAttribute(
            "aria-pressed",
            fillFullDateIso === fullIsoDate ? "true" : "false",
          );
          button.setAttribute(
            "aria-label",
            `Select ${fillDayName}, ${fillMonthName} ${fillDayNum}, ${fillDate.getFullYear()}`,
          );

          button.innerHTML = `
            <span class="booking-date-day">${fillDayName}</span>
            <span class="booking-date-number">${fillDayNum}</span>
            <span class="booking-date-month">${fillMonthName}</span>
          `;

          wrapper.appendChild(button);
          button.addEventListener("click", handleDateTileClick);
          dateCarousel.appendChild(wrapper);
          datesFilled++;
        }

        // Stop when we reach the selected date
        if (fillDateIso === selectedDateString) {
          console.log(
            "✓ Filled",
            datesFilled,
            "dates. Reached next available date:",
            selectedDateString,
          );
          break;
        }

        fillDate.setDate(fillDate.getDate() + 1);
      }

      // Update carousel end date
      carouselEndDate = new Date(date);

      // Now click the newly created tile
      dateTiles = dateCarousel.querySelectorAll(".booking-date-tile-wrapper");
      dateTiles.forEach((tile) => {
        const tileDate = tile.getAttribute("data-iso-date");
        if (tileDate === fullIsoDate) {
          const button = tile.querySelector(".booking-date-tile");
          button.click();
        }
      });
    }

    // Scroll to the selected date
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const dateCarouselElement = document.querySelector(
            ".booking-date-carousel",
          );
          if (dateCarouselElement) {
            const selectedTile = Array.from(
              document.querySelectorAll(".booking-date-tile-wrapper"),
            ).find((tile) => {
              return (
                tile.getAttribute("data-iso-date") === fullIsoDate &&
                tile.querySelector(".booking-date-tile--selected")
              );
            });

            if (selectedTile) {
              const selectedButton =
                selectedTile.querySelector(".booking-date-tile");
              const buttonRect = selectedButton.getBoundingClientRect();
              const carouselRect = dateCarouselElement.getBoundingClientRect();
              const scrollLeft =
                dateCarouselElement.scrollLeft +
                (buttonRect.left - carouselRect.left) -
                carouselRect.width / 2 +
                buttonRect.width / 2;

              console.log("✓ Scrolling to next available date");
              dateCarouselElement.scrollTo({
                left: scrollLeft,
                behavior: "smooth",
              });
            }
          }
        });
      });
    });

    // Hide unavailable message
    hideUnavailableMessage();

    // Clear time selection
    const timeSlots = document.querySelectorAll(".booking-time-slot");
    timeSlots.forEach((slot) => {
      slot.classList.remove("booking-time-slot--selected");
      slot.setAttribute("aria-pressed", "false");
    });
    selectedTime = null;
    checkFormCompletion();
  }

  function updateDateSelection() {
    // Update carousel selection
    const dateTiles = document.querySelectorAll(".booking-date-tile-wrapper");
    dateTiles.forEach((tile) => {
      const tileDate = tile.getAttribute("data-iso-date");
      const button = tile.querySelector(".booking-date-tile");
      if (tileDate === selectedDate) {
        button.classList.add("booking-date-tile--selected");
        button.setAttribute("aria-pressed", "true");
        tile.setAttribute("data-selected", "true");
      } else {
        button.classList.remove("booking-date-tile--selected");
        button.setAttribute("aria-pressed", "false");
        tile.setAttribute("data-selected", "false");
      }
    });

    // Clear time slot selections when date changes
    const timeSlots = document.querySelectorAll(".booking-time-slot");
    timeSlots.forEach((slot) => {
      slot.classList.remove("booking-time-slot--selected");
      slot.setAttribute("aria-pressed", "false");
    });
    selectedTime = null;
    console.log("🔄 Date changed - time slots cleared");

    hideUnavailableMessage();
    checkFormCompletion();
  }

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

      // Check if this is the selected date
      const isSelected =
        selectedDate &&
        selectedDate.includes(
          `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        );

      if (isSelected) {
        dayBtn.classList.add("selected");
      }

      // Check if Saturday (6) or Sunday (0)
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Check if date is in the past (before today)
      const isPast =
        year < todayYear ||
        (year === todayYear && month < todayMonth) ||
        (year === todayYear && month === todayMonth && day < todayDay);

      // Check if past dates
      if (isPast) {
        dayBtn.classList.add("disabled");
        dayBtn.disabled = true;
      } else if (isWeekend) {
        // Add weekend class for styling but keep clickable
        dayBtn.classList.add("weekend");
        dayBtn.addEventListener("click", function () {
          selectDateFromCalendar(isoDate, isWeekend);
        });
      } else {
        // Allow clicking on available dates
        dayBtn.addEventListener("click", function () {
          selectDateFromCalendar(isoDate, isWeekend);
        });
      }

      calendarDays.appendChild(dayBtn);
    }
  }

  function selectDateFromCalendar(isoDate, isWeekend = false) {
    // Close calendar
    calendarModal.classList.remove("active");

    const fullIsoDate = isoDate + "T00:00:00.000Z";
    // Parse the date string (YYYY-MM-DD) without timezone conversion
    const [year, month, day] = isoDate.split("-").map(Number);
    const selectedDateObj = new Date(year, month - 1, day);

    // Update calendar to show the selected date's month
    currentCalendarDate = new Date(year, month - 1, 1);
    console.log("📅 Calendar updated to show:", year, month, "month");

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

    // Update selected date
    selectedDate = fullIsoDate;

    // Update carousel to show this date if it exists, or add it
    const dateCarousel = document.querySelector(
      ".booking-date-scrollable-inner",
    );
    const dateTiles = dateCarousel.querySelectorAll(
      ".booking-date-tile-wrapper",
    );
    let dateFound = false;

    dateTiles.forEach((tile) => {
      const tileDate = tile.getAttribute("data-iso-date");
      const button = tile.querySelector(".booking-date-tile");
      button.classList.remove("booking-date-tile--selected");
      button.setAttribute("aria-pressed", "false");
      tile.setAttribute("data-selected", "false");

      if (tileDate === fullIsoDate) {
        dateFound = true;
        button.classList.add("booking-date-tile--selected");
        button.setAttribute("aria-pressed", "true");
        tile.setAttribute("data-selected", "true");
      }
    });

    // If date not found in carousel, add all dates from carousel end to selected date
    if (!dateFound) {
      console.log("📅 Date not found in carousel, filling dates...");
      console.log("Selected date:", isoDate, "Full ISO:", fullIsoDate);

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

      // Get today's date in Dominican Republic timezone
      const nowUTC = new Date();
      const dominicanToday = new Date(
        nowUTC.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }),
      );
      const todayYear = dominicanToday.getFullYear();
      const todayMonth = dominicanToday.getMonth();
      const todayDay = dominicanToday.getDate();

      // Fill in dates from carousel end to selected date
      let fillDate = new Date(carouselEndDate);
      fillDate.setDate(fillDate.getDate() + 1);

      // Use date comparison by converting to YYYY-MM-DD strings to avoid timezone issues
      const selectedDateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      console.log(
        "Carousel end date:",
        carouselEndDate.toISOString().split("T")[0],
      );
      console.log("Selected date string:", selectedDateString);

      let datesFilled = 0;
      while (true) {
        const fillDateIso = fillDate.toISOString().split("T")[0];
        const fillFullDateIso = fillDateIso + "T00:00:00.000Z";

        // Check if tile already exists
        const exists = Array.from(
          document.querySelectorAll(".booking-date-tile-wrapper"),
        ).some((w) => w.getAttribute("data-iso-date") === fillFullDateIso);

        if (!exists) {
          const fillDayName = dayNames[fillDate.getDay()];
          const fillDayNum = fillDate.getDate();
          const fillMonthName = monthNames[fillDate.getMonth()];
          const fillDayOfWeek = fillDate.getDay();
          const fillDateYear = fillDate.getFullYear();
          const fillDateMonth = fillDate.getMonth();
          const fillDateDay = fillDate.getDate();

          // Check if weekend
          const fillIsWeekend = fillDayOfWeek === 0 || fillDayOfWeek === 6;

          const wrapper = document.createElement("div");
          wrapper.className = "booking-date-tile-wrapper";
          wrapper.setAttribute("data-item", "true");
          wrapper.setAttribute("data-iso-date", fillFullDateIso);
          wrapper.setAttribute(
            "data-selected",
            fillFullDateIso === fullIsoDate ? "true" : "false",
          );

          const button = document.createElement("button");
          button.type = "button";
          let buttonClass = "booking-date-tile";
          if (fillFullDateIso === fullIsoDate)
            buttonClass += " booking-date-tile--selected";
          if (fillIsWeekend) buttonClass += " booking-date-tile--unavailable";
          button.className = buttonClass;
          button.setAttribute(
            "aria-pressed",
            fillFullDateIso === fullIsoDate ? "true" : "false",
          );
          button.setAttribute(
            "aria-label",
            `Select ${fillDayName}, ${fillMonthName} ${fillDayNum}, ${fillDateYear}`,
          );

          button.innerHTML = `
            <span class="booking-date-day">${fillDayName}</span>
            <span class="booking-date-number">${fillDayNum}</span>
            <span class="booking-date-month">${fillMonthName}</span>
          `;

          wrapper.appendChild(button);
          button.addEventListener("click", handleDateTileClick);
          dateCarousel.appendChild(wrapper);
          datesFilled++;
        }

        // Stop when we reach the selected date
        if (fillDateIso === selectedDateString) {
          console.log(
            "✓ Filled",
            datesFilled,
            "dates. Reached selected date:",
            selectedDateString,
          );
          break;
        }

        fillDate.setDate(fillDate.getDate() + 1);
      }

      // Update carousel end date
      carouselEndDate = new Date(selectedDateObj);
    }

    // Scroll carousel to show the selected date (works for both weekday and weekend)
    const scrollToSelectedDate = () => {
      const dateCarouselElement = document.querySelector(
        ".booking-date-carousel",
      );
      if (dateCarouselElement) {
        // Find the selected tile by ISO date instead of class selector
        // This ensures we get the correct tile even if multiple tiles have the class
        const selectedTile = Array.from(
          document.querySelectorAll(".booking-date-tile-wrapper"),
        ).find((tile) => {
          return (
            tile.getAttribute("data-iso-date") === fullIsoDate &&
            tile.querySelector(".booking-date-tile--selected")
          );
        });

        console.log("🔍 Looking for tile with ISO date:", fullIsoDate);
        console.log("✓ Selected tile found:", selectedTile ? "YES" : "NO");

        if (selectedTile) {
          const selectedButton =
            selectedTile.querySelector(".booking-date-tile");
          const buttonRect = selectedButton.getBoundingClientRect();
          const carouselRect = dateCarouselElement.getBoundingClientRect();
          const scrollLeft =
            dateCarouselElement.scrollLeft +
            (buttonRect.left - carouselRect.left) -
            carouselRect.width / 2 +
            buttonRect.width / 2;

          console.log("✓ Scrolling to position:", scrollLeft);
          dateCarouselElement.scrollTo({
            left: scrollLeft,
            behavior: "smooth",
          });
        } else {
          console.warn(
            "⚠️ Selected tile not found! Checking available tiles...",
          );
          const allTiles = document.querySelectorAll(
            ".booking-date-tile-wrapper",
          );
          console.log("Total tiles in carousel:", allTiles.length);
          allTiles.forEach((tile) => {
            console.log("Tile ISO date:", tile.getAttribute("data-iso-date"));
          });
        }
      }
    };

    // Use triple requestAnimationFrame to ensure DOM is fully updated before scrolling
    // First frame: DOM updates are applied
    // Second frame: Layout is calculated
    // Third frame: scroll happens after DOM is fully painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToSelectedDate();

          // If weekend, show unavailable message after scroll
          if (isWeekend) {
            console.log(
              "⚠️ Weekend date selected, showing unavailable message",
            );

            // Clear time slot selections visually
            const timeSlots = document.querySelectorAll(".booking-time-slot");
            timeSlots.forEach((slot) => {
              slot.classList.remove("booking-time-slot--selected");
              slot.setAttribute("aria-pressed", "false");
            });

            // Clear selected time
            selectedTime = null;
            console.log("🔄 Date changed from calendar - time slots cleared");

            showUnavailableMessage(fullIsoDate);
            checkFormCompletion();
            return;
          }

          // If weekday, hide unavailable message and show time slots
          console.log("✓ Weekday date selected, hiding unavailable message");
          hideUnavailableMessage();

          // Store the newly selected date as pending (like carousel)
          // It will be saved to localStorage only when user picks a time
          if (typeof window !== "undefined") {
            window.pendingDate = formattedDate;
            console.log(
              "✓ Date selected from calendar (pending):",
              formattedDate,
            );
            console.log("✓ Cart will update when you select a time");

            // Clear time slot selections visually
            const timeSlots = document.querySelectorAll(".booking-time-slot");
            timeSlots.forEach((slot) => {
              slot.classList.remove("booking-time-slot--selected");
              slot.setAttribute("aria-pressed", "false");
            });

            // Clear selected time
            selectedTime = null;
            console.log("🔄 Date changed from calendar - time slots cleared");

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

            // Check form completion to update button state
            checkFormCompletion();
          }
        });
      });
    });
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
    tile.addEventListener("click", handleDateTileClick);
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
    console.log("🔍 Checking form completion...");
    console.log("Selected date:", selectedDate);
    console.log("Selected time:", selectedTime);

    // Check if both date and time are selected
    if (!selectedDate || !selectedTime) {
      console.log("❌ Form incomplete: Missing date or time");
      if (continueBtnDesktop) continueBtnDesktop.disabled = true;
      if (continueBtnMobile) continueBtnMobile.disabled = true;
      return;
    }

    // Check if the selected date is available (not a weekend)
    const selectedTile = document.querySelector(
      `[data-iso-date="${selectedDate}"] .booking-date-tile`,
    );

    if (!selectedTile) {
      console.log("⚠️ Selected tile not found in DOM");
      if (continueBtnDesktop) continueBtnDesktop.disabled = true;
      if (continueBtnMobile) continueBtnMobile.disabled = true;
      return;
    }

    const isUnavailable = selectedTile.classList.contains(
      "booking-date-tile--unavailable",
    );

    if (isUnavailable) {
      console.log("❌ Form incomplete: Selected date is unavailable (weekend)");
      if (continueBtnDesktop) continueBtnDesktop.disabled = true;
      if (continueBtnMobile) continueBtnMobile.disabled = true;
      return;
    }

    // All conditions met: date is available and time is selected
    console.log("✅ Form complete: Available date and time selected");
    if (continueBtnDesktop) continueBtnDesktop.disabled = false;
    if (continueBtnMobile) continueBtnMobile.disabled = false;
  }

  // Continue button
  if (continueBtn) {
    continueBtn.addEventListener("click", function () {
      if (!this.disabled) {
        // Store selected date and time in sessionStorage for next step
        sessionStorage.setItem("bookingDate", selectedDate);
        sessionStorage.setItem("bookingTime", selectedTime);

        // Navigate to next step (datos page)
        window.location.href = "/reservar/datos/";
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
