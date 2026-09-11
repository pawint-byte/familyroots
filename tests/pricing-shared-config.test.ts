import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PRICING_CONFIG as serverPricingConfig } from "../server/subscriptionService";
import { PRICING_CONFIG as sharedPricingConfig } from "../shared/pricing";
import { getRegisterHref } from "../client/src/lib/register-link";

test("server pricing uses the shared plan and limit configuration", () => {
  assert.strictEqual(sharedPricingConfig.freeTierCredits, 20);
  assert.strictEqual(sharedPricingConfig.unlimitedTrees, true);
  assert.deepEqual(serverPricingConfig.tiers, sharedPricingConfig.tiers);
  assert.deepEqual(serverPricingConfig.tierLimits, sharedPricingConfig.tierLimits);
  assert.strictEqual(serverPricingConfig.freeTierCredits, sharedPricingConfig.freeTierCredits);
  assert.strictEqual(serverPricingConfig.unlimitedTrees, sharedPricingConfig.unlimitedTrees);
});

test("registration links preserve destination and return query parameters", () => {
  const query = "?destination=%2Fpricing&return=%2Ffamily-tree&ref=family";
  assert.equal(getRegisterHref(query), `/register${query}`);
  assert.equal(getRegisterHref(""), "/register");
});

test("homepage and pricing use shared member and tree limits", () => {
  const landing = readFileSync("client/src/pages/landing.tsx", "utf8");
  const pricing = readFileSync("client/src/pages/pricing.tsx", "utf8");

  assert.match(landing, /PRICING_CONFIG\.freeTierCredits/);
  assert.match(landing, /Unlimited trees/);
  assert.match(pricing, /config\.freeTierCredits/);
  assert.match(pricing, /config\.unlimitedTrees/);
  assert.doesNotMatch(landing, /1 tree included|For high-volume use/);
  assert.doesNotMatch(pricing, /High-volume, still capped for your safety/);
});