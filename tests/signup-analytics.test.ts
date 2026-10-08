import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { consumeSignUpAnalytics } from "../client/src/lib/signup-analytics";
import { recordSignUpAnalytics } from "../server/lib/signupAnalytics";
import { SIGNUP_ANALYTICS_COOKIE } from "../shared/signup-analytics";

const measurementId = "G-JFYQ8LKE96";
let sequence = 0;

function browser(method = "email", storageWorks = true) {
  const token = `00000000-0000-0000-0000-${String(++sequence).padStart(12, "0")}`;
  const originalCookie = `${SIGNUP_ANALYTICS_COOKIE}=${token}.${method}`;
  let cookie = originalCookie;
  const storage = new Map<string, string>();
  const events: unknown[][] = [];
  const context = {
    location: { origin: "https://familyroots.family", search: "?email=private@example.com" },
    gtag: (...args: unknown[]) => events.push(args),
    localStorage: {
      getItem: (key: string) => {
        if (!storageWorks) throw new Error("storage unavailable");
        return storage.get(key) || null;
      },
      setItem: (key: string, value: string) => {
        if (!storageWorks) throw new Error("storage unavailable");
        storage.set(key, value);
      },
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: context });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      referrer: "https://familyroots.family/verify?token=private",
      get cookie() { return cookie; },
      set cookie(value: string) { cookie = value.includes("Max-Age=0") ? "" : value; },
    },
  });
  return { context, events, originalCookie, setCookie: (value: string) => { cookie = value; } };
}

afterEach(() => {
  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

test("server analytics signal contains only a random nonce and the real method", () => {
  let recorded: any[] = [];
  recordSignUpAnalytics({ cookie: (...args: any[]) => { recorded = args; } } as any, "email");
  assert.equal(recorded[0], SIGNUP_ANALYTICS_COOKIE);
  assert.match(recorded[1], /^[0-9a-f-]{36}\.email$/);
  assert.equal(recorded[2].path, "/");
  assert.equal(recorded[2].sameSite, "lax");
  assert.equal(recorded[2].maxAge, 600000);
});

test("server analytics failure cannot fail account creation", () => {
  assert.doesNotThrow(() => recordSignUpAnalytics({
    cookie: () => { throw new Error("headers already sent"); },
  } as any, "email"));
});

test("confirmed email signup emits once to the correct property without PII", () => {
  const b = browser();
  consumeSignUpAnalytics(measurementId, true);
  consumeSignUpAnalytics(measurementId, true);
  b.setCookie(b.originalCookie);
  consumeSignUpAnalytics(measurementId, true);
  assert.deepEqual(b.events, [["event", "sign_up", {
    method: "email",
    send_to: measurementId,
    page_location: "https://familyroots.family/register",
    page_referrer: "https://familyroots.family",
    debug_mode: true,
  }]]);
  assert.doesNotMatch(JSON.stringify(b.events), /private|token=|email=/);
});

test("no signal means no event for login, validation errors, or returning accounts", () => {
  const b = browser();
  b.setCookie("");
  consumeSignUpAnalytics(measurementId);
  assert.equal(b.events.length, 0);
});

test("invalid methods and missing measurement IDs never emit", () => {
  const b = browser("google-with-private-data");
  consumeSignUpAnalytics(measurementId);
  assert.equal(b.events.length, 0);
  b.setCookie(`${SIGNUP_ANALYTICS_COOKIE}=00000000-0000-0000-0000-000000000999.email`);
  consumeSignUpAnalytics("");
  assert.equal(b.events.length, 0);
});

test("Replit signup uses its actual method and does not enable production debug mode", () => {
  const b = browser("replit");
  consumeSignUpAnalytics(measurementId);
  assert.equal((b.events[0][2] as any).method, "replit");
  assert.equal((b.events[0][2] as any).debug_mode, undefined);
});

test("disabled browser storage does not break signup or cause a replay", () => {
  const b = browser("email", false);
  consumeSignUpAnalytics(measurementId);
  b.setCookie(b.originalCookie);
  consumeSignUpAnalytics(measurementId);
  assert.equal(b.events.length, 1);
});

test("a later new account emits its own distinct event", () => {
  const b = browser();
  consumeSignUpAnalytics(measurementId);
  b.setCookie(`${SIGNUP_ANALYTICS_COOKIE}=00000000-0000-0000-0000-000000009999.email`);
  consumeSignUpAnalytics(measurementId);
  assert.equal(b.events.length, 2);
});

test("if gtag is unavailable, the signal remains for initialization to consume", () => {
  const b = browser();
  const originalGtag = b.context.gtag;
  (b.context as any).gtag = undefined;
  consumeSignUpAnalytics(measurementId);
  b.context.gtag = originalGtag;
  consumeSignUpAnalytics(measurementId);
  assert.equal(b.events.length, 1);
});
