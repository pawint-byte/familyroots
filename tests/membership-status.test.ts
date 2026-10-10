import assert from "node:assert/strict";
import test from "node:test";
import { getMembershipStatus } from "../server/membership-status";

test("free accounts are explicitly free Explorer", () => {
  assert.deepEqual(getMembershipStatus({}), { kind: "free", tier: "explorer" });
});

test("active purchased membership includes the purchased tier", () => {
  for (const premiumTier of ["cultivator", "heritage", "legacy"] as const) {
    assert.deepEqual(getMembershipStatus({
      isPremium: true, isSubscriptionActive: true, stripeSubscriptionId: "sub_example", premiumTier,
    }), { kind: "paid", tier: premiumTier });
  }
});

test("admin entitlement never claims to be a paid Legacy subscription", () => {
  assert.deepEqual(getMembershipStatus({ isAdmin: true, premiumTier: "legacy" }), { kind: "admin", tier: "legacy" });
  assert.deepEqual(getMembershipStatus({
    isAdmin: true, isPremium: true, isSubscriptionActive: true, stripeSubscriptionId: "sub_example", premiumTier: "cultivator",
  }), { kind: "paid", tier: "cultivator" });
});

test("included or gifted tier access is not labeled paid", () => {
  assert.deepEqual(getMembershipStatus({ isPremium: true, premiumTier: "heritage" }), { kind: "included", tier: "heritage" });
  assert.deepEqual(getMembershipStatus({
    isPremium: true, premiumTier: "heritage", stripeSubscriptionId: "sub_old", isSubscriptionActive: false,
  }), { kind: "included", tier: "heritage" });
});

test("a one-time purchase customer or unknown tier does not imply paid membership", () => {
  assert.deepEqual(getMembershipStatus({ isPremium: false, premiumTier: "invalid" }), { kind: "free", tier: "explorer" });
});
