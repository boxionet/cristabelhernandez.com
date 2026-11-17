/* Gallery + accordions + AM/PM routine for the Tienda product pages. Vanilla, no dependencies. */
(function () {
    var gallery = document.querySelector("[data-gallery]");
    if (gallery) {
        var thumbs = Array.prototype.slice.call(
            gallery.querySelectorAll("[data-gallery-thumb]")
        );
        var panels = Array.prototype.slice.call(
            gallery.querySelectorAll("[data-gallery-panel]")
        );
        var dots = Array.prototype.slice.call(
            gallery.querySelectorAll("[data-gallery-dot]")
        );
        var main = gallery.querySelector(".cs-main");

        function setActive(index, scroll) {
            thumbs.forEach(function (t) {
                var on = t.getAttribute("data-gallery-thumb") === index;
                t.classList.toggle("is-active", on);
                t.setAttribute("aria-pressed", on ? "true" : "false");
            });
            panels.forEach(function (p) {
                p.classList.toggle(
                    "is-active",
                    p.getAttribute("data-gallery-panel") === index
                );
            });
            dots.forEach(function (d) {
                var on = d.getAttribute("data-gallery-dot") === index;
                d.classList.toggle("is-active", on);
                d.setAttribute("aria-pressed", on ? "true" : "false");
            });
            // On mobile the main area is a swipe strip: scroll the chosen
            // photo into view. On tablet/desktop only one panel is
            // displayed, so this is a no-op there.
            if (scroll && main) {
                main.scrollTo({
                    left: parseInt(index, 10) * main.clientWidth,
                    behavior: "smooth",
                });
            }
        }

        thumbs.forEach(function (thumb) {
            thumb.addEventListener("click", function () {
                setActive(thumb.getAttribute("data-gallery-thumb"), true);
            });
        });
        dots.forEach(function (dot) {
            dot.addEventListener("click", function () {
                setActive(dot.getAttribute("data-gallery-dot"), true);
            });
        });

        // Keep thumbs, panels and dots in sync while the user swipes
        // through the photos on mobile.
        var ticking = false;
        if (main) {
            main.addEventListener(
                "scroll",
                function () {
                    if (ticking) return;
                    ticking = true;
                    requestAnimationFrame(function () {
                        var index = Math.round(
                            main.scrollLeft / main.clientWidth
                        );
                        index = Math.max(0, Math.min(panels.length - 1, index));
                        setActive(String(index), false);
                        ticking = false;
                    });
                },
                { passive: true }
            );
        }
    }

    var accButtons = document.querySelectorAll("[data-acc-button]");
    accButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            var item = button.closest(".cs-acc");
            var willOpen = !item.classList.contains("is-open");
            document
                .querySelectorAll(".cs-acc.is-open")
                .forEach(function (openItem) {
                    openItem.classList.remove("is-open");
                    openItem
                        .querySelector("[data-acc-button]")
                        .setAttribute("aria-expanded", "false");
                });
            if (willOpen) {
                item.classList.add("is-open");
                button.setAttribute("aria-expanded", "true");
            }
        });
    });

    var rutinaToggles = document.querySelectorAll("[data-rutina-toggle]");
    var rutinaPanels = document.querySelectorAll("[data-rutina-panel]");
    rutinaToggles.forEach(function (toggle) {
        toggle.addEventListener("click", function () {
            var target = toggle.getAttribute("data-rutina-toggle");
            rutinaToggles.forEach(function (t) {
                var on = t === toggle;
                t.classList.toggle("is-active", on);
                t.setAttribute("aria-pressed", on ? "true" : "false");
            });
            rutinaPanels.forEach(function (panel) {
                panel.classList.toggle(
                    "is-active",
                    panel.getAttribute("data-rutina-panel") === target
                );
            });
        });
    });
})();
