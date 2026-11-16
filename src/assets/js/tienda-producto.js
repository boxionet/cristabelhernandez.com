/* Gallery + accordions for the Tienda product page. Vanilla, no dependencies. */
(function () {
    var gallery = document.querySelector("[data-gallery]");
    if (gallery) {
        var thumbs = Array.prototype.slice.call(
            gallery.querySelectorAll("[data-gallery-thumb]")
        );
        var panels = Array.prototype.slice.call(
            gallery.querySelectorAll("[data-gallery-panel]")
        );
        thumbs.forEach(function (thumb) {
            thumb.addEventListener("click", function () {
                var index = thumb.getAttribute("data-gallery-thumb");
                thumbs.forEach(function (t) {
                    var on = t === thumb;
                    t.classList.toggle("is-active", on);
                    t.setAttribute("aria-pressed", on ? "true" : "false");
                });
                panels.forEach(function (p) {
                    p.classList.toggle(
                        "is-active",
                        p.getAttribute("data-gallery-panel") === index
                    );
                });
            });
        });
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
})();
