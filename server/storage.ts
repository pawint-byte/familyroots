import { 
  familyTrees, familyMembers, relationships, treeCollaborators, familyEvents, users,
  treeInvitations, nameHistory, treeConnections, accountHeirs, educationHistory, careerHistory,
  discoverableMembers, matchRequests, memberInvitations, merchandiseOrders,
  type FamilyTree, type InsertFamilyTree, 
  type FamilyMember, type InsertFamilyMember,
  type Relationship, type InsertRelationship,
  type TreeCollaborator, type InsertTreeCollaborator,
  type FamilyEvent, type InsertFamilyEvent,
  type TreeInvitation, type InsertTreeInvitation,
  type NameHistory, type InsertNameHistory,
  type TreeConnection, type InsertTreeConnection,
  type AccountHeir, type InsertAccountHeir,
  type EducationHistory, type InsertEducationHistory,
  type CareerHistory, type InsertCareerHistory,
  type DiscoverableMember, type InsertDiscoverableMember,
  type MatchRequest, type InsertMatchRequest,
  type MemberInvitation, type InsertMemberInvitation,
  type MerchandiseOrder, type InsertMerchandiseOrder,
  type User
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, desc } from "drizzle-orm";

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
  createMember(member: InsertFamilyMember): Promise<FamilyMember>;
  updateMember(id: string, member: Partial<InsertFamilyMember>): Promise<FamilyMember | undefined>;
  deleteMember(id: string): Promise<boolean>;
  searchMembers(treeId: string, query: string): Promise<FamilyMember[]>;

  // Relationships
  getRelationships(treeId: string): Promise<Relationship[]>;
  createRelationship(rel: InsertRelationship): Promise<Relationship>;
  deleteRelationship(id: string): Promise<boolean>;

  // Collaborators
  getCollaborators(treeId: string): Promise<TreeCollaborator[]>;
  getCollaboratorByUserAndTree(userId: string, treeId: string): Promise<TreeCollaborator | undefined>;
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
  createTreeConnection(connection: InsertTreeConnection): Promise<TreeConnection>;
  deleteTreeConnection(id: string): Promise<boolean>;

  // Events
  getEvents(treeId: string): Promise<FamilyEvent[]>;
  createEvent(event: InsertFamilyEvent): Promise<FamilyEvent>;
  deleteEvent(id: string): Promise<boolean>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserStripeInfo(userId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string }): Promise<User | undefined>;
  updateUserActivity(userId: string): Promise<void>;
  getInactiveUsers(inactivityMonths: number): Promise<User[]>;
  updateUserInactivityReminder(userId: string): Promise<void>;
  
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

  // Merchandise Orders
  getMerchandiseOrders(userId: string): Promise<MerchandiseOrder[]>;
  getMerchandiseOrder(id: string): Promise<MerchandiseOrder | undefined>;
  createMerchandiseOrder(order: InsertMerchandiseOrder): Promise<MerchandiseOrder>;
  updateMerchandiseOrder(id: string, data: Partial<InsertMerchandiseOrder>): Promise<MerchandiseOrder | undefined>;
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
}

export const storage = new DatabaseStorage();
