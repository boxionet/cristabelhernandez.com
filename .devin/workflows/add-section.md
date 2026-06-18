---
description: How to add a new section/component to a page following project conventions
---

# Adding a New Section to a Page

## HTML Structure

Every section follows the CodeStitch pattern:

```html
<!-- ============================================ -->
<!--                Section Name                   -->
<!-- ============================================ -->

<section id="section-name-NUMBER">
    <div class="cs-container">
        <div class="cs-content">
            <span class="cs-topper">Section Label</span>
            <h2 class="cs-title">Section Heading</h2>
            <p class="cs-text">
                Section body text.
            </p>
            <a href="/link/" class="cs-button-solid">CTA Text</a>
        </div>
    </div>
</section>
```

## SCSS Structure

Add styles to the page's corresponding SCSS file (`src/assets/sass/<page-name>.scss`):

```scss
/*-- -------------------------- -->
<---        Section Name        -->
<--- -------------------------- -*/

/* Mobile - 360px */
@media only screen and (min-width: 0rem) {
    #section-name-NUMBER {
        padding: var(--sectionPadding);

        .cs-container {
            width: 100%;
            max-width: calc(1280 / 16 * 1rem);
            margin: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            /* 48px - 64px */
            gap: clamp(3rem, 6vw, 4rem);
        }

        .cs-content {
            text-align: left;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .cs-text {
            margin-bottom: calc(16 / 16 * 1rem);
            &:last-of-type {
                margin-bottom: calc(32 / 16 * 1rem);
            }
        }
    }
}

/* Desktop - 1024px */
@media only screen and (min-width: 64rem) {
    #section-name-NUMBER {
        /* Desktop overrides here */
    }
}
```

## Responsive Images

If the section includes images, use the `<picture>` pattern with Sharp image plugin:

```html
<picture class="cs-picture">
    <!--Mobile Image-->
    <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 640, height: 400 }) | avif %}" type="image/avif">
    <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 640, height: 400 }) | webp %}" type="image/webp">
    <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 640, height: 400 }) | jpeg %}" type="image/jpeg">
    <!--Tablet Image-->
    <source media="(max-width: 1024px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 1024, height: 600 }) | avif %}" type="image/avif">
    <source media="(max-width: 1024px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 1024, height: 600 }) | webp %}" type="image/webp">
    <source media="(max-width: 1024px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 1024, height: 600 }) | jpeg %}" type="image/jpeg">
    <!--Desktop Image-->
    <source media="(min-width: 1024px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 1280, height: 800 }) | avif %}" type="image/avif">
    <source media="(min-width: 1024px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 1280, height: 800 }) | webp %}" type="image/webp">
    <source media="(min-width: 1024px)" srcset="{% getUrl '/assets/images/image.jpg' | resize({ width: 1280, height: 800 }) | jpeg %}" type="image/jpeg">
    <img src="{% getUrl '/assets/images/image.jpg' | resize({ width: 1280, height: 800 }) | jpeg %}" alt="descriptive alt text" width="640" height="400" loading="lazy" decoding="async">
</picture>
```

## Conventions
- Use `calc(X / 16 * 1rem)` for pixel-to-rem conversion
- Use `clamp(min, preferred, max)` for fluid sizing
- Section padding: `var(--sectionPadding)`
- Max container width: `calc(1280 / 16 * 1rem)`
- All class names prefixed with `cs-`
- `aria-hidden="true"` on decorative images
- `loading="lazy"` and `decoding="async"` on all non-hero images
