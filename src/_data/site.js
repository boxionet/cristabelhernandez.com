// Temporary-closure switch.
//
// Flip `closed` to `true` to show the logo-only cover on every page of the
// site (see src/_includes/layouts/base.html and src/_includes/cover.html,
// plus the booking-app gate in app/index.html). Flip it back to `false`
// to reopen. One line, one deploy — no reverts, no redirect rules.
//
// Note: /admin (Decap CMS) and robots.txt / sitemap.xml are not covered —
// same as the November 2026 closure. The app shell keeps its own noindex.
module.exports = {
  closed: false,
};
