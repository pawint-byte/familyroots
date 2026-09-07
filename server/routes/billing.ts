import express, { type Express } from "express";
import { WebhookHandlers } from "../webhookHandlers";

/**
 * Stripe must receive the untouched request bytes for signature verification.
 * Register this before the application's JSON body parser.
 */
export function registerStripeWebhook(app: Express): void {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error("Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is required.");
        return res.status(503).json({ error: "Stripe webhook is not configured" });
      }

      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature" });
      }

      if (!Buffer.isBuffer(req.body)) {
        console.error("Stripe webhook rejected: request body is not a Buffer.");
        return res.status(500).json({ error: "Webhook processing error" });
      }

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        await WebhookHandlers.processWebhook(req.body, sig);
        return res.status(200).json({ received: true });
      } catch (error: any) {
        console.error("Webhook error:", error.message);
        return res.status(400).json({ error: "Webhook processing error" });
      }
    },
  );
}