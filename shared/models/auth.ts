import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer, boolean, pgEnum, date, text } from "drizzle-orm/pg-core";

// Subscription tier enum
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "tier_25", "tier_50", "tier_75", "tier_100"]);

// Gender enum for user profile
export const userGenderEnum = pgEnum("user_gender", ["male", "female", "other"]);

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
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  inactivityReminderSentAt: timestamp("inactivity_reminder_sent_at"),
  notificationPreferences: jsonb("notification_preferences").$type<NotificationPreferences>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Member milestone payments table (for tracking 100+ member one-time payments)
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

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type MemberMilestonePayment = typeof memberMilestonePayments.$inferSelect;
export type InsertMemberMilestonePayment = typeof memberMilestonePayments.$inferInsert;
