import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { deliverPendingSalesAlerts, recordCheckoutSale } from "../server/sales-alerts";
import { createDemoUser, revokeDemoUser } from "../scripts/qa-demo-user";
import type Stripe from "stripe";

test("outbox deduplicates payments, safely claims concurrent deliveries, and retries failed mail", async () => {
  assert.notEqual(process.env.NODE_ENV, "production", "Outbox tests are development-only");
  const key = `checkout-qa-${randomUUID()}`;
  const retryKey = `${key}-retry`;
  const scopedSessionId = `cs_qa_${randomUUID()}`;
  const scopedKey = `checkout-${scopedSessionId}`;
  const rejectedKey = `checkout-${scopedSessionId}-foreign`;
  const env = { ...process.env, NODE_ENV: "development" };
  let qaUser: { id: string } | undefined;
  const send = async () => ({ data: { id: "qa-email" }, error: null });
  const insert = async (paymentKey: string) => pool.query(
    `INSERT INTO sales_email_alerts (payment_key, recipients, subject, html)
     VALUES ($1, '["qa@example.invalid"]'::jsonb, 'TEST ONLY', 'Not a real sale')
     ON CONFLICT DO NOTHING`, [paymentKey],
  );
  try {
    await insert(key);
    await insert(key);
    const count = await pool.query("SELECT count(*) FROM sales_email_alerts WHERE payment_key = $1", [key]);
    assert.equal(Number(count.rows[0].count), 1);
    let sent = 0;
    const countingSend = async () => { sent++; return send(); };
    await Promise.all([
      deliverPendingSalesAlerts(countingSend, [key]),
      deliverPendingSalesAlerts(countingSend, [key]),
    ]);
    assert.equal(sent, 1);
    await pool.query("UPDATE sales_email_alerts SET last_attempt_at = now() - interval '10 minutes' WHERE payment_key = $1", [key]);
    await deliverPendingSalesAlerts(countingSend, [key]);
    assert.equal(sent, 1, "Delivered mail is never claimed again");

    await insert(retryKey);
    await deliverPendingSalesAlerts(async () => ({
      data: null, error: { name: "validation_error" as const, message: "Simulated provider rejection" },
    }), [retryKey]);
    const failed = await pool.query("SELECT sent_at, attempts FROM sales_email_alerts WHERE payment_key = $1", [retryKey]);
    assert.equal(failed.rows[0].sent_at, null);
    assert.equal(failed.rows[0].attempts, 1);
    await pool.query("UPDATE sales_email_alerts SET last_attempt_at = now() - interval '10 minutes' WHERE payment_key = $1", [retryKey]);
    await deliverPendingSalesAlerts(send, [retryKey]);
    const retried = await pool.query("SELECT sent_at, attempts, provider_email_id FROM sales_email_alerts WHERE payment_key = $1", [retryKey]);
    assert.ok(retried.rows[0].sent_at);
    assert.equal(retried.rows[0].attempts, 2);
    assert.equal(retried.rows[0].provider_email_id, "qa-email");
    qaUser = await createDemoUser(pool as any, `Aa1!${randomUUID()}${randomUUID()}`, env, true);
    const customer = `cus_qa_${randomUUID()}`;
    await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customer, qaUser.id]);
    const session = {
      id: scopedSessionId, livemode: true, payment_status: "paid", amount_total: 499, currency: "usd",
      customer, metadata: { type: "tier_subscription", tier: "cultivator", userId: qaUser.id },
    } as unknown as Stripe.Checkout.Session;
    await recordCheckoutSale(session);
    await recordCheckoutSale(session);
    const scoped = await pool.query("SELECT count(*) FROM sales_email_alerts WHERE payment_key = $1", [scopedKey]);
    assert.equal(Number(scoped.rows[0].count), 1, "Replayed checkout and async-payment events queue one sale");
    await recordCheckoutSale({ ...session, id: `${scopedSessionId}-foreign`, customer: "cus_other_app" });
    const foreign = await pool.query("SELECT count(*) FROM sales_email_alerts WHERE payment_key = $1", [rejectedKey]);
    assert.equal(Number(foreign.rows[0].count), 0, "Another app's customer never produces an owner alert");
  } finally {
    await pool.query("DELETE FROM sales_email_alerts WHERE payment_key = ANY($1::varchar[])", [[key, retryKey, scopedKey, rejectedKey]]);
    if (qaUser) await revokeDemoUser(pool as any, qaUser.id, env, true);
    await pool.end();
  }
});
