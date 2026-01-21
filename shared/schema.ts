import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Re-export chat models (for AI chatbot)
export * from "./models/chat";

// Enums
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const relationshipTypeEnum = pgEnum("relationship_type", ["parent", "child", "spouse", "sibling"]);
export const privacyEnum = pgEnum("privacy", ["private", "public"]);
export const videoStatusEnum = pgEnum("video_status", ["pending", "processing", "completed", "failed"]);
export const collaboratorRoleEnum = pgEnum("collaborator_role", ["viewer", "editor", "co_owner"]);
export const nameChangeReasonEnum = pgEnum("name_change_reason", ["birth", "marriage", "divorce", "adoption", "legal", "other"]);

// Family Trees table
export const familyTrees = pgTable("family_trees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  privacy: privacyEnum("privacy").default("private").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Family Members table
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  gender: genderEnum("gender"),
  birthDate: date("birth_date"),
  birthPlace: text("birth_place"),
  deathDate: date("death_date"),
  isLiving: boolean("is_living").default(true),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relationships table
export const relationships = pgTable("relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  fromMemberId: varchar("from_member_id").notNull(),
  toMemberId: varchar("to_member_id").notNull(),
  relationshipType: relationshipTypeEnum("relationship_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tree Collaborators table
export const treeCollaborators = pgTable("tree_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: collaboratorRoleEnum("role").default("viewer").notNull(),
  canEdit: boolean("can_edit").default(false),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
});

// Tree Invitations table (for shareable invite links)
export const treeInvitations = pgTable("tree_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  inviteCode: varchar("invite_code").notNull().unique(),
  role: collaboratorRoleEnum("role").default("viewer").notNull(),
  createdBy: varchar("created_by").notNull(),
  expiresAt: timestamp("expires_at"),
  maxUses: text("max_uses"),
  usedCount: text("used_count").default("0"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tree Connections table (for linking two trees together)
export const treeConnections = pgTable("tree_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tree1Id: varchar("tree1_id").notNull(),
  tree2Id: varchar("tree2_id").notNull(),
  connector1MemberId: varchar("connector1_member_id"),
  connector2MemberId: varchar("connector2_member_id"),
  connectionType: text("connection_type").default("marriage"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Name History table (for tracking name changes through life events)
export const nameHistory = pgTable("name_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  maidenName: text("maiden_name"),
  reason: nameChangeReasonEnum("reason").notNull(),
  effectiveDate: date("effective_date"),
  endDate: date("end_date"),
  spouseId: varchar("spouse_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Family Events (for timeline)
export const familyEvents = pgTable("family_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  memberId: varchar("member_id"),
  eventType: text("event_type").notNull(),
  eventDate: date("event_date").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// HeyGen Generated Videos
export const generatedVideos = pgTable("generated_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  heygenVideoId: varchar("heygen_video_id"),
  title: text("title").notNull(),
  script: text("script").notNull(),
  avatarId: varchar("avatar_id").notNull(),
  voiceId: varchar("voice_id").notNull(),
  backgroundUrl: text("background_url"),
  destinationUrl: text("destination_url").notNull(),
  status: videoStatusEnum("status").default("pending").notNull(),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: text("duration"),
  errorMessage: text("error_message"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const familyTreesRelations = relations(familyTrees, ({ many }) => ({
  members: many(familyMembers),
  relationships: many(relationships),
  collaborators: many(treeCollaborators),
  events: many(familyEvents),
}));

export const familyMembersRelations = relations(familyMembers, ({ one, many }) => ({
  tree: one(familyTrees, {
    fields: [familyMembers.treeId],
    references: [familyTrees.id],
  }),
  events: many(familyEvents),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [relationships.treeId],
    references: [familyTrees.id],
  }),
  fromMember: one(familyMembers, {
    fields: [relationships.fromMemberId],
    references: [familyMembers.id],
  }),
  toMember: one(familyMembers, {
    fields: [relationships.toMemberId],
    references: [familyMembers.id],
  }),
}));

export const treeCollaboratorsRelations = relations(treeCollaborators, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [treeCollaborators.treeId],
    references: [familyTrees.id],
  }),
}));

export const treeInvitationsRelations = relations(treeInvitations, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [treeInvitations.treeId],
    references: [familyTrees.id],
  }),
}));

export const nameHistoryRelations = relations(nameHistory, ({ one }) => ({
  member: one(familyMembers, {
    fields: [nameHistory.memberId],
    references: [familyMembers.id],
  }),
  spouse: one(familyMembers, {
    fields: [nameHistory.spouseId],
    references: [familyMembers.id],
  }),
}));

export const treeConnectionsRelations = relations(treeConnections, ({ one }) => ({
  tree1: one(familyTrees, {
    fields: [treeConnections.tree1Id],
    references: [familyTrees.id],
  }),
  tree2: one(familyTrees, {
    fields: [treeConnections.tree2Id],
    references: [familyTrees.id],
  }),
}));

export const familyEventsRelations = relations(familyEvents, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [familyEvents.treeId],
    references: [familyTrees.id],
  }),
  member: one(familyMembers, {
    fields: [familyEvents.memberId],
    references: [familyMembers.id],
  }),
}));

// Insert schemas
export const insertFamilyTreeSchema = createInsertSchema(familyTrees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRelationshipSchema = createInsertSchema(relationships).omit({
  id: true,
  createdAt: true,
});

export const insertTreeCollaboratorSchema = createInsertSchema(treeCollaborators).omit({
  id: true,
  invitedAt: true,
});

export const insertTreeInvitationSchema = createInsertSchema(treeInvitations).omit({
  id: true,
  createdAt: true,
});

export const insertNameHistorySchema = createInsertSchema(nameHistory).omit({
  id: true,
  createdAt: true,
});

export const insertTreeConnectionSchema = createInsertSchema(treeConnections).omit({
  id: true,
  createdAt: true,
});

export const insertFamilyEventSchema = createInsertSchema(familyEvents).omit({
  id: true,
  createdAt: true,
});

export const insertGeneratedVideoSchema = createInsertSchema(generatedVideos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type FamilyTree = typeof familyTrees.$inferSelect;
export type InsertFamilyTree = z.infer<typeof insertFamilyTreeSchema>;

export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;

export type Relationship = typeof relationships.$inferSelect;
export type InsertRelationship = z.infer<typeof insertRelationshipSchema>;

export type TreeCollaborator = typeof treeCollaborators.$inferSelect;
export type InsertTreeCollaborator = z.infer<typeof insertTreeCollaboratorSchema>;

export type TreeInvitation = typeof treeInvitations.$inferSelect;
export type InsertTreeInvitation = z.infer<typeof insertTreeInvitationSchema>;

export type NameHistory = typeof nameHistory.$inferSelect;
export type InsertNameHistory = z.infer<typeof insertNameHistorySchema>;

export type TreeConnection = typeof treeConnections.$inferSelect;
export type InsertTreeConnection = z.infer<typeof insertTreeConnectionSchema>;

export type FamilyEvent = typeof familyEvents.$inferSelect;
export type InsertFamilyEvent = z.infer<typeof insertFamilyEventSchema>;

export type GeneratedVideo = typeof generatedVideos.$inferSelect;
export type InsertGeneratedVideo = z.infer<typeof insertGeneratedVideoSchema>;
