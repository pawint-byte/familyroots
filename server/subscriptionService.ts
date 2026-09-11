import { db } from './db';
import { users, memberMilestonePayments, bulkPackPurchases, activityRewards, featureUsage } from '@shared/models/auth';
import { familyTrees, familyMembers } from '@shared/schema';
import { eq, sql, and, gte, desc, lte } from 'drizzle-orm';
import { getUncachableStripeClient } from './stripeClient';
import { isAdminAccount } from './adminConfig';
import {
  PRICING_CONFIG as SHARED_PRICING_CONFIG,
  TIER_CONFIG as SHARED_TIER_CONFIG,
  TIER_LIMITS as SHARED_TIER_LIMITS,
  FEATURE_INFO as SHARED_FEATURE_INFO,
  TIER_ORDER as SHARED_TIER_ORDER,
  type PremiumFeature as SharedPremiumFeature,
  type FeatureTier as SharedFeatureTier,
} from '@shared/pricing';

export type PremiumFeature = SharedPremiumFeature;

export type FeatureTier = SharedFeatureTier;

export const TIER_ORDER: FeatureTier[] = [...SHARED_TIER_ORDER];

export const TIER_CONFIG = SHARED_TIER_CONFIG;

export const TIER_LIMITS = SHARED_TIER_LIMITS;

export const FEATURE_INFO = SHARED_FEATURE_INFO;

export const PREMIUM_LIMITS: Record<PremiumFeature, { freeLimit: number; period: 'monthly' | 'lifetime'; label: string; description: string }> = {
  ai_chat: { freeLimit: 5, period: 'monthly', label: 'AI Chat', description: 'AI-powered family tree assistant' },
  familysearch_import: { freeLimit: 1, period: 'monthly', label: 'FamilySearch Import', description: 'Import ancestors from FamilySearch' },
  email_tagged_group: { freeLimit: 2, period: 'monthly', label: 'Email Tagged Group', description: 'Send emails to tagged members' },
  ai_avatar_video: { freeLimit: 0, period: 'monthly', label: 'AI Avatar Video', description: 'Generate AI avatar videos' },
  media_upload: { freeLimit: 10, period: 'monthly', label: 'Media Upload', description: 'Upload photos and media to events' },
  voice_video_upload: { freeLimit: 0, period: 'monthly', label: 'Voice & Video', description: 'Record voice notes and attach videos to members' },
  tree_wall: { freeLimit: 0, period: 'monthly', label: 'Group Wall', description: 'Group messaging wall within your trees' },
};

// New pricing model: Bulk add packs + tiered subscriptions
export const PRICING_CONFIG = SHARED_PRICING_CONFIG;

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
  featureTier: FeatureTier;
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
    const featureTier = this.getUserTier(user || {});
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
      featureTier,
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
    cancelUrl: string,
    options?: {
      paymentMethodTypes?: Array<'card' | 'crypto'>;
      metadata?: Record<string, string>;
    },
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

    const checkoutMetadata = {
      userId,
      type: 'bulk_pack',
      packType,
      credits: pack.credits.toString(),
      discountApplied: discountApplied.toString(),
      rewardId: activeReward?.id || '',
      ...options?.metadata,
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: options?.paymentMethodTypes || ['card'],
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
      metadata: checkoutMetadata,
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

  async createTierCheckout(
    userId: string,
    tier: FeatureTier,
    successUrl: string,
    cancelUrl: string,
    options?: {
      paymentMethodTypes?: Array<'card' | 'crypto'>;
      metadata?: Record<string, string>;
    },
  ) {
    if (tier === 'explorer') throw new Error('Explorer is the free tier');
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

    const tierInfo = TIER_CONFIG[tier];
    const featureList = Object.entries(TIER_LIMITS).map(([key, limits]) => {
      const info = FEATURE_INFO[key as PremiumFeature];
      const val = limits[tier];
      return `${info.label}: ${val === -1 ? 'Unlimited' : val}/mo`;
    }).join(', ');

    const checkoutMetadata = {
      userId,
      type: 'tier_subscription',
      tier,
      ...options?.metadata,
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: options?.paymentMethodTypes || ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `FamilyRoots ${tierInfo.label}`,
            description: featureList,
          },
          unit_amount: tierInfo.monthlyPriceCents,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: checkoutMetadata,
      subscription_data: {
        metadata: checkoutMetadata,
      },
    });

    return session;
  }

  async createPremiumCheckout(userId: string, successUrl: string, cancelUrl: string) {
    return this.createTierCheckout(userId, 'cultivator', successUrl, cancelUrl);
  }

  async handleTierSubscriptionCreated(userId: string, tier: FeatureTier, subscriptionId: string): Promise<void> {
    await db.update(users)
      .set({
        isPremium: tier !== 'explorer',
        premiumTier: tier,
        premiumStartedAt: new Date(),
        stripeSubscriptionId: subscriptionId,
        isSubscriptionActive: true,
        subscriptionCancelledAt: null,
        contentRetentionWarningsSent: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async handlePremiumSubscriptionCreated(userId: string, subscriptionId: string): Promise<void> {
    await this.handleTierSubscriptionCreated(userId, 'cultivator', subscriptionId);
  }

  async handlePremiumSubscriptionCancelled(userId: string): Promise<void> {
    await db.update(users)
      .set({
        isPremium: false,
        premiumTier: 'explorer',
        isSubscriptionActive: false,
        subscriptionCancelledAt: new Date(),
        contentRetentionWarningsSent: 0,
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

  // ==================== PREMIUM FEATURE USAGE TRACKING ====================

  private getCurrentPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  getUserTier(user: { id?: string | null; email?: string | null; premiumTier?: string | null; isPremium?: boolean | null; isAdmin?: boolean | null }): FeatureTier {
    if (user.isAdmin || isAdminAccount(user.id, user.email)) return 'legacy';
    if (user.premiumTier && TIER_ORDER.includes(user.premiumTier as FeatureTier)) {
      return user.premiumTier as FeatureTier;
    }
    if (user.isPremium) return 'cultivator';
    return 'explorer';
  }

  getTierLimit(tier: FeatureTier, feature: PremiumFeature): number {
    return TIER_LIMITS[feature][tier];
  }

  getNextTierForFeature(currentTier: FeatureTier): FeatureTier | null {
    const idx = TIER_ORDER.indexOf(currentTier);
    if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
    return TIER_ORDER[idx + 1];
  }

  async getFeatureUsage(userId: string, feature: PremiumFeature): Promise<{ used: number; limit: number; remaining: number; tier: FeatureTier }> {
    const [user] = await db.select({ id: users.id, email: users.email, isPremium: users.isPremium, premiumTier: users.premiumTier, isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId));
    const tier = this.getUserTier(user || {});
    const limit = this.getTierLimit(tier, feature);

    if (limit === -1) {
      return { used: 0, limit: -1, remaining: -1, tier };
    }

    const { start, end } = this.getCurrentPeriod();
    const [record] = await db.select()
      .from(featureUsage)
      .where(
        and(
          eq(featureUsage.userId, userId),
          eq(featureUsage.feature, feature),
          gte(featureUsage.periodStart, start),
          lte(featureUsage.periodEnd, end)
        )
      );

    const used = record?.usageCount || 0;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      tier,
    };
  }

  async checkFeatureAccess(userId: string, feature: PremiumFeature): Promise<{ allowed: boolean; used: number; limit: number; isPremium: boolean; tier: FeatureTier; nextTier: FeatureTier | null }> {
    const usage = await this.getFeatureUsage(userId, feature);
    const nextTier = this.getNextTierForFeature(usage.tier);
    if (usage.limit === -1) {
      return { allowed: true, used: 0, limit: -1, isPremium: usage.tier !== 'explorer', tier: usage.tier, nextTier };
    }
    return {
      allowed: usage.remaining > 0,
      used: usage.used,
      limit: usage.limit,
      isPremium: usage.tier !== 'explorer',
      tier: usage.tier,
      nextTier,
    };
  }

  async incrementFeatureUsage(userId: string, feature: PremiumFeature): Promise<{ used: number; limit: number; remaining: number }> {
    const [user] = await db.select({ id: users.id, email: users.email, isPremium: users.isPremium, premiumTier: users.premiumTier, isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId));
    const tier = this.getUserTier(user || {});
    const limit = this.getTierLimit(tier, feature);

    if (limit === -1) {
      return { used: 0, limit: -1, remaining: -1 };
    }

    const { start, end } = this.getCurrentPeriod();
    const [existing] = await db.select()
      .from(featureUsage)
      .where(
        and(
          eq(featureUsage.userId, userId),
          eq(featureUsage.feature, feature),
          gte(featureUsage.periodStart, start),
          lte(featureUsage.periodEnd, end)
        )
      );

    let newCount: number;
    if (existing) {
      newCount = (existing.usageCount || 0) + 1;
      await db.update(featureUsage)
        .set({ usageCount: newCount, updatedAt: new Date() })
        .where(eq(featureUsage.id, existing.id));
    } else {
      newCount = 1;
      await db.insert(featureUsage).values({
        userId,
        feature,
        usageCount: 1,
        periodStart: start,
        periodEnd: end,
      });
    }

    return {
      used: newCount,
      limit,
      remaining: Math.max(0, limit - newCount),
    };
  }

  async getAllFeatureUsage(userId: string): Promise<Record<PremiumFeature, { used: number; limit: number; remaining: number; tier: FeatureTier }>> {
    const [user] = await db.select({ id: users.id, email: users.email, isPremium: users.isPremium, premiumTier: users.premiumTier, isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId));
    const tier = this.getUserTier(user || {});

    const result = {} as Record<PremiumFeature, { used: number; limit: number; remaining: number; tier: FeatureTier }>;

    const { start, end } = this.getCurrentPeriod();
    const records = await db.select()
      .from(featureUsage)
      .where(
        and(
          eq(featureUsage.userId, userId),
          gte(featureUsage.periodStart, start),
          lte(featureUsage.periodEnd, end)
        )
      );

    const usageMap = new Map(records.map(r => [r.feature, r.usageCount || 0]));

    for (const feature of Object.keys(TIER_LIMITS) as PremiumFeature[]) {
      const limit = this.getTierLimit(tier, feature);
      const used = limit === -1 ? 0 : (usageMap.get(feature) || 0);
      result[feature] = {
        used,
        limit,
        remaining: limit === -1 ? -1 : Math.max(0, limit - used),
        tier,
      };
    }

    return result;
  }
  async checkPremiumContentAccess(creatorUserId: string): Promise<{ accessible: boolean; reason?: string; cancelledAt?: Date | null }> {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      isPremium: users.isPremium,
      premiumTier: users.premiumTier,
      isAdmin: users.isAdmin,
      isSubscriptionActive: users.isSubscriptionActive,
      subscriptionCancelledAt: users.subscriptionCancelledAt,
    }).from(users).where(eq(users.id, creatorUserId));

    if (!user) {
      return { accessible: false, reason: 'creator_not_found' };
    }

    const tier = this.getUserTier(user);
    if (tier !== 'explorer') {
      return { accessible: true };
    }

    if (user.subscriptionCancelledAt) {
      return { accessible: false, reason: 'subscription_cancelled', cancelledAt: user.subscriptionCancelledAt };
    }

    return { accessible: false, reason: 'never_subscribed' };
  }

  async getCancelledUsersForRetentionWarnings(): Promise<Array<{ id: string; email: string | null; firstName: string | null; subscriptionCancelledAt: Date; contentRetentionWarningsSent: number }>> {
    const results = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      subscriptionCancelledAt: users.subscriptionCancelledAt,
      contentRetentionWarningsSent: users.contentRetentionWarningsSent,
    }).from(users).where(
      and(
        sql`${users.subscriptionCancelledAt} IS NOT NULL`,
        eq(users.premiumTier, 'explorer'),
        sql`${users.contentRetentionWarningsSent} < 3`
      )
    );
    return results.filter(u => u.subscriptionCancelledAt !== null) as any;
  }

  async incrementRetentionWarning(userId: string): Promise<void> {
    await db.update(users)
      .set({
        contentRetentionWarningsSent: sql`COALESCE(${users.contentRetentionWarningsSent}, 0) + 1`,
      })
      .where(eq(users.id, userId));
  }
}

export const subscriptionService = new SubscriptionService();
