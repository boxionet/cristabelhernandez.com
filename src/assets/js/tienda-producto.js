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
            // A video stops the moment its slide is no longer active.
            pauseVideosExcept(index);
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

        // Video slides: the small round button at the bottom right
        // plays/pauses. The button state follows the video's own
        // play/pause events, and leaving the slide pauses it.
        var videos = Array.prototype.slice.call(
            gallery.querySelectorAll("video")
        );

        function pauseVideosExcept(index) {
            videos.forEach(function (video) {
                var panel = video.closest("[data-gallery-panel]");
                if (
                    panel &&
                    panel.getAttribute("data-gallery-panel") !== index &&
                    !video.paused
                ) {
                    video.pause();
                }
            });
        }

        videos.forEach(function (video) {
            var panel = video.closest("[data-gallery-panel]");
            var toggle = panel
                ? panel.querySelector("[data-video-toggle]")
                : null;
            if (!toggle) return;
            video.addEventListener("play", function () {
                toggle.classList.add("is-playing");
                toggle.setAttribute("aria-label", "Pausar video");
            });
            video.addEventListener("pause", function () {
                toggle.classList.remove("is-playing");
                toggle.setAttribute("aria-label", "Reproducir video");
            });
            toggle.addEventListener("click", function () {
                if (video.paused) {
                    var pending = video.play();
                    if (pending && pending.catch) {
                        pending.catch(function () {});
                    }
                } else {
                    video.pause();
                }
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

        // Mobile default: the SECOND photo (the middle one) is the one
        // centered when the page loads, with a peek of the first and
        // third photos on either side — like Peachy's mobile gallery.
        // Tablet/desktop keep the first photo (the thumb rail decides).
        //
        // The position is asserted more than once on purpose: on fast
        // (cached) loads, some browsers reset a snap scroller to its
        // start AFTER this script runs, so the initial set alone does
        // not always stick — the slider would open on the first photo
        // when arriving from a link. The re-asserts below only run
        // while the user has not touched the strip, so a photo the
        // user swiped to is never yanked away.
        var mobileQuery = window.matchMedia("(max-width: 767px)");
        var stripTouched = false;

        function centerPanelInstant(index) {
            var target = panels[index];
            if (!main || !target) return;
            var r = target.getBoundingClientRect();
            var sr = main.getBoundingClientRect();
            var want =
                main.scrollLeft +
                (r.left - sr.left) -
                (sr.width - r.width) / 2;
            if (Math.abs(main.scrollLeft - want) <= 2) return;
            // Snap is paused while the position is set, so the snap
            // system cannot pull the strip back to the first photo.
            var prevSnap = main.style.scrollSnapType;
            main.style.scrollSnapType = "none";
            main.scrollLeft = want;
            void main.offsetWidth;
            main.style.scrollSnapType = prevSnap;
        }

        function ensureMobileDefault() {
            if (!mobileQuery.matches) return;
            centerPanelInstant(1);
            setActive("1", false);
        }

        function reassertIfUntouched() {
            if (!stripTouched) ensureMobileDefault();
        }

        if (main) {
            main.addEventListener(
                "pointerdown",
                function () {
                    stripTouched = true;
                },
                { passive: true }
            );
            main.addEventListener(
                "wheel",
                function () {
                    stripTouched = true;
                },
                { passive: true }
            );
        }

        ensureMobileDefault();
        // After first paint, once the page is fully loaded, and once
        // more shortly after — covers late snap/restore resets.
        requestAnimationFrame(reassertIfUntouched);
        if (document.readyState === "complete") {
            reassertIfUntouched();
        } else {
            window.addEventListener("load", reassertIfUntouched);
        }
        setTimeout(reassertIfUntouched, 600);

        window.addEventListener("pageshow", function (event) {
            if (!event.persisted) return;
            // Restored from the back/forward cache: the script does not
            // re-run, so the default is applied again here.
            stripTouched = false;
            ensureMobileDefault();
        });
        if (mobileQuery.addEventListener) {
            mobileQuery.addEventListener("change", function () {
                if (!mobileQuery.matches) return;
                // Entering mobile (resize/rotation): center the photo
                // the user is currently viewing.
                var current = 0;
                panels.forEach(function (p, i) {
                    if (p.classList.contains("is-active")) current = i;
                });
                centerPanelInstant(current);
            });
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
