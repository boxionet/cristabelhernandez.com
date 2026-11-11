import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One app, two gated areas (plan §2): /mi-cuenta/* (patients) and
// /panel/* (staff). Netlify redirects both prefixes to /app/index.html;
// the router decides the area from the path. The build lands inside the
// Eleventy output (public/app) and never touches the public site.
export default defineConfig({
  base: "/app/",
  plugins: [react()],
  build: {
    outDir: "../public/app",
    emptyOutDir: true,
  },
});
