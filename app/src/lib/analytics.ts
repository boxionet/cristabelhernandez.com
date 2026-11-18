// Google Tag Manager for the React app (the booking flow and Mi
// Cuenta). Same container as the static pages (GTM-KR663M52, supplied
// by the site owner 2026-11-16; the container already carries the
// GA4 tag G-EVBG5T80N5).
//
// The SPA has no full page loads, so two things happen here instead
// of a static <script> tag:
//
//   1. The container is injected on the first non-Panel route, with
//      the standard GTM bootstrap (the gtm.start push, then gtm.js).
//   2. Every route change pushes a virtual page_view carrying the
//      pathname only, so the booking funnel (start -> tratamientos
//      -> fecha-hora -> verificar -> datos -> revision ->
//      confirmacion) and the Mi Cuenta pages show up as page views
//      in GA4, one per step the patient actually reaches.
//
// Panel exclusion: isPanelPath gates both the loader and every
// event. A session that starts on /panel never loads the container
// and never sends anything. (Edge case, accepted in the plan: if
// someone navigates from a tracked area into the Panel without a
// reload, the already-loaded container stays in memory, but no
// Panel event is ever pushed.)
//
// Privacy: only pathnames and aggregate booking facts are sent.
// Query strings are stripped (the confirmation URL carries the
// booking reference), and names, emails, and phone numbers are
// never pushed.

export const GTM_CONTAINER_ID = "GTM-KR663M52";

const GTM_SCRIPT_SRC = `https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`;

type DataLayer = Array<Record<string, unknown>>;

function getDataLayer(): DataLayer {
  const w = window as unknown as { dataLayer?: DataLayer };
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  return w.dataLayer;
}

/** True for /panel and everything under it. */
export function isPanelPath(pathname: string): boolean {
  return pathname === "/panel" || pathname.startsWith("/panel/");
}

let gtmLoaded = false;

/**
 * Inject the GTM container once, using the standard bootstrap: push
 * the gtm.start event, then insert gtm.js before the first script.
 * Safe to call on every route change; later calls are no-ops.
 */
export function ensureGtmLoaded(): void {
  if (gtmLoaded) return;
  if (document.querySelector(`script[src="${GTM_SCRIPT_SRC}"]`)) {
    gtmLoaded = true;
    return;
  }
  try {
    getDataLayer().push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js",
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = GTM_SCRIPT_SRC;
    const first = document.getElementsByTagName("script")[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else document.head.appendChild(script);
    gtmLoaded = true;
  } catch {
    // Tracking must never break the app.
  }
}

/** Push one event to the dataLayer. Never throws. */
export function pushAnalyticsEvent(
  event: string,
  params: Record<string, unknown> = {},
): void {
  try {
    getDataLayer().push({ event, ...params });
  } catch {
    // Tracking must never break the app.
  }
}

/**
 * Virtual page view for one SPA route. Pathname only — the query
 * string is deliberately dropped (see the privacy note above).
 */
export function trackPageView(pathname: string): void {
  pushAnalyticsEvent("page_view", {
    page_path: pathname,
    page_location: `${window.location.origin}${pathname}`,
  });
}

/**
 * Fired once per successful booking submit, from the revision step.
 * booking_identity is how the patient passed verification
 * ("verified" | "guest" | "unknown"); customer_type is "new" |
 * "returning" | "unknown". No patient data is included.
 */
export function trackBookingCompleted({
  identity,
  customerType,
  serviceCount,
}: {
  identity: string | null;
  customerType: string | null;
  serviceCount: number;
}): void {
  pushAnalyticsEvent("booking_completed", {
    booking_identity: identity ?? "unknown",
    customer_type: customerType ?? "unknown",
    service_count: serviceCount,
  });
}
