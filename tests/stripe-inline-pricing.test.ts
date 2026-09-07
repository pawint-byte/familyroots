import assert from "node:assert/strict";
import test from "node:test";
import {
  PRICING_CONFIG,
  subscriptionService,
  TIER_CONFIG,
} from "../server/subscriptionService";

test("uses the requested monthly subscription amounts", () => {
  assert.equal(TIER_CONFIG.explorer.monthlyPriceCents, 0);
  assert.equal(TIER_CONFIG.cultivator.monthlyPriceCents, 499);
  assert.equal(TIER_CONFIG.heritage.monthlyPriceCents, 1299);
  assert.equal(TIER_CONFIG.legacy.monthlyPriceCents, 2499);
});

test("uses the existing one-time add-on amounts", () => {
  assert.deepEqual(
    Object.fromEntries(PRICING_CONFIG.packs.map((pack) => [pack.type, pack.priceCents])),
    {
      starter_10: 799,
      growth_25: 1499,
      family_50: 2499,
    },
  );
});

test("does not create a checkout for the free Explorer tier", async () => {
  await assert.rejects(
    subscriptionService.createTierCheckout(
      "unused-user",
      "explorer",
      "https://familyroots.family/pricing?status=success",
      "https://familyroots.family/pricing?status=cancel",
    ),
    /Explorer is the free tier/,
  );
});