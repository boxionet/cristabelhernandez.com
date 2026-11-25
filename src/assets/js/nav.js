// Select DOM elements
const bodyElement = document.querySelector("body");
const navbarMenu = document.querySelector("#cs-navigation");
const hamburgerMenu = document.querySelector("#cs-navigation .cs-toggle");

// Function to toggle the aria-expanded attribute
function toggleAriaExpanded(element) {
    const isExpanded = element.getAttribute("aria-expanded");
    element.setAttribute("aria-expanded", isExpanded === "false" ? "true" : "false");
}

// Function to toggle the menu open or closed
function toggleMenu() {
    hamburgerMenu.classList.toggle("cs-active");
    navbarMenu.classList.toggle("cs-active");
    bodyElement.classList.toggle("cs-open");
    toggleAriaExpanded(hamburgerMenu);
    // Menu just opened on mobile: the user is about to pick a top-level
    // page, so prefetch those pages' first photos now (blog, tienda).
    if (navbarMenu.classList.contains("cs-active")) {
        prefetchPhotosFor("/blog/");
        prefetchPhotosFor("/tienda/");
    }
}

// Add click event listener to the hamburger menu
hamburgerMenu.addEventListener("click", toggleMenu);

// Add click event listener to the navbar menu to handle clicks on the pseudo-element
navbarMenu.addEventListener("click", function (event) {
    if (event.target === navbarMenu && navbarMenu.classList.contains("cs-active")) {
        toggleMenu();
    }
});

// Function to handle dropdown toggle
function toggleDropdown(element) {
    element.classList.toggle("cs-active");
    const dropdownButton = element.querySelector(".cs-dropdown-button");
    if (dropdownButton) {
        toggleAriaExpanded(dropdownButton);
    }
}

// Add event listeners to each dropdown element for accessibility
const dropdownElements = document.querySelectorAll(".cs-dropdown");
dropdownElements.forEach(element => {
    let escapePressed = false;

    element.addEventListener("focusout", function (event) {
        // Skip the focusout logic if escape was pressed
        if (escapePressed) {
            escapePressed = false;
            return;
        }

        // If the focus has moved outside the dropdown, remove the active class from the dropdown 
        if (!element.contains(event.relatedTarget)) {
            element.classList.remove("cs-active");
            const dropdownButton = element.querySelector(".cs-dropdown-button");

            if (dropdownButton) {
                toggleAriaExpanded(dropdownButton);
            }
        }
    });

    element.addEventListener("keydown", function (event) {
        if (element.classList.contains("cs-active")) {
            event.stopPropagation();
        }

        // Pressing Enter or Space will toggle the dropdown and adjust the aria-expanded attribute
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleDropdown(element);
        }

        // Pressing Escape will remove the active class from the dropdown. The stopPropagation above will stop the hamburger menu from closing
        if (event.key === "Escape") {
            escapePressed = true;
            toggleDropdown(element);
        }
    });

    // Handles dropdown menus on mobile - the matching media query (max-width: 63.9375rem) is necessary so that clicking the dropdown button on desktop does not add the active class and thus interfere with the hover state
    const maxWidthMediaQuery = window.matchMedia("(max-width: 63.9375rem)");
    if (maxWidthMediaQuery.matches) {
        element.addEventListener("click", () => {
            toggleDropdown(element);
            // Dropdown just opened: prefetch its destinations' first
            // photos, so they are cached when the user taps one.
            if (element.classList.contains("cs-active")) {
                element.querySelectorAll(".cs-drop-li > a").forEach((a) => {
                    prefetchPhotosFor(a.getAttribute("href"));
                });
            }
        });
    }
});

// Pressing Enter will redirect to the href
const dropdownLinks = document.querySelectorAll(".cs-drop-li > .cs-li-link");
dropdownLinks.forEach(link => {
    link.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            window.location.href = this.href;
        }
    });
});

// If you press Escape and the hamburger menu is open, close it
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && hamburgerMenu.classList.contains("cs-active")) {
        toggleMenu();
    }
});

// Prefetch a destination's first photo(s) before the user taps it, so the
// photo is already cached when the new page reveals (no late-arriving
// flash — same approach that fixed the hero pop-in). Triggered by real
// intent signals only (menu open, dropdown expand, link hover/focus),
// never on page load, so a first visit stays light. URLs must match the
// variant the browser will actually request: the <picture> serves a
// mobile AVIF at <=600px and a desktop AVIF above it, so pick by the
// same breakpoint — prefetching the JPEG fallback would download a
// second, unused file.
const NAV_PHOTO_PREFETCH = {
    "/tratamientos-faciales/": [
        { mobile: "/assets/images/tratamiento-facial-ff3154ee.avif", desktop: "/assets/images/tratamiento-facial-9357eabc.avif" },
    ],
    "/tratamientos-corporales/": [
        { mobile: "/assets/images/tratamiento-corporal-2eb542f9.avif", desktop: "/assets/images/tratamiento-corporal-9bbcbe31.avif" },
    ],
    "/nosotros/": [
        { mobile: "/assets/images/doctora-sbs-f50b469b.avif", desktop: "/assets/images/doctora-sbs-11fa8f41.avif" },
    ],
    "/resultados/": [
        { mobile: "/assets/images/resultado-antes-real-6877afcf.avif", desktop: "/assets/images/resultado-antes-real-00c827a2.avif" },
        { mobile: "/assets/images/resultado-despues-real-61c30c02.avif", desktop: "/assets/images/resultado-despues-real-33ecaaf7.avif" },
    ],
    "/blog/": [
        { mobile: "/assets/images/radiant-beauty-in-a-serene-spa-70b42a96.avif", desktop: "/assets/images/radiant-beauty-in-a-serene-spa-1cff908d.avif" },
    ],
    "/tienda/": [
        { mobile: "/assets/images/tizo3-studio-b73a9417.avif", desktop: "/assets/images/tizo3-studio-da0a3133.avif" },
    ],
};
const prefetchedPhotos = new Set();
function prefetchPhotosFor(href) {
    const isMobile = window.matchMedia("(max-width: 600px)").matches;
    (NAV_PHOTO_PREFETCH[href] || []).forEach((variant) => {
        const src = isMobile ? variant.mobile : variant.desktop;
        if (prefetchedPhotos.has(src)) return;
        prefetchedPhotos.add(src);
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "image";
        link.href = src;
        document.head.appendChild(link);
    });
}

// Desktop hover / keyboard focus on a nav link: prefetch its photos.
document.querySelectorAll("#cs-navigation a[href]").forEach((a) => {
    a.addEventListener("mouseenter", () => prefetchPhotosFor(a.getAttribute("href")));
    a.addEventListener("focus", () => prefetchPhotosFor(a.getAttribute("href")));
});

// Show the slim progress bar the moment a link is tapped, not only when
// the transition starts: pageswap fires after the new page's HTML and CSS
// have downloaded, and until then the old page sits there looking frozen.
// A tap on any internal link shows the bar immediately; the new page is
// a fresh document, so the class is gone on arrival.
document.addEventListener("pageswap", () => {
    document.documentElement.classList.add("is-navigating");
});
document.querySelectorAll('a[href^="/"]').forEach((a) => {
    a.addEventListener("click", () => {
        document.documentElement.classList.add("is-navigating");
    });
});
