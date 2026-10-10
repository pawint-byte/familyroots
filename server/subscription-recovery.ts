import { getUncachableStripeClient } from "./stripeClient";
import type { FeatureTier } from "@shared/pricing";

interface BillingSubscription {
  id: string;
  customer: string | { id: string };
  status: string;
  created: number;
  metadata: Record<string, string>;
}

export interface VerifiedSubscription {
  subscriptionId: string;
  tier: Exclude<FeatureTier, "explorer">;
}

// Only Stripe-owned billing data may restore a missing entitlement. A browser
// plan name, a customer ID alone, or an unrelated app's subscription cannot.
export function findVerifiedSubscription(
  subscriptions: BillingSubscription[],
  userId: string,
  customerId: string,
): VerifiedSubscription | null {
  const subscription = subscriptions
    .filter(s =>
      s.status === "active" &&
      (typeof s.customer === "string" ? s.customer : s.customer.id) === customerId &&
      s.metadata.userId === userId &&
      s.metadata.type === "tier_subscription" &&
      ["cultivator", "heritage", "legacy"].includes(s.metadata.tier),
    )
    .sort((a, b) => b.created - a.created)[0];
  return subscription
    ? { subscriptionId: subscription.id, tier: subscription.metadata.tier as VerifiedSubscription["tier"] }
    : null;
}

export async function verifyMissingSubscription(userId: string, customerId: string) {
  const stripe = await getUncachableStripeClient();
  const subscriptions = await stripe.subscriptions.list(
    { customer: customerId, status: "active", limit: 100 },
    { timeout: 5000, maxNetworkRetries: 0 },
  );
  return findVerifiedSubscription(subscriptions.data, userId, customerId);
}

// Coalesce simultaneous status requests and cache failed/empty checks as well,
// so an unpaid account or Stripe outage does not cause repeated API traffic.
export class MissingSubscriptionRecovery {
  private attempts = new Map<string, { until: number; result: Promise<boolean> }>();

  constructor(
    private verify: (userId: string, customerId: string) => Promise<VerifiedSubscription | null>,
    private apply: (userId: string, tier: VerifiedSubscription["tier"], subscriptionId: string) => Promise<void>,
    private now: () => number = Date.now,
  ) {}

  async recover(userId: string, customerId: string): Promise<boolean> {
    const key = `${userId}:${customerId}`;
    const cached = this.attempts.get(key);
    if (cached && cached.until > this.now()) return cached.result;
    if (this.attempts.size >= 1000) {
      for (const [entryKey, entry] of this.attempts) {
        if (entry.until <= this.now()) this.attempts.delete(entryKey);
      }
      if (this.attempts.size >= 1000) return false;
    }
    const result = (async () => {
      const subscription = await this.verify(userId, customerId);
      if (!subscription) return false;
      await this.apply(userId, subscription.tier, subscription.subscriptionId);
      return true;
    })();
    this.attempts.set(key, { until: this.now() + 45_000, result });
    return result;
  }
}
