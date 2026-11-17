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
            // Center the chosen photo in the strip. The mobile carousel
            // has side gutters + peeks, so the target offset is computed
            // from the panel's position, not from the strip width.
            // On tablet/desktop there is no scrollable overflow, so
            // this is a no-op there.
            if (scroll && main) {
                var target = panels[parseInt(index, 10)];
                if (target) {
                    var r = target.getBoundingClientRect();
                    var sr = main.getBoundingClientRect();
                    main.scrollTo({
                        left:
                            main.scrollLeft +
                            (r.left - sr.left) -
                            (sr.width - r.width) / 2,
                        behavior: "smooth",
                    });
                }
            }
        }

        thumbs.forEach(function (thumb) {
            thumb.addEventListener("click", function () {
                setActive(thumb.getAttribute("data-gallery-thumb"), true);
            });
        });

        // Keep thumbs and panels in sync while the user swipes
        // through the photos on mobile.
        var ticking = false;
        if (main) {
            main.addEventListener(
                "scroll",
                function () {
                    if (ticking) return;
                    ticking = true;
                    requestAnimationFrame(function () {
                        // The active photo is the one nearest the strip's
                        // visible center (centered carousel with peeks).
                        var sr = main.getBoundingClientRect();
                        var center = sr.left + sr.width / 2;
                        var best = 0;
                        var bestDist = Infinity;
                        panels.forEach(function (p, i) {
                            var r = p.getBoundingClientRect();
                            var d = Math.abs(r.left + r.width / 2 - center);
                            if (d < bestDist) {
                                bestDist = d;
                                best = i;
                            }
                        });
                        setActive(String(best), false);
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
            var group = toggle.closest(".cs-toggle");
            if (group) {
                group.classList.toggle("is-pm", target === "pm");
            }
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
