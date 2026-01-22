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
export const heirStatusEnum = pgEnum("heir_status", ["pending", "notified", "transferred", "cancelled"]);
export const matchRequestStatusEnum = pgEnum("match_request_status", ["pending", "accepted", "declined", "expired"]);
export const memberInvitationStatusEnum = pgEnum("member_invitation_status", ["pending", "clicked", "registered"]);

// Family Trees table
export const familyTrees = pgTable("family_trees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  privacy: privacyEnum("privacy").default("private").notNull(),
  rootMemberId: varchar("root_member_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Family Members table
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  nickname: text("nickname"),
  email: text("email"),
  gender: genderEnum("gender"),
  birthDate: date("birth_date"),
  birthPlace: text("birth_place"),
  deathDate: date("death_date"),
  isLiving: boolean("is_living").default(true),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  isUnknown: boolean("is_unknown").default(false),
  unknownLabel: text("unknown_label"),
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

// Account Heirs table (for deadman switch feature)
export const accountHeirs = pgTable("account_heirs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  heirEmail: text("heir_email").notNull(),
  heirName: text("heir_name").notNull(),
  relationship: text("relationship"),
  heirUserId: varchar("heir_user_id"),
  status: heirStatusEnum("status").default("pending").notNull(),
  inactivityMonths: text("inactivity_months").default("6"),
  reminderSentAt: timestamp("reminder_sent_at"),
  transferredAt: timestamp("transferred_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Education History table (for tracking education of family members)
export const educationHistory = pgTable("education_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  institution: text("institution").notNull(),
  degree: text("degree"),
  fieldOfStudy: text("field_of_study"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  graduated: boolean("graduated").default(false),
  honors: text("honors"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Career History table (for tracking employment of family members)
export const careerHistory = pgTable("career_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  employer: text("employer").notNull(),
  jobTitle: text("job_title"),
  industry: text("industry"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isCurrent: boolean("is_current").default(false),
  location: text("location"),
  achievements: text("achievements"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Discoverable Members table (for opt-in family matching)
export const discoverableMembers = pgTable("discoverable_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().unique(),
  treeId: varchar("tree_id").notNull(),
  isDiscoverable: boolean("is_discoverable").default(false).notNull(),
  matchByEmail: boolean("match_by_email").default(false),
  matchByName: boolean("match_by_name").default(false),
  matchByNickname: boolean("match_by_nickname").default(false),
  matchByBirthdate: boolean("match_by_birthdate").default(false),
  matchByBirthplace: boolean("match_by_birthplace").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Match Requests table (for connecting family trees)
export const matchRequests = pgTable("match_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestingTreeId: varchar("requesting_tree_id").notNull(),
  requestingMemberId: varchar("requesting_member_id").notNull(),
  targetTreeId: varchar("target_tree_id").notNull(),
  targetMemberId: varchar("target_member_id").notNull(),
  requestedBy: varchar("requested_by").notNull(),
  status: matchRequestStatusEnum("status").default("pending").notNull(),
  matchScore: text("match_score"),
  matchCriteria: text("match_criteria"),
  message: text("message"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Member Invitations table (track emails sent to non-registered users when added as family members)
export const memberInvitations = pgTable("member_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  memberId: varchar("member_id").notNull(),
  treeId: varchar("tree_id").notNull(),
  treeName: text("tree_name").notNull(),
  invitedBy: varchar("invited_by").notNull(),
  inviterName: text("inviter_name").notNull(),
  memberName: text("member_name").notNull(),
  status: memberInvitationStatusEnum("status").default("pending").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  clickedAt: timestamp("clicked_at"),
  registeredAt: timestamp("registered_at"),
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
  education: many(educationHistory),
  career: many(careerHistory),
}));

export const educationHistoryRelations = relations(educationHistory, ({ one }) => ({
  member: one(familyMembers, {
    fields: [educationHistory.memberId],
    references: [familyMembers.id],
  }),
}));

export const careerHistoryRelations = relations(careerHistory, ({ one }) => ({
  member: one(familyMembers, {
    fields: [careerHistory.memberId],
    references: [familyMembers.id],
  }),
}));

export const discoverableMembersRelations = relations(discoverableMembers, ({ one }) => ({
  member: one(familyMembers, {
    fields: [discoverableMembers.memberId],
    references: [familyMembers.id],
  }),
  tree: one(familyTrees, {
    fields: [discoverableMembers.treeId],
    references: [familyTrees.id],
  }),
}));

export const matchRequestsRelations = relations(matchRequests, ({ one }) => ({
  requestingTree: one(familyTrees, {
    fields: [matchRequests.requestingTreeId],
    references: [familyTrees.id],
  }),
  targetTree: one(familyTrees, {
    fields: [matchRequests.targetTreeId],
    references: [familyTrees.id],
  }),
  requestingMember: one(familyMembers, {
    fields: [matchRequests.requestingMemberId],
    references: [familyMembers.id],
  }),
  targetMember: one(familyMembers, {
    fields: [matchRequests.targetMemberId],
    references: [familyMembers.id],
  }),
}));

export const memberInvitationsRelations = relations(memberInvitations, ({ one }) => ({
  member: one(familyMembers, {
    fields: [memberInvitations.memberId],
    references: [familyMembers.id],
  }),
  tree: one(familyTrees, {
    fields: [memberInvitations.treeId],
    references: [familyTrees.id],
  }),
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

export const insertAccountHeirSchema = createInsertSchema(accountHeirs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEducationHistorySchema = createInsertSchema(educationHistory).omit({
  id: true,
  createdAt: true,
});

export const insertCareerHistorySchema = createInsertSchema(careerHistory).omit({
  id: true,
  createdAt: true,
});

export const insertDiscoverableMemberSchema = createInsertSchema(discoverableMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMatchRequestSchema = createInsertSchema(matchRequests).omit({
  id: true,
  createdAt: true,
});

export const insertMemberInvitationSchema = createInsertSchema(memberInvitations).omit({
  id: true,
  sentAt: true,
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

export type AccountHeir = typeof accountHeirs.$inferSelect;
export type InsertAccountHeir = z.infer<typeof insertAccountHeirSchema>;

export type EducationHistory = typeof educationHistory.$inferSelect;
export type InsertEducationHistory = z.infer<typeof insertEducationHistorySchema>;

export type CareerHistory = typeof careerHistory.$inferSelect;
export type InsertCareerHistory = z.infer<typeof insertCareerHistorySchema>;

export type DiscoverableMember = typeof discoverableMembers.$inferSelect;
export type InsertDiscoverableMember = z.infer<typeof insertDiscoverableMemberSchema>;

export type MatchRequest = typeof matchRequests.$inferSelect;
export type InsertMatchRequest = z.infer<typeof insertMatchRequestSchema>;

export type MemberInvitation = typeof memberInvitations.$inferSelect;
export type InsertMemberInvitation = z.infer<typeof insertMemberInvitationSchema>;
