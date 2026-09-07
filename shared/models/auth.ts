import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer, boolean, pgEnum, date, text, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Subscription tier enum (legacy - kept for backward compatibility)
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "tier_25", "tier_50", "tier_75", "tier_100"]);

// Gender enum for user profile
export const userGenderEnum = pgEnum("user_gender", ["male", "female", "other"]);

// Bulk pack type enum
export const bulkPackTypeEnum = pgEnum("bulk_pack_type", ["starter_10", "growth_25", "family_50"]);

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Notification preferences type
export interface NotificationPreferences {
  births: boolean;
  deaths: boolean;
  marriages: boolean;
  divorces: boolean;
  milestones: boolean;
  emailEnabled: boolean;
}

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Personal profile fields (single source of truth for claimed profiles)
  nickname: text("nickname"),
  gender: userGenderEnum("gender"),
  birthDate: date("birth_date"),
  birthPlace: text("birth_place"),
  bio: text("bio"),
  // Location fields for connecting with family
  currentCity: text("current_city"),
  currentRegion: text("current_region"),
  currentCountry: text("current_country"),
  locationVisible: boolean("location_visible").default(false),
  
  // Subscription and payment fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),
  totalMemberCount: integer("total_member_count").default(0),
  lastMilestoneReached: integer("last_milestone_reached").default(0),
  isSubscriptionActive: boolean("is_subscription_active").default(false),

  // New pricing model fields
  memberCredits: integer("member_credits").default(0),
  isPremium: boolean("is_premium").default(false),
  premiumTier: varchar("premium_tier").default("explorer"),
  premiumStartedAt: timestamp("premium_started_at"),
  monthlyAddsCount: integer("monthly_adds_count").default(0),
  monthlyAddsResetAt: timestamp("monthly_adds_reset_at"),
  hasEarnedFreePackAt100: boolean("has_earned_free_pack_at_100").default(false),

  passwordHash: text("password_hash"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  authProvider: varchar("auth_provider").default("replit"),
  emailVerified: boolean("email_verified").default(false),
  emailVerifyToken: varchar("email_verify_token"),
  isAdmin: boolean("is_admin").default(false),

  subscriptionCancelledAt: timestamp("subscription_cancelled_at"),
  contentRetentionWarningsSent: integer("content_retention_warnings_sent").default(0),

  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  inactivityReminderSentAt: timestamp("inactivity_reminder_sent_at"),
  annualReviewSentYear: integer("annual_review_sent_year"),
  notificationPreferences: jsonb("notification_preferences").$type<NotificationPreferences>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Member milestone payments table (legacy - kept for backward compatibility)
export const memberMilestonePayments = pgTable("member_milestone_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  milestone: integer("milestone").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  amountCents: integer("amount_cents").notNull(),
  status: varchar("status").default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bulk pack purchases table
export const bulkPackPurchases = pgTable("bulk_pack_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  packType: bulkPackTypeEnum("pack_type").notNull(),
  creditsTotal: integer("credits_total").notNull(),
  creditsUsed: integer("credits_used").default(0),
  amountCents: integer("amount_cents").notNull(),
  discountApplied: integer("discount_applied").default(0),
  stripeSessionId: varchar("stripe_session_id"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  status: varchar("status").default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cryptoPayments = pgTable("crypto_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  purchaseType: varchar("purchase_type").notNull(),
  purchaseKey: varchar("purchase_key").notNull(),
  chain: varchar("chain").notNull(),
  status: varchar("status").notNull().default("pending"),
  toAddress: text("to_address").notNull(),
  expectedAmount: varchar("expected_amount").notNull(),
  expectedAsset: varchar("expected_asset").notNull(),
  usdAmount: numeric("usd_amount", { precision: 12, scale: 2 }).notNull(),
  destinationTag: varchar("destination_tag"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activity rewards tracking table
export const activityRewards = pgTable("activity_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  rewardType: varchar("reward_type").notNull(), // 'monthly_discount' | 'milestone_free_pack'
  description: text("description"),
  discountPercent: integer("discount_percent"),
  freeCredits: integer("free_credits"),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const featureUsage = pgTable("feature_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  feature: varchar("feature", { length: 50 }).notNull(),
  usageCount: integer("usage_count").default(0),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertBulkPackPurchaseSchema = createInsertSchema(bulkPackPurchases).omit({ id: true, createdAt: true });
export const insertActivityRewardSchema = createInsertSchema(activityRewards).omit({ id: true, createdAt: true });

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type MemberMilestonePayment = typeof memberMilestonePayments.$inferSelect;
export type InsertMemberMilestonePayment = typeof memberMilestonePayments.$inferInsert;
export type BulkPackPurchase = typeof bulkPackPurchases.$inferSelect;
export type InsertBulkPackPurchase = typeof bulkPackPurchases.$inferInsert;
export type ActivityReward = typeof activityRewards.$inferSelect;
export type InsertActivityReward = typeof activityRewards.$inferInsert;
export type FeatureUsage = typeof featureUsage.$inferSelect;
export type CryptoPayment = typeof cryptoPayments.$inferSelect;
