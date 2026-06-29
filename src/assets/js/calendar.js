/**
 * Calendar utility for the booking confirmation page.
 * Generates Google Calendar links and downloadable .ics files
 * from reservation data stored in BookingStorage.
 */

const CalendarUtils = {
  BUSINESS_NAME: "Dra. Cristabel Hernandez",
  BUSINESS_ADDRESS:
    "Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata 57000, DO",
  BUSINESS_PHONE: "(829) 316-3313",
  DEFAULT_DURATION_MINUTES: 60,
  // Puerto Plata, Dominican Republic is UTC-4 all year (no DST)
  CLINIC_UTC_OFFSET_MINUTES: 240,

  MONTH_MAP: {
    enero: "01",
    febrero: "02",
    marzo: "03",
    abril: "04",
    mayo: "05",
    junio: "06",
    julio: "07",
    agosto: "08",
    septiembre: "09",
    octubre: "10",
    noviembre: "11",
    diciembre: "12",
  },

  /**
   * Format a Date object as a UTC timestamp string for ICS.
   * @param {Date} dateObj
   * @returns {string} YYYYMMDDTHHMMSSZ
   */
  formatCalendarDate(dateObj) {
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getUTCDate()).padStart(2, "0");
    const hours = String(dateObj.getUTCHours()).padStart(2, "0");
    const minutes = String(dateObj.getUTCMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getUTCSeconds()).padStart(2, "0");
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  },

  /**
   * Calculate total duration in minutes from booking services.
   * @param {Object} services
   * @returns {number}
   */
  getTotalDuration(services) {
    if (!services || typeof services !== "object")
      return this.DEFAULT_DURATION_MINUTES;
    return (
      Object.values(services).reduce((sum, s) => {
        return sum + (s.duration || 0) * (s.quantity || 1);
      }, 0) || this.DEFAULT_DURATION_MINUTES
    );
  },

  /**
   * Extract year, month, and day from stored date string.
   * Supports "DD de mes de YYYY" and "Día, Mes DD" formats.
   * @param {string} dateStr
   * @param {string|number} fallbackYear
   * @returns {Object|null} { day, month, year }
   */
  parseDateString(dateStr, fallbackYear) {
    if (!dateStr) return null;

    // "24 de junio de 2025"
    let match = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (match) {
      return {
        day: match[1].padStart(2, "0"),
        month: this.MONTH_MAP[match[2].toLowerCase()],
        year: match[3],
      };
    }

    // "Domingo, Julio 3" or "Julio 3"
    match = dateStr.match(/(\w+)\s+(\d{1,2})/i);
    if (match) {
      const month = this.MONTH_MAP[match[1].toLowerCase()];
      const year = String(fallbackYear || new Date().getFullYear());
      return {
        day: match[2].padStart(2, "0"),
        month: month,
        year: year,
      };
    }

    return null;
  },

  /**
   * Parse stored time string into 24-hour format.
   * @param {string} timeStr
   * @returns {Object|null} { hours, minutes }
   */
  parseTimeString(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3] ? match[3].toUpperCase() : null;

    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    return { hours: String(hours).padStart(2, "0"), minutes };
  },

  /**
   * Convert a parsed local date/time to the clinic's correct UTC instant.
   * The browser parses the string as its own local time, so we adjust by the
   * difference between the browser offset and the clinic offset (UTC-4).
   * @param {Date} date
   * @returns {Date}
   */
  applyClinicOffset(date) {
    const browserOffsetMinutes = date.getTimezoneOffset();
    return new Date(
      date.getTime() +
        (this.CLINIC_UTC_OFFSET_MINUTES - browserOffsetMinutes) * 60000,
    );
  },

  /**
   * Extract booking data needed for calendar generation.
   * @param {Object} bookingData
   * @returns {Object|null}
   */
  parseBookingData(bookingData) {
    if (!bookingData) return null;

    const dt = bookingData.dateTime;
    const info = bookingData.customerInfo;
    const services = bookingData.services || {};

    if (!dt || typeof dt !== "object" || !dt.date || !dt.time) return null;

    const serviceNames = Object.values(services)
      .map((s) => s.name)
      .join(", ");
    const patientName = info
      ? `${info.firstName || ""} ${info.lastName || ""}`.trim()
      : "";
    const confirmationNumber = bookingData.confirmationNumber || "";

    const timestamp = bookingData.timestamp;
    const fallbackYear = timestamp
      ? new Date(timestamp).getFullYear()
      : new Date().getFullYear();

    const dateParts = this.parseDateString(dt.date, fallbackYear);
    if (!dateParts || !dateParts.month) return null;

    const timeParts = this.parseTimeString(dt.time);
    if (!timeParts) return null;

    const parsedStart = new Date(
      `${dateParts.year}-${dateParts.month}-${dateParts.day}T${timeParts.hours}:${timeParts.minutes}:00`,
    );
    if (isNaN(parsedStart.getTime())) return null;

    const startDate = this.applyClinicOffset(parsedStart);
    const durationMinutes = this.getTotalDuration(services);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    return {
      startDate,
      endDate,
      serviceNames,
      patientName,
      confirmationNumber,
      durationMinutes,
    };
  },

  /**
   * Create a Google Calendar event URL from booking data.
   * @param {Object} bookingData
   * @returns {string|null}
   */
  createGoogleCalendarUrl(bookingData) {
    const data = this.parseBookingData(bookingData);
    if (!data) return null;

    const {
      startDate,
      endDate,
      serviceNames,
      patientName,
      confirmationNumber,
    } = data;
    const summary = encodeURIComponent(`Cita - ${this.BUSINESS_NAME}`);

    const detailsParts = [
      `Paciente: ${patientName || "N/A"}`,
      `Servicios: ${serviceNames || "No especificado"}`,
      `Clínica: ${this.BUSINESS_NAME}`,
      `Teléfono: ${this.BUSINESS_PHONE}`,
      `Dirección: ${this.BUSINESS_ADDRESS}`,
    ];
    if (confirmationNumber) {
      detailsParts.push(`Confirmación: ${confirmationNumber}`);
    }
    const details = encodeURIComponent(detailsParts.join("\n"));
    const location = encodeURIComponent(this.BUSINESS_ADDRESS);
    const dates = `${this.formatCalendarDate(startDate)}/${this.formatCalendarDate(endDate)}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${dates}&details=${details}&location=${location}`;
  },

  /**
   * Create ICS calendar content string.
   * @param {Object} bookingData
   * @returns {string|null}
   */
  createICSContent(bookingData) {
    const data = this.parseBookingData(bookingData);
    if (!data) return null;

    const {
      startDate,
      endDate,
      serviceNames,
      patientName,
      confirmationNumber,
    } = data;
    const summary = `Cita - ${this.BUSINESS_NAME}`;

    const descriptionParts = [
      `Paciente: ${patientName || "N/A"}`,
      `Servicios: ${serviceNames || "No especificado"}`,
      `Clínica: ${this.BUSINESS_NAME}`,
      `Teléfono: ${this.BUSINESS_PHONE}`,
      `Dirección: ${this.BUSINESS_ADDRESS}`,
    ];
    if (confirmationNumber) {
      descriptionParts.push(`Confirmación: ${confirmationNumber}`);
    }

    const description = descriptionParts.join("\\n");
    const location = this.BUSINESS_ADDRESS;
    const uid = `cristabel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cristabel Hernandez//Booking//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${this.formatCalendarDate(new Date())}`,
      `DTSTART:${this.formatCalendarDate(startDate)}`,
      `DTEND:${this.formatCalendarDate(endDate)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\\r\\n");
  },

  /**
   * Generate a filename for the ICS download.
   * @param {Object} bookingData
   * @returns {string}
   */
  getICSFilename(bookingData) {
    const dt = bookingData?.dateTime;
    let datePart = "";

    if (dt && typeof dt === "object" && dt.date) {
      const dateParts = this.parseDateString(dt.date, new Date().getFullYear());
      if (dateParts) {
        datePart = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
      }
    }

    if (!datePart) {
      const now = new Date();
      datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }

    return `Cristabel-Reservation-${datePart}.ics`;
  },

  /**
   * Trigger .ics file download.
   * @param {Object} bookingData
   */
  downloadICS(bookingData) {
    const content = this.createICSContent(bookingData);
    if (!content) {
      console.warn("Cannot download ICS: missing or invalid booking data");
      return;
    }

    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.getICSFilename(bookingData);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

/**
 * Accessible dropdown menu for calendar options.
 */
class CalendarMenu {
  /**
   * @param {string} dropdownId - ID of the dropdown wrapper element.
   * @param {Object} bookingData - Reservation data from BookingStorage.
   */
  constructor(dropdownId, bookingData) {
    this.dropdown = document.getElementById(dropdownId);
    if (!this.dropdown) {
      console.warn(`CalendarMenu: dropdown #${dropdownId} not found`);
      return;
    }

    this.button = this.dropdown.querySelector(
      ".confirmacion-action-btn--calendar",
    );
    this.menu = this.dropdown.querySelector(".confirmacion-calendar-menu");
    this.error = this.dropdown.querySelector(".confirmacion-calendar-error");
    this.options = this.menu
      ? Array.from(this.menu.querySelectorAll('[role="menuitem"]'))
      : [];
    this.bookingData = bookingData;
    this.isOpen = false;
    this.hasData = !!CalendarUtils.parseBookingData(this.bookingData);

    console.log("CalendarMenu:", {
      hasData: this.hasData,
      options: this.options.length,
      button: !!this.button,
      menu: !!this.menu,
    });

    this.init();
  }

  init() {
    if (!this.button || !this.menu) return;

    this.button.setAttribute("aria-haspopup", "true");
    this.button.setAttribute("aria-expanded", "false");
    this.menu.setAttribute("role", "menu");
    this.menu.setAttribute("aria-hidden", "true");

    if (!this.hasData) {
      this.button.setAttribute("disabled", "true");
      this.button.setAttribute("aria-disabled", "true");
      this.button.title = "Información de cita incompleta";
      if (this.error) this.error.hidden = false;
      return;
    }

    this.button.addEventListener("click", (e) => {
      e.preventDefault();
      this.toggle();
    });

    this.options.forEach((option) => {
      option.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleOptionClick(option);
      });
    });

    document.addEventListener("click", (e) => {
      if (!this.dropdown.contains(e.target)) {
        this.close();
      }
    });

    this.dropdown.addEventListener("keydown", (e) => this.handleKeydown(e));
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (!this.hasData || this.isOpen) return;
    this.isOpen = true;
    this.dropdown.classList.add("is-open");
    this.button.setAttribute("aria-expanded", "true");
    this.menu.setAttribute("aria-hidden", "false");
    if (this.options[0]) this.options[0].focus();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.dropdown.classList.remove("is-open");
    this.button.setAttribute("aria-expanded", "false");
    this.menu.setAttribute("aria-hidden", "true");
  }

  handleOptionClick(option) {
    const type = option.dataset.calendarType;
    if (type === "google") {
      const url = CalendarUtils.createGoogleCalendarUrl(this.bookingData);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } else if (type === "ics") {
      CalendarUtils.downloadICS(this.bookingData);
    }
    this.close();
    this.button.focus();
  }

  handleKeydown(e) {
    if (!this.isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        this.open();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        this.close();
        this.button.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        this.focusNext();
        break;
      case "ArrowUp":
        e.preventDefault();
        this.focusPrev();
        break;
      case "Tab":
        e.preventDefault();
        this.close();
        this.button.focus();
        break;
      case "Home":
        e.preventDefault();
        if (this.options[0]) this.options[0].focus();
        break;
      case "End":
        e.preventDefault();
        if (this.options[this.options.length - 1])
          this.options[this.options.length - 1].focus();
        break;
    }
  }

  focusNext() {
    const currentIndex = this.options.findIndex(
      (opt) => opt === document.activeElement,
    );
    const nextIndex =
      currentIndex >= this.options.length - 1 ? 0 : currentIndex + 1;
    this.options[nextIndex].focus();
  }

  focusPrev() {
    const currentIndex = this.options.findIndex(
      (opt) => opt === document.activeElement,
    );
    const prevIndex =
      currentIndex <= 0 ? this.options.length - 1 : currentIndex - 1;
    this.options[prevIndex].focus();
  }
}

window.CalendarUtils = CalendarUtils;
window.CalendarMenu = CalendarMenu;
