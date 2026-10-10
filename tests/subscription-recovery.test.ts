import assert from "node:assert/strict";
import test from "node:test";
import { findVerifiedSubscription, MissingSubscriptionRecovery } from "../server/subscription-recovery";

const userId = "test-member";
const customerId = "cus_test_member";
const subscription = {
  id: "sub_test_member",
  customer: customerId,
  status: "active",
  created: 100,
  metadata: { userId, type: "tier_subscription", tier: "cultivator" },
};

test("recovers the customer's active monthly tier from Stripe metadata", () => {
  assert.deepEqual(findVerifiedSubscription([subscription], userId, customerId), {
    subscriptionId: subscription.id, tier: "cultivator",
  });
});

test("rejects inactive and unpaid subscriptions", () => {
  for (const status of ["canceled", "past_due", "unpaid", "incomplete", "paused", "trialing"]) {
    assert.equal(findVerifiedSubscription([{ ...subscription, status }], userId, customerId), null);
  }
});

test("rejects another customer, another member, other apps, packs, and unknown tiers", () => {
  assert.equal(findVerifiedSubscription([subscription], userId, "cus_other"), null);
  assert.equal(findVerifiedSubscription([subscription], "other-member", customerId), null);
  for (const metadata of [
    { ...subscription.metadata, type: "bulk_pack" },
    { ...subscription.metadata, type: "other_app" },
    { ...subscription.metadata, tier: "explorer" },
    { ...subscription.metadata, tier: "invalid" },
  ]) {
    assert.equal(findVerifiedSubscription([{ ...subscription, metadata }], userId, customerId), null);
  }
});

test("chooses the newest valid subscription and accepts expanded customer objects", () => {
  const newer = { ...subscription, id: "sub_newer", customer: { id: customerId }, created: 200,
    metadata: { ...subscription.metadata, tier: "heritage" } };
  assert.deepEqual(findVerifiedSubscription([subscription, newer], userId, customerId), {
    subscriptionId: "sub_newer", tier: "heritage",
  });
});

test("coalesces simultaneous status requests and applies verified access once", async () => {
  let verified = 0, applied = 0;
  const recovery = new MissingSubscriptionRecovery(
    async () => { verified++; await new Promise(resolve => setTimeout(resolve, 10)); return { subscriptionId: subscription.id, tier: "cultivator" }; },
    async (user, tier, id) => { applied++; assert.equal(user, userId); assert.equal(tier, "cultivator"); assert.equal(id, subscription.id); },
  );
  assert.deepEqual(await Promise.all([recovery.recover(userId, customerId), recovery.recover(userId, customerId)]), [true, true]);
  assert.equal(verified, 1);
  assert.equal(applied, 1);
});

test("empty checks are cached without granting any access, then expire", async () => {
  let clock = 0, verified = 0;
  const recovery = new MissingSubscriptionRecovery(
    async () => { verified++; return null; },
    async () => { assert.fail("Unverified subscription must never grant access"); },
    () => clock,
  );
  assert.equal(await recovery.recover(userId, customerId), false);
  assert.equal(await recovery.recover(userId, customerId), false);
  assert.equal(verified, 1);
  clock = 45_001;
  assert.equal(await recovery.recover(userId, customerId), false);
  assert.equal(verified, 2);
});

test("provider failures and storage failures are cached, not converted to paid access", async () => {
  for (const failure of ["provider", "storage"]) {
    let verified = 0;
    const recovery = new MissingSubscriptionRecovery(
      async () => {
        verified++;
        if (failure === "provider") throw new Error("Provider unavailable");
        return { subscriptionId: subscription.id, tier: "cultivator" };
      },
      async () => { throw new Error("Storage unavailable"); },
    );
    await assert.rejects(recovery.recover(userId, customerId), /unavailable/);
    await assert.rejects(recovery.recover(userId, customerId), /unavailable/);
    assert.equal(verified, 1);
  }
});
