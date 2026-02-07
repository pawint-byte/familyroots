import { db } from './db';
import { users, memberMilestonePayments, bulkPackPurchases, activityRewards } from '@shared/models/auth';
import { familyTrees, familyMembers } from '@shared/schema';
import { eq, sql, and, gte, desc } from 'drizzle-orm';
import { getUncachableStripeClient } from './stripeClient';

// New pricing model: Bulk add packs + optional premium
export const PRICING_CONFIG = {
  packs: [
    { type: 'starter_10' as const, credits: 10, priceCents: 799, perMemberCents: 80, label: 'Starter Pack' },
    { type: 'growth_25' as const, credits: 25, priceCents: 1499, perMemberCents: 60, label: 'Growth Pack', savings: '25%' },
    { type: 'family_50' as const, credits: 50, priceCents: 2499, perMemberCents: 50, label: 'Family Pack', savings: '37%' },
  ],
  premium: {
    monthlyPriceCents: 499,
    label: 'Premium',
    features: ['Unlimited media uploads', 'Gift registries', 'Priority support', 'Advanced analytics'],
  },
  rewards: {
    monthlyAddsThreshold: 5,
    monthlyDiscountPercent: 20,
    milestoneFreePack: { memberCount: 100, freeCredits: 10 },
  },
  freeTierCredits: 20,
};

// Legacy config kept for backward compatibility with existing subscribers
export const SUBSCRIPTION_CONFIG = {
  basePriceMonthly: 999,
  annualDiscountPercent: 20,
  tiers: [
    { name: 'free', minMembers: 0, maxMembers: 24, discountPercent: 0, monthlyPrice: 999 },
    { name: 'tier_25', minMembers: 25, maxMembers: 49, discountPercent: 25, monthlyPrice: 749 },
    { name: 'tier_50', minMembers: 50, maxMembers: 74, discountPercent: 50, monthlyPrice: 499 },
    { name: 'tier_75', minMembers: 75, maxMembers: 99, discountPercent: 75, monthlyPrice: 250 },
    { name: 'tier_100', minMembers: 100, maxMembers: Infinity, discountPercent: 100, monthlyPrice: 0 },
  ],
  milestonePaymentCents: 299,
};

export function getAnnualPrice(monthlyPrice: number): number {
  const yearlyTotal = monthlyPrice * 12;
  const discountedTotal = Math.round(yearlyTotal * (1 - SUBSCRIPTION_CONFIG.annualDiscountPercent / 100));
  return discountedTotal;
}

export function getAnnualMonthlyEquivalent(monthlyPrice: number): number {
  return Math.round(getAnnualPrice(monthlyPrice) / 12);
}

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
  // New pricing model fields
  memberCredits: number;
  isPremium: boolean;
  monthlyAddsCount: number;
  hasActiveReward: boolean;
  activeRewardDiscount: number;
  pricingModel: 'bulk_packs';
}

export class SubscriptionService {
  async calculateTotalMemberCount(userId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as total FROM (
        SELECT fm.id as member_id
        FROM family_members fm
        JOIN family_trees ft ON fm.tree_id = ft.id
        WHERE ft.owner_id = ${userId}
        
        UNION
        
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

    // Get new pricing model data
    const memberCredits = user?.memberCredits || 0;
    const isPremium = user?.isPremium || false;
    const monthlyAddsCount = user?.monthlyAddsCount || 0;

    // Check for active reward
    const activeReward = await this.getActiveReward(userId);
    const hasActiveReward = !!activeReward;
    const activeRewardDiscount = activeReward?.discountPercent || 0;

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
      memberCredits,
      isPremium,
      monthlyAddsCount,
      hasActiveReward,
      activeRewardDiscount,
      pricingModel: 'bulk_packs',
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

  // ==================== NEW PRICING MODEL ====================

  async getActiveReward(userId: string): Promise<{ discountPercent: number; id: string } | null> {
    const now = new Date();
    const rewards = await db.select()
      .from(activityRewards)
      .where(
        and(
          eq(activityRewards.userId, userId),
          eq(activityRewards.rewardType, 'monthly_discount'),
          eq(activityRewards.isUsed, false),
        )
      )
      .orderBy(desc(activityRewards.createdAt))
      .limit(1);

    const reward = rewards[0];
    if (!reward) return null;
    if (reward.expiresAt && reward.expiresAt < now) return null;
    return { discountPercent: reward.discountPercent || 0, id: reward.id };
  }

  async getUserCredits(userId: string): Promise<number> {
    const [user] = await db.select({ memberCredits: users.memberCredits })
      .from(users).where(eq(users.id, userId));
    return user?.memberCredits || 0;
  }

  async deductCredit(userId: string): Promise<boolean> {
    const credits = await this.getUserCredits(userId);
    if (credits <= 0) return false;

    await db.update(users)
      .set({ 
        memberCredits: credits - 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return true;
  }

  async incrementMonthlyAdds(userId: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return;

    const now = new Date();
    const resetAt = user.monthlyAddsResetAt;

    // Reset monthly count if we're in a new month
    if (!resetAt || resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear()) {
      await db.update(users)
        .set({
          monthlyAddsCount: 1,
          monthlyAddsResetAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    } else {
      const newCount = (user.monthlyAddsCount || 0) + 1;
      await db.update(users)
        .set({
          monthlyAddsCount: newCount,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      // Check if user just hit the monthly threshold for a reward
      if (newCount === PRICING_CONFIG.rewards.monthlyAddsThreshold) {
        await this.grantMonthlyDiscount(userId);
      }
    }
  }

  async grantMonthlyDiscount(userId: string): Promise<void> {
    // Check if they already have an active unused discount
    const existing = await this.getActiveReward(userId);
    if (existing) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60); // Discount valid for 60 days

    await db.insert(activityRewards).values({
      userId,
      rewardType: 'monthly_discount',
      description: `${PRICING_CONFIG.rewards.monthlyDiscountPercent}% off your next bulk pack for adding ${PRICING_CONFIG.rewards.monthlyAddsThreshold}+ members this month`,
      discountPercent: PRICING_CONFIG.rewards.monthlyDiscountPercent,
      expiresAt,
    });
  }

  async checkAndGrantMilestoneReward(userId: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || user.hasEarnedFreePackAt100) return false;

    const totalMembers = await this.calculateTotalMemberCount(userId);
    const threshold = PRICING_CONFIG.rewards.milestoneFreePack.memberCount;

    if (totalMembers >= threshold) {
      const freeCredits = PRICING_CONFIG.rewards.milestoneFreePack.freeCredits;

      // Grant the free credits
      await db.update(users)
        .set({
          memberCredits: (user.memberCredits || 0) + freeCredits,
          hasEarnedFreePackAt100: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Record the reward
      await db.insert(activityRewards).values({
        userId,
        rewardType: 'milestone_free_pack',
        description: `Free ${freeCredits}-member pack for reaching ${threshold} connected members`,
        freeCredits,
        isUsed: true,
        usedAt: new Date(),
      });

      return true;
    }
    return false;
  }

  async createBulkPackCheckout(
    userId: string,
    packType: 'starter_10' | 'growth_25' | 'family_50',
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) throw new Error('User not found');

    const pack = PRICING_CONFIG.packs.find(p => p.type === packType);
    if (!pack) throw new Error('Invalid pack type');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
    }

    // Check for active discount reward
    const activeReward = await this.getActiveReward(userId);
    let finalPrice = pack.priceCents;
    let discountApplied = 0;

    if (activeReward) {
      discountApplied = Math.round(pack.priceCents * (activeReward.discountPercent / 100));
      finalPrice = pack.priceCents - discountApplied;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `FamilyRoots ${pack.label}`,
            description: `${pack.credits} member credits${activeReward ? ` (${activeReward.discountPercent}% reward discount applied)` : ''}`,
          },
          unit_amount: finalPrice,
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        type: 'bulk_pack',
        packType,
        credits: pack.credits.toString(),
        discountApplied: discountApplied.toString(),
        rewardId: activeReward?.id || '',
      },
    });

    // Record the purchase as pending
    await db.insert(bulkPackPurchases).values({
      userId,
      packType,
      creditsTotal: pack.credits,
      amountCents: finalPrice,
      discountApplied,
      stripeSessionId: session.id,
      status: 'pending',
    });

    return session;
  }

  async handleBulkPackPaymentCompleted(
    userId: string,
    packType: string,
    credits: number,
    stripeSessionId: string,
    paymentIntentId: string,
    rewardId?: string
  ): Promise<void> {
    // Update purchase record
    await db.update(bulkPackPurchases)
      .set({
        status: 'paid',
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      })
      .where(
        and(
          eq(bulkPackPurchases.userId, userId),
          eq(bulkPackPurchases.stripeSessionId, stripeSessionId),
          eq(bulkPackPurchases.status, 'pending')
        )
      );

    // Add credits to user
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const currentCredits = user?.memberCredits || 0;

    await db.update(users)
      .set({
        memberCredits: currentCredits + credits,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Mark reward as used if applicable
    if (rewardId) {
      await db.update(activityRewards)
        .set({ isUsed: true, usedAt: new Date() })
        .where(eq(activityRewards.id, rewardId));
    }
  }

  async createPremiumCheckout(userId: string, successUrl: string, cancelUrl: string) {
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
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'FamilyRoots Premium',
            description: PRICING_CONFIG.premium.features.join(', '),
          },
          unit_amount: PRICING_CONFIG.premium.monthlyPriceCents,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        type: 'premium_subscription',
      },
      subscription_data: {
        metadata: {
          userId,
          type: 'premium_subscription',
        },
      },
    });

    return session;
  }

  async handlePremiumSubscriptionCreated(userId: string, subscriptionId: string): Promise<void> {
    await db.update(users)
      .set({
        isPremium: true,
        premiumStartedAt: new Date(),
        stripeSubscriptionId: subscriptionId,
        isSubscriptionActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async handlePremiumSubscriptionCancelled(userId: string): Promise<void> {
    await db.update(users)
      .set({
        isPremium: false,
        isSubscriptionActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getUserPurchaseHistory(userId: string) {
    return db.select()
      .from(bulkPackPurchases)
      .where(and(
        eq(bulkPackPurchases.userId, userId),
        eq(bulkPackPurchases.status, 'paid')
      ))
      .orderBy(desc(bulkPackPurchases.createdAt));
  }

  async getUserRewards(userId: string) {
    return db.select()
      .from(activityRewards)
      .where(eq(activityRewards.userId, userId))
      .orderBy(desc(activityRewards.createdAt));
  }

  // Legacy methods kept for backward compatibility
  async createSubscriptionCheckout(userId: string, successUrl: string, cancelUrl: string, billingInterval: 'month' | 'year' = 'month') {
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

    const unitAmount = billingInterval === 'year' 
      ? getAnnualPrice(info.monthlyPrice)
      : info.monthlyPrice;

    const intervalDescription = billingInterval === 'year'
      ? `${info.discountPercent}% tier discount + 20% annual discount`
      : `${info.discountPercent}% discount`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'FamilyRoots Subscription',
            description: `${intervalDescription} - ${info.totalMemberCount} family members`,
          },
          unit_amount: unitAmount,
          recurring: { interval: billingInterval },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tier: info.currentTier,
        memberCount: info.totalMemberCount.toString(),
        billingInterval,
      },
      subscription_data: {
        metadata: {
          userId,
          tier: info.currentTier,
          billingInterval,
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
