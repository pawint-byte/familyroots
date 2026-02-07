import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { subscriptionService } from './subscriptionService';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // Process with stripe-replit-sync first
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Also handle our custom payment types
    try {
      const stripe = await getUncachableStripeClient();
      const event = JSON.parse(payload.toString());

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};

        if (metadata.type === 'bulk_pack') {
          console.log(`Bulk pack payment completed for user ${metadata.userId}: ${metadata.packType} (${metadata.credits} credits)`);
          await subscriptionService.handleBulkPackPaymentCompleted(
            metadata.userId,
            metadata.packType,
            parseInt(metadata.credits, 10),
            session.id,
            session.payment_intent,
            metadata.rewardId || undefined
          );
        } else if (metadata.type === 'premium_subscription') {
          console.log(`Premium subscription created for user ${metadata.userId}`);
          const subscriptionId = session.subscription;
          if (subscriptionId) {
            await subscriptionService.handlePremiumSubscriptionCreated(metadata.userId, subscriptionId);
          }
        } else if (metadata.type === 'milestone_payment') {
          console.log(`Milestone payment completed for user ${metadata.userId}: milestone ${metadata.milestone}`);
          await subscriptionService.handleMilestonePaymentCompleted(
            metadata.userId,
            parseInt(metadata.milestone, 10),
            session.payment_intent
          );
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const metadata = subscription.metadata || {};

        if (metadata.type === 'premium_subscription' && metadata.userId) {
          console.log(`Premium subscription cancelled for user ${metadata.userId}`);
          await subscriptionService.handlePremiumSubscriptionCancelled(metadata.userId);
        } else if (metadata.userId) {
          await subscriptionService.handleSubscriptionCancelled(metadata.userId);
        }
      }
    } catch (customError) {
      console.error('Error processing custom webhook handler:', customError);
    }
  }
}
