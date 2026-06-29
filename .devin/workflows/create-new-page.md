---
description: How to create a new page in the Cristabel Hernandez website
---

# Creating a New Page

## Steps

1. Create the HTML file at `src/content/pages/<page-name>.html` with this structure:

```html
---
title: "Page Title | Dra. Cristabel Hernandez"
description: "Meta description in Spanish for SEO"
permalink: "/<page-slug>/"
---

{% extends "layouts/base.html" %} {% block head %}
<link rel="stylesheet" href="/assets/css/<page-name>.css" />
{% endblock %} {% block body %}
<!-- Page sections go here -->
{% endblock %}
```

2. Create a corresponding SCSS file at `src/assets/sass/<page-name>.scss`

3. Add the navigation link in `src/_includes/sections/header.html` following the pattern:

```html
<li class="cs-li">
  <a
    href="/<page-slug>/"
    class="cs-li-link {% if page.url == '/<page-slug>/' %} cs-active {% endif %}"
  >
    Link Text
  </a>
</li>
```

4. Update the footer in `src/_includes/sections/footer.html` if the page should appear there.

5. The page is automatically added to the sitemap via `content/content.json` (tags: "sitemap").

## Notes

- Permalinks must have trailing slashes
- Use Spanish text for titles, descriptions, and content
- Page-specific CSS is loaded via the `{% block head %}` block
- All content is inside `{% block body %}` (base.html provides the `<main>` wrapper)
- Section IDs follow pattern: `#section-name-number` (e.g., `#faq-1458`)
