// Services catalog for the static marketing pages, fetched from Supabase
// at build time so a Panel edit (add / rename / description / deactivate)
// flows to /tratamientos-faciales/, /tratamientos-corporales/ and the
// face explorer on the next deploy — no hardcoded copy left to drift.
// Throws loudly when the env vars are missing or the fetch fails: a build
// must never ship empty treatment pages by accident.
//
// Env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (the same values
// the booking app uses; already set on Netlify. Locally, run
// node ~/workspace/cristabel-flow-verify/extract-supabase-env.mjs and
// source /tmp/supabase-env.sh before building.)
"use strict";

// Icon per treatment, from the icons the hardcoded pages used. Anything
// without an entry (e.g. a treatment added in the Panel) falls back to
// the generic sparkle badge in servicio-default.svg.
const ICON_BY_SLUG = {
  "toxina-frontal": "servicio-toxina.svg",
  "toxina-full-face": "servicio-toxina.svg",
  microneedling: "servicio-microneedling.svg",
  "mesoterapia-facial": "servicio-mesoterapia.svg",
  "prp-facial": "servicio-prp.svg",
  "peelings-quimicos": "servicio-peelings.svg",
  "rejuvenecimiento-cuello": "servicio-rejuvenecimiento.svg",
  "rejuvenecimiento-escote": "servicio-rejuvenecimiento.svg",
  "rejuvenecimiento-manos": "servicio-rejuvenecimiento.svg",
  "rejuvenecimiento-facial-profhilo": "servicio-rejuvenecimiento.svg",
  escleroterapia: "servicio-escleroterapia.svg",
  "lipolisis-menton": "servicio-lipolisis.svg",
  "lipolisis-localizada": "servicio-localizada.svg",
  "anticelulitico-alidya": "servicio-anticelulitico.svg",
};

const DEFAULT_ICON = "servicio-default.svg";

// One fetch per build, shared with faceExplorer.js (which requires this
// module) so the catalog is fetched once however many data files use it.
let cached = null;

async function fetchServices() {
  if (cached) return cached;
  cached = (async () => {
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        "[services] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set to build the treatment pages (Netlify already has them; locally source /tmp/supabase-env.sh after running extract-supabase-env.mjs).",
      );
    }
    const endpoint =
      `${url}/rest/v1/services` +
      "?select=slug,name,description,category,sort_order" +
      "&active=eq.true&order=sort_order.asc";
    let res;
    try {
      res = await fetch(endpoint, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
    } catch (err) {
      throw new Error(`[services] Could not reach Supabase: ${err.message}`);
    }
    if (!res.ok) {
      throw new Error(
        `[services] Supabase catalog fetch failed: ${res.status} ${res.statusText}`,
      );
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(
        "[services] Supabase returned no active services — refusing to build empty treatment pages.",
      );
    }
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
      category: row.category,
      sort_order: row.sort_order,
      icon: ICON_BY_SLUG[row.slug] || DEFAULT_ICON,
    }));
  })();
  return cached;
}

module.exports = fetchServices;
