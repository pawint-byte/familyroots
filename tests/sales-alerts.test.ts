import assert from "node:assert/strict";
import test from "node:test";
import { buildSaleEmail, checkoutProduct, deliverSaleEmail, isPaidCheckout, isPaidRenewal } from "../server/lib/sales-alert-content";

test("only paid live checkouts with a positive amount qualify", () => {
  const paid = { livemode: true, payment_status: "paid", amount_total: 499 };
  assert.equal(isPaidCheckout(paid), true);
  for (const changed of [{ livemode: false }, { payment_status: "unpaid" },
    { payment_status: "no_payment_required" }, { amount_total: 0 }, { amount_total: null }]) {
    assert.equal(isPaidCheckout({ ...paid, ...changed }), false);
  }
});

test("recognizes all app purchase categories and rejects unrelated ones", () => {
  for (const type of ["bulk_pack", "premium_subscription", "milestone_payment", "merchandise", "merchandise_cart"]) {
    assert.ok(checkoutProduct({ type }));
  }
  assert.equal(checkoutProduct({ type: "tier_subscription", tier: "cultivator" }), "Cultivator membership");
  assert.equal(checkoutProduct({ type: "tier_subscription", tier: "invalid" }), null);
  assert.equal(checkoutProduct({ type: "other_app" }), null);
});

test("renewal alerts require payment and exclude the initial checkout invoice", () => {
  const paid = { status: "paid", amount_paid: 499, billing_reason: "subscription_cycle" };
  assert.equal(isPaidRenewal(paid), true);
  assert.equal(isPaidRenewal({ ...paid, billing_reason: "subscription_update" }), true);
  assert.equal(isPaidRenewal({ ...paid, billing_reason: "subscription_create" }), false);
  assert.equal(isPaidRenewal({ ...paid, status: "open" }), false);
  assert.equal(isPaidRenewal({ ...paid, amount_paid: 0 }), false);
});

test("includes buyer, product, exact payment amount and reference, escaping HTML", () => {
  const email = buildSaleEmail({
    paymentKey: "checkout-cs_test", reference: "cs_test", product: "Cultivator membership",
    buyerName: '<script>alert("buyer")</script>', buyerEmail: "test@example.invalid", amount: 499, currency: "usd",
  });
  assert.match(email.subject, /\$4\.99/);
  assert.match(email.html, /Cultivator membership/);
  assert.match(email.html, /test@example.invalid/);
  assert.match(email.html, /cs_test/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
});

test("retries use the same idempotency key and mark accepted mail delivered", async () => {
  const keys: string[] = [], ids: string[] = [];
  const alert = { paymentKey: "checkout-cs_paid", recipients: ["test@example.invalid"], subject: "Sale", html: "Sale" };
  const send = async (_to: string[], _subject: string, _html: string, key: string) => {
    keys.push(key); return { data: { id: "email_test" }, error: null };
  };
  await deliverSaleEmail(alert, send, async id => { ids.push(id); });
  await deliverSaleEmail(alert, send, async id => { ids.push(id); });
  assert.deepEqual(keys, ["sale-checkout-cs_paid", "sale-checkout-cs_paid"]);
  assert.deepEqual(ids, ["email_test", "email_test"]);
});

test("email-provider rejection and missing delivery IDs never mark mail sent", async () => {
  let marked = false;
  const alert = { paymentKey: "checkout-cs_failed", recipients: ["test@example.invalid"], subject: "Sale", html: "Sale" };
  for (const response of [{ data: null, error: { message: "Rejected" } }, { data: null, error: null }]) {
    await assert.rejects(deliverSaleEmail(alert, async () => response, async () => { marked = true; }));
  }
  assert.equal(marked, false);
});
