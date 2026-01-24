import { db } from './db';
import { users, memberMilestonePayments } from '@shared/models/auth';
import { familyTrees, familyMembers } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { getUncachableStripeClient } from './stripeClient';

export const SUBSCRIPTION_CONFIG = {
  basePriceMonthly: 999,
  tiers: [
    { name: 'free', minMembers: 0, maxMembers: 24, discountPercent: 0, monthlyPrice: 999 },
    { name: 'tier_25', minMembers: 25, maxMembers: 49, discountPercent: 25, monthlyPrice: 749 },
    { name: 'tier_50', minMembers: 50, maxMembers: 74, discountPercent: 50, monthlyPrice: 499 },
    { name: 'tier_75', minMembers: 75, maxMembers: 99, discountPercent: 75, monthlyPrice: 250 },
    { name: 'tier_100', minMembers: 100, maxMembers: Infinity, discountPercent: 100, monthlyPrice: 0 },
  ],
  milestonePaymentCents: 299,
};

export type SubscriptionTier = 'free' | 'tier_25' | 'tier_50' | 'tier_75' | 'tier_100';

export interface UserSubscriptionInfo {
  userId: string;
  totalMemberCount: number;
  currentTier: SubscriptionTier;
  discountPercent: number;
  monthlyPrice: number;
  nextTier: { name: string; membersNeeded: number; discountPercent: number } | null;
  isSubscriptionActive: boolean;
  lastMilestoneReached: number;
  nextMilestone: number | null;
  milestonePaymentRequired: boolean;
}

export class SubscriptionService {
  async calculateTotalMemberCount(userId: string): Promise<number> {
    // Count unique members: owned members + imported members (deduplicated)
    // Uses UNION to avoid double-counting if same member appears in both
    const result = await db.execute(sql`
      SELECT COUNT(*) as total FROM (
        -- Members from owned trees
        SELECT fm.id as member_id
        FROM family_members fm
        JOIN family_trees ft ON fm.tree_id = ft.id
        WHERE ft.owner_id = ${userId}
        
        UNION
        
        -- Imported members from connected trees (unique source members)
        SELECT DISTINCT im.source_member_id as member_id
        FROM imported_members im
        JOIN family_trees ft ON im.target_tree_id = ft.id
        WHERE ft.owner_id = ${userId}
      ) as all_members
    `);
    return parseInt(result.rows[0]?.total as string || '0', 10);
  }

  getTierForMemberCount(memberCount: number): (typeof SUBSCRIPTION_CONFIG.tiers)[0] {
    for (const tier of SUBSCRIPTION_CONFIG.tiers) {
      if (memberCount >= tier.minMembers && memberCount <= tier.maxMembers) {
        return tier;
      }
    }
    return SUBSCRIPTION_CONFIG.tiers[0];
  }

  getNextTier(currentTierName: string, memberCount: number): { name: string; membersNeeded: number; discountPercent: number; progressPercent: number } | null {
    const tiers = SUBSCRIPTION_CONFIG.tiers;
    const currentIndex = tiers.findIndex(t => t.name === currentTierName);
    if (currentIndex === -1 || currentIndex >= tiers.length - 1) {
      return null;
    }
    const currentTier = tiers[currentIndex];
    const nextTier = tiers[currentIndex + 1];
    
    const tierRangeStart = currentTier.minMembers;
    const tierRangeEnd = nextTier.minMembers;
    const progressInRange = memberCount - tierRangeStart;
    const rangeSize = tierRangeEnd - tierRangeStart;
    const progressPercent = Math.min(100, Math.max(0, (progressInRange / rangeSize) * 100));
    
    return {
      name: nextTier.name,
      membersNeeded: nextTier.minMembers,
      discountPercent: nextTier.discountPercent,
      progressPercent,
    };
  }

  async getUserSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo> {
    const totalMemberCount = await this.calculateTotalMemberCount(userId);
    const tier = this.getTierForMemberCount(totalMemberCount);
    const nextTier = this.getNextTier(tier.name, totalMemberCount);

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const lastMilestoneReached = user?.lastMilestoneReached || 100;
    const isSubscriptionActive = user?.isSubscriptionActive || false;

    let nextMilestone: number | null = null;
    let milestonePaymentRequired = false;

    if (tier.name === 'tier_100' && totalMemberCount >= 100) {
      const nextMilestoneTarget = lastMilestoneReached + 25;
      if (totalMemberCount >= nextMilestoneTarget) {
        nextMilestone = nextMilestoneTarget;
        milestonePaymentRequired = true;
      }
    }

    return {
      userId,
      totalMemberCount,
      currentTier: tier.name as SubscriptionTier,
      discountPercent: tier.discountPercent,
      monthlyPrice: tier.monthlyPrice,
      nextTier,
      isSubscriptionActive,
      lastMilestoneReached,
      nextMilestone,
      milestonePaymentRequired,
    };
  }

  async updateUserMemberCount(userId: string): Promise<UserSubscriptionInfo> {
    const totalMemberCount = await this.calculateTotalMemberCount(userId);
    const tier = this.getTierForMemberCount(totalMemberCount);

    await db.update(users)
      .set({
        totalMemberCount,
        subscriptionTier: tier.name as SubscriptionTier,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return this.getUserSubscriptionInfo(userId);
  }

  async createSubscriptionCheckout(userId: string, successUrl: string, cancelUrl: string) {
    const stripe = await getUncachableStripeClient();
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) throw new Error('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
    }

    const info = await this.getUserSubscriptionInfo(userId);
    
    if (info.monthlyPrice === 0) {
      throw new Error('You qualify for free subscription with 100+ members!');
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'FamilyRoots Subscription',
            description: `${info.discountPercent}% discount - ${info.totalMemberCount} family members`,
          },
          unit_amount: info.monthlyPrice,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tier: info.currentTier,
        memberCount: info.totalMemberCount.toString(),
      },
      subscription_data: {
        metadata: {
          userId,
          tier: info.currentTier,
        },
      },
    });

    return session;
  }

  async createMilestonePaymentCheckout(
    userId: string,
    milestone: number,
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) throw new Error('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Family Tree Growth Payment',
            description: `Unlock ${milestone} family members`,
          },
          unit_amount: SUBSCRIPTION_CONFIG.milestonePaymentCents,
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        milestone: milestone.toString(),
        type: 'milestone_payment',
      },
    });

    await db.insert(memberMilestonePayments).values({
      userId,
      milestone,
      amountCents: SUBSCRIPTION_CONFIG.milestonePaymentCents,
      status: 'pending',
    });

    return session;
  }

  async handleSubscriptionCreated(userId: string, subscriptionId: string) {
    await db.update(users)
      .set({
        stripeSubscriptionId: subscriptionId,
        isSubscriptionActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async handleSubscriptionCancelled(userId: string) {
    await db.update(users)
      .set({
        isSubscriptionActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async handleMilestonePaymentCompleted(userId: string, milestone: number, paymentIntentId: string) {
    await db.update(memberMilestonePayments)
      .set({
        status: 'paid',
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      })
      .where(
        sql`user_id = ${userId} AND milestone = ${milestone} AND status = 'pending'`
      );

    await db.update(users)
      .set({
        lastMilestoneReached: milestone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getUserMilestonePayments(userId: string) {
    return db.select()
      .from(memberMilestonePayments)
      .where(eq(memberMilestonePayments.userId, userId))
      .orderBy(memberMilestonePayments.milestone);
  }
}

export const subscriptionService = new SubscriptionService();
