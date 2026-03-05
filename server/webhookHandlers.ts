import Stripe from 'stripe';
import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { subscriptionService } from './subscriptionService';
import { storage } from './storage';
import { printfulService } from './printful';
import { buildPrintfulFiles, sendOrderConfirmationEmail, sendOrderFailureEmail } from './merchandiseHelpers';

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

    try {
      const sync = await getStripeSync();
      await sync.processWebhook(payload, signature);
    } catch (syncError: any) {
      console.error('stripe-replit-sync processWebhook failed (non-fatal):', syncError.message);
    }

    try {
      const stripe = await getUncachableStripeClient();

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      let event: Stripe.Event;

      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } else {
        console.warn('STRIPE_WEBHOOK_SECRET not set — falling back to unverified event parsing');
        event = JSON.parse(payload.toString()) as Stripe.Event;
      }

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
        } else if (metadata.type === 'tier_subscription') {
          const tier = metadata.tier || 'cultivator';
          console.log(`Tier subscription created for user ${metadata.userId}: ${tier}`);
          const subscriptionId = session.subscription;
          if (subscriptionId) {
            await subscriptionService.handleTierSubscriptionCreated(metadata.userId, tier as any, subscriptionId);
          }
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
              await WebhookHandlers.processOrderToPrintful(order);
            } else if (order) {
              console.log(`Merchandise order ${order.id} already processed (status: ${order.status})`);
            }
          } catch (merchError: any) {
            console.error('Error processing merchandise webhook:', merchError);
            if (metadata.orderId) {
              try {
                const failedOrder = await storage.getMerchandiseOrder(metadata.orderId);
                await storage.updateMerchandiseOrder(metadata.orderId, {
                  status: "failed",
                  printfulError: merchError.message || "Unexpected error during order submission",
                });
                if (failedOrder) {
                  await sendOrderFailureEmail(failedOrder, failedOrder.userId, merchError.message || "Unexpected error during order submission");
                }
              } catch {}
            }
          }
        } else if (metadata.type === 'merchandise_cart') {
          console.log(`Cart payment completed for cartSessionId ${metadata.cartSessionId}, session ${session.id}`);
          try {
            const allUserOrders = await storage.getMerchandiseOrderByStripeSession(session.id);
            if (!allUserOrders) {
              console.error(`No orders found for cart session ${session.id}`);
              return;
            }
            const userId = allUserOrders.userId;
            const userOrders = await storage.getMerchandiseOrders(userId);
            const cartOrders = userOrders.filter((o: any) => o.cartSessionId === metadata.cartSessionId && o.status === 'pending');
            
            for (const order of cartOrders) {
              try {
                await WebhookHandlers.processOrderToPrintful(order);
              } catch (err: any) {
                console.error(`Error processing cart order ${order.id}:`, err);
                await storage.updateMerchandiseOrder(order.id, {
                  status: "failed",
                  printfulError: err.message || "Error during cart order processing",
                });
                await sendOrderFailureEmail(order, order.userId, err.message || "Error during cart order processing");
              }
            }
          } catch (cartError: any) {
            console.error('Error processing cart webhook:', cartError);
          }
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const metadata = subscription.metadata || {};

        if ((metadata.type === 'tier_subscription' || metadata.type === 'premium_subscription') && metadata.userId) {
          console.log(`Subscription cancelled for user ${metadata.userId} (type: ${metadata.type})`);
          await subscriptionService.handlePremiumSubscriptionCancelled(metadata.userId);
        } else if (metadata.userId) {
          await subscriptionService.handleSubscriptionCancelled(metadata.userId);
        }
      }
    } catch (customError) {
      console.error('Error processing custom webhook handler:', customError);
    }
  }

  static async processOrderToPrintful(order: any): Promise<void> {
    await storage.updateMerchandiseOrder(order.id, { status: "paid" });

    if (!order.shippingAddress) {
      console.error(`Merchandise order ${order.id} has no shipping address`);
      return;
    }

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

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const printfulFiles = await buildPrintfulFiles(order, baseUrl);

    if (printfulFiles.length === 0) {
      await storage.updateMerchandiseOrder(order.id, {
        status: "failed",
        printfulError: "No print files configured for this order",
      });
      console.error(`Merchandise order ${order.id} has no print files`);
      await sendOrderFailureEmail(order, order.userId, "No print files configured for this order");
      return;
    }

    const printfulResult = await printfulService.createOrder(
      printfulAddress,
      [{
        variant_id: order.variantId,
        quantity: order.quantity,
        files: printfulFiles,
      }],
      true
    );

    if (printfulResult) {
      await storage.updateMerchandiseOrder(order.id, {
        status: "submitted",
        printfulOrderId: String(printfulResult.orderId),
      });
      console.log(`Merchandise order ${order.id} submitted to Printful: ${printfulResult.orderId}`);
      await sendOrderConfirmationEmail(order, order.userId);
    } else {
      const errorMsg = "Printful rejected the order — check print files and address";
      await storage.updateMerchandiseOrder(order.id, {
        status: "failed",
        printfulError: errorMsg,
      });
      console.error(`Failed to submit merchandise order ${order.id} to Printful`);
      await sendOrderFailureEmail(order, order.userId, errorMsg);
    }
  }
}
