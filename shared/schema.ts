import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, date, pgEnum, integer, jsonb, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Re-export chat models (for AI chatbot)
export * from "./models/chat";

// Enums
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const relationshipTypeEnum = pgEnum("relationship_type", ["parent", "child", "spouse", "sibling", "coparent"]);
export const relationshipQualifierEnum = pgEnum("relationship_qualifier", ["biological", "step", "adopted", "foster", "half", "in-law"]);
export const privacyEnum = pgEnum("privacy", ["private", "public"]);
export const videoStatusEnum = pgEnum("video_status", ["pending", "processing", "completed", "failed"]);
export const collaboratorRoleEnum = pgEnum("collaborator_role", ["viewer", "editor", "co_owner"]);
export const nameChangeReasonEnum = pgEnum("name_change_reason", ["birth", "marriage", "divorce", "adoption", "legal", "other"]);
export const heirStatusEnum = pgEnum("heir_status", ["pending", "notified", "transferred", "cancelled"]);
export const matchRequestStatusEnum = pgEnum("match_request_status", ["pending", "accepted", "declined", "expired"]);
export const memberInvitationStatusEnum = pgEnum("member_invitation_status", ["pending", "clicked", "registered"]);
export const merchandiseOrderStatusEnum = pgEnum("merchandise_order_status", ["pending", "paid", "submitted", "processing", "shipped", "delivered", "cancelled", "failed"]);
export const profileClaimStatusEnum = pgEnum("profile_claim_status", ["pending", "approved", "denied"]);

// Visibility tier enum for privacy controls
// full: All details visible (immediate family default)
// extended: Name, relationship, birth year, photo only (extended family)
// limited: Name and relationship only (distant relatives/public)
export const visibilityTierEnum = pgEnum("visibility_tier", ["full", "extended", "limited"]);

// Special connection types (non-blood relationships)
export const specialConnectionTypeEnum = pgEnum("special_connection_type", [
  "godparent", "godchild", "boyfriend", "girlfriend", "fiance", "fiancee",
  "ex_boyfriend", "ex_girlfriend", "ex_spouse",
  "best_friend", "family_friend", "mentor", "mentee", "guardian", "ward", "other"
]);

// Connection request status
export const connectionRequestStatusEnum = pgEnum("connection_request_status", ["pending", "approved", "denied", "expired"]);

// User relationship type enum (for QR code connections - how the requester is related to the target)
export const userRelationshipTypeEnum = pgEnum("user_relationship_type", [
  "son", "daughter", "parent", "spouse", "sibling", 
  "grandparent", "grandchild", "aunt", "uncle", "niece", "nephew",
  "cousin", "in_law", "step_relative", "other"
]);

// Tree type enum for multi-tree-type support
export const treeTypeEnum = pgEnum("tree_type", [
  "family", "church", "sports", "fraternity", "friends", "professional", "school", "custom"
]);

// Family Trees table
export const familyTrees = pgTable("family_trees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  privacy: privacyEnum("privacy").default("private").notNull(),
  rootMemberId: varchar("root_member_id"),
  // Privacy visibility default for non-immediate family members
  visibilityDefault: visibilityTierEnum("visibility_default").default("extended"),
  treeType: treeTypeEnum("tree_type").default("family").notNull(),
  treeTypeLabel: text("tree_type_label"),
  customRelationshipTypes: jsonb("custom_relationship_types").$type<(string | { label: string; reverseLabel?: string })[]>(),
  preferredLayout: text("preferred_layout"),
  isDiscoverable: boolean("is_discoverable").default(false),
  discoveryDescription: text("discovery_description"),
  discoveryCategory: text("discovery_category"),
  discoveryLocation: text("discovery_location"),
  autoJoin: boolean("auto_join").default(false),
  parentTreeId: varchar("parent_tree_id"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Family Members table
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  suffix: text("suffix"), // Jr, Sr, III, etc.
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
  claimedByUserId: varchar("claimed_by_user_id"),
  claimedAt: timestamp("claimed_at"),
  disassociatedAt: timestamp("disassociated_at"),
  disassociatedName: text("disassociated_name"),
  custodianUserId: varchar("custodian_user_id"), // For deceased members - who has custodianship
  custodianAssignedAt: timestamp("custodian_assigned_at"),
  // Privacy visibility override (null = use tree default)
  visibilityOverride: visibilityTierEnum("visibility_override"),
  // Location for connecting with family members (city/region)
  currentCity: text("current_city"),
  currentRegion: text("current_region"), // state/province
  currentCountry: text("current_country"),
  locationVisible: boolean("location_visible").default(false), // Whether to share location with connections
  customPosition: jsonb("custom_position").$type<{ x: number; y: number } | null>(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relationships table
export const relationships = pgTable("relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  fromMemberId: varchar("from_member_id").notNull(),
  toMemberId: varchar("to_member_id").notNull(),
  relationshipType: text("relationship_type").notNull(),
  qualifier: text("qualifier"),
  customLabel: text("custom_label"),
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

// Import scope enum for selective branch import
export const importScopeEnum = pgEnum("import_scope", [
  "single",
  "immediate_family",
  "descendants",
  "ancestors",
  "custom"
]);

// Tree Connection Imports table (for tracking import configurations)
export const treeConnectionImports = pgTable("tree_connection_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull(),
  sourceTreeId: varchar("source_tree_id").notNull(),
  targetTreeId: varchar("target_tree_id").notNull(),
  importRootMemberId: varchar("import_root_member_id").notNull(),
  importScope: importScopeEnum("import_scope").default("immediate_family").notNull(),
  includeSpouses: boolean("include_spouses").default(true),
  includeParents: boolean("include_parents").default(false),
  includeChildren: boolean("include_children").default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Imported Members table (materialized list of imported members)
export const importedMembers = pgTable("imported_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  importConfigId: varchar("import_config_id").notNull(),
  connectionId: varchar("connection_id").notNull(),
  sourceMemberId: varchar("source_member_id").notNull(),
  sourceTreeId: varchar("source_tree_id").notNull(),
  targetTreeId: varchar("target_tree_id").notNull(),
  importedBy: varchar("imported_by").notNull(),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
});

// Mute scope enum for member/branch muting
export const muteScopeEnum = pgEnum("mute_scope", ["member", "branch"]);

// Member Mutes table (per-user notification suppression)
export const memberMutes = pgTable("member_mutes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  treeId: varchar("tree_id").notNull(),
  memberId: varchar("member_id").notNull(),
  scope: muteScopeEnum("scope").default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMemberMuteSchema = createInsertSchema(memberMutes).omit({
  id: true,
  createdAt: true,
});
export type InsertMemberMute = z.infer<typeof insertMemberMuteSchema>;
export type MemberMute = typeof memberMutes.$inferSelect;

// Network Connection Requests table (auto-generated requests for extended family network)
export const networkConnectionRequests = pgTable("network_connection_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromTreeId: varchar("from_tree_id").notNull(),
  toTreeId: varchar("to_tree_id").notNull(),
  viaConnectionId: varchar("via_connection_id").notNull(), // The connection that triggered this request
  viaTreeId: varchar("via_tree_id").notNull(), // The intermediate tree (bridge)
  requestedBy: varchar("requested_by").notNull(), // User who owns fromTree
  toOwnerId: varchar("to_owner_id").notNull(), // User who owns toTree
  status: text("status").default("pending").notNull(), // pending, approved, denied
  message: text("message"), // Optional message explaining the connection
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
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
// Media attachment type for events
export interface EventMediaAttachment {
  url: string;
  type: 'image' | 'video';
  caption?: string;
  uploadedAt: string;
}

export const familyEvents = pgTable("family_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  memberId: varchar("member_id"),
  eventType: text("event_type").notNull(), // birth, death, marriage, divorce, milestone
  eventDate: date("event_date").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  mediaAttachments: jsonb("media_attachments").$type<EventMediaAttachment[]>(),
  createdBy: varchar("created_by"),
  notificationsSent: boolean("notifications_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdBy: varchar("created_by").notNull(),
  sourceTreeId: varchar("source_tree_id").notNull(),
  eventId: varchar("event_id"),
  title: text("title").notNull(),
  message: text("message"),
  eventType: text("event_type").notNull(),
  targetTreeIds: jsonb("target_tree_ids").$type<string[]>().notNull(),
  notificationsSent: boolean("notifications_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

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

// Profile Claim Requests table (for users to claim their own profiles)
export const profileClaimRequests = pgTable("profile_claim_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  treeId: varchar("tree_id").notNull(),
  requesterId: varchar("requester_id").notNull(),
  requesterEmail: text("requester_email"),
  status: profileClaimStatusEnum("status").default("pending").notNull(),
  message: text("message"),
  denialReason: text("denial_reason"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Custodianship status enum
export const custodianshipStatusEnum = pgEnum("custodianship_status", ["pending", "approved", "denied", "auto_approved", "expired"]);

// Profile Custodianship Requests table (for relatives to take over deceased member profiles)
export const custodianshipRequests = pgTable("custodianship_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(), // The deceased member's profile
  treeId: varchar("tree_id").notNull(),
  requesterId: varchar("requester_id").notNull(), // Direct relative requesting custodianship
  requesterEmail: text("requester_email"),
  relationshipToMember: text("relationship_to_member").notNull(), // parent, child, spouse, sibling
  reason: text("reason"), // Why they're requesting custodianship
  status: custodianshipStatusEnum("status").default("pending").notNull(),
  denialReason: text("denial_reason"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from creation for auto-approval
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  reminderCount: integer("reminder_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustodianshipRequestSchema = createInsertSchema(custodianshipRequests).omit({
  id: true,
  createdAt: true,
});

// Special Connections table (for non-blood relationships like godparents, friends, etc.)
export const specialConnections = pgTable("special_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromMemberId: varchar("from_member_id").notNull(), // The member in the tree
  fromTreeId: varchar("from_tree_id").notNull(),
  toMemberId: varchar("to_member_id").notNull(), // The connected person (can be in different tree)
  toTreeId: varchar("to_tree_id").notNull(),
  connectionType: specialConnectionTypeEnum("connection_type").notNull(),
  customLabel: text("custom_label"), // For "other" type or custom description
  notes: text("notes"),
  isReciprocal: boolean("is_reciprocal").default(true), // Whether both sides see the connection
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSpecialConnectionSchema = createInsertSchema(specialConnections).omit({
  id: true,
  createdAt: true,
});

// Connection Requests table (for requesting to connect with someone)
export const connectionRequests = pgTable("connection_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromMemberId: varchar("from_member_id").notNull(), // Who is requesting
  fromTreeId: varchar("from_tree_id").notNull(),
  toMemberId: varchar("to_member_id").notNull(), // Who they want to connect with
  toTreeId: varchar("to_tree_id").notNull(),
  requesterId: varchar("requester_id").notNull(), // User who initiated the request
  connectionType: specialConnectionTypeEnum("connection_type").notNull(),
  customLabel: text("custom_label"),
  message: text("message"), // Reason for connecting
  status: connectionRequestStatusEnum("status").default("pending").notNull(),
  respondedBy: varchar("responded_by"),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"), // Optional expiration
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConnectionRequestSchema = createInsertSchema(connectionRequests).omit({
  id: true,
  createdAt: true,
});

// FamilySearch User Connections table
export const familySearchConnections = pgTable("family_search_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(), // Our user's ID
  familySearchId: varchar("family_search_id"), // FamilySearch person ID
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  displayName: text("display_name"), // Name from FamilySearch
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  lastSyncAt: timestamp("last_sync_at"),
});

export const insertFamilySearchConnectionSchema = createInsertSchema(familySearchConnections).omit({
  id: true,
  connectedAt: true,
});

export type FamilySearchConnection = typeof familySearchConnections.$inferSelect;
export type InsertFamilySearchConnection = z.infer<typeof insertFamilySearchConnectionSchema>;

// FamilySearch Record Sources table (attached records to family members)
export const familySearchSources = pgTable("family_search_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(), // Family member this source is attached to
  treeId: varchar("tree_id").notNull(),
  recordId: varchar("record_id").notNull(), // FamilySearch record ID
  recordTitle: text("record_title").notNull(),
  recordType: text("record_type"), // birth, death, marriage, census, etc.
  recordUrl: text("record_url"),
  recordData: jsonb("record_data"), // Cached record data
  notes: text("notes"),
  addedBy: varchar("added_by").notNull(), // User who attached this source
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFamilySearchSourceSchema = createInsertSchema(familySearchSources).omit({
  id: true,
  createdAt: true,
});

export type FamilySearchSource = typeof familySearchSources.$inferSelect;
export type InsertFamilySearchSource = z.infer<typeof insertFamilySearchSourceSchema>;

// External Person Identifiers - Links family members to external systems (FamilySearch, etc.)
// This enables cross-tree matching using shared external IDs
export const externalPersonIdentifiers = pgTable("external_person_identifiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  treeId: varchar("tree_id").notNull(),
  source: text("source").notNull(), // "familysearch", "ancestry", "myheritage", etc.
  externalId: text("external_id").notNull(), // The ID from the external system
  externalUrl: text("external_url"), // Link to the external record
  confidence: real("confidence").default(1.0), // Confidence score (1.0 = confirmed by user, lower = auto-matched)
  verifiedAt: timestamp("verified_at"), // When user confirmed the match
  verifiedBy: varchar("verified_by"), // User who verified
  metadata: jsonb("metadata"), // Additional data from external source (name, dates, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExternalPersonIdentifierSchema = createInsertSchema(externalPersonIdentifiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExternalPersonIdentifier = typeof externalPersonIdentifiers.$inferSelect;
export type InsertExternalPersonIdentifier = z.infer<typeof insertExternalPersonIdentifierSchema>;

// Pending Member Suggestions - Members discovered from external sources awaiting approval
export const pendingMemberSuggestions = pgTable("pending_member_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  suggestedBy: varchar("suggested_by").notNull(), // User ID or "system" for auto-discoveries
  source: text("source").notNull(), // "familysearch", "cross_tree_match", "network_discovery"
  externalId: text("external_id"), // External system ID if from external source
  
  // Suggested member data
  firstName: text("first_name"),
  lastName: text("last_name"),
  gender: text("gender"),
  birthDate: text("birth_date"),
  birthPlace: text("birth_place"),
  deathDate: text("death_date"),
  deathPlace: text("death_place"),
  
  // Relationship suggestion
  relatedToMemberId: varchar("related_to_member_id"), // Existing member this person relates to
  relationshipType: text("relationship_type"), // "parent", "child", "spouse", "sibling"
  
  // Matching info
  matchScore: real("match_score"), // How confident we are this is a valid suggestion
  matchReason: text("match_reason"), // Why this was suggested
  sourceData: jsonb("source_data"), // Full data from external source for review
  
  // Status tracking
  status: text("status").default("pending").notNull(), // "pending", "approved", "rejected", "merged"
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  createdMemberId: varchar("created_member_id"), // If approved, the new member ID
  mergedWithMemberId: varchar("merged_with_member_id"), // If merged with existing
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPendingMemberSuggestionSchema = createInsertSchema(pendingMemberSuggestions).omit({
  id: true,
  createdAt: true,
});

export type PendingMemberSuggestion = typeof pendingMemberSuggestions.$inferSelect;
export type InsertPendingMemberSuggestion = z.infer<typeof insertPendingMemberSuggestionSchema>;

// Cross-Tree Person Matches - Tracks when the same person appears in multiple trees
export const crossTreeMatches = pgTable("cross_tree_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  member1Id: varchar("member1_id").notNull(),
  tree1Id: varchar("tree1_id").notNull(),
  member2Id: varchar("member2_id").notNull(),
  tree2Id: varchar("tree2_id").notNull(),
  
  matchType: text("match_type").notNull(), // "external_id", "name_date", "user_confirmed"
  matchSource: text("match_source"), // "familysearch", "auto_detection", "user_link"
  externalId: text("external_id"), // If matched via external ID
  matchScore: real("match_score").default(0), // Confidence score
  
  status: text("status").default("pending").notNull(), // "pending", "confirmed", "rejected"
  confirmedByUser1: boolean("confirmed_by_user1").default(false),
  confirmedByUser2: boolean("confirmed_by_user2").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint to prevent duplicate matches (member pair in either direction)
  uniqueMatchPair: unique("unique_match_pair").on(table.member1Id, table.member2Id),
}));

export const insertCrossTreeMatchSchema = createInsertSchema(crossTreeMatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CrossTreeMatch = typeof crossTreeMatches.$inferSelect;
export type InsertCrossTreeMatch = z.infer<typeof insertCrossTreeMatchSchema>;

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

export const profileClaimRequestsRelations = relations(profileClaimRequests, ({ one }) => ({
  member: one(familyMembers, {
    fields: [profileClaimRequests.memberId],
    references: [familyMembers.id],
  }),
  tree: one(familyTrees, {
    fields: [profileClaimRequests.treeId],
    references: [familyTrees.id],
  }),
}));

export const specialConnectionsRelations = relations(specialConnections, ({ one }) => ({
  fromMember: one(familyMembers, {
    fields: [specialConnections.fromMemberId],
    references: [familyMembers.id],
  }),
  toMember: one(familyMembers, {
    fields: [specialConnections.toMemberId],
    references: [familyMembers.id],
  }),
  fromTree: one(familyTrees, {
    fields: [specialConnections.fromTreeId],
    references: [familyTrees.id],
  }),
  toTree: one(familyTrees, {
    fields: [specialConnections.toTreeId],
    references: [familyTrees.id],
  }),
}));

export const connectionRequestsRelations = relations(connectionRequests, ({ one }) => ({
  fromMember: one(familyMembers, {
    fields: [connectionRequests.fromMemberId],
    references: [familyMembers.id],
  }),
  toMember: one(familyMembers, {
    fields: [connectionRequests.toMemberId],
    references: [familyMembers.id],
  }),
  fromTree: one(familyTrees, {
    fields: [connectionRequests.fromTreeId],
    references: [familyTrees.id],
  }),
  toTree: one(familyTrees, {
    fields: [connectionRequests.toTreeId],
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

export const insertTreeConnectionImportSchema = createInsertSchema(treeConnectionImports).omit({
  id: true,
  createdAt: true,
});

export const insertImportedMemberSchema = createInsertSchema(importedMembers).omit({
  id: true,
  importedAt: true,
});

export const insertNetworkConnectionRequestSchema = createInsertSchema(networkConnectionRequests).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
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

export const insertProfileClaimRequestSchema = createInsertSchema(profileClaimRequests).omit({
  id: true,
  createdAt: true,
});

// Merchandise Orders table (for Printful print-on-demand products)
// Shipping address type for merchandise orders
export const shippingAddressSchema = z.object({
  name: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  stateCode: z.string().min(1),
  countryCode: z.string().length(2),
  zip: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const merchandiseOrders = pgTable("merchandise_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  treeId: varchar("tree_id"),
  status: merchandiseOrderStatusEnum("status").default("pending").notNull(),
  printfulOrderId: text("printful_order_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id").notNull(),
  productName: text("product_name").notNull(),
  variantName: text("variant_name"),
  quantity: integer("quantity").default(1).notNull(),
  treeImageUrl: text("tree_image_url"),
  shippingAddress: jsonb("shipping_address").$type<ShippingAddress>(),
  subtotal: integer("subtotal").notNull(),
  shippingCost: integer("shipping_cost").default(0),
  totalAmount: integer("total_amount").notNull(),
  commission: integer("commission").default(0),
  placementConfig: jsonb("placement_config").$type<Record<string, any>>(),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMerchandiseOrderSchema = createInsertSchema(merchandiseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Gift Registry enums
export const registryEventTypeEnum = pgEnum("registry_event_type", [
  "birthday", "baby_shower", "wedding", "anniversary", "graduation", 
  "holiday", "housewarming", "retirement", "other"
]);

export const registryItemStatusEnum = pgEnum("registry_item_status", [
  "available", "reserved", "purchased"
]);

// Gift Registries table
export const giftRegistries = pgTable("gift_registries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(), // The family member this registry is for
  treeId: varchar("tree_id").notNull(), // Which tree this belongs to
  createdByUserId: varchar("created_by_user_id").notNull(), // Who created the registry
  title: text("title").notNull(), // e.g., "John's 5th Birthday"
  eventType: registryEventTypeEnum("event_type").notNull(),
  eventDate: date("event_date"), // When the event is
  description: text("description"), // Optional details about the event
  isPublic: boolean("is_public").default(true).notNull(), // Visible to all tree collaborators
  isActive: boolean("is_active").default(true).notNull(), // Whether registry is accepting items
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGiftRegistrySchema = createInsertSchema(giftRegistries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Gift Registry Items table
export const giftRegistryItems = pgTable("gift_registry_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registryId: varchar("registry_id").notNull(),
  name: text("name").notNull(), // Product name
  description: text("description"), // Optional details
  productUrl: text("product_url"), // Link to product (Amazon, etc.)
  imageUrl: text("image_url"), // Product image
  price: integer("price"), // Price in cents
  quantity: integer("quantity").default(1).notNull(), // How many needed
  quantityPurchased: integer("quantity_purchased").default(0).notNull(), // How many bought
  status: registryItemStatusEnum("status").default("available").notNull(),
  priority: integer("priority").default(0), // Higher = more wanted
  purchasedByUserId: varchar("purchased_by_user_id"), // Who bought it (if fully purchased)
  purchasedAt: timestamp("purchased_at"), // When it was purchased
  notes: text("notes"), // Additional notes from registry owner
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGiftRegistryItemSchema = createInsertSchema(giftRegistryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User-to-User Connection Requests table (for QR code scans and direct user connections)
// Separate from cross-tree special connections - this connects user accounts
export const userConnectionRequests = pgTable("user_connection_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull(), // User sending the request
  toUserId: varchar("to_user_id").notNull(), // User receiving the request
  relationshipType: userRelationshipTypeEnum("relationship_type").notNull(), // How requester is related to target
  customLabel: text("custom_label"), // If "other" is selected, custom description
  message: text("message"), // Optional message with the request
  status: connectionRequestStatusEnum("status").default("pending").notNull(),
  respondedAt: timestamp("responded_at"),
  approverRelationshipType: userRelationshipTypeEnum("approver_relationship_type"), // How the approver says they're related
  approverCustomLabel: text("approver_custom_label"), // If approver chose "other"
  sourceType: text("source_type").default("qr_scan"), // How they connected: qr_scan, manual, invite
  targetTreeId: varchar("target_tree_id"), // Which tree the requester wants to connect to
  targetTreeName: text("target_tree_name"), // Cached tree name for display
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserConnectionRequestSchema = createInsertSchema(userConnectionRequests).omit({
  id: true,
  createdAt: true,
});

// User Connections table (approved connections between users)
// Each user can have their own perspective on the relationship (bidirectional)
export const userConnections = pgTable("user_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId1: varchar("user_id_1").notNull(), // One user (stored in consistent order)
  userId2: varchar("user_id_2").notNull(), // Other user
  relationshipFromUser1: userRelationshipTypeEnum("relationship_from_user_1"), // How user1 describes their relationship to user2
  customLabelFromUser1: text("custom_label_from_user_1"), // Custom label if user1 chose "other"
  relationshipFromUser2: userRelationshipTypeEnum("relationship_from_user_2"), // How user2 describes their relationship to user1
  customLabelFromUser2: text("custom_label_from_user_2"), // Custom label if user2 chose "other"
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  sourceRequestId: varchar("source_request_id"), // The request that created this connection
});

export const insertUserConnectionSchema = createInsertSchema(userConnections).omit({
  id: true,
  connectedAt: true,
});

// Member merge history - tracks when members are merged together
export const memberMergeHistory = pgTable("member_merge_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  survivorMemberId: varchar("survivor_member_id").notNull(), // The member that remains after merge
  mergedMemberId: varchar("merged_member_id").notNull(), // The member that was merged/deleted
  mergedByUserId: varchar("merged_by_user_id").notNull(), // Who performed the merge
  // Snapshot of the merged member's data before deletion
  mergedMemberData: jsonb("merged_member_data"),
  // Snapshot of relationships that were remapped
  remappedRelationships: jsonb("remapped_relationships"),
  notes: text("notes"), // Optional notes about why they were merged
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMemberMergeHistorySchema = createInsertSchema(memberMergeHistory).omit({
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

export type TreeInvitation = typeof treeInvitations.$inferSelect;
export type InsertTreeInvitation = z.infer<typeof insertTreeInvitationSchema>;

export type NameHistory = typeof nameHistory.$inferSelect;
export type InsertNameHistory = z.infer<typeof insertNameHistorySchema>;

export type TreeConnection = typeof treeConnections.$inferSelect;
export type InsertTreeConnection = z.infer<typeof insertTreeConnectionSchema>;

export type TreeConnectionImport = typeof treeConnectionImports.$inferSelect;
export type InsertTreeConnectionImport = z.infer<typeof insertTreeConnectionImportSchema>;

export type ImportedMember = typeof importedMembers.$inferSelect;
export type InsertImportedMember = z.infer<typeof insertImportedMemberSchema>;

export type NetworkConnectionRequest = typeof networkConnectionRequests.$inferSelect;
export type InsertNetworkConnectionRequest = z.infer<typeof insertNetworkConnectionRequestSchema>;

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

export type ProfileClaimRequest = typeof profileClaimRequests.$inferSelect;
export type InsertProfileClaimRequest = z.infer<typeof insertProfileClaimRequestSchema>;

export type MerchandiseOrder = typeof merchandiseOrders.$inferSelect;
export type InsertMerchandiseOrder = z.infer<typeof insertMerchandiseOrderSchema>;

export type CustodianshipRequest = typeof custodianshipRequests.$inferSelect;
export type InsertCustodianshipRequest = z.infer<typeof insertCustodianshipRequestSchema>;

export type SpecialConnection = typeof specialConnections.$inferSelect;
export type InsertSpecialConnection = z.infer<typeof insertSpecialConnectionSchema>;

export type ConnectionRequest = typeof connectionRequests.$inferSelect;
export type InsertConnectionRequest = z.infer<typeof insertConnectionRequestSchema>;

export type GiftRegistry = typeof giftRegistries.$inferSelect;
export type InsertGiftRegistry = z.infer<typeof insertGiftRegistrySchema>;

export type GiftRegistryItem = typeof giftRegistryItems.$inferSelect;
export type InsertGiftRegistryItem = z.infer<typeof insertGiftRegistryItemSchema>;

export type UserConnectionRequest = typeof userConnectionRequests.$inferSelect;
export type InsertUserConnectionRequest = z.infer<typeof insertUserConnectionRequestSchema>;

export type UserConnection = typeof userConnections.$inferSelect;
export type InsertUserConnection = z.infer<typeof insertUserConnectionSchema>;

export type MemberMergeHistory = typeof memberMergeHistory.$inferSelect;
export type InsertMemberMergeHistory = z.infer<typeof insertMemberMergeHistorySchema>;

// Referral tracking table
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerUserId: varchar("referrer_user_id").notNull(), // User who shared the referral
  referralCode: varchar("referral_code").notNull().unique(), // Unique code for tracking
  referredUserId: varchar("referred_user_id"), // User who signed up (null until signup)
  status: text("status").default("pending").notNull(), // pending, completed, rewarded
  rewardType: text("reward_type"), // e.g., "discount", "free_month", etc.
  rewardAppliedAt: timestamp("reward_applied_at"),
  clickCount: integer("click_count").default(0).notNull(), // How many times link was clicked
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"), // When the referred user signed up
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

export const treeTags = pgTable("tree_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  label: text("label").notNull(),
  color: text("color").default("#6366f1"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTreeTagSchema = createInsertSchema(treeTags).omit({
  id: true,
  createdAt: true,
});

export type TreeTag = typeof treeTags.$inferSelect;
export type InsertTreeTag = z.infer<typeof insertTreeTagSchema>;

export const memberTags = pgTable("member_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tagId: varchar("tag_id").notNull(),
  memberId: varchar("member_id").notNull(),
  treeId: varchar("tree_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const insertMemberTagSchema = createInsertSchema(memberTags).omit({
  id: true,
  assignedAt: true,
});

export type MemberTag = typeof memberTags.$inferSelect;
export type InsertMemberTag = z.infer<typeof insertMemberTagSchema>;

export const memories = pgTable("memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treeId: varchar("tree_id").notNull(),
  memberId: varchar("member_id"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  title: text("title").notNull(),
  story: text("story"),
  eventDate: date("event_date"),
  photoUrl: text("photo_url"),
  mediaAttachments: jsonb("media_attachments").$type<EventMediaAttachment[]>(),
  category: text("category").default("memory"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMemorySchema = createInsertSchema(memories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Memory = typeof memories.$inferSelect;
export type InsertMemory = z.infer<typeof insertMemorySchema>;

export const voiceNotes = pgTable("voice_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  treeId: varchar("tree_id").notNull(),
  recordedByUserId: varchar("recorded_by_user_id").notNull(),
  audioUrl: text("audio_url").notNull(),
  durationSeconds: integer("duration_seconds"),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoiceNoteSchema = createInsertSchema(voiceNotes).omit({
  id: true,
  createdAt: true,
});

export type VoiceNote = typeof voiceNotes.$inferSelect;
export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
