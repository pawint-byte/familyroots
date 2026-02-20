import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { subscriptionService } from './subscriptionService';
import { storage } from './storage';
import { printfulService } from './printful';

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
        } else if (metadata.type === 'merchandise') {
          console.log(`Merchandise payment completed for order ${metadata.orderId}, session ${session.id}`);
          try {
            let order = metadata.orderId ? await storage.getMerchandiseOrder(metadata.orderId) : undefined;
            if (!order) {
              order = await storage.getMerchandiseOrderByStripeSession(session.id);
              if (order) {
                console.log(`Found merchandise order ${order.id} by session ID fallback`);
              } else {
                console.error(`No merchandise order found for orderId=${metadata.orderId} or session=${session.id}`);
              }
            }
            if (order && order.status === 'pending') {
              await storage.updateMerchandiseOrder(order.id, { status: "paid" });

              if (order.shippingAddress) {
                const shippingAddr = order.shippingAddress as any;
                const printfulAddress = {
                  name: shippingAddr.name,
                  address1: shippingAddr.address1,
                  address2: shippingAddr.address2 || '',
                  city: shippingAddr.city,
                  state_code: shippingAddr.stateCode,
                  country_code: shippingAddr.countryCode,
                  zip: shippingAddr.zip,
                  email: shippingAddr.email,
                  phone: shippingAddr.phone,
                };

                const printfulResult = await printfulService.createOrder(
                  printfulAddress,
                  [{
                    variant_id: order.variantId,
                    quantity: order.quantity,
                    files: [{
                      type: 'default',
                      url: order.treeImageUrl,
                    }],
                  }],
                  true
                );

                if (printfulResult) {
                  await storage.updateMerchandiseOrder(order.id, {
                    status: "submitted",
                    printfulOrderId: String(printfulResult.orderId),
                  });
                  console.log(`Merchandise order ${order.id} submitted to Printful: ${printfulResult.orderId}`);
                } else {
                  console.error(`Failed to submit merchandise order ${order.id} to Printful, keeping as paid`);
                }
              }
            } else if (order) {
              console.log(`Merchandise order ${order.id} already processed (status: ${order.status})`);
            }
          } catch (merchError) {
            console.error('Error processing merchandise webhook:', merchError);
          }
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
