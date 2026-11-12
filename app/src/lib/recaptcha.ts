// Invisible reCAPTCHA v2 for guest bookings — same site key as the
// contact form. Framework-free: the Datos step renders the hidden
// container div, this module loads the script, renders the widget
// once, and resolves a token per submission.
//
// Semantics (ported from the static booking page): getCaptchaToken()
// resolves null when the script is blocked, the widget fails, or the
// challenge times out after 8s — the server then rejects the
// submission, and the UI surfaces the clinic phone number.

const SITE_KEY = "6Lc7RxUuAAAAAG4ixBIT1XhyFRemeELPADIXthm4";
const SCRIPT_SRC =
  "https://www.google.com/recaptcha/api.js?render=explicit";
const CONTAINER_ID = "booking-recaptcha";
const TOKEN_TIMEOUT_MS = 8000;

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: string | HTMLElement,
        params: Record<string, unknown>,
      ) => number;
      execute: (widgetId: number) => void;
      reset?: (widgetId: number) => void;
    };
    __bookingCaptchaOnLoad?: () => void;
  }
}

let scriptPromise: Promise<boolean> | null = null;
let widgetId: number | null = null;
let pendingResolvers: Array<(token: string | null) => void> = [];

function loadScript(): Promise<boolean> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.grecaptcha) return resolve(true);
    const existing = document.querySelector(
      `script[src^="https://www.google.com/recaptcha/api.js"]`,
    );
    if (existing) {
      // Another loader owns the script; poll briefly for grecaptcha.
      const started = Date.now();
      const tick = () => {
        if (window.grecaptcha) return resolve(true);
        if (Date.now() - started > TOKEN_TIMEOUT_MS) return resolve(false);
        setTimeout(tick, 200);
      };
      tick();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.grecaptcha));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function ensureWidget(): number | null {
  if (widgetId !== null) return widgetId;
  const grecaptcha = window.grecaptcha;
  const container = document.getElementById(CONTAINER_ID);
  if (!grecaptcha || !container) return null;
  try {
    widgetId = grecaptcha.render(container, {
      sitekey: SITE_KEY,
      size: "invisible",
      callback: (token: string) => {
        const resolvers = pendingResolvers;
        pendingResolvers = [];
        resolvers.forEach((r) => r(token || null));
      },
      "error-callback": () => {
        const resolvers = pendingResolvers;
        pendingResolvers = [];
        resolvers.forEach((r) => r(null));
      },
    });
    return widgetId;
  } catch {
    return null;
  }
}

/** The container id the Datos step must render for the widget. */
export const RECAPTCHA_CONTAINER_ID = CONTAINER_ID;

/**
 * Warms the widget ahead of submission (call on the Datos step's
 * mount) so the token request at submit time is instant.
 */
export async function warmCaptcha(): Promise<void> {
  const ok = await loadScript();
  if (ok) ensureWidget();
}

/** Resolves a fresh captcha token, or null when unavailable. */
export async function getCaptchaToken(): Promise<string | null> {
  const ok = await loadScript();
  if (!ok) return null;
  const id = ensureWidget();
  const grecaptcha = window.grecaptcha;
  if (id === null || !grecaptcha) return null;
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    pendingResolvers.push(done);
    try {
      grecaptcha.execute(id);
    } catch {
      done(null);
    }
    setTimeout(() => done(null), TOKEN_TIMEOUT_MS);
  });
}
