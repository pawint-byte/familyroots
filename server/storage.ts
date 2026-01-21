import { 
  familyTrees, familyMembers, relationships, treeCollaborators, familyEvents, users,
  treeInvitations, nameHistory, treeConnections,
  type FamilyTree, type InsertFamilyTree, 
  type FamilyMember, type InsertFamilyMember,
  type Relationship, type InsertRelationship,
  type TreeCollaborator, type InsertTreeCollaborator,
  type FamilyEvent, type InsertFamilyEvent,
  type TreeInvitation, type InsertTreeInvitation,
  type NameHistory, type InsertNameHistory,
  type TreeConnection, type InsertTreeConnection,
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
  updateUserStripeInfo(userId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string }): Promise<User | undefined>;
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
}

export const storage = new DatabaseStorage();
