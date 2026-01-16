import { 
  familyTrees, familyMembers, relationships, treeCollaborators, familyEvents,
  type FamilyTree, type InsertFamilyTree, 
  type FamilyMember, type InsertFamilyMember,
  type Relationship, type InsertRelationship,
  type TreeCollaborator, type InsertTreeCollaborator,
  type FamilyEvent, type InsertFamilyEvent
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, desc } from "drizzle-orm";

export interface IStorage {
  // Family Trees
  getTrees(userId: string): Promise<FamilyTree[]>;
  getTree(id: string): Promise<FamilyTree | undefined>;
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
  addCollaborator(collaborator: InsertTreeCollaborator): Promise<TreeCollaborator>;
  removeCollaborator(id: string): Promise<boolean>;

  // Events
  getEvents(treeId: string): Promise<FamilyEvent[]>;
  createEvent(event: InsertFamilyEvent): Promise<FamilyEvent>;
  deleteEvent(id: string): Promise<boolean>;
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

  async addCollaborator(collaborator: InsertTreeCollaborator): Promise<TreeCollaborator> {
    const [created] = await db.insert(treeCollaborators).values(collaborator).returning();
    return created;
  }

  async removeCollaborator(id: string): Promise<boolean> {
    await db.delete(treeCollaborators).where(eq(treeCollaborators.id, id));
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
}

export const storage = new DatabaseStorage();
