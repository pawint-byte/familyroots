import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATTRIBUTION_VERSION,
  getLegacyUtmFields,
  sanitizeAttributionPayload,
} from "../shared/attribution";
import {
  ATTRIBUTION_STORAGE_KEY,
  captureAttribution,
  getSignupAttributionPayload,
} from "../client/src/lib/attribution";

const validPayload = {
  version: ATTRIBUTION_VERSION,
  firstTouch: {
    utm_source: "youtube",
    referrer: "https://example.com/video",
    landing_path: "/register?utm_source=youtube",
    timestamp: "2026-09-16T12:00:00.000Z",
  },
  lastTouch: {
    utm_source: "newsletter",
    utm_medium: "email",
    landing_path: "/join/abc?utm_source=newsletter&utm_medium=email",
    timestamp: "2026-09-17T12:00:00.000Z",
  },
};

test("sanitizes attribution to the supported version and touch fields", () => {
  const sanitized = sanitizeAttributionPayload({
    ...validPayload,
    expiresAt: "2026-10-16T12:00:00.000Z",
    unexpected: "discard me",
    firstTouch: { ...validPayload.firstTouch, secret: "discard me" },
  });

  assert.deepEqual(sanitized, validPayload);
});

test("rejects malformed timestamps and oversized attribution strings", () => {
  assert.equal(sanitizeAttributionPayload({
    ...validPayload,
    firstTouch: { ...validPayload.firstTouch, timestamp: "not-a-date" },
  }), null);
  assert.equal(sanitizeAttributionPayload({
    ...validPayload,
    lastTouch: { ...validPayload.lastTouch, utm_term: "x".repeat(201) },
  }), null);
});

test("legacy UTM fields prefer first touch and fall back to last touch", () => {
  const sanitized = sanitizeAttributionPayload({
    ...validPayload,
    firstTouch: {
      utm_source: "youtube",
      landing_path: "/",
      timestamp: "2026-09-16T12:00:00.000Z",
    },
  });

  assert.deepEqual(getLegacyUtmFields(sanitized), {
    utmSource: "youtube",
    utmMedium: "email",
    utmCampaign: null,
  });
});

test("client capture freezes first touch and updates last touch only for new UTMs", () => {
  const values = new Map<string, string>();
  const location = {
    pathname: "/register",
    search: "?utm_source=youtube&utm_campaign=launch",
    hash: "",
  };
  let cookie = "";

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location,
      localStorage: {
        getItem: (key: string) => values.get(key) || null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      referrer: "https://search.example/result",
      get cookie() { return cookie; },
      set cookie(value: string) { cookie = value; },
    },
  });

  captureAttribution();
  const first = getSignupAttributionPayload().attribution!;
  assert.equal(first.firstTouch.utm_source, "youtube");
  assert.equal(first.firstTouch.referrer, "https://search.example/result");
  assert.equal(first.firstTouch.landing_path, "/register?utm_source=youtube&utm_campaign=launch");
  assert.equal(values.has(ATTRIBUTION_STORAGE_KEY), true);
  assert.match(cookie, /^fr_attribution=/);

  location.pathname = "/pricing";
  location.search = "?plan=free";
  captureAttribution();
  assert.deepEqual(getSignupAttributionPayload().attribution, first);

  location.pathname = "/join/abc";
  location.search = "?utm_source=newsletter&utm_medium=email";
  (globalThis.document as any).referrer = "https://later.example/";
  captureAttribution();
  const updated = getSignupAttributionPayload().attribution!;
  assert.deepEqual(updated.firstTouch, first.firstTouch);
  assert.equal(updated.lastTouch.utm_source, "newsletter");
  assert.equal(updated.lastTouch.utm_medium, "email");
  assert.equal(updated.lastTouch.referrer, "https://search.example/result");
  assert.equal(updated.lastTouch.landing_path, "/join/abc?utm_source=newsletter&utm_medium=email");

  delete (globalThis as any).window;
  delete (globalThis as any).document;
});