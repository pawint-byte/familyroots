import { z } from "zod";
import { pgTable, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const reference = z.string().trim().min(1).max(200);
const tree = { treeId: reference.optional(), treeName: reference.optional() };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value;
}, "Use a real calendar date in YYYY-MM-DD format.");
export const helpActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create_tree"), name: reference, treeType: z.enum(["family", "friends", "custom"]).default("friends") }).strict(),
  z.object({ kind: z.literal("add_event"), ...tree, title: reference, eventDate: date, eventType: z.enum(["birth", "death", "marriage", "divorce", "milestone"]).default("milestone"), memberId: reference.optional(), description: z.string().max(2000).optional() }).strict(),
  z.object({ kind: z.literal("send_invite"), ...tree, email: z.string().email().max(254) }).strict(),
  z.object({ kind: z.literal("delete_created"), resourceId: reference.optional(), name: reference.optional(), resourceType: z.enum(["tree", "event", "invite"]).default("tree") }).strict(),
]);
export type HelpActionInput = z.infer<typeof helpActionSchema>;
export interface HelpConfirmation {
  actionId: string;
  summary: string;
  expiresAt: string;
  kind: HelpActionInput["kind"];
}
export interface HelpActionResult {
  message: string;
  resourceId?: string;
  resourceType?: "tree" | "event" | "invite";
  treeId?: string;
  status?: string;
}
export const helpAssistantActions = pgTable("help_assistant_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  sessionHash: varchar("session_hash").notNull(),
  kind: text("kind").notNull(),
  state: text("state").notNull().default("pending"),
  payload: jsonb("payload").$type<HelpActionInput>().notNull(),
  result: jsonb("result").$type<HelpActionResult>(),
  resourceId: varchar("resource_id"),
  resourceType: text("resource_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
}, t => [index("help_assistant_actions_user_created").on(t.userId, t.createdAt)]);
