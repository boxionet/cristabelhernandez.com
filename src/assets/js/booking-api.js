// Booking API client for the public reservar flow (Phase 3).
// Every method returns null on any failure — callers MUST fall back to
// the bundled catalog / static rules / legacy email flow so the booking
// pages keep working even if the new engine is unreachable.
window.BookingAPI = (function () {
  var configPromise = null;

  function config() {
    if (!configPromise) {
      configPromise = fetch("/.netlify/functions/booking-config")
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        });
    }
    return configPromise;
  }

  // Live catalog from Supabase (public read via RLS + anon key), shaped
  // like the bundled catalog entries in booking-services.js.
  function fetchServices() {
    return config().then(function (cfg) {
      if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
      return fetch(
        cfg.supabaseUrl +
          "/rest/v1/services?select=slug,name,price,price_from,price_note,duration_minutes,category,sort_order&active=eq.true&order=sort_order.asc",
        {
          headers: {
            apikey: cfg.supabaseAnonKey,
            Authorization: "Bearer " + cfg.supabaseAnonKey,
          },
        },
      )
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (rows) {
          if (!rows) return null;
          return rows.map(function (row) {
            return {
              slug: row.slug,
              name: row.name,
              price: row.price,
              priceFrom: row.price_from,
              priceNote: row.price_note || "",
              duration: row.duration_minutes,
              category: row.category,
            };
          });
        })
        .catch(function () {
          return null;
        });
    });
  }

  // { date, open, slots: ["HH:MM", ...] } for one day + cart duration.
  function fetchSlots(dateISO, durationMinutes) {
    return fetch(
      "/.netlify/functions/booking-availability?date=" +
        encodeURIComponent(dateISO) +
        "&durationMinutes=" +
        encodeURIComponent(durationMinutes),
    )
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  // Creates a booking. Resolves { ok, status, data } for every HTTP
  // outcome (including 409 slot_taken); rejects only on network failure.
  function createBooking(payload) {
    return fetch("/.netlify/functions/booking-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
    });
  }

  // "10:00 AM" -> "10:00" (24h, for the API). Returns null if unparsable.
  function to24h(display) {
    var m = String(display || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    var h = parseInt(m[1], 10) % 12;
    if (/PM/i.test(m[3])) h += 12;
    return (h < 10 ? "0" : "") + h + ":" + m[2];
  }

  return {
    fetchServices: fetchServices,
    fetchSlots: fetchSlots,
    createBooking: createBooking,
    to24h: to24h,
  };
})();
