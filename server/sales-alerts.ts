import type Stripe from "stripe";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "./db";
import { salesEmailAlerts } from "@shared/schema";
import { ADMIN_EMAILS_LIST } from "./adminConfig";
import { storage } from "./storage";
import { sendEmail } from "./lib/email";
import { stripeObjectId } from "./lib/stripe-object-id";
import { getUncachableStripeClient } from "./stripeClient";
import { buildSaleEmail, checkoutProduct, deliverSaleEmail, isPaidCheckout, isPaidRenewal, type SaleEmail } from "./lib/sales-alert-content";

async function enqueueSale(sale: SaleEmail) {
  await db.insert(salesEmailAlerts).values({
    paymentKey: sale.paymentKey,
    recipients: [...ADMIN_EMAILS_LIST],
    ...buildSaleEmail(sale),
  }).onConflictDoNothing();
  // Never make access or fulfillment wait for the email provider. Pending
  // deliveries survive process restarts and are claimed atomically by workers.
  if (process.env.NODE_ENV === "production") {
    void deliverPendingSalesAlerts().catch(() => console.error("[sales-alerts] Email retry worker failed"));
  }
}

export async function recordCheckoutSale(session: Stripe.Checkout.Session) {
  if (!isPaidCheckout(session)) return;
  const metadata = session.metadata || {};
  let product = checkoutProduct(metadata);
  if (!product) return; // Ignore other apps sharing this Stripe account.
  let userId = metadata.userId;
  if (metadata.type === "merchandise" || metadata.type === "merchandise_cart") {
    const order = await storage.getMerchandiseOrderByStripeSession(session.id);
    if (!order) return;
    userId = order.userId;
    if (metadata.type === "merchandise") product = order.productName;
  }
  if (!userId) return;
  const user = await storage.getUser(userId);
  const customerId = stripeObjectId(session.customer);
  if (!customerId || !user?.stripeCustomerId || user.stripeCustomerId !== customerId) return;
  await enqueueSale({
    paymentKey: `checkout-${session.id}`, reference: session.id, product,
    buyerName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "FamilyRoots member",
    buyerEmail: user.email, amount: session.amount_total!, currency: session.currency || "usd",
  });
}

export async function recordStripeSalesEvent(event: Stripe.Event) {
  if (!event.livemode) return; // Do not email real sales alerts for test payments.
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await recordCheckoutSale(event.data.object);
  } else if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    // The initial subscription invoice and its checkout are the same sale.
    if (!isPaidRenewal(invoice)) return;
    // Stripe delivers snapshots using the webhook endpoint's API version.
    const legacySubscription = (invoice as Stripe.Invoice & {
      subscription?: string | { id: string } | null;
    }).subscription;
    const subscriptionId = stripeObjectId(invoice.parent?.subscription_details?.subscription ?? legacySubscription ?? null);
    if (!subscriptionId) return;
    const stripe = await getUncachableStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { timeout: 5000, maxNetworkRetries: 0 });
    const product = checkoutProduct(subscription.metadata);
    if (!product || !subscription.metadata.userId ||
      !["tier_subscription", "premium_subscription"].includes(subscription.metadata.type)) return;
    const user = await storage.getUser(subscription.metadata.userId);
    const customerId = stripeObjectId(invoice.customer);
    if (!customerId || !user?.stripeCustomerId || user.stripeCustomerId !== customerId) return;
    await enqueueSale({
      paymentKey: `invoice-${invoice.id}`, reference: invoice.id!,
      product: `${product} — ${invoice.billing_reason === "subscription_update" ? "plan change" : "renewal"}`,
      buyerName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "FamilyRoots member",
      buyerEmail: user.email, amount: invoice.amount_paid, currency: invoice.currency,
    });
  }
}

export async function deliverPendingSalesAlerts(send: typeof sendEmail = sendEmail, onlyKeys?: string[]) {
  const claimed = await db.transaction(async tx => {
    const due = await tx.select().from(salesEmailAlerts)
      .where(and(isNull(salesEmailAlerts.sentAt), or(isNull(salesEmailAlerts.lastAttemptAt),
        lt(salesEmailAlerts.lastAttemptAt, new Date(Date.now() - 5 * 60_000))),
        onlyKeys ? inArray(salesEmailAlerts.paymentKey, onlyKeys) : undefined))
      .orderBy(asc(salesEmailAlerts.createdAt)).limit(10).for("update", { skipLocked: true });
    for (const alert of due) {
      await tx.update(salesEmailAlerts).set({
        lastAttemptAt: new Date(), attempts: sql`${salesEmailAlerts.attempts} + 1`,
      }).where(eq(salesEmailAlerts.paymentKey, alert.paymentKey));
    }
    return due;
  });
  for (const alert of claimed) {
    try {
      await deliverSaleEmail(alert, send, async emailId => {
        await db.update(salesEmailAlerts).set({ sentAt: new Date(), providerEmailId: emailId })
          .where(eq(salesEmailAlerts.paymentKey, alert.paymentKey));
      });
    } catch {
      console.error("[sales-alerts] Delivery pending; will retry");
    }
  }
}

export function startSalesEmailRetryWorker() {
  if (process.env.NODE_ENV !== "production") return;
  const run = () => void deliverPendingSalesAlerts().catch(() => console.error("[sales-alerts] Retry worker failed"));
  run();
  setInterval(run, 60_000).unref();
}
