// Click tracking for the static pages (Google Tag Manager,
// container GTM-KR663M52, loaded by layouts/base.html).
//
// One delegated listener covers every "Reservar Cita" and "Mi Cuenta"
// link on every static page — including links injected after load
// (the face-explorer card) — so no link needs its own markup. Each
// click pushes one dataLayer event with the spot it came from, so
// the owner can see in GA4 not just how many clicks, but where.
//
//   reservar_click   { click_location, page_path }
//   mi_cuenta_click  { click_location, page_path }
//
// The listener never stops or delays the navigation: the push is
// synchronous, and a failure here must never break a link. No
// personal data is ever sent — only the link location and the page
// the click happened on. The Panel never loads this file (it is not
// a static page), so Panel clicks are never tracked.
(function () {
  "use strict";

  function pushEvent(name, location) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: name,
        click_location: location,
        page_path: window.location.pathname,
      });
    } catch (e) {
      /* Tracking must never break the page. */
    }
  }

  // Where on the page the link sits, most specific first. The last
  // two fallbacks keep every click labelled even on pages or
  // sections added later.
  function clickLocation(link) {
    if (link.closest("#cs-navigation")) {
      if (link.classList.contains("cs-nav-button")) return "navbar_button";
      if (link.classList.contains("cs-account-btn")) return "navbar_icon";
      if (link.closest(".cs-ul-wrapper")) return "mobile_menu";
      return "navbar";
    }
    if (link.closest("#cs-footer-275")) return "footer";
    if (link.closest("#hero-2335")) return "hero";
    if (link.closest("#cta-2353")) return "cta";
    if (link.closest("#face-explorer")) return "face_explorer";
    if (link.closest(".cs-acciones")) return "tienda_product";
    var section = link.closest("section[id]");
    if (section) return section.id;
    return window.location.pathname;
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var link = target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href");
    if (!href) return;
    var path;
    try {
      var url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      path = url.pathname.replace(/\/$/, "") || "/";
    } catch (e) {
      return;
    }
    if (path === "/reservar") {
      pushEvent("reservar_click", clickLocation(link));
    } else if (path === "/mi-cuenta") {
      pushEvent("mi_cuenta_click", clickLocation(link));
    }
  });
})();
