import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HEARD_VIA_CHOICES,
  normalizeSignupAttribution,
  optionalSignupAttributionSchema,
} from "../shared/signup-attribution";

test("signup attribution uses exactly the requested choices", () => {
  assert.deepEqual(HEARD_VIA_CHOICES, [
    "TikTok", "X", "Reddit", "YouTube", "Friend", "Search", "Other",
  ]);
});

test("signup attribution remains optional", () => {
  const parsed = optionalSignupAttributionSchema.parse({});
  assert.deepEqual(normalizeSignupAttribution(parsed), {
    heardVia: null,
    heardViaOther: null,
  });
});

test("a predefined source discards unrelated Other text", () => {
  const parsed = optionalSignupAttributionSchema.parse({
    heardVia: "Search",
    heardViaOther: "should not persist",
  });
  assert.deepEqual(normalizeSignupAttribution(parsed), {
    heardVia: "Search",
    heardViaOther: null,
  });
});

test("Other requires and normalizes a short explanation", () => {
  assert.equal(optionalSignupAttributionSchema.safeParse({
    heardVia: "Other",
    heardViaOther: "   ",
  }).success, false);
  const parsed = optionalSignupAttributionSchema.parse({
    heardVia: "Other",
    heardViaOther: "  Community event  ",
  });
  assert.deepEqual(normalizeSignupAttribution(parsed), {
    heardVia: "Other",
    heardViaOther: "Community event",
  });
});

test("unknown choices and oversized Other values are rejected", () => {
  assert.equal(optionalSignupAttributionSchema.safeParse({ heardVia: "Instagram" }).success, false);
  assert.equal(optionalSignupAttributionSchema.safeParse({
    heardVia: "Other",
    heardViaOther: "x".repeat(201),
  }).success, false);
});