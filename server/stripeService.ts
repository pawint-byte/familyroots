import { getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';

export class StripeService {
  async createCustomer(email: string, userId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  async createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card', 'crypto'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
      allow_promotion_codes: true,
    });
  }

  async createMerchandiseCheckoutSession(
    customerId: string,
    productName: string,
    productDescription: string,
    amountCents: number,
    quantity: number,
    successUrl: string,
    cancelUrl: string,
    metadata: Record<string, string>
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card', 'crypto'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            description: productDescription,
          },
          unit_amount: amountCents,
        },
        quantity,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });
  }

  async createCartCheckoutSession(
    customerId: string,
    lineItems: Array<{ name: string; description: string; amountCents: number; quantity: number }>,
    successUrl: string,
    cancelUrl: string,
    metadata: Record<string, string>
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            description: item.description,
          },
          unit_amount: item.amountCents,
        },
        quantity: item.quantity,
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });
  }

  async retrieveCheckoutSession(sessionId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.retrieve(sessionId);
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active}`
    );
    return result.rows;
  }

  async listProductsWithPrices(active = true) {
    const result = await db.execute(
      sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = ${active}
        ORDER BY p.id, pr.unit_amount
      `
    );
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  async getCustomerSubscription(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} AND status = 'active' LIMIT 1`
    );
    return result.rows[0] || null;
  }
}

export const stripeService = new StripeService();
