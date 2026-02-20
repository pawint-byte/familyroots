import { 
  familyTrees, familyMembers, relationships, treeCollaborators, familyEvents, users,
  treeInvitations, nameHistory, treeConnections, treeConnectionImports, importedMembers,
  networkConnectionRequests,
  accountHeirs, educationHistory, careerHistory,
  discoverableMembers, matchRequests, memberInvitations, merchandiseOrders, profileClaimRequests,
  custodianshipRequests, specialConnections, connectionRequests, familySearchConnections, familySearchSources,
  giftRegistries, giftRegistryItems, userConnectionRequests, userConnections, memberMergeHistory,
  externalPersonIdentifiers, pendingMemberSuggestions, crossTreeMatches, referrals,
  type FamilyTree, type InsertFamilyTree, 
  type FamilyMember, type InsertFamilyMember,
  type Relationship, type InsertRelationship,
  type TreeCollaborator, type InsertTreeCollaborator,
  type FamilyEvent, type InsertFamilyEvent,
  type TreeInvitation, type InsertTreeInvitation,
  type NameHistory, type InsertNameHistory,
  type TreeConnection, type InsertTreeConnection,
  type TreeConnectionImport, type InsertTreeConnectionImport,
  type ImportedMember, type InsertImportedMember,
  type NetworkConnectionRequest, type InsertNetworkConnectionRequest,
  type AccountHeir, type InsertAccountHeir,
  type EducationHistory, type InsertEducationHistory,
  type CareerHistory, type InsertCareerHistory,
  type DiscoverableMember, type InsertDiscoverableMember,
  type MatchRequest, type InsertMatchRequest,
  type MemberInvitation, type InsertMemberInvitation,
  type ProfileClaimRequest, type InsertProfileClaimRequest,
  type MerchandiseOrder, type InsertMerchandiseOrder,
  type CustodianshipRequest, type InsertCustodianshipRequest,
  type SpecialConnection, type InsertSpecialConnection,
  type ConnectionRequest, type InsertConnectionRequest,
  type FamilySearchConnection, type InsertFamilySearchConnection,
  type FamilySearchSource, type InsertFamilySearchSource,
  type GiftRegistry, type InsertGiftRegistry,
  type GiftRegistryItem, type InsertGiftRegistryItem,
  type UserConnectionRequest, type InsertUserConnectionRequest,
  type UserConnection, type InsertUserConnection,
  type MemberMergeHistory, type InsertMemberMergeHistory,
  type ExternalPersonIdentifier, type InsertExternalPersonIdentifier,
  type PendingMemberSuggestion, type InsertPendingMemberSuggestion,
  type CrossTreeMatch, type InsertCrossTreeMatch,
  type Referral,
  type User,
  announcements,
  type Announcement, type InsertAnnouncement,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, desc, lt, inArray } from "drizzle-orm";

export interface IStorage {
  // Family Trees
  getTrees(userId: string): Promise<FamilyTree[]>;
  getTree(id: string): Promise<FamilyTree | undefined>;
  getCollaboratedTrees(userId: string): Promise<{ collaboratedTrees: FamilyTree[] }>;
  createTree(tree: InsertFamilyTree): Promise<FamilyTree>;
  updateTree(id: string, tree: Partial<InsertFamilyTree>): Promise<FamilyTree | undefined>;
  deleteTree(id: string): Promise<boolean>;

  // Family Members
  getMembers(treeId: string): Promise<FamilyMember[]>;
  getMember(id: string): Promise<FamilyMember | undefined>;
  getMemberByClaimedUserId(userId: string, treeId: string): Promise<FamilyMember | undefined>;
  getMembersByEmail(email: string): Promise<FamilyMember[]>;
  createMember(member: InsertFamilyMember): Promise<FamilyMember>;
  updateMember(id: string, member: Partial<InsertFamilyMember>): Promise<FamilyMember | undefined>;
  deleteMember(id: string): Promise<boolean>;
  searchMembers(treeId: string, query: string): Promise<FamilyMember[]>;

  // Relationships
  getRelationships(treeId: string): Promise<Relationship[]>;
  createRelationship(rel: InsertRelationship): Promise<Relationship>;
  updateRelationship(id: string, data: Partial<InsertRelationship>): Promise<Relationship | undefined>;
  deleteRelationship(id: string): Promise<boolean>;

  // Collaborators
  getCollaborators(treeId: string): Promise<TreeCollaborator[]>;
  getCollaboratorByUserAndTree(userId: string, treeId: string): Promise<TreeCollaborator | undefined>;
  getCollaboratorsByUser(userId: string): Promise<TreeCollaborator[]>;
  addCollaborator(collaborator: InsertTreeCollaborator): Promise<TreeCollaborator>;
  updateCollaborator(id: string, data: Partial<InsertTreeCollaborator>): Promise<TreeCollaborator | undefined>;
  removeCollaborator(id: string): Promise<boolean>;

  // Invitations
  getInvitation(inviteCode: string): Promise<TreeInvitation | undefined>;
  getInvitationsByTree(treeId: string): Promise<TreeInvitation[]>;
  createInvitation(invitation: InsertTreeInvitation): Promise<TreeInvitation>;
  updateInvitation(id: string, data: Partial<InsertTreeInvitation>): Promise<TreeInvitation | undefined>;
  deleteInvitation(id: string): Promise<boolean>;
  atomicIncrementInvitationUsage(id: string, expectedUsedCount: number): Promise<boolean>;
  atomicDecrementInvitationUsage(id: string, expectedUsedCount: number): Promise<boolean>;

  // Name History
  getNameHistory(memberId: string): Promise<NameHistory[]>;
  createNameHistory(history: InsertNameHistory): Promise<NameHistory>;
  updateNameHistory(id: string, data: Partial<InsertNameHistory>): Promise<NameHistory | undefined>;
  deleteNameHistory(id: string): Promise<boolean>;

  // Tree Connections
  getTreeConnections(treeId: string): Promise<TreeConnection[]>;
  getTreeConnectionBetween(tree1Id: string, tree2Id: string): Promise<TreeConnection | undefined>;
  createTreeConnection(connection: InsertTreeConnection): Promise<TreeConnection>;
  deleteTreeConnection(id: string): Promise<boolean>;
  
  // Network Connection Requests
  getNetworkConnectionRequest(fromTreeId: string, toTreeId: string): Promise<NetworkConnectionRequest | undefined>;
  getNetworkConnectionRequestById(id: string): Promise<NetworkConnectionRequest | undefined>;
  getNetworkConnectionRequestsForUser(userId: string): Promise<NetworkConnectionRequest[]>;
  createNetworkConnectionRequest(request: InsertNetworkConnectionRequest): Promise<NetworkConnectionRequest>;
  updateNetworkConnectionRequestStatus(id: string, status: string): Promise<NetworkConnectionRequest | undefined>;

  // Tree Connection Imports (Selective Branch Import)
  getImportConfigsForConnection(connectionId: string): Promise<TreeConnectionImport[]>;
  getImportConfigsForTree(targetTreeId: string): Promise<TreeConnectionImport[]>;
  createImportConfig(config: InsertTreeConnectionImport): Promise<TreeConnectionImport>;
  deleteImportConfig(id: string): Promise<boolean>;
  
  // Imported Members
  getImportedMembersForTree(targetTreeId: string): Promise<ImportedMember[]>;
  getImportedMembersForConfig(importConfigId: string): Promise<ImportedMember[]>;
  createImportedMember(member: InsertImportedMember): Promise<ImportedMember>;
  deleteImportedMembersForConfig(importConfigId: string): Promise<boolean>;
  getImportedMemberCount(targetTreeId: string): Promise<number>;
  isImportedMember(targetTreeId: string, sourceMemberId: string): Promise<boolean>;

  // Events
  getEvents(treeId: string): Promise<FamilyEvent[]>;
  createEvent(event: InsertFamilyEvent): Promise<FamilyEvent>;
  deleteEvent(id: string): Promise<boolean>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserEmail(userId: string, email: string): Promise<void>;
  updateUserStripeInfo(userId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string }): Promise<User | undefined>;
  updateUserActivity(userId: string): Promise<void>;
  getInactiveUsers(inactivityMonths: number): Promise<User[]>;
  updateUserInactivityReminder(userId: string): Promise<void>;
  
  // User Profile (single source of truth for claimed profiles)
  getAllClaimedProfilesForUser(userId: string): Promise<FamilyMember[]>;
  updateUserProfile(userId: string, profile: {
    nickname?: string;
    gender?: "male" | "female" | "other";
    birthDate?: string;
    birthPlace?: string;
    bio?: string;
    currentCity?: string;
    currentRegion?: string;
    currentCountry?: string;
    locationVisible?: boolean;
  }): Promise<User | undefined>;
  
  // Account Heirs
  getAccountHeir(userId: string): Promise<AccountHeir | undefined>;
  createAccountHeir(heir: InsertAccountHeir): Promise<AccountHeir>;
  updateAccountHeir(id: string, data: Partial<InsertAccountHeir>): Promise<AccountHeir | undefined>;
  deleteAccountHeir(id: string): Promise<boolean>;
  getHeirsAwaitingTransfer(): Promise<AccountHeir[]>;

  // Education History
  getEducationHistory(memberId: string): Promise<EducationHistory[]>;
  createEducationHistory(education: InsertEducationHistory): Promise<EducationHistory>;
  updateEducationHistory(id: string, data: Partial<InsertEducationHistory>): Promise<EducationHistory | undefined>;
  deleteEducationHistory(id: string): Promise<boolean>;

  // Career History
  getCareerHistory(memberId: string): Promise<CareerHistory[]>;
  createCareerHistory(career: InsertCareerHistory): Promise<CareerHistory>;
  updateCareerHistory(id: string, data: Partial<InsertCareerHistory>): Promise<CareerHistory | undefined>;
  deleteCareerHistory(id: string): Promise<boolean>;

  // Discoverable Members
  getDiscoverableMember(memberId: string): Promise<DiscoverableMember | undefined>;
  getDiscoverableMembersByTree(treeId: string): Promise<DiscoverableMember[]>;
  createOrUpdateDiscoverableMember(data: InsertDiscoverableMember): Promise<DiscoverableMember>;
  deleteDiscoverableMember(memberId: string): Promise<boolean>;
  findPotentialMatches(memberId: string): Promise<{ member: FamilyMember; matchScore: number; matchCriteria: string[] }[]>;

  // Match Requests
  getMatchRequests(treeId: string): Promise<MatchRequest[]>;
  getSentMatchRequests(treeId: string): Promise<MatchRequest[]>;
  getMatchRequest(id: string): Promise<MatchRequest | undefined>;
  createMatchRequest(request: InsertMatchRequest): Promise<MatchRequest>;
  updateMatchRequest(id: string, data: Partial<InsertMatchRequest>): Promise<MatchRequest | undefined>;
  deleteMatchRequest(id: string): Promise<boolean>;

  // Member Invitations
  getMemberInvitationByEmail(email: string, memberId: string): Promise<MemberInvitation | undefined>;
  getMemberInvitationsByEmail(email: string): Promise<MemberInvitation[]>;
  getMemberInvitationsByTree(treeId: string): Promise<MemberInvitation[]>;
  createMemberInvitation(invitation: InsertMemberInvitation): Promise<MemberInvitation>;
  updateMemberInvitationStatus(id: string, status: 'clicked' | 'registered'): Promise<MemberInvitation | undefined>;
  deleteMemberInvitation(id: string): Promise<void>;

  // Profile Claim Requests
  getProfileClaimRequest(id: string): Promise<ProfileClaimRequest | undefined>;
  getProfileClaimRequestsByTree(treeId: string): Promise<ProfileClaimRequest[]>;
  getProfileClaimRequestsByMember(memberId: string): Promise<ProfileClaimRequest[]>;
  getProfileClaimRequestByRequester(requesterId: string, memberId: string): Promise<ProfileClaimRequest | undefined>;
  getClaimedProfilesByUser(userId: string): Promise<FamilyMember[]>;
  createProfileClaimRequest(request: InsertProfileClaimRequest): Promise<ProfileClaimRequest>;
  updateProfileClaimRequest(id: string, data: Partial<InsertProfileClaimRequest>): Promise<ProfileClaimRequest | undefined>;
  approveProfileClaim(claimId: string, reviewerId: string): Promise<ProfileClaimRequest | undefined>;
  denyProfileClaim(claimId: string, reviewerId: string, reason?: string): Promise<ProfileClaimRequest | undefined>;

  // Merchandise Orders
  getMerchandiseOrders(userId: string): Promise<MerchandiseOrder[]>;
  getMerchandiseOrder(id: string): Promise<MerchandiseOrder | undefined>;
  getMerchandiseOrderByStripeSession(sessionId: string): Promise<MerchandiseOrder | undefined>;
  createMerchandiseOrder(order: InsertMerchandiseOrder): Promise<MerchandiseOrder>;
  updateMerchandiseOrder(id: string, data: Partial<InsertMerchandiseOrder>): Promise<MerchandiseOrder | undefined>;

  // Custodianship Requests
  getCustodianshipRequest(id: string): Promise<CustodianshipRequest | undefined>;
  getCustodianshipRequestsByTree(treeId: string): Promise<CustodianshipRequest[]>;
  getCustodianshipRequestsByMember(memberId: string): Promise<CustodianshipRequest[]>;
  getCustodianshipRequestByRequester(requesterId: string, memberId: string): Promise<CustodianshipRequest | undefined>;
  createCustodianshipRequest(request: InsertCustodianshipRequest): Promise<CustodianshipRequest>;
  updateCustodianshipRequest(id: string, data: Partial<InsertCustodianshipRequest>): Promise<CustodianshipRequest | undefined>;
  approveCustodianship(requestId: string, reviewerId: string): Promise<CustodianshipRequest | undefined>;
  denyCustodianship(requestId: string, reviewerId: string, reason?: string): Promise<CustodianshipRequest | undefined>;
  getPendingCustodianshipRequests(): Promise<CustodianshipRequest[]>;
  getExpiredCustodianshipRequests(): Promise<CustodianshipRequest[]>;

  // Events (extended)
  getEvent(id: string): Promise<FamilyEvent | undefined>;
  updateEvent(id: string, data: Partial<InsertFamilyEvent>): Promise<FamilyEvent | undefined>;
  getEventsByMember(memberId: string): Promise<FamilyEvent[]>;

  // Announcements
  createAnnouncement(data: InsertAnnouncement): Promise<Announcement>;
  getAnnouncementsByUser(userId: string): Promise<Announcement[]>;
  getAnnouncementsForTree(treeId: string): Promise<Announcement[]>;

  // User notification preferences
  updateUserNotificationPreferences(userId: string, preferences: any): Promise<User | undefined>;
  
  // Get tree collaborators and owners with their notification preferences
  getTreeMembersWithNotificationPrefs(treeId: string): Promise<User[]>;

  // Special Connections
  getSpecialConnectionsByMember(memberId: string): Promise<SpecialConnection[]>;
  getSpecialConnectionsByTree(treeId: string): Promise<SpecialConnection[]>;
  getSpecialConnection(id: string): Promise<SpecialConnection | undefined>;
  createSpecialConnection(connection: InsertSpecialConnection): Promise<SpecialConnection>;
  deleteSpecialConnection(id: string): Promise<boolean>;

  // Connection Requests
  getConnectionRequestsByMember(memberId: string): Promise<ConnectionRequest[]>;
  getConnectionRequestsByTree(treeId: string): Promise<ConnectionRequest[]>;
  getPendingConnectionRequestsForTree(treeId: string): Promise<ConnectionRequest[]>;
  getConnectionRequest(id: string): Promise<ConnectionRequest | undefined>;
  createConnectionRequest(request: InsertConnectionRequest): Promise<ConnectionRequest>;
  updateConnectionRequest(id: string, data: Partial<InsertConnectionRequest>): Promise<ConnectionRequest | undefined>;
  approveConnectionRequest(requestId: string, responderId: string): Promise<ConnectionRequest | undefined>;
  denyConnectionRequest(requestId: string, responderId: string): Promise<ConnectionRequest | undefined>;

  // Network discovery - get members connected to connections (second-degree)
  getNetworkConnections(memberId: string): Promise<{ member: FamilyMember; connectionType: string; connectedVia: FamilyMember }[]>;
  
  // Location-based search
  getMembersByLocation(city?: string, region?: string, country?: string): Promise<FamilyMember[]>;

  // Gift Registries
  getGiftRegistry(id: string): Promise<GiftRegistry | undefined>;
  getGiftRegistriesByMember(memberId: string): Promise<GiftRegistry[]>;
  getGiftRegistriesByTree(treeId: string): Promise<GiftRegistry[]>;
  getGiftRegistriesByUser(userId: string): Promise<GiftRegistry[]>;
  createGiftRegistry(registry: InsertGiftRegistry): Promise<GiftRegistry>;
  updateGiftRegistry(id: string, data: Partial<InsertGiftRegistry>): Promise<GiftRegistry | undefined>;
  deleteGiftRegistry(id: string): Promise<boolean>;

  // Gift Registry Items
  getGiftRegistryItems(registryId: string): Promise<GiftRegistryItem[]>;
  getGiftRegistryItem(id: string): Promise<GiftRegistryItem | undefined>;
  createGiftRegistryItem(item: InsertGiftRegistryItem): Promise<GiftRegistryItem>;
  updateGiftRegistryItem(id: string, data: Partial<InsertGiftRegistryItem>): Promise<GiftRegistryItem | undefined>;
  deleteGiftRegistryItem(id: string): Promise<boolean>;
  markItemPurchased(itemId: string, userId: string, quantity: number): Promise<GiftRegistryItem | undefined>;

  // User Connection Requests (QR code connections)
  createUserConnectionRequest(request: InsertUserConnectionRequest): Promise<UserConnectionRequest>;
  getUserConnectionRequest(id: string): Promise<UserConnectionRequest | undefined>;
  getPendingUserConnectionRequestsForUser(toUserId: string): Promise<UserConnectionRequest[]>;
  getSentUserConnectionRequests(fromUserId: string): Promise<UserConnectionRequest[]>;
  getExistingUserConnectionRequest(fromUserId: string, toUserId: string): Promise<UserConnectionRequest | undefined>;
  approveUserConnectionRequest(id: string, approverRelationshipType?: string, approverCustomLabel?: string): Promise<UserConnectionRequest | undefined>;
  denyUserConnectionRequest(id: string): Promise<UserConnectionRequest | undefined>;

  // User Connections (approved connections)
  getUserConnections(userId: string): Promise<UserConnection[]>;
  getExistingUserConnection(userId1: string, userId2: string): Promise<UserConnection | undefined>;
  createUserConnection(connection: InsertUserConnection): Promise<UserConnection>;

  // Member Merge
  getMergeHistory(treeId: string): Promise<MemberMergeHistory[]>;
  createMergeHistory(data: InsertMemberMergeHistory): Promise<MemberMergeHistory>;
  mergeMembers(survivorId: string, mergedId: string, userId: string, notes?: string): Promise<{ success: boolean; mergeHistoryId: string }>;

  // Referrals
  createReferral(referrerUserId: string, referralCode: string): Promise<Referral>;
  getReferralByCode(code: string): Promise<Referral | undefined>;
  getReferralsByUser(userId: string): Promise<Referral[]>;
  incrementReferralClick(code: string): Promise<void>;
  completeReferral(code: string, referredUserId: string): Promise<Referral | undefined>;
  getUserReferralStats(userId: string): Promise<{ totalReferrals: number; completedReferrals: number; pendingReferrals: number }>;

  // Admin methods
  getAllUsers(search?: string): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;
  getUserTreeCount(userId: string): Promise<number>;
  transferUserOwnership(fromUserId: string, toUserId: string): Promise<void>;
  getAllUserConnections(search?: string): Promise<UserConnection[]>;
  adminDeleteUserConnection(connectionId: string): Promise<void>;
  getSubscriptionMetrics(): Promise<{
    totalUsers: number;
    activeSubscribers: number;
    subscribersByTier: Record<string, number>;
    monthlyRecurringRevenue: number;
    projectedAnnualRevenue: number;
    freeUsers: number;
    tierBreakdown: Array<{ tier: string; count: number; monthlyRevenue: number }>;
  }>;
  getAllTreeConnections(search?: string): Promise<any[]>;

  // External Person Identifiers (FamilySearch, Ancestry, etc.)
  getExternalIdentifiersForMember(memberId: string): Promise<ExternalPersonIdentifier[]>;
  getExternalIdentifiersByExternalId(source: string, externalId: string): Promise<ExternalPersonIdentifier[]>;
  createExternalIdentifier(data: InsertExternalPersonIdentifier): Promise<ExternalPersonIdentifier>;
  updateExternalIdentifier(id: string, data: Partial<InsertExternalPersonIdentifier>): Promise<ExternalPersonIdentifier | undefined>;
  deleteExternalIdentifier(id: string): Promise<boolean>;
  findMembersByExternalId(source: string, externalId: string): Promise<FamilyMember[]>;

  // Pending Member Suggestions
  getPendingMemberSuggestions(treeId: string): Promise<PendingMemberSuggestion[]>;
  getPendingMemberSuggestionById(id: string): Promise<PendingMemberSuggestion | undefined>;
  createPendingMemberSuggestion(data: InsertPendingMemberSuggestion): Promise<PendingMemberSuggestion>;
  updatePendingMemberSuggestion(id: string, data: Partial<InsertPendingMemberSuggestion>): Promise<PendingMemberSuggestion | undefined>;
  approvePendingMemberSuggestion(id: string, reviewerId: string, createdMemberId?: string, mergedWithMemberId?: string): Promise<PendingMemberSuggestion | undefined>;
  rejectPendingMemberSuggestion(id: string, reviewerId: string): Promise<PendingMemberSuggestion | undefined>;

  // Cross-Tree Matches
  getCrossTreeMatchesForTree(treeId: string): Promise<CrossTreeMatch[]>;
  getCrossTreeMatchById(id: string): Promise<CrossTreeMatch | undefined>;
  getCrossTreeMatchByMembers(member1Id: string, member2Id: string): Promise<CrossTreeMatch | undefined>;
  createCrossTreeMatch(data: InsertCrossTreeMatch): Promise<CrossTreeMatch>;
  updateCrossTreeMatch(id: string, data: Partial<InsertCrossTreeMatch>): Promise<CrossTreeMatch | undefined>;
  confirmCrossTreeMatch(id: string, userId: string, treeId: string): Promise<CrossTreeMatch | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Family Trees
  async getTrees(userId: string): Promise<FamilyTree[]> {
    return db.select().from(familyTrees)
      .where(eq(familyTrees.ownerId, userId))
      .orderBy(desc(familyTrees.updatedAt));
  }

  async getTree(id: string): Promise<FamilyTree | undefined> {
    const [tree] = await db.select().from(familyTrees).where(eq(familyTrees.id, id));
    return tree;
  }

  async getCollaboratedTrees(userId: string): Promise<{ collaboratedTrees: FamilyTree[] }> {
    const collaborations = await db.select().from(treeCollaborators)
      .where(eq(treeCollaborators.userId, userId));
    
    const collaboratedTrees: FamilyTree[] = [];
    for (const collab of collaborations) {
      const tree = await this.getTree(collab.treeId);
      if (tree) {
        collaboratedTrees.push(tree);
      }
    }
    
    return { collaboratedTrees };
  }

  async createTree(tree: InsertFamilyTree): Promise<FamilyTree> {
    const [created] = await db.insert(familyTrees).values(tree).returning();
    return created;
  }

  async updateTree(id: string, tree: Partial<InsertFamilyTree>): Promise<FamilyTree | undefined> {
    const [updated] = await db.update(familyTrees)
      .set({ ...tree, updatedAt: new Date() })
      .where(eq(familyTrees.id, id))
      .returning();
    return updated;
  }

  async deleteTree(id: string): Promise<boolean> {
    const result = await db.delete(familyTrees).where(eq(familyTrees.id, id));
    return true;
  }

  // Family Members
  async getMembers(treeId: string): Promise<FamilyMember[]> {
    return db.select().from(familyMembers)
      .where(eq(familyMembers.treeId, treeId))
      .orderBy(familyMembers.firstName);
  }

  async getMember(id: string): Promise<FamilyMember | undefined> {
    const [member] = await db.select().from(familyMembers).where(eq(familyMembers.id, id));
    return member;
  }

  async getMemberByClaimedUserId(userId: string, treeId: string): Promise<FamilyMember | undefined> {
    const [member] = await db.select().from(familyMembers).where(
      and(
        eq(familyMembers.claimedByUserId, userId),
        eq(familyMembers.treeId, treeId)
      )
    );
    return member;
  }

  async getMembersByEmail(email: string): Promise<FamilyMember[]> {
    // Find all family members with this email across all trees
    const members = await db.select().from(familyMembers).where(
      eq(familyMembers.email, email.toLowerCase())
    );
    return members;
  }

  async createMember(member: InsertFamilyMember): Promise<FamilyMember> {
    const [created] = await db.insert(familyMembers).values(member).returning();
    return created;
  }

  async updateMember(id: string, member: Partial<InsertFamilyMember>): Promise<FamilyMember | undefined> {
    const [updated] = await db.update(familyMembers)
      .set({ ...member, updatedAt: new Date() })
      .where(eq(familyMembers.id, id))
      .returning();
    return updated;
  }

  async deleteMember(id: string): Promise<boolean> {
    await db.delete(relationships).where(
      or(eq(relationships.fromMemberId, id), eq(relationships.toMemberId, id))
    );
    await db.delete(familyEvents).where(eq(familyEvents.memberId, id));
    await db.delete(familyMembers).where(eq(familyMembers.id, id));
    return true;
  }

  async searchMembers(treeId: string, query: string): Promise<FamilyMember[]> {
    return db.select().from(familyMembers)
      .where(and(
        eq(familyMembers.treeId, treeId),
        or(
          ilike(familyMembers.firstName, `%${query}%`),
          ilike(familyMembers.lastName, `%${query}%`),
          ilike(familyMembers.birthPlace, `%${query}%`)
        )
      ));
  }

  // Relationships
  async getRelationships(treeId: string): Promise<Relationship[]> {
    return db.select().from(relationships).where(eq(relationships.treeId, treeId));
  }

  async createRelationship(rel: InsertRelationship): Promise<Relationship> {
    const [created] = await db.insert(relationships).values(rel).returning();
    return created;
  }

  async updateRelationship(id: string, data: Partial<InsertRelationship>): Promise<Relationship | undefined> {
    const [updated] = await db.update(relationships)
      .set(data)
      .where(eq(relationships.id, id))
      .returning();
    return updated;
  }

  async deleteRelationship(id: string): Promise<boolean> {
    await db.delete(relationships).where(eq(relationships.id, id));
    return true;
  }

  // Collaborators
  async getCollaborators(treeId: string): Promise<TreeCollaborator[]> {
    return db.select().from(treeCollaborators).where(eq(treeCollaborators.treeId, treeId));
  }

  async getCollaboratorByUserAndTree(userId: string, treeId: string): Promise<TreeCollaborator | undefined> {
    const [collab] = await db.select().from(treeCollaborators)
      .where(and(eq(treeCollaborators.userId, userId), eq(treeCollaborators.treeId, treeId)));
    return collab;
  }

  async getCollaboratorsByUser(userId: string): Promise<TreeCollaborator[]> {
    return db.select().from(treeCollaborators).where(eq(treeCollaborators.userId, userId));
  }

  async addCollaborator(collaborator: InsertTreeCollaborator): Promise<TreeCollaborator> {
    const [created] = await db.insert(treeCollaborators).values(collaborator).returning();
    return created;
  }

  async updateCollaborator(id: string, data: Partial<InsertTreeCollaborator>): Promise<TreeCollaborator | undefined> {
    const [updated] = await db.update(treeCollaborators)
      .set(data)
      .where(eq(treeCollaborators.id, id))
      .returning();
    return updated;
  }

  async removeCollaborator(id: string): Promise<boolean> {
    await db.delete(treeCollaborators).where(eq(treeCollaborators.id, id));
    return true;
  }

  // Invitations
  async getInvitation(inviteCode: string): Promise<TreeInvitation | undefined> {
    const [invitation] = await db.select().from(treeInvitations)
      .where(eq(treeInvitations.inviteCode, inviteCode));
    return invitation;
  }

  async getInvitationsByTree(treeId: string): Promise<TreeInvitation[]> {
    return db.select().from(treeInvitations)
      .where(eq(treeInvitations.treeId, treeId))
      .orderBy(desc(treeInvitations.createdAt));
  }

  async createInvitation(invitation: InsertTreeInvitation): Promise<TreeInvitation> {
    const [created] = await db.insert(treeInvitations).values(invitation).returning();
    return created;
  }

  async updateInvitation(id: string, data: Partial<InsertTreeInvitation>): Promise<TreeInvitation | undefined> {
    const [updated] = await db.update(treeInvitations)
      .set(data)
      .where(eq(treeInvitations.id, id))
      .returning();
    return updated;
  }

  async deleteInvitation(id: string): Promise<boolean> {
    await db.delete(treeInvitations).where(eq(treeInvitations.id, id));
    return true;
  }

  async atomicIncrementInvitationUsage(id: string, expectedUsedCount: number): Promise<boolean> {
    // Atomic update that only succeeds if usedCount matches expected value
    const [updated] = await db.update(treeInvitations)
      .set({ usedCount: String(expectedUsedCount + 1) })
      .where(and(
        eq(treeInvitations.id, id),
        eq(treeInvitations.usedCount, String(expectedUsedCount))
      ))
      .returning();
    return !!updated;
  }

  async atomicDecrementInvitationUsage(id: string, expectedUsedCount: number): Promise<boolean> {
    // Roll back an increment if collaborator insert fails
    const [updated] = await db.update(treeInvitations)
      .set({ usedCount: String(expectedUsedCount - 1) })
      .where(and(
        eq(treeInvitations.id, id),
        eq(treeInvitations.usedCount, String(expectedUsedCount))
      ))
      .returning();
    return !!updated;
  }

  // Name History
  async getNameHistory(memberId: string): Promise<NameHistory[]> {
    return db.select().from(nameHistory)
      .where(eq(nameHistory.memberId, memberId))
      .orderBy(desc(nameHistory.effectiveDate));
  }

  async createNameHistory(history: InsertNameHistory): Promise<NameHistory> {
    const [created] = await db.insert(nameHistory).values(history).returning();
    return created;
  }

  async updateNameHistory(id: string, data: Partial<InsertNameHistory>): Promise<NameHistory | undefined> {
    const [updated] = await db.update(nameHistory)
      .set(data)
      .where(eq(nameHistory.id, id))
      .returning();
    return updated;
  }

  async deleteNameHistory(id: string): Promise<boolean> {
    await db.delete(nameHistory).where(eq(nameHistory.id, id));
    return true;
  }

  // Tree Connections
  async getTreeConnections(treeId: string): Promise<TreeConnection[]> {
    return db.select().from(treeConnections)
      .where(or(
        eq(treeConnections.tree1Id, treeId),
        eq(treeConnections.tree2Id, treeId)
      ));
  }

  async createTreeConnection(connection: InsertTreeConnection): Promise<TreeConnection> {
    const [created] = await db.insert(treeConnections).values(connection).returning();
    return created;
  }

  async deleteTreeConnection(id: string): Promise<boolean> {
    await db.delete(treeConnections).where(eq(treeConnections.id, id));
    return true;
  }

  async getTreeConnectionBetween(tree1Id: string, tree2Id: string): Promise<TreeConnection | undefined> {
    const [connection] = await db.select().from(treeConnections)
      .where(or(
        and(eq(treeConnections.tree1Id, tree1Id), eq(treeConnections.tree2Id, tree2Id)),
        and(eq(treeConnections.tree1Id, tree2Id), eq(treeConnections.tree2Id, tree1Id))
      ))
      .limit(1);
    return connection;
  }

  // Network Connection Requests
  async getNetworkConnectionRequest(fromTreeId: string, toTreeId: string): Promise<NetworkConnectionRequest | undefined> {
    const [request] = await db.select().from(networkConnectionRequests)
      .where(or(
        and(eq(networkConnectionRequests.fromTreeId, fromTreeId), eq(networkConnectionRequests.toTreeId, toTreeId)),
        and(eq(networkConnectionRequests.fromTreeId, toTreeId), eq(networkConnectionRequests.toTreeId, fromTreeId))
      ))
      .limit(1);
    return request;
  }

  async getNetworkConnectionRequestById(id: string): Promise<NetworkConnectionRequest | undefined> {
    const [request] = await db.select().from(networkConnectionRequests)
      .where(eq(networkConnectionRequests.id, id))
      .limit(1);
    return request;
  }

  async getNetworkConnectionRequestsForUser(userId: string): Promise<NetworkConnectionRequest[]> {
    return db.select().from(networkConnectionRequests)
      .where(eq(networkConnectionRequests.toOwnerId, userId));
  }

  async createNetworkConnectionRequest(request: InsertNetworkConnectionRequest): Promise<NetworkConnectionRequest> {
    const [created] = await db.insert(networkConnectionRequests).values(request).returning();
    return created;
  }

  async updateNetworkConnectionRequestStatus(id: string, status: string): Promise<NetworkConnectionRequest | undefined> {
    const [updated] = await db.update(networkConnectionRequests)
      .set({ status, respondedAt: new Date() })
      .where(eq(networkConnectionRequests.id, id))
      .returning();
    return updated;
  }

  // Tree Connection Imports (Selective Branch Import)
  async getImportConfigsForConnection(connectionId: string): Promise<TreeConnectionImport[]> {
    return db.select().from(treeConnectionImports)
      .where(eq(treeConnectionImports.connectionId, connectionId));
  }

  async getImportConfigsForTree(targetTreeId: string): Promise<TreeConnectionImport[]> {
    return db.select().from(treeConnectionImports)
      .where(eq(treeConnectionImports.targetTreeId, targetTreeId));
  }

  async createImportConfig(config: InsertTreeConnectionImport): Promise<TreeConnectionImport> {
    const [created] = await db.insert(treeConnectionImports).values(config).returning();
    return created;
  }

  async deleteImportConfig(id: string): Promise<boolean> {
    await db.delete(importedMembers).where(eq(importedMembers.importConfigId, id));
    await db.delete(treeConnectionImports).where(eq(treeConnectionImports.id, id));
    return true;
  }

  // Imported Members
  async getImportedMembersForTree(targetTreeId: string): Promise<ImportedMember[]> {
    return db.select().from(importedMembers)
      .where(eq(importedMembers.targetTreeId, targetTreeId));
  }

  async getImportedMembersForConfig(importConfigId: string): Promise<ImportedMember[]> {
    return db.select().from(importedMembers)
      .where(eq(importedMembers.importConfigId, importConfigId));
  }

  async createImportedMember(member: InsertImportedMember): Promise<ImportedMember> {
    const [created] = await db.insert(importedMembers).values(member).returning();
    return created;
  }

  async deleteImportedMembersForConfig(importConfigId: string): Promise<boolean> {
    await db.delete(importedMembers).where(eq(importedMembers.importConfigId, importConfigId));
    return true;
  }

  async getImportedMemberCount(targetTreeId: string): Promise<number> {
    const result = await db.select().from(importedMembers)
      .where(eq(importedMembers.targetTreeId, targetTreeId));
    const uniqueMembers = new Set(result.map(m => m.sourceMemberId));
    return uniqueMembers.size;
  }

  async isImportedMember(targetTreeId: string, sourceMemberId: string): Promise<boolean> {
    const result = await db.select().from(importedMembers)
      .where(and(
        eq(importedMembers.targetTreeId, targetTreeId),
        eq(importedMembers.sourceMemberId, sourceMemberId)
      ));
    return result.length > 0;
  }

  // Events
  async getEvents(treeId: string): Promise<FamilyEvent[]> {
    return db.select().from(familyEvents)
      .where(eq(familyEvents.treeId, treeId))
      .orderBy(desc(familyEvents.eventDate));
  }

  async createEvent(event: InsertFamilyEvent): Promise<FamilyEvent> {
    const [created] = await db.insert(familyEvents).values(event).returning();
    return created;
  }

  async deleteEvent(id: string): Promise<boolean> {
    await db.delete(familyEvents).where(eq(familyEvents.id, id));
    return true;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUserStripeInfo(userId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...info, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserEmail(userId: string, email: string): Promise<void> {
    await db.update(users)
      .set({ email, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateUserActivity(userId: string): Promise<void> {
    await db.update(users)
      .set({ lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getInactiveUsers(inactivityMonths: number): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - inactivityMonths);
    
    const allUsers = await db.select().from(users);
    return allUsers.filter(user => {
      const lastActivity = user.lastActivityAt || user.createdAt;
      return lastActivity && lastActivity < cutoffDate;
    });
  }

  async updateUserInactivityReminder(userId: string): Promise<void> {
    await db.update(users)
      .set({ inactivityReminderSentAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // User Profile (single source of truth for claimed profiles)
  async getAllClaimedProfilesForUser(userId: string): Promise<FamilyMember[]> {
    const members = await db.select().from(familyMembers).where(
      eq(familyMembers.claimedByUserId, userId)
    );
    return members;
  }

  async updateUserProfile(userId: string, profile: {
    nickname?: string;
    gender?: "male" | "female" | "other";
    birthDate?: string;
    birthPlace?: string;
    bio?: string;
    currentCity?: string;
    currentRegion?: string;
    currentCountry?: string;
    locationVisible?: boolean;
  }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Account Heirs
  async getAccountHeir(userId: string): Promise<AccountHeir | undefined> {
    const [heir] = await db.select().from(accountHeirs).where(eq(accountHeirs.userId, userId));
    return heir;
  }

  async createAccountHeir(heir: InsertAccountHeir): Promise<AccountHeir> {
    const [created] = await db.insert(accountHeirs).values(heir).returning();
    return created;
  }

  async updateAccountHeir(id: string, data: Partial<InsertAccountHeir>): Promise<AccountHeir | undefined> {
    const [updated] = await db.update(accountHeirs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accountHeirs.id, id))
      .returning();
    return updated;
  }

  async deleteAccountHeir(id: string): Promise<boolean> {
    await db.delete(accountHeirs).where(eq(accountHeirs.id, id));
    return true;
  }

  async getHeirsAwaitingTransfer(): Promise<AccountHeir[]> {
    return db.select().from(accountHeirs)
      .where(eq(accountHeirs.status, "notified"));
  }

  // Education History
  async getEducationHistory(memberId: string): Promise<EducationHistory[]> {
    return db.select().from(educationHistory)
      .where(eq(educationHistory.memberId, memberId))
      .orderBy(desc(educationHistory.startDate));
  }

  async createEducationHistory(education: InsertEducationHistory): Promise<EducationHistory> {
    const [created] = await db.insert(educationHistory).values(education).returning();
    return created;
  }

  async updateEducationHistory(id: string, data: Partial<InsertEducationHistory>): Promise<EducationHistory | undefined> {
    const [updated] = await db.update(educationHistory)
      .set(data)
      .where(eq(educationHistory.id, id))
      .returning();
    return updated;
  }

  async deleteEducationHistory(id: string): Promise<boolean> {
    await db.delete(educationHistory).where(eq(educationHistory.id, id));
    return true;
  }

  // Career History
  async getCareerHistory(memberId: string): Promise<CareerHistory[]> {
    return db.select().from(careerHistory)
      .where(eq(careerHistory.memberId, memberId))
      .orderBy(desc(careerHistory.startDate));
  }

  async createCareerHistory(career: InsertCareerHistory): Promise<CareerHistory> {
    const [created] = await db.insert(careerHistory).values(career).returning();
    return created;
  }

  async updateCareerHistory(id: string, data: Partial<InsertCareerHistory>): Promise<CareerHistory | undefined> {
    const [updated] = await db.update(careerHistory)
      .set(data)
      .where(eq(careerHistory.id, id))
      .returning();
    return updated;
  }

  async deleteCareerHistory(id: string): Promise<boolean> {
    await db.delete(careerHistory).where(eq(careerHistory.id, id));
    return true;
  }

  // Discoverable Members
  async getDiscoverableMember(memberId: string): Promise<DiscoverableMember | undefined> {
    const [result] = await db.select().from(discoverableMembers)
      .where(eq(discoverableMembers.memberId, memberId));
    return result;
  }

  async getDiscoverableMembersByTree(treeId: string): Promise<DiscoverableMember[]> {
    return db.select().from(discoverableMembers)
      .where(eq(discoverableMembers.treeId, treeId));
  }

  async createOrUpdateDiscoverableMember(data: InsertDiscoverableMember): Promise<DiscoverableMember> {
    const existing = await this.getDiscoverableMember(data.memberId);
    if (existing) {
      const [updated] = await db.update(discoverableMembers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(discoverableMembers.memberId, data.memberId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(discoverableMembers).values(data).returning();
    return created;
  }

  async deleteDiscoverableMember(memberId: string): Promise<boolean> {
    await db.delete(discoverableMembers).where(eq(discoverableMembers.memberId, memberId));
    return true;
  }

  async findPotentialMatches(memberId: string): Promise<{ member: FamilyMember; matchScore: number; matchCriteria: string[] }[]> {
    const sourceMember = await this.getMember(memberId);
    if (!sourceMember) return [];

    const sourceDiscoverable = await this.getDiscoverableMember(memberId);
    if (!sourceDiscoverable || !sourceDiscoverable.isDiscoverable) return [];

    const allDiscoverable = await db.select().from(discoverableMembers)
      .where(and(
        eq(discoverableMembers.isDiscoverable, true)
      ));

    const matches: { member: FamilyMember; matchScore: number; matchCriteria: string[] }[] = [];

    for (const discoverable of allDiscoverable) {
      if (discoverable.memberId === memberId) continue;
      if (discoverable.treeId === sourceMember.treeId) continue;

      const targetMember = await this.getMember(discoverable.memberId);
      if (!targetMember) continue;

      const matchCriteria: string[] = [];
      let matchScore = 0;

      if (sourceDiscoverable.matchByEmail && discoverable.matchByEmail && 
          sourceMember.email && targetMember.email && 
          sourceMember.email.toLowerCase() === targetMember.email.toLowerCase()) {
        matchCriteria.push("email");
        matchScore += 50;
      }

      if (sourceDiscoverable.matchByName && discoverable.matchByName) {
        const sourceFullName = `${sourceMember.firstName} ${sourceMember.lastName || ''}`.toLowerCase().trim();
        const targetFullName = `${targetMember.firstName} ${targetMember.lastName || ''}`.toLowerCase().trim();
        if (sourceFullName === targetFullName) {
          matchCriteria.push("name");
          matchScore += 30;
        }
      }

      if (sourceDiscoverable.matchByNickname && discoverable.matchByNickname &&
          sourceMember.nickname && targetMember.nickname &&
          sourceMember.nickname.toLowerCase() === targetMember.nickname.toLowerCase()) {
        matchCriteria.push("nickname");
        matchScore += 20;
      }

      if (sourceDiscoverable.matchByBirthdate && discoverable.matchByBirthdate &&
          sourceMember.birthDate && targetMember.birthDate &&
          sourceMember.birthDate === targetMember.birthDate) {
        matchCriteria.push("birthdate");
        matchScore += 25;
      }

      if (sourceDiscoverable.matchByBirthplace && discoverable.matchByBirthplace &&
          sourceMember.birthPlace && targetMember.birthPlace &&
          sourceMember.birthPlace.toLowerCase() === targetMember.birthPlace.toLowerCase()) {
        matchCriteria.push("birthplace");
        matchScore += 15;
      }

      if (matchScore > 0) {
        matches.push({ member: targetMember, matchScore, matchCriteria });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  // Match Requests
  async getMatchRequests(treeId: string): Promise<MatchRequest[]> {
    return db.select().from(matchRequests)
      .where(eq(matchRequests.targetTreeId, treeId))
      .orderBy(desc(matchRequests.createdAt));
  }

  async getSentMatchRequests(treeId: string): Promise<MatchRequest[]> {
    return db.select().from(matchRequests)
      .where(eq(matchRequests.requestingTreeId, treeId))
      .orderBy(desc(matchRequests.createdAt));
  }

  async getMatchRequest(id: string): Promise<MatchRequest | undefined> {
    const [result] = await db.select().from(matchRequests)
      .where(eq(matchRequests.id, id));
    return result;
  }

  async createMatchRequest(request: InsertMatchRequest): Promise<MatchRequest> {
    const [created] = await db.insert(matchRequests).values(request).returning();
    return created;
  }

  async updateMatchRequest(id: string, data: Partial<InsertMatchRequest>): Promise<MatchRequest | undefined> {
    const [updated] = await db.update(matchRequests)
      .set({ ...data, respondedAt: new Date() })
      .where(eq(matchRequests.id, id))
      .returning();
    return updated;
  }

  async deleteMatchRequest(id: string): Promise<boolean> {
    await db.delete(matchRequests).where(eq(matchRequests.id, id));
    return true;
  }

  // Member Invitations
  async getMemberInvitationByEmail(email: string, memberId: string): Promise<MemberInvitation | undefined> {
    const [result] = await db.select().from(memberInvitations)
      .where(and(
        eq(memberInvitations.email, email.toLowerCase()),
        eq(memberInvitations.memberId, memberId)
      ));
    return result;
  }

  async getMemberInvitationsByEmail(email: string): Promise<MemberInvitation[]> {
    return db.select().from(memberInvitations)
      .where(eq(memberInvitations.email, email.toLowerCase()))
      .orderBy(desc(memberInvitations.sentAt));
  }

  async getMemberInvitationsByTree(treeId: string): Promise<MemberInvitation[]> {
    return db.select().from(memberInvitations)
      .where(eq(memberInvitations.treeId, treeId))
      .orderBy(desc(memberInvitations.sentAt));
  }

  async createMemberInvitation(invitation: InsertMemberInvitation): Promise<MemberInvitation> {
    const [created] = await db.insert(memberInvitations).values({
      ...invitation,
      email: invitation.email.toLowerCase()
    }).returning();
    return created;
  }

  async updateMemberInvitationStatus(id: string, status: 'clicked' | 'registered'): Promise<MemberInvitation | undefined> {
    const updateData: any = { status };
    if (status === 'clicked') {
      updateData.clickedAt = new Date();
    } else if (status === 'registered') {
      updateData.registeredAt = new Date();
    }
    const [updated] = await db.update(memberInvitations)
      .set(updateData)
      .where(eq(memberInvitations.id, id))
      .returning();
    return updated;
  }

  async deleteMemberInvitation(id: string): Promise<void> {
    await db.delete(memberInvitations).where(eq(memberInvitations.id, id));
  }

  // Profile Claim Requests
  async getProfileClaimRequest(id: string): Promise<ProfileClaimRequest | undefined> {
    const [request] = await db.select().from(profileClaimRequests)
      .where(eq(profileClaimRequests.id, id));
    return request;
  }

  async getProfileClaimRequestsByTree(treeId: string): Promise<ProfileClaimRequest[]> {
    return db.select().from(profileClaimRequests)
      .where(eq(profileClaimRequests.treeId, treeId))
      .orderBy(desc(profileClaimRequests.createdAt));
  }

  async getProfileClaimRequestsByMember(memberId: string): Promise<ProfileClaimRequest[]> {
    return db.select().from(profileClaimRequests)
      .where(eq(profileClaimRequests.memberId, memberId))
      .orderBy(desc(profileClaimRequests.createdAt));
  }

  async getProfileClaimRequestByRequester(requesterId: string, memberId: string): Promise<ProfileClaimRequest | undefined> {
    const [request] = await db.select().from(profileClaimRequests)
      .where(and(
        eq(profileClaimRequests.requesterId, requesterId),
        eq(profileClaimRequests.memberId, memberId)
      ));
    return request;
  }

  async getClaimedProfilesByUser(userId: string): Promise<FamilyMember[]> {
    return db.select().from(familyMembers)
      .where(eq(familyMembers.claimedByUserId, userId));
  }

  async createProfileClaimRequest(request: InsertProfileClaimRequest): Promise<ProfileClaimRequest> {
    const [created] = await db.insert(profileClaimRequests).values(request).returning();
    return created;
  }

  async updateProfileClaimRequest(id: string, data: Partial<InsertProfileClaimRequest>): Promise<ProfileClaimRequest | undefined> {
    const [updated] = await db.update(profileClaimRequests)
      .set(data)
      .where(eq(profileClaimRequests.id, id))
      .returning();
    return updated;
  }

  async approveProfileClaim(claimId: string, reviewerId: string): Promise<ProfileClaimRequest | undefined> {
    const claim = await this.getProfileClaimRequest(claimId);
    if (!claim) return undefined;

    // Update the claim status
    const [updatedClaim] = await db.update(profileClaimRequests)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(profileClaimRequests.id, claimId))
      .returning();

    // Update the family member to mark them as claimed
    await db.update(familyMembers)
      .set({
        claimedByUserId: claim.requesterId,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(familyMembers.id, claim.memberId));

    return updatedClaim;
  }

  async denyProfileClaim(claimId: string, reviewerId: string, reason?: string): Promise<ProfileClaimRequest | undefined> {
    const [updated] = await db.update(profileClaimRequests)
      .set({
        status: 'denied',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        denialReason: reason,
      })
      .where(eq(profileClaimRequests.id, claimId))
      .returning();
    return updated;
  }

  // Merchandise Orders
  async getMerchandiseOrders(userId: string): Promise<MerchandiseOrder[]> {
    return db.select().from(merchandiseOrders)
      .where(eq(merchandiseOrders.userId, userId))
      .orderBy(desc(merchandiseOrders.createdAt));
  }

  async getMerchandiseOrder(id: string): Promise<MerchandiseOrder | undefined> {
    const [order] = await db.select().from(merchandiseOrders)
      .where(eq(merchandiseOrders.id, id));
    return order;
  }

  async getMerchandiseOrderByStripeSession(sessionId: string): Promise<MerchandiseOrder | undefined> {
    const [order] = await db.select().from(merchandiseOrders)
      .where(eq(merchandiseOrders.stripePaymentIntentId, sessionId));
    return order;
  }

  async createMerchandiseOrder(order: InsertMerchandiseOrder): Promise<MerchandiseOrder> {
    const [created] = await db.insert(merchandiseOrders).values(order).returning();
    return created;
  }

  async updateMerchandiseOrder(id: string, data: Partial<InsertMerchandiseOrder>): Promise<MerchandiseOrder | undefined> {
    const [updated] = await db.update(merchandiseOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(merchandiseOrders.id, id))
      .returning();
    return updated;
  }

  // Custodianship Requests
  async getCustodianshipRequest(id: string): Promise<CustodianshipRequest | undefined> {
    const [request] = await db.select().from(custodianshipRequests)
      .where(eq(custodianshipRequests.id, id));
    return request;
  }

  async getCustodianshipRequestsByTree(treeId: string): Promise<CustodianshipRequest[]> {
    return db.select().from(custodianshipRequests)
      .where(eq(custodianshipRequests.treeId, treeId))
      .orderBy(desc(custodianshipRequests.createdAt));
  }

  async getCustodianshipRequestsByMember(memberId: string): Promise<CustodianshipRequest[]> {
    return db.select().from(custodianshipRequests)
      .where(eq(custodianshipRequests.memberId, memberId))
      .orderBy(desc(custodianshipRequests.createdAt));
  }

  async getCustodianshipRequestByRequester(requesterId: string, memberId: string): Promise<CustodianshipRequest | undefined> {
    const [request] = await db.select().from(custodianshipRequests)
      .where(and(
        eq(custodianshipRequests.requesterId, requesterId),
        eq(custodianshipRequests.memberId, memberId),
        eq(custodianshipRequests.status, 'pending')
      ));
    return request;
  }

  async createCustodianshipRequest(request: InsertCustodianshipRequest): Promise<CustodianshipRequest> {
    const [created] = await db.insert(custodianshipRequests).values(request).returning();
    return created;
  }

  async updateCustodianshipRequest(id: string, data: Partial<InsertCustodianshipRequest>): Promise<CustodianshipRequest | undefined> {
    const [updated] = await db.update(custodianshipRequests)
      .set(data)
      .where(eq(custodianshipRequests.id, id))
      .returning();
    return updated;
  }

  async approveCustodianship(requestId: string, reviewerId: string): Promise<CustodianshipRequest | undefined> {
    const request = await this.getCustodianshipRequest(requestId);
    if (!request) return undefined;

    const [updatedRequest] = await db.update(custodianshipRequests)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(custodianshipRequests.id, requestId))
      .returning();

    // Update the family member to assign custodianship
    await db.update(familyMembers)
      .set({
        custodianUserId: request.requesterId,
        custodianAssignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(familyMembers.id, request.memberId));

    return updatedRequest;
  }

  async denyCustodianship(requestId: string, reviewerId: string, reason?: string): Promise<CustodianshipRequest | undefined> {
    const [updated] = await db.update(custodianshipRequests)
      .set({
        status: 'denied',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        denialReason: reason,
      })
      .where(eq(custodianshipRequests.id, requestId))
      .returning();
    return updated;
  }

  async getPendingCustodianshipRequests(): Promise<CustodianshipRequest[]> {
    return db.select().from(custodianshipRequests)
      .where(eq(custodianshipRequests.status, 'pending'))
      .orderBy(desc(custodianshipRequests.createdAt));
  }

  async getExpiredCustodianshipRequests(): Promise<CustodianshipRequest[]> {
    const now = new Date();
    return db.select().from(custodianshipRequests)
      .where(and(
        eq(custodianshipRequests.status, 'pending'),
        lt(custodianshipRequests.expiresAt, now)
      ));
  }

  // Events (extended)
  async getEvent(id: string): Promise<FamilyEvent | undefined> {
    const [event] = await db.select().from(familyEvents)
      .where(eq(familyEvents.id, id));
    return event;
  }

  async updateEvent(id: string, data: Partial<InsertFamilyEvent>): Promise<FamilyEvent | undefined> {
    const [updated] = await db.update(familyEvents)
      .set(data)
      .where(eq(familyEvents.id, id))
      .returning();
    return updated;
  }

  async getEventsByMember(memberId: string): Promise<FamilyEvent[]> {
    return db.select().from(familyEvents)
      .where(eq(familyEvents.memberId, memberId))
      .orderBy(desc(familyEvents.eventDate));
  }

  async createAnnouncement(data: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await db.insert(announcements).values(data).returning();
    return announcement;
  }

  async getAnnouncementsByUser(userId: string): Promise<Announcement[]> {
    return db.select().from(announcements)
      .where(eq(announcements.createdBy, userId))
      .orderBy(desc(announcements.createdAt));
  }

  async getAnnouncementsForTree(treeId: string): Promise<Announcement[]> {
    const all = await db.select().from(announcements)
      .orderBy(desc(announcements.createdAt));
    return all.filter(a => 
      a.sourceTreeId === treeId || 
      (a.targetTreeIds as string[]).includes(treeId)
    );
  }

  // User notification preferences
  async updateUserNotificationPreferences(userId: string, preferences: any): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({
        notificationPreferences: preferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  // Get tree collaborators and owners with their notification preferences
  async getTreeMembersWithNotificationPrefs(treeId: string): Promise<User[]> {
    // Get the tree to find the owner
    const tree = await this.getTree(treeId);
    if (!tree) return [];
    
    // Get all collaborators for this tree
    const collabs = await this.getCollaborators(treeId);
    const userIds = [tree.ownerId, ...collabs.map(c => c.userId)];
    
    // Fetch all users with their notification preferences
    const userList = await db.select().from(users)
      .where(inArray(users.id, userIds));
    
    return userList;
  }

  // Special Connections
  async getSpecialConnectionsByMember(memberId: string): Promise<SpecialConnection[]> {
    return db.select().from(specialConnections)
      .where(or(
        eq(specialConnections.fromMemberId, memberId),
        and(
          eq(specialConnections.toMemberId, memberId),
          eq(specialConnections.isReciprocal, true)
        )
      ))
      .orderBy(desc(specialConnections.createdAt));
  }

  async getSpecialConnectionsByTree(treeId: string): Promise<SpecialConnection[]> {
    return db.select().from(specialConnections)
      .where(or(
        eq(specialConnections.fromTreeId, treeId),
        eq(specialConnections.toTreeId, treeId)
      ))
      .orderBy(desc(specialConnections.createdAt));
  }

  async getSpecialConnection(id: string): Promise<SpecialConnection | undefined> {
    const [connection] = await db.select().from(specialConnections)
      .where(eq(specialConnections.id, id));
    return connection;
  }

  async createSpecialConnection(connection: InsertSpecialConnection): Promise<SpecialConnection> {
    const [created] = await db.insert(specialConnections)
      .values(connection)
      .returning();
    return created;
  }

  async deleteSpecialConnection(id: string): Promise<boolean> {
    const result = await db.delete(specialConnections)
      .where(eq(specialConnections.id, id));
    return true;
  }

  // Connection Requests
  async getConnectionRequestsByMember(memberId: string): Promise<ConnectionRequest[]> {
    return db.select().from(connectionRequests)
      .where(or(
        eq(connectionRequests.fromMemberId, memberId),
        eq(connectionRequests.toMemberId, memberId)
      ))
      .orderBy(desc(connectionRequests.createdAt));
  }

  async getConnectionRequestsByTree(treeId: string): Promise<ConnectionRequest[]> {
    return db.select().from(connectionRequests)
      .where(or(
        eq(connectionRequests.fromTreeId, treeId),
        eq(connectionRequests.toTreeId, treeId)
      ))
      .orderBy(desc(connectionRequests.createdAt));
  }

  async getPendingConnectionRequestsForTree(treeId: string): Promise<ConnectionRequest[]> {
    return db.select().from(connectionRequests)
      .where(and(
        eq(connectionRequests.toTreeId, treeId),
        eq(connectionRequests.status, 'pending')
      ))
      .orderBy(desc(connectionRequests.createdAt));
  }

  async getConnectionRequest(id: string): Promise<ConnectionRequest | undefined> {
    const [request] = await db.select().from(connectionRequests)
      .where(eq(connectionRequests.id, id));
    return request;
  }

  async createConnectionRequest(request: InsertConnectionRequest): Promise<ConnectionRequest> {
    const [created] = await db.insert(connectionRequests)
      .values(request)
      .returning();
    return created;
  }

  async updateConnectionRequest(id: string, data: Partial<InsertConnectionRequest>): Promise<ConnectionRequest | undefined> {
    const [updated] = await db.update(connectionRequests)
      .set(data)
      .where(eq(connectionRequests.id, id))
      .returning();
    return updated;
  }

  async approveConnectionRequest(requestId: string, responderId: string): Promise<ConnectionRequest | undefined> {
    const request = await this.getConnectionRequest(requestId);
    if (!request) return undefined;

    // Update the request status
    const [updated] = await db.update(connectionRequests)
      .set({
        status: 'approved',
        respondedBy: responderId,
        respondedAt: new Date(),
      })
      .where(eq(connectionRequests.id, requestId))
      .returning();

    // Create the special connection
    await this.createSpecialConnection({
      fromMemberId: request.fromMemberId,
      fromTreeId: request.fromTreeId,
      toMemberId: request.toMemberId,
      toTreeId: request.toTreeId,
      connectionType: request.connectionType,
      customLabel: request.customLabel,
      isReciprocal: true,
      createdBy: responderId,
    });

    return updated;
  }

  async denyConnectionRequest(requestId: string, responderId: string): Promise<ConnectionRequest | undefined> {
    const [updated] = await db.update(connectionRequests)
      .set({
        status: 'denied',
        respondedBy: responderId,
        respondedAt: new Date(),
      })
      .where(eq(connectionRequests.id, requestId))
      .returning();
    return updated;
  }

  // Network discovery - get members connected to your connections (second-degree)
  async getNetworkConnections(memberId: string): Promise<{ member: FamilyMember; connectionType: string; connectedVia: FamilyMember }[]> {
    // Get all direct connections for this member
    const directConnections = await this.getSpecialConnectionsByMember(memberId);
    const results: { member: FamilyMember; connectionType: string; connectedVia: FamilyMember }[] = [];
    
    for (const conn of directConnections) {
      // Determine which side is the "other" person
      const connectedMemberId = conn.fromMemberId === memberId ? conn.toMemberId : conn.fromMemberId;
      const connectedMember = await this.getMember(connectedMemberId);
      if (!connectedMember) continue;

      // Get connections of that connected member
      const secondDegree = await this.getSpecialConnectionsByMember(connectedMemberId);
      
      for (const sc of secondDegree) {
        const thirdPartyId = sc.fromMemberId === connectedMemberId ? sc.toMemberId : sc.fromMemberId;
        // Skip if it's the original member
        if (thirdPartyId === memberId) continue;
        
        const thirdParty = await this.getMember(thirdPartyId);
        if (thirdParty && thirdParty.locationVisible) {
          results.push({
            member: thirdParty,
            connectionType: sc.connectionType,
            connectedVia: connectedMember,
          });
        }
      }
    }
    
    return results;
  }

  // Location-based search
  async getMembersByLocation(city?: string, region?: string, country?: string): Promise<FamilyMember[]> {
    const conditions = [eq(familyMembers.locationVisible, true)];
    
    if (city) {
      conditions.push(ilike(familyMembers.currentCity, `%${city}%`));
    }
    if (region) {
      conditions.push(ilike(familyMembers.currentRegion, `%${region}%`));
    }
    if (country) {
      conditions.push(ilike(familyMembers.currentCountry, `%${country}%`));
    }
    
    return db.select().from(familyMembers)
      .where(and(...conditions));
  }

  // FamilySearch connections
  async getFamilySearchConnection(userId: string): Promise<FamilySearchConnection | undefined> {
    const [connection] = await db.select().from(familySearchConnections)
      .where(eq(familySearchConnections.userId, userId));
    return connection;
  }

  async createFamilySearchConnection(data: InsertFamilySearchConnection): Promise<FamilySearchConnection> {
    const [connection] = await db.insert(familySearchConnections).values(data).returning();
    return connection;
  }

  async updateFamilySearchConnection(userId: string, data: Partial<InsertFamilySearchConnection>): Promise<FamilySearchConnection | undefined> {
    const [connection] = await db.update(familySearchConnections)
      .set(data)
      .where(eq(familySearchConnections.userId, userId))
      .returning();
    return connection;
  }

  async deleteFamilySearchConnection(userId: string): Promise<boolean> {
    const result = await db.delete(familySearchConnections)
      .where(eq(familySearchConnections.userId, userId));
    return true;
  }

  // FamilySearch sources (attached records)
  async getFamilySearchSources(memberId: string): Promise<FamilySearchSource[]> {
    return db.select().from(familySearchSources)
      .where(eq(familySearchSources.memberId, memberId))
      .orderBy(desc(familySearchSources.createdAt));
  }

  async getFamilySearchSourceById(id: string): Promise<FamilySearchSource | undefined> {
    const [source] = await db.select().from(familySearchSources)
      .where(eq(familySearchSources.id, id));
    return source;
  }

  async getFamilySearchSourcesByTree(treeId: string): Promise<FamilySearchSource[]> {
    return db.select().from(familySearchSources)
      .where(eq(familySearchSources.treeId, treeId))
      .orderBy(desc(familySearchSources.createdAt));
  }

  async createFamilySearchSource(data: InsertFamilySearchSource): Promise<FamilySearchSource> {
    const [source] = await db.insert(familySearchSources).values(data).returning();
    return source;
  }

  async deleteFamilySearchSource(id: string): Promise<boolean> {
    await db.delete(familySearchSources).where(eq(familySearchSources.id, id));
    return true;
  }

  // Gift Registries
  async getGiftRegistry(id: string): Promise<GiftRegistry | undefined> {
    const [registry] = await db.select().from(giftRegistries).where(eq(giftRegistries.id, id));
    return registry;
  }

  async getGiftRegistriesByMember(memberId: string): Promise<GiftRegistry[]> {
    return db.select().from(giftRegistries)
      .where(eq(giftRegistries.memberId, memberId))
      .orderBy(desc(giftRegistries.eventDate));
  }

  async getGiftRegistriesByTree(treeId: string): Promise<GiftRegistry[]> {
    return db.select().from(giftRegistries)
      .where(eq(giftRegistries.treeId, treeId))
      .orderBy(desc(giftRegistries.eventDate));
  }

  async getGiftRegistriesByUser(userId: string): Promise<GiftRegistry[]> {
    return db.select().from(giftRegistries)
      .where(eq(giftRegistries.createdByUserId, userId))
      .orderBy(desc(giftRegistries.eventDate));
  }

  async createGiftRegistry(registry: InsertGiftRegistry): Promise<GiftRegistry> {
    const [created] = await db.insert(giftRegistries).values(registry).returning();
    return created;
  }

  async updateGiftRegistry(id: string, data: Partial<InsertGiftRegistry>): Promise<GiftRegistry | undefined> {
    const [updated] = await db.update(giftRegistries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(giftRegistries.id, id))
      .returning();
    return updated;
  }

  async deleteGiftRegistry(id: string): Promise<boolean> {
    await db.delete(giftRegistryItems).where(eq(giftRegistryItems.registryId, id));
    await db.delete(giftRegistries).where(eq(giftRegistries.id, id));
    return true;
  }

  // Gift Registry Items
  async getGiftRegistryItems(registryId: string): Promise<GiftRegistryItem[]> {
    return db.select().from(giftRegistryItems)
      .where(eq(giftRegistryItems.registryId, registryId))
      .orderBy(desc(giftRegistryItems.priority));
  }

  async getGiftRegistryItem(id: string): Promise<GiftRegistryItem | undefined> {
    const [item] = await db.select().from(giftRegistryItems).where(eq(giftRegistryItems.id, id));
    return item;
  }

  async createGiftRegistryItem(item: InsertGiftRegistryItem): Promise<GiftRegistryItem> {
    const [created] = await db.insert(giftRegistryItems).values(item).returning();
    return created;
  }

  async updateGiftRegistryItem(id: string, data: Partial<InsertGiftRegistryItem>): Promise<GiftRegistryItem | undefined> {
    const [updated] = await db.update(giftRegistryItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(giftRegistryItems.id, id))
      .returning();
    return updated;
  }

  async deleteGiftRegistryItem(id: string): Promise<boolean> {
    await db.delete(giftRegistryItems).where(eq(giftRegistryItems.id, id));
    return true;
  }

  async markItemPurchased(itemId: string, userId: string, quantity: number): Promise<GiftRegistryItem | undefined> {
    const item = await this.getGiftRegistryItem(itemId);
    if (!item) return undefined;

    const newQuantityPurchased = (item.quantityPurchased || 0) + quantity;
    const isFullyPurchased = newQuantityPurchased >= item.quantity;

    const [updated] = await db.update(giftRegistryItems)
      .set({
        quantityPurchased: newQuantityPurchased,
        status: isFullyPurchased ? 'purchased' : (newQuantityPurchased > 0 ? 'reserved' : 'available'),
        purchasedByUserId: isFullyPurchased ? userId : item.purchasedByUserId,
        purchasedAt: isFullyPurchased ? new Date() : item.purchasedAt,
        updatedAt: new Date(),
      })
      .where(eq(giftRegistryItems.id, itemId))
      .returning();
    return updated;
  }

  // User Connection Requests (QR code connections)
  async createUserConnectionRequest(request: InsertUserConnectionRequest): Promise<UserConnectionRequest> {
    const [created] = await db.insert(userConnectionRequests).values(request).returning();
    return created;
  }

  async getUserConnectionRequest(id: string): Promise<UserConnectionRequest | undefined> {
    const [request] = await db.select().from(userConnectionRequests).where(eq(userConnectionRequests.id, id));
    return request;
  }

  async getPendingUserConnectionRequestsForUser(toUserId: string): Promise<UserConnectionRequest[]> {
    return db.select().from(userConnectionRequests)
      .where(and(
        eq(userConnectionRequests.toUserId, toUserId),
        eq(userConnectionRequests.status, "pending")
      ))
      .orderBy(desc(userConnectionRequests.createdAt));
  }

  async getSentUserConnectionRequests(fromUserId: string): Promise<UserConnectionRequest[]> {
    return db.select().from(userConnectionRequests)
      .where(eq(userConnectionRequests.fromUserId, fromUserId))
      .orderBy(desc(userConnectionRequests.createdAt));
  }

  async getExistingUserConnectionRequest(fromUserId: string, toUserId: string): Promise<UserConnectionRequest | undefined> {
    const [request] = await db.select().from(userConnectionRequests)
      .where(and(
        eq(userConnectionRequests.fromUserId, fromUserId),
        eq(userConnectionRequests.toUserId, toUserId),
        eq(userConnectionRequests.status, "pending")
      ));
    return request;
  }

  async approveUserConnectionRequest(id: string, approverRelationshipType?: string, approverCustomLabel?: string): Promise<UserConnectionRequest | undefined> {
    // Update the request with the approver's relationship type
    const updateData: any = { status: "approved", respondedAt: new Date() };
    if (approverRelationshipType) {
      updateData.approverRelationshipType = approverRelationshipType;
      if (approverRelationshipType === "other" && approverCustomLabel) {
        updateData.approverCustomLabel = approverCustomLabel;
      }
    }
    
    const [updated] = await db.update(userConnectionRequests)
      .set(updateData)
      .where(eq(userConnectionRequests.id, id))
      .returning();
    return updated;
  }

  async denyUserConnectionRequest(id: string): Promise<UserConnectionRequest | undefined> {
    const [updated] = await db.update(userConnectionRequests)
      .set({ status: "denied", respondedAt: new Date() })
      .where(eq(userConnectionRequests.id, id))
      .returning();
    return updated;
  }

  // User Connections (approved connections)
  async getUserConnections(userId: string): Promise<UserConnection[]> {
    return db.select().from(userConnections)
      .where(or(
        eq(userConnections.userId1, userId),
        eq(userConnections.userId2, userId)
      ))
      .orderBy(desc(userConnections.connectedAt));
  }

  async getExistingUserConnection(userId1: string, userId2: string): Promise<UserConnection | undefined> {
    // Check both directions since connection is bidirectional
    const [connection] = await db.select().from(userConnections)
      .where(or(
        and(eq(userConnections.userId1, userId1), eq(userConnections.userId2, userId2)),
        and(eq(userConnections.userId1, userId2), eq(userConnections.userId2, userId1))
      ));
    return connection;
  }

  async createUserConnection(connection: InsertUserConnection): Promise<UserConnection> {
    const [created] = await db.insert(userConnections).values(connection).returning();
    return created;
  }

  // Admin methods
  async getAllUsers(search?: string): Promise<User[]> {
    if (search) {
      return db.select().from(users)
        .where(or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`)
        ))
        .orderBy(desc(users.createdAt))
        .limit(100);
    }
    return db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteUserConnections(userId: string): Promise<void> {
    await db.delete(userConnections).where(
      or(eq(userConnections.userId1, userId), eq(userConnections.userId2, userId))
    );
  }

  async deleteUserConnection(connectionId: string, userId: string): Promise<boolean> {
    const connection = await db.select().from(userConnections).where(eq(userConnections.id, connectionId)).limit(1);
    if (!connection.length) return false;
    
    const conn = connection[0];
    if (conn.userId1 !== userId && conn.userId2 !== userId) {
      return false;
    }
    
    await db.delete(userConnections).where(eq(userConnections.id, connectionId));
    return true;
  }

  async deleteUserConnectionRequests(userId: string): Promise<void> {
    await db.delete(userConnectionRequests).where(
      or(eq(userConnectionRequests.fromUserId, userId), eq(userConnectionRequests.toUserId, userId))
    );
  }

  async getUserTreeCount(userId: string): Promise<number> {
    const trees = await db.select().from(familyTrees).where(eq(familyTrees.ownerId, userId));
    return trees.length;
  }

  async getSubscriptionMetrics(): Promise<{
    totalUsers: number;
    activeSubscribers: number;
    subscribersByTier: Record<string, number>;
    monthlyRecurringRevenue: number;
    projectedAnnualRevenue: number;
    freeUsers: number;
    tierBreakdown: Array<{ tier: string; count: number; monthlyRevenue: number }>;
  }> {
    // Import pricing from subscription config for consistency
    // Starter (free tier, 0-24 members) is FREE - users only pay when exceeding limits
    // Note: 'free' tier represents users still within free tier limits
    const tierPrices: Record<string, number> = {
      'free': 0,      // Starter tier is free (up to 20-24 members)
      'tier_25': 749, // $7.49/mo (25-49 members)
      'tier_50': 499, // $4.99/mo (50-74 members)
      'tier_75': 250, // $2.50/mo (75-99 members)
      'tier_100': 0,  // Heritage tier is free (100+ members)
    };

    const tierDisplayNames: Record<string, string> = {
      'free': 'Starter (Free)',
      'tier_25': 'Growing Family',
      'tier_50': 'Extended Family',
      'tier_75': 'Family Reunion',
      'tier_100': 'Heritage (Free)',
    };

    // Get all users
    const allUsers = await db.select().from(users);
    const totalUsers = allUsers.length;

    // Count active paying subscribers (exclude free tiers)
    const activeSubscribers = allUsers.filter(u => 
      u.isSubscriptionActive && 
      u.subscriptionTier !== 'free' && 
      u.subscriptionTier !== 'tier_100'
    ).length;

    // Count users by tier
    const subscribersByTier: Record<string, number> = {};

    for (const tier of Object.keys(tierPrices)) {
      const count = allUsers.filter(u => u.subscriptionTier === tier).length;
      subscribersByTier[tier] = count;
    }

    // Calculate MRR from active subscriptions (only paying tiers)
    let monthlyRecurringRevenue = 0;
    for (const user of allUsers) {
      if (user.isSubscriptionActive && user.subscriptionTier) {
        monthlyRecurringRevenue += tierPrices[user.subscriptionTier] || 0;
      }
    }

    // Build tier breakdown showing all users per tier
    const tierBreakdown: Array<{ tier: string; count: number; monthlyRevenue: number }> = [];
    for (const [tier, price] of Object.entries(tierPrices)) {
      const count = subscribersByTier[tier] || 0;
      const activeCount = allUsers.filter(u => u.subscriptionTier === tier && u.isSubscriptionActive).length;
      tierBreakdown.push({
        tier: tierDisplayNames[tier] || tier,
        count,
        monthlyRevenue: activeCount * price, // Only count active subscribers for revenue
      });
    }

    // Free users (on free tier, Heritage tier, or not subscribed)
    const freeUsers = allUsers.filter(u => 
      !u.isSubscriptionActive || 
      u.subscriptionTier === 'free' || 
      u.subscriptionTier === 'tier_100'
    ).length;

    return {
      totalUsers,
      activeSubscribers,
      subscribersByTier,
      monthlyRecurringRevenue,
      projectedAnnualRevenue: monthlyRecurringRevenue * 12,
      freeUsers,
      tierBreakdown,
    };
  }

  async transferUserOwnership(fromUserId: string, toUserId: string): Promise<void> {
    // Transfer family trees ownership
    await db.update(familyTrees)
      .set({ ownerId: toUserId })
      .where(eq(familyTrees.ownerId, fromUserId));

    // Transfer claimed profiles
    await db.update(familyMembers)
      .set({ claimedByUserId: toUserId })
      .where(eq(familyMembers.claimedByUserId, fromUserId));

    // Transfer custodianship
    await db.update(familyMembers)
      .set({ custodianUserId: toUserId })
      .where(eq(familyMembers.custodianUserId, fromUserId));

    // Transfer collaborator roles
    await db.update(treeCollaborators)
      .set({ userId: toUserId })
      .where(eq(treeCollaborators.userId, fromUserId));

    // Transfer user connections (userId1)
    await db.update(userConnections)
      .set({ userId1: toUserId })
      .where(eq(userConnections.userId1, fromUserId));

    // Transfer user connections (userId2)
    await db.update(userConnections)
      .set({ userId2: toUserId })
      .where(eq(userConnections.userId2, fromUserId));

    // Transfer connection requests (from)
    await db.update(userConnectionRequests)
      .set({ fromUserId: toUserId })
      .where(eq(userConnectionRequests.fromUserId, fromUserId));

    // Transfer connection requests (to)
    await db.update(userConnectionRequests)
      .set({ toUserId: toUserId })
      .where(eq(userConnectionRequests.toUserId, fromUserId));

    // Transfer gift registries
    await db.update(giftRegistries)
      .set({ createdByUserId: toUserId })
      .where(eq(giftRegistries.createdByUserId, fromUserId));

    // Transfer merchandise orders
    await db.update(merchandiseOrders)
      .set({ userId: toUserId })
      .where(eq(merchandiseOrders.userId, fromUserId));

    // Transfer account heirs
    await db.update(accountHeirs)
      .set({ userId: toUserId })
      .where(eq(accountHeirs.userId, fromUserId));

    // Transfer profile claim requests
    await db.update(profileClaimRequests)
      .set({ requesterId: toUserId })
      .where(eq(profileClaimRequests.requesterId, fromUserId));

    // Transfer custodianship requests
    await db.update(custodianshipRequests)
      .set({ requesterId: toUserId })
      .where(eq(custodianshipRequests.requesterId, fromUserId));
  }

  async getAllUserConnections(search?: string): Promise<UserConnection[]> {
    if (search) {
      // Get all users matching search
      const matchingUsers = await this.getAllUsers(search);
      const userIds = matchingUsers.map(u => u.id);
      
      if (userIds.length === 0) {
        return [];
      }
      
      // Get connections where either user matches
      const conditions = userIds.flatMap(id => [
        eq(userConnections.userId1, id),
        eq(userConnections.userId2, id)
      ]);
      
      return db.select().from(userConnections)
        .where(or(...conditions))
        .orderBy(desc(userConnections.connectedAt));
    }
    
    return db.select().from(userConnections)
      .orderBy(desc(userConnections.connectedAt));
  }

  async adminDeleteUserConnection(connectionId: string): Promise<void> {
    await db.delete(userConnections).where(eq(userConnections.id, connectionId));
  }

  async getAllTreeConnections(search?: string): Promise<any[]> {
    // Efficient query to get all tree connections with tree and owner info
    const allConnections = await db.select().from(treeConnections)
      .orderBy(desc(treeConnections.createdAt));
    
    // Fetch all related data in batches
    const treeIds = new Set<string>();
    allConnections.forEach(conn => {
      treeIds.add(conn.tree1Id);
      treeIds.add(conn.tree2Id);
    });
    
    // Get all trees in one query
    const trees = await db.select().from(familyTrees)
      .where(inArray(familyTrees.id, Array.from(treeIds)));
    const treeMap = new Map(trees.map(t => [t.id, t]));
    
    // Get all tree owners in one query
    const ownerIds = new Set(trees.map(t => t.ownerId));
    const owners = await db.select().from(users)
      .where(inArray(users.id, Array.from(ownerIds)));
    const ownerMap = new Map(owners.map(u => [u.id, u]));
    
    // Enrich connections
    const enriched = allConnections.map(conn => {
      const tree1 = treeMap.get(conn.tree1Id);
      const tree2 = treeMap.get(conn.tree2Id);
      const tree1Owner = tree1 ? ownerMap.get(tree1.ownerId) : null;
      const tree2Owner = tree2 ? ownerMap.get(tree2.ownerId) : null;
      
      return {
        ...conn,
        tree1: tree1 ? {
          id: tree1.id,
          name: tree1.name,
          ownerId: tree1.ownerId,
          ownerEmail: tree1Owner?.email || null,
          ownerName: tree1Owner ? `${tree1Owner.firstName || ''} ${tree1Owner.lastName || ''}`.trim() : null,
        } : null,
        tree2: tree2 ? {
          id: tree2.id,
          name: tree2.name,
          ownerId: tree2.ownerId,
          ownerEmail: tree2Owner?.email || null,
          ownerName: tree2Owner ? `${tree2Owner.firstName || ''} ${tree2Owner.lastName || ''}`.trim() : null,
        } : null,
      };
    });
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return enriched.filter(conn => 
        conn.tree1?.name?.toLowerCase().includes(searchLower) ||
        conn.tree2?.name?.toLowerCase().includes(searchLower) ||
        conn.tree1?.ownerEmail?.toLowerCase().includes(searchLower) ||
        conn.tree2?.ownerEmail?.toLowerCase().includes(searchLower) ||
        conn.tree1?.ownerName?.toLowerCase().includes(searchLower) ||
        conn.tree2?.ownerName?.toLowerCase().includes(searchLower)
      );
    }
    
    return enriched;
  }

  // Member Merge
  async getMergeHistory(treeId: string): Promise<MemberMergeHistory[]> {
    return db.select().from(memberMergeHistory)
      .where(eq(memberMergeHistory.treeId, treeId))
      .orderBy(desc(memberMergeHistory.createdAt));
  }

  async createMergeHistory(data: InsertMemberMergeHistory): Promise<MemberMergeHistory> {
    const [created] = await db.insert(memberMergeHistory).values(data).returning();
    return created;
  }

  async mergeMembers(survivorId: string, mergedId: string, userId: string, notes?: string): Promise<{ success: boolean; mergeHistoryId: string }> {
    // Get both members
    const [survivor] = await db.select().from(familyMembers).where(eq(familyMembers.id, survivorId));
    const [merged] = await db.select().from(familyMembers).where(eq(familyMembers.id, mergedId));
    
    if (!survivor || !merged) {
      throw new Error("One or both members not found");
    }
    
    if (survivor.treeId !== merged.treeId) {
      throw new Error("Members must be in the same tree");
    }
    
    const treeId = survivor.treeId;
    
    // Get all relationships involving the merged member
    const allRelationships = await db.select().from(relationships)
      .where(eq(relationships.treeId, treeId));
    
    const mergedRelationships = allRelationships.filter(r => 
      r.fromMemberId === mergedId || r.toMemberId === mergedId
    );
    
    // Remap relationships from merged member to survivor
    for (const rel of mergedRelationships) {
      const newFromId = rel.fromMemberId === mergedId ? survivorId : rel.fromMemberId;
      const newToId = rel.toMemberId === mergedId ? survivorId : rel.toMemberId;
      
      // Skip if this would create a self-reference
      if (newFromId === newToId) continue;
      
      // Check if relationship already exists
      const existingRel = allRelationships.find(r => 
        r.fromMemberId === newFromId && r.toMemberId === newToId && r.relationshipType === rel.relationshipType
      );
      
      if (!existingRel) {
        // Create new relationship pointing to survivor
        await db.insert(relationships).values({
          treeId: treeId,
          fromMemberId: newFromId,
          toMemberId: newToId,
          relationshipType: rel.relationshipType,
        });
      }
      
      // Delete the old relationship
      await db.delete(relationships).where(eq(relationships.id, rel.id));
    }
    
    // Update tree connections that reference the merged member
    await db.update(treeConnections)
      .set({ connector1MemberId: survivorId })
      .where(eq(treeConnections.connector1MemberId, mergedId));
    
    await db.update(treeConnections)
      .set({ connector2MemberId: survivorId })
      .where(eq(treeConnections.connector2MemberId, mergedId));
    
    // Transfer claimed profile if merged has one and survivor doesn't
    if (merged.claimedByUserId && !survivor.claimedByUserId) {
      await db.update(familyMembers)
        .set({ claimedByUserId: merged.claimedByUserId, claimedAt: merged.claimedAt })
        .where(eq(familyMembers.id, survivorId));
    }
    
    // Merge data - fill in any empty fields on survivor with merged member's data
    const updates: Partial<typeof survivor> = {};
    if (!survivor.nickname && merged.nickname) updates.nickname = merged.nickname;
    if (!survivor.birthDate && merged.birthDate) updates.birthDate = merged.birthDate;
    if (!survivor.birthPlace && merged.birthPlace) updates.birthPlace = merged.birthPlace;
    if (!survivor.deathDate && merged.deathDate) updates.deathDate = merged.deathDate;
    if (!survivor.photoUrl && merged.photoUrl) updates.photoUrl = merged.photoUrl;
    if (!survivor.notes && merged.notes) updates.notes = merged.notes;
    if (!survivor.gender && merged.gender) updates.gender = merged.gender;
    if (!survivor.currentCity && merged.currentCity) updates.currentCity = merged.currentCity;
    if (!survivor.currentRegion && merged.currentRegion) updates.currentRegion = merged.currentRegion;
    if (!survivor.currentCountry && merged.currentCountry) updates.currentCountry = merged.currentCountry;
    
    if (Object.keys(updates).length > 0) {
      await db.update(familyMembers).set(updates).where(eq(familyMembers.id, survivorId));
    }
    
    // Create merge history record
    const [historyRecord] = await db.insert(memberMergeHistory).values({
      treeId,
      survivorMemberId: survivorId,
      mergedMemberId: mergedId,
      mergedByUserId: userId,
      mergedMemberData: merged as any,
      remappedRelationships: mergedRelationships as any,
      notes: notes || null,
    }).returning();
    
    // Delete the merged member
    await db.delete(familyMembers).where(eq(familyMembers.id, mergedId));
    
    return { success: true, mergeHistoryId: historyRecord.id };
  }

  // External Person Identifiers (FamilySearch, Ancestry, etc.)
  async getExternalIdentifiersForMember(memberId: string): Promise<ExternalPersonIdentifier[]> {
    return db.select().from(externalPersonIdentifiers)
      .where(eq(externalPersonIdentifiers.memberId, memberId))
      .orderBy(desc(externalPersonIdentifiers.createdAt));
  }

  async getExternalIdentifiersByExternalId(source: string, externalId: string): Promise<ExternalPersonIdentifier[]> {
    return db.select().from(externalPersonIdentifiers)
      .where(and(
        eq(externalPersonIdentifiers.source, source),
        eq(externalPersonIdentifiers.externalId, externalId)
      ));
  }

  async createExternalIdentifier(data: InsertExternalPersonIdentifier): Promise<ExternalPersonIdentifier> {
    const [identifier] = await db.insert(externalPersonIdentifiers).values(data).returning();
    return identifier;
  }

  async updateExternalIdentifier(id: string, data: Partial<InsertExternalPersonIdentifier>): Promise<ExternalPersonIdentifier | undefined> {
    const [updated] = await db.update(externalPersonIdentifiers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(externalPersonIdentifiers.id, id))
      .returning();
    return updated;
  }

  async deleteExternalIdentifier(id: string): Promise<boolean> {
    await db.delete(externalPersonIdentifiers).where(eq(externalPersonIdentifiers.id, id));
    return true;
  }

  async findMembersByExternalId(source: string, externalId: string): Promise<FamilyMember[]> {
    const identifiers = await this.getExternalIdentifiersByExternalId(source, externalId);
    if (identifiers.length === 0) return [];
    
    const memberIds = identifiers.map(i => i.memberId);
    return db.select().from(familyMembers)
      .where(inArray(familyMembers.id, memberIds));
  }

  // Pending Member Suggestions
  async getPendingMemberSuggestions(treeId: string): Promise<PendingMemberSuggestion[]> {
    return db.select().from(pendingMemberSuggestions)
      .where(and(
        eq(pendingMemberSuggestions.treeId, treeId),
        eq(pendingMemberSuggestions.status, "pending")
      ))
      .orderBy(desc(pendingMemberSuggestions.createdAt));
  }

  async getPendingMemberSuggestionById(id: string): Promise<PendingMemberSuggestion | undefined> {
    const [suggestion] = await db.select().from(pendingMemberSuggestions)
      .where(eq(pendingMemberSuggestions.id, id));
    return suggestion;
  }

  async createPendingMemberSuggestion(data: InsertPendingMemberSuggestion): Promise<PendingMemberSuggestion> {
    const [suggestion] = await db.insert(pendingMemberSuggestions).values(data).returning();
    return suggestion;
  }

  async updatePendingMemberSuggestion(id: string, data: Partial<InsertPendingMemberSuggestion>): Promise<PendingMemberSuggestion | undefined> {
    const [updated] = await db.update(pendingMemberSuggestions)
      .set(data)
      .where(eq(pendingMemberSuggestions.id, id))
      .returning();
    return updated;
  }

  async approvePendingMemberSuggestion(id: string, reviewerId: string, createdMemberId?: string, mergedWithMemberId?: string): Promise<PendingMemberSuggestion | undefined> {
    const status = mergedWithMemberId ? "merged" : "approved";
    const [updated] = await db.update(pendingMemberSuggestions)
      .set({
        status,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        createdMemberId: createdMemberId || null,
        mergedWithMemberId: mergedWithMemberId || null,
      })
      .where(eq(pendingMemberSuggestions.id, id))
      .returning();
    return updated;
  }

  async rejectPendingMemberSuggestion(id: string, reviewerId: string): Promise<PendingMemberSuggestion | undefined> {
    const [updated] = await db.update(pendingMemberSuggestions)
      .set({
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      })
      .where(eq(pendingMemberSuggestions.id, id))
      .returning();
    return updated;
  }

  // Cross-Tree Matches
  async getCrossTreeMatchesForTree(treeId: string): Promise<CrossTreeMatch[]> {
    return db.select().from(crossTreeMatches)
      .where(or(
        eq(crossTreeMatches.tree1Id, treeId),
        eq(crossTreeMatches.tree2Id, treeId)
      ))
      .orderBy(desc(crossTreeMatches.createdAt));
  }

  async getCrossTreeMatchById(id: string): Promise<CrossTreeMatch | undefined> {
    const [match] = await db.select().from(crossTreeMatches)
      .where(eq(crossTreeMatches.id, id));
    return match;
  }

  async getCrossTreeMatchByMembers(member1Id: string, member2Id: string): Promise<CrossTreeMatch | undefined> {
    const [match] = await db.select().from(crossTreeMatches)
      .where(or(
        and(eq(crossTreeMatches.member1Id, member1Id), eq(crossTreeMatches.member2Id, member2Id)),
        and(eq(crossTreeMatches.member1Id, member2Id), eq(crossTreeMatches.member2Id, member1Id))
      ));
    return match;
  }

  async createCrossTreeMatch(data: InsertCrossTreeMatch): Promise<CrossTreeMatch> {
    // Ensure canonical ordering of member IDs for bidirectional uniqueness
    // Always store smaller ID first to prevent (A,B) and (B,A) duplicates
    let orderedData = { ...data };
    if (data.member1Id > data.member2Id) {
      orderedData = {
        ...data,
        member1Id: data.member2Id,
        member2Id: data.member1Id,
        tree1Id: data.tree2Id,
        tree2Id: data.tree1Id,
      };
    }
    const [match] = await db.insert(crossTreeMatches).values(orderedData).returning();
    return match;
  }

  async updateCrossTreeMatch(id: string, data: Partial<InsertCrossTreeMatch>): Promise<CrossTreeMatch | undefined> {
    const [updated] = await db.update(crossTreeMatches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crossTreeMatches.id, id))
      .returning();
    return updated;
  }

  async confirmCrossTreeMatch(id: string, userId: string, treeId: string): Promise<CrossTreeMatch | undefined> {
    const match = await this.getCrossTreeMatchById(id);
    if (!match) return undefined;

    const updateData: Partial<InsertCrossTreeMatch> = {};
    
    if (match.tree1Id === treeId) {
      updateData.confirmedByUser1 = true;
    } else if (match.tree2Id === treeId) {
      updateData.confirmedByUser2 = true;
    }

    // Check if both users confirmed
    const willBeFullyConfirmed = 
      (match.tree1Id === treeId && match.confirmedByUser2) ||
      (match.tree2Id === treeId && match.confirmedByUser1);
    
    if (willBeFullyConfirmed) {
      updateData.status = "confirmed";
    }

    return this.updateCrossTreeMatch(id, updateData);
  }

  // Referral methods
  async createReferral(referrerUserId: string, referralCode: string): Promise<Referral> {
    const [created] = await db.insert(referrals).values({
      referrerUserId,
      referralCode,
      status: "pending",
      clickCount: 0,
    }).returning();
    return created;
  }

  async getReferralByCode(code: string): Promise<Referral | undefined> {
    const [referral] = await db.select().from(referrals)
      .where(eq(referrals.referralCode, code));
    return referral;
  }

  async getReferralsByUser(userId: string): Promise<Referral[]> {
    return db.select().from(referrals)
      .where(eq(referrals.referrerUserId, userId))
      .orderBy(desc(referrals.createdAt));
  }

  async incrementReferralClick(code: string): Promise<void> {
    const referral = await this.getReferralByCode(code);
    if (referral) {
      await db.update(referrals)
        .set({ clickCount: referral.clickCount + 1 })
        .where(eq(referrals.referralCode, code));
    }
  }

  async completeReferral(code: string, referredUserId: string): Promise<Referral | undefined> {
    const [updated] = await db.update(referrals)
      .set({
        referredUserId,
        status: "completed",
        completedAt: new Date(),
      })
      .where(and(
        eq(referrals.referralCode, code),
        eq(referrals.status, "pending")
      ))
      .returning();
    return updated;
  }

  async getUserReferralStats(userId: string): Promise<{ totalReferrals: number; completedReferrals: number; pendingReferrals: number }> {
    const userReferrals = await this.getReferralsByUser(userId);
    const total = userReferrals.length;
    const completed = userReferrals.filter(r => r.status === "completed").length;
    const pending = userReferrals.filter(r => r.status === "pending").length;
    return { totalReferrals: total, completedReferrals: completed, pendingReferrals: pending };
  }

  async hasUserCompletedAnyReferral(userId: string): Promise<boolean> {
    const [existing] = await db.select().from(referrals)
      .where(eq(referrals.referredUserId, userId));
    return !!existing;
  }
}

export const storage = new DatabaseStorage();
