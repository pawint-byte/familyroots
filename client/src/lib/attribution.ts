import {
  ATTRIBUTION_VERSION,
  type AttributionPayload,
  type AttributionTouch,
  sanitizeAttributionPayload,
} from "@shared/attribution";

export const ATTRIBUTION_STORAGE_KEY = "fr_attribution";
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

type StoredAttribution = AttributionPayload & { expiresAt: string };

function readCookie(): string | null {
  try {
    const prefix = `${ATTRIBUTION_STORAGE_KEY}=`;
    const entry = document.cookie.split("; ").find(value => value.startsWith(prefix));
    return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

function readStoredAttribution(): StoredAttribution | null {
  let localValue: string | null = null;
  try {
    localValue = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  } catch {
    // Cookies remain available as the fallback when local storage is blocked.
  }
  const candidates = [localValue, readCookie()];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as Partial<StoredAttribution>;
      if (!parsed.expiresAt || Date.parse(parsed.expiresAt) <= Date.now()) continue;
      const sanitized = sanitizeAttributionPayload(parsed);
      if (sanitized) return { ...sanitized, expiresAt: parsed.expiresAt };
    } catch {
      // Ignore malformed browser storage and replace it on the next capture.
    }
  }
  return null;
}

function writeStoredAttribution(value: StoredAttribution): void {
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, serialized);
  } catch {
    // The cookie below remains the fallback when local storage is blocked.
  }
  try {
    document.cookie = `${ATTRIBUTION_STORAGE_KEY}=${encodeURIComponent(serialized)}; Max-Age=${Math.floor(
      ATTRIBUTION_TTL_MS / 1000,
    )}; Path=/; SameSite=Lax`;
  } catch {
    // Attribution must never prevent the app from loading.
  }
}

function currentTouch(params: URLSearchParams, referrer: string): AttributionTouch {
  const touch: AttributionTouch = {
    timestamp: new Date().toISOString(),
    landing_path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  };
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) touch[key] = value;
  }
  if (referrer) touch.referrer = referrer;
  return touch;
}

export function captureAttribution(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const hasNewUtm = UTM_KEYS.some(key => Boolean(params.get(key)?.trim()));
  const existing = readStoredAttribution();
  const firstReferrer = existing?.firstTouch.referrer || document.referrer.trim();

  if (!existing) {
    const touch = currentTouch(params, firstReferrer);
    writeStoredAttribution({
      version: ATTRIBUTION_VERSION,
      firstTouch: touch,
      lastTouch: touch,
      expiresAt: new Date(Date.now() + ATTRIBUTION_TTL_MS).toISOString(),
    });
    return;
  }

  if (!hasNewUtm) return;

  writeStoredAttribution({
    ...existing,
    lastTouch: currentTouch(params, firstReferrer),
    expiresAt: new Date(Date.now() + ATTRIBUTION_TTL_MS).toISOString(),
  });
}

export function getSignupAttributionPayload(): { attribution?: AttributionPayload } {
  if (typeof window === "undefined" || typeof document === "undefined") return {};
  const stored = readStoredAttribution();
  if (!stored) return {};
  const { expiresAt: _expiresAt, ...attribution } = stored;
  return { attribution };
}