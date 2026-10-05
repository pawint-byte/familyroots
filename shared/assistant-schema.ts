import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import type { AssistantScope } from "./assistant";

export const assistantKeys = pgTable("assistant_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  treeId: varchar("tree_id").notNull(),
  memberId: varchar("member_id"),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  scopes: jsonb("scopes").$type<AssistantScope[]>().notNull(),
  reviewDueAt: timestamp("review_due_at").notNull(),
  pauseAt: timestamp("pause_at").notNull(),
  stoppedAt: timestamp("stopped_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
}, t => [index("assistant_keys_owner_idx").on(t.userId)]);

export const assistantActions = pgTable("assistant_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  keyId: varchar("key_id"),
  treeId: varchar("tree_id").notNull(),
  requestId: text("request_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  result: jsonb("result").$type<Record<string, unknown>>(),
  httpStatus: integer("http_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, t => [
  uniqueIndex("assistant_actions_retry_idx").on(t.keyId, t.requestId),
  index("assistant_actions_owner_idx").on(t.userId, t.createdAt),
]);
