import { SIGNUP_ANALYTICS_COOKIE } from "../../../shared/signup-analytics";

const consumedSignals = new Set<string>();

export function consumeSignUpAnalytics(measurementId: string, debugMode = false): void {
  if (typeof window === "undefined" || !window.gtag || !measurementId) return;

  try {
    const cookie = document.cookie.split(";").map(value => value.trim())
      .find(value => value.startsWith(`${SIGNUP_ANALYTICS_COOKIE}=`));
    if (!cookie) return;
    const signal = decodeURIComponent(cookie.slice(SIGNUP_ANALYTICS_COOKIE.length + 1));
    const match = /^([0-9a-f-]{36})\.(email|replit)$/.exec(signal);
    if (!match) return;

    const key = `fr_ga4_signup_consumed_${match[1]}`;
    let alreadyConsumed = consumedSignals.has(key);
    try {
      alreadyConsumed ||= window.localStorage.getItem(key) === "true";
    } catch {
      // Cookie deletion and the in-memory guard still work without localStorage.
    }

    if (!alreadyConsumed) {
      window.gtag("event", "sign_up", {
        method: match[2],
        send_to: measurementId,
        // Never transmit email-prefill parameters or verification/OAuth tokens.
        page_location: `${window.location.origin}${match[2] === "email" ? "/register" : "/"}`,
        page_referrer: document.referrer ? new URL(document.referrer).origin : "",
        ...(debugMode ? { debug_mode: true } : {}),
      });
      consumedSignals.add(key);
      try {
        window.localStorage.setItem(key, "true");
      } catch {
        // Analytics storage failures must not affect signup.
      }
    }
    document.cookie = `${SIGNUP_ANALYTICS_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    console.warn("GA4 sign_up could not be queued");
  }
}
