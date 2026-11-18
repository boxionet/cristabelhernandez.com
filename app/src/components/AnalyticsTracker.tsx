import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  ensureGtmLoaded,
  isPanelPath,
  trackPageView,
} from "../lib/analytics";

// Renders nothing. On every route change outside the Panel, makes
// sure the GTM container is loaded and records a virtual page view
// for the new route, so the booking funnel and Mi Cuenta pages are
// visible step by step in GA4. Panel routes load nothing and send
// nothing (see lib/analytics.ts).
export default function AnalyticsTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (isPanelPath(pathname)) return;
    ensureGtmLoaded();
    trackPageView(pathname);
  }, [pathname]);

  return null;
}
