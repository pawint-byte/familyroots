import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Enums
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const relationshipTypeEnum = pgEnum("relationship_type", ["parent", "child", "spouse", "sibling"]);
export const privacyEnum = pgEnum("privacy", ["private", "public"]);

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
  canEdit: boolean("can_edit").default(false),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
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

export const insertFamilyEventSchema = createInsertSchema(familyEvents).omit({
  id: true,
  createdAt: true,
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

export type FamilyEvent = typeof familyEvents.$inferSelect;
export type InsertFamilyEvent = z.infer<typeof insertFamilyEventSchema>;
