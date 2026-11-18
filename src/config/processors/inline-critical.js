const fs = require("fs");

// Inline the compiled critical.css into the homepage HTML.
//
// Why: the <link> to critical.css is a render-blocking request on the
// largest-contentful-paint path. Inlining removes the request entirely
// while keeping the styles in exactly the same cascade position (the
// <style> replaces the <link> tag in place, after root.css).
//
// Runs at the end of the sass processor (src/config/processors/sass.js),
// AFTER every stylesheet is written — chained there deliberately, because
// a separate eleventy.after handler raced the sass writes on fresh builds
// and silently left the <link> tag in place. Only the homepage references
// critical.css, so only public/index.html is touched. The compiled CSS
// file is left in place: if inlining ever fails, the <link> fallback in
// the source still resolves.
//
// Fail-safe: on any problem the HTML is left untouched and the reason
// is logged, so a bad inline can never break the build output.
module.exports = function () {
    const cssPath = "./public/assets/css/critical.css";
    const htmlPath = "./public/index.html";

    if (!fs.existsSync(cssPath)) {
        console.error("inline-critical: critical.css not found, leaving the <link> tag in place.");
        return;
    }
    if (!fs.existsSync(htmlPath)) {
        return;
    }

    const css = fs.readFileSync(cssPath, "utf8").trim();
    if (!css) {
        console.error("inline-critical: critical.css is empty, leaving the <link> tag in place.");
        return;
    }

    const html = fs.readFileSync(htmlPath, "utf8");
    // Match the <link> tag regardless of attribute order (the production
    // minifier reorders attributes).
    const linkPattern = /<link[^>]*href="\/assets\/css\/critical\.css"[^>]*>/;
    if (!linkPattern.test(html)) {
        console.error("inline-critical: no critical.css <link> tag found in public/index.html.");
        return;
    }

    const inlined = html.replace(linkPattern, () => `<style>${css}</style>`);
    fs.writeFileSync(htmlPath, inlined);
};
