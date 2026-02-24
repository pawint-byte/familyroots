import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, or, inArray } from "drizzle-orm";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { 
  familyTrees, familyMembers, relationships as relationshipsTable,
  insertFamilyTreeSchema, insertFamilyMemberSchema, 
  insertRelationshipSchema, insertFamilyEventSchema,
  insertNameHistorySchema, insertTreeConnectionSchema,
  insertCustodianshipRequestSchema,
  familyEvents, nameHistory, educationHistory, careerHistory,
  memberTags, familySearchSources, externalPersonIdentifiers,
  specialConnections, giftRegistries, giftRegistryItems
} from "@shared/schema";
import { mergeMemberWithUserProfile } from "@shared/utils/profile-merge";
import { getValidRelationshipValues, getDefaultPeerRelationship, getDefaultLeaderRelationship, getRelationshipTypesForTree, getReverseRelationshipType } from "@shared/treeTypes";
import type { TreeType } from "@shared/treeTypes";
import { z } from "zod";
import crypto from "crypto";
import { calculateRelationship, getSubtreeBetweenMembers } from "./lib/relationship-calculator";

// Validation schemas for API requests
const createInvitationSchema = z.object({
  role: z.enum(["viewer", "editor", "co_owner"]),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  maxUses: z.number().int().min(1).max(1000).optional(),
});

const updateUserProfileSchema = z.object({
  nickname: z.string().max(100).optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional().nullable(),
  birthPlace: z.string().max(200).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  currentCity: z.string().max(100).optional().nullable(),
  currentRegion: z.string().max(100).optional().nullable(),
  currentCountry: z.string().max(100).optional().nullable(),
  locationVisible: z.boolean().optional(),
});

const updateCollaboratorRoleSchema = z.object({
  role: z.enum(["viewer", "editor", "co_owner"]),
});

const createTreeConnectionSchema = z.object({
  targetTreeId: z.string().min(1),
  connector1MemberId: z.string().optional(),
  connector2MemberId: z.string().optional(),
  connectionType: z.enum(["marriage", "adoption", "other"]).optional(),
});

// Special connection validation schemas
const specialConnectionTypeValues = [
  "godparent", "godchild", "boyfriend", "girlfriend", "fiance", "fiancee",
  "best_friend", "family_friend", "mentor", "mentee", "guardian", "ward", "other"
] as const;

const createSpecialConnectionSchema = z.object({
  fromMemberId: z.string().min(1),
  fromTreeId: z.string().min(1),
  toMemberId: z.string().min(1),
  toTreeId: z.string().min(1),
  connectionType: z.enum(specialConnectionTypeValues),
  customLabel: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

const createConnectionRequestSchema = z.object({
  fromMemberId: z.string().min(1),
  fromTreeId: z.string().min(1),
  toMemberId: z.string().min(1),
  toTreeId: z.string().min(1),
  connectionType: z.enum(specialConnectionTypeValues),
  customLabel: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
});

import { stripeService } from "./stripeService";
import { getStripePublishableKey, isStripeConfigured } from "./stripeClient";
import { streamChatResponse } from "./chatbot";
import { 
  getAvatars, getVoices, generateVideo, syncVideoStatus, 
  getAllVideos, getVideoById, deleteVideo 
} from "./heygen";
import { postToBluesky, testBlueskyConnection } from "./bluesky";
import { testDiscordConnection, sendDiscordNotification, notifyNewSignup, notifyNewTree, notifyMilestone } from "./discord";
import { sendInactivityReminder, sendAccountTransferNotification, sendFamilyMemberInvitation, sendLifeEventNotification, sendRegistryAnnouncementEmail, sendRegistryItemPurchasedEmail, sendTreeUpdateNotification } from "./lib/email";
import { insertAccountHeirSchema, insertAnnouncementSchema } from "@shared/schema";
import { printfulService } from "./printful";
import { subscriptionService, SUBSCRIPTION_CONFIG, PRICING_CONFIG } from "./subscriptionService";
import * as familySearchService from "./familySearch";

// Admin users who bypass all limits and costs
const ADMIN_EMAILS_LIST = [
  "pawint@me.com",
];
const ADMIN_USER_IDS_LIST = ["52852375"];

function isAdminAccount(userId: string, email?: string | null): boolean {
  if (ADMIN_USER_IDS_LIST.includes(userId)) return true;
  if (email && ADMIN_EMAILS_LIST.some(e => e === email.toLowerCase())) return true;
  return false;
}

// Privacy visibility filtering for family members
type VisibilityTier = "full" | "extended" | "limited";

// Fields visible at each tier
const VISIBILITY_FIELDS: Record<VisibilityTier, string[]> = {
  full: ["id", "treeId", "firstName", "lastName", "nickname", "email", "gender", "birthDate", "birthPlace", "deathDate", "isLiving", "photoUrl", "notes", "isUnknown", "unknownLabel", "claimedByUserId", "claimedAt", "custodianUserId", "custodianAssignedAt", "visibilityOverride", "createdAt", "updatedAt"],
  extended: ["id", "treeId", "firstName", "lastName", "gender", "birthDate", "photoUrl", "isLiving", "isUnknown", "unknownLabel", "visibilityOverride"],
  limited: ["id", "treeId", "firstName", "lastName", "photoUrl", "isLiving", "isUnknown", "unknownLabel", "visibilityOverride"],
};

// Filter member data based on visibility tier
function filterMemberByVisibility(member: any, tier: VisibilityTier): any {
  const allowedFields = VISIBILITY_FIELDS[tier];
  const filtered: any = {};
  
  for (const field of allowedFields) {
    if (member[field] !== undefined) {
      // For extended tier, only show birth year not full date
      if (tier === "extended" && field === "birthDate" && member.birthDate) {
        const date = new Date(member.birthDate);
        filtered.birthYear = date.getFullYear();
        filtered.birthDate = null;
      } else {
        filtered[field] = member[field];
      }
    }
  }
  
  return filtered;
}

// Determine visibility tier for a viewer relative to a member
async function getVisibilityTierForViewer(
  viewerUserId: string,
  memberId: string,
  treeId: string,
  treeVisibilityDefault: VisibilityTier,
  memberVisibilityOverride: VisibilityTier | null
): Promise<VisibilityTier> {
  // Get the tree and check if viewer is owner
  const tree = await storage.getTree(treeId);
  if (tree?.ownerId === viewerUserId) {
    return "full"; // Tree owners always have full access
  }
  
  // Check if viewer is a co-owner
  const collab = await storage.getCollaboratorByUserAndTree(viewerUserId, treeId);
  if (collab?.role === "co_owner") {
    return "full"; // Co-owners have full access
  }
  
  // Check if member claimed this profile (they can see their own info)
  const member = await storage.getMember(memberId);
  if (member?.claimedByUserId === viewerUserId) {
    return "full"; // Users can always see their own claimed profile
  }
  
  // Check if viewer is immediate family of this member
  const relationships = await storage.getRelationships(treeId);
  const viewerMember = await storage.getMemberByClaimedUserId(viewerUserId, treeId);
  
  if (viewerMember) {
    // Check for direct relationships (parent, child, spouse, sibling)
    const isImmediate = relationships.some(rel => 
      (rel.fromMemberId === viewerMember.id && rel.toMemberId === memberId) ||
      (rel.toMemberId === viewerMember.id && rel.fromMemberId === memberId)
    );
    
    if (isImmediate) {
      return "full"; // Immediate family always has full access
    }
  }
  
  // Use member's visibility override or tree default
  return memberVisibilityOverride || treeVisibilityDefault || "extended";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Setup object storage for photo uploads
  registerObjectStorageRoutes(app);

  // Health check endpoint (no auth required)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Get all trees for the current user (owned and collaborated)
  app.get("/api/trees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ownedTrees = await storage.getTrees(userId);
      
      // Get collaborated trees
      const { collaboratedTrees } = await storage.getCollaboratedTrees(userId);
      
      // Combine and deduplicate
      const allTrees = [...ownedTrees, ...collaboratedTrees];
      
      // Add member counts to each tree
      const treesWithCounts = await Promise.all(
        allTrees.map(async (tree) => {
          const members = await storage.getMembers(tree.id);
          const tags = await storage.getTreeTags(tree.id);
          return {
            ...tree,
            memberCount: members.length,
            tags,
          };
        })
      );
      
      const includeImportTrees = req.query.includeImportTrees === "true";
      const filteredTrees = includeImportTrees ? treesWithCounts : treesWithCounts.filter(tree => {
        const isEmptyImportSubTree = tree.parentTreeId && 
          tree.name?.startsWith("FamilySearch Import") && 
          tree.memberCount === 0;
        return !isEmptyImportSubTree;
      });
      
      res.json(filteredTrees);
    } catch (error) {
      console.error("Error fetching trees:", error);
      res.status(500).json({ message: "Failed to fetch trees" });
    }
  });

  // Get a single tree with members and relationships
  app.get("/api/trees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(id);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      // Check access
      if (tree.ownerId !== userId && tree.privacy !== "public") {
        const collaborators = await storage.getCollaborators(id);
        const hasAccess = collaborators.some(c => c.userId === userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const members = await storage.getMembers(id);
      const relationships = await storage.getRelationships(id);

      let viewerRole: "owner" | "co_owner" | "collaborator" | "public" = "public";
      if (tree.ownerId === userId) {
        viewerRole = "owner";
      } else {
        const collab = await storage.getCollaboratorByUserAndTree(userId, id);
        if (collab?.role === "co_owner") viewerRole = "co_owner";
        else if (collab) viewerRole = "collaborator";
      }

      const isPublicViewer = tree.isDiscoverable && viewerRole === "public";

      // Merge claimed member data with user profiles (single source of truth)
      const mergedMembers = await Promise.all(
        members.map(async (member) => {
          let merged = member;
          if (member.claimedByUserId) {
            const claimedUser = await storage.getUser(member.claimedByUserId);
            const mergedProfile = mergeMemberWithUserProfile(member, claimedUser);
            merged = {
              ...member,
              firstName: mergedProfile.firstName ?? member.firstName,
              lastName: mergedProfile.lastName ?? member.lastName,
              nickname: mergedProfile.nickname ?? member.nickname,
              email: mergedProfile.email ?? member.email,
              gender: mergedProfile.gender ?? member.gender,
              birthDate: mergedProfile.birthDate ?? member.birthDate,
              birthPlace: mergedProfile.birthPlace ?? member.birthPlace,
              photoUrl: mergedProfile.photoUrl ?? member.photoUrl,
              notes: mergedProfile.notes ?? member.notes,
              currentCity: mergedProfile.currentCity ?? member.currentCity,
              currentRegion: mergedProfile.currentRegion ?? member.currentRegion,
              currentCountry: mergedProfile.currentCountry ?? member.currentCountry,
              locationVisible: mergedProfile.locationVisible,
              _profileSourceInfo: mergedProfile._sourceInfo,
            };
          }

          if (isPublicViewer && member.claimedByUserId !== userId) {
            return filterMemberByVisibility(merged, "limited");
          }
          return merged;
        })
      );

      let parentTree: any = null;
      if (tree.parentTreeId) {
        const parent = await storage.getTree(tree.parentTreeId);
        if (parent) {
          parentTree = { id: parent.id, name: parent.name };
        }
      }

      const childTrees = await storage.getChildTrees(id);
      const childTreesSummary = childTrees.map(c => ({ id: c.id, name: c.name }));

      const tags = await storage.getTreeTags(id);
      const memberTagAssignments = await storage.getMemberTagsByTree(id);

      res.json({ tree, members: mergedMembers, relationships, parentTree, childTrees: childTreesSummary, tags, memberTags: memberTagAssignments });
    } catch (error) {
      console.error("Error fetching tree:", error);
      res.status(500).json({ message: "Failed to fetch tree" });
    }
  });

  // Create a new tree
  app.post("/api/trees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Trees are now free and unlimited for all users
      const user = await storage.getUser(userId);
      
      const data = insertFamilyTreeSchema.parse({ ...req.body, ownerId: userId });
      const tree = await storage.createTree(data);

      // Auto-add the creator as the first member (root) of the tree
      const profileMode = req.body.creatorProfileMode || 'full';
      if (user) {
        try {
          const memberData: any = {
            treeId: tree.id,
            firstName: user.firstName || 'Me',
            lastName: user.lastName || null,
            email: user.email || null,
            claimedByUserId: userId,
            claimedAt: new Date(),
            isLiving: true,
          };
          if (profileMode === 'full') {
            memberData.photoUrl = user.photoUrl || null;
            memberData.bio = user.bio || null;
          }
          const creatorMember = await storage.createMember(memberData);
          await storage.updateTree(tree.id, { rootMemberId: creatorMember.id });
          console.log(`Auto-added creator ${user.firstName || userId} as root member of tree "${tree.name}" (profile: ${profileMode})`);
        } catch (memberError) {
          console.error("Failed to auto-add creator as member (non-fatal):", memberError);
        }
      }
      
      // Send Discord notification for new tree (fire and forget)
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'familyroots.replit.app'}`;
      notifyNewTree(tree.name, user?.firstName || 'A user', baseUrl).catch(() => {});
      
      res.status(201).json(tree);
    } catch (error) {
      console.error("Error creating tree:", error);
      res.status(400).json({ message: "Failed to create tree" });
    }
  });

  // Get child/sub-group trees for a parent tree
  app.get("/api/trees/:id/children", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(id);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId && tree.privacy !== "public") {
        const collaborators = await storage.getCollaborators(id);
        const hasAccess = collaborators.some(c => c.userId === userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const children = await storage.getChildTrees(id);

      const childrenWithCounts = await Promise.all(
        children.map(async (child) => {
          const members = await storage.getMembers(child.id);
          return { ...child, memberCount: members.length };
        })
      );

      res.json(childrenWithCounts);
    } catch (error) {
      console.error("Error fetching child trees:", error);
      res.status(500).json({ message: "Failed to fetch child trees" });
    }
  });

  // Create a sub-group under a parent tree
  app.post("/api/trees/:id/children", isAuthenticated, async (req: any, res) => {
    try {
      const { id: parentId } = req.params;
      const userId = req.user.claims.sub;

      const parentTree = await storage.getTree(parentId);
      if (!parentTree) {
        return res.status(404).json({ message: "Parent tree not found" });
      }

      if (parentTree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, parentId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Only the owner or co-owners can create sub-groups" });
        }
      }

      const data = insertFamilyTreeSchema.parse({
        ...req.body,
        ownerId: userId,
        parentTreeId: parentId,
        treeType: req.body.treeType || parentTree.treeType,
        privacy: req.body.privacy || parentTree.privacy,
      });

      const child = await storage.createTree(data);

      const user = await storage.getUser(userId);
      if (user) {
        try {
          const creatorMember = await storage.createMember({
            treeId: child.id,
            firstName: user.firstName || 'Me',
            lastName: user.lastName || null,
            email: user.email || null,
            claimedByUserId: userId,
            claimedAt: new Date(),
            isLiving: true,
          } as any);
          await storage.updateTree(child.id, { rootMemberId: creatorMember.id });
        } catch (memberError) {
          console.error("Failed to auto-add creator to sub-group (non-fatal):", memberError);
        }
      }

      res.status(201).json(child);
    } catch (error) {
      console.error("Error creating sub-group:", error);
      res.status(400).json({ message: "Failed to create sub-group" });
    }
  });

  app.patch("/api/trees/:id/parent", isAuthenticated, async (req: any, res) => {
    try {
      const { id: treeId } = req.params;
      const userId = req.user.claims.sub;
      const { parentTreeId } = req.body;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Only the owner or co-owners can move this tree" });
        }
      }

      if (parentTreeId === null || parentTreeId === undefined) {
        const updated = await storage.updateTree(treeId, { parentTreeId: null } as any);
        return res.json(updated);
      }

      if (parentTreeId === treeId) {
        return res.status(400).json({ message: "A tree cannot be its own parent" });
      }

      const parentTree = await storage.getTree(parentTreeId);
      if (!parentTree) {
        return res.status(404).json({ message: "Parent tree not found" });
      }

      if (parentTree.ownerId !== userId) {
        const parentCollab = await storage.getCollaboratorByUserAndTree(userId, parentTreeId);
        if (!parentCollab || parentCollab.role !== "co_owner") {
          return res.status(403).json({ message: "You must be the owner or co-owner of both trees to move one under the other" });
        }
      }

      let current = parentTree;
      while (current.parentTreeId) {
        if (current.parentTreeId === treeId) {
          return res.status(400).json({ message: "Cannot move a tree under one of its own sub-groups (circular reference)" });
        }
        const next = await storage.getTree(current.parentTreeId);
        if (!next) break;
        current = next;
      }

      const updated = await storage.updateTree(treeId, { parentTreeId } as any);
      res.json(updated);
    } catch (error) {
      console.error("Error updating tree parent:", error);
      res.status(400).json({ message: "Failed to update tree parent" });
    }
  });

  // Split a tree into two - move selected members to a new tree
  app.post("/api/trees/:id/split", isAuthenticated, async (req: any, res) => {
    try {
      const { id: sourceTreeId } = req.params;
      const userId = req.user.claims.sub;

      const splitSchema = z.object({
        name: z.string().min(1).max(200),
        treeType: z.string().optional(),
        treeTypeLabel: z.string().optional(),
        privacy: z.enum(["private", "public"]).optional(),
        parentTreeId: z.string().nullable().optional(),
        newOwnerId: z.string().optional(),
        memberIds: z.array(z.string()).min(1, "Select at least one member to split off"),
        rootMemberId: z.string().optional(),
        createConnection: z.boolean().optional(),
      });

      const parsed = splitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const data = parsed.data;

      const sourceTree = await storage.getTree(sourceTreeId);
      if (!sourceTree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (sourceTree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, sourceTreeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Only the owner or co-owners can split this tree" });
        }
      }

      const members = await storage.getMembers(sourceTreeId);
      const memberIdSet = new Set(members.map(m => m.id));
      const invalidIds = data.memberIds.filter(id => !memberIdSet.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ message: "Some selected members do not belong to this tree" });
      }

      if (data.memberIds.length >= members.length) {
        return res.status(400).json({ message: "You cannot move all members out of a tree. At least one member must remain." });
      }

      if (data.rootMemberId && !data.memberIds.includes(data.rootMemberId)) {
        return res.status(400).json({ message: "The root member must be among the selected members" });
      }

      const newOwnerId = data.newOwnerId || userId;
      if (newOwnerId !== userId) {
        const ownerCollab = await storage.getCollaboratorByUserAndTree(newOwnerId, sourceTreeId);
        if (!ownerCollab && sourceTree.ownerId !== newOwnerId) {
          return res.status(400).json({ message: "New owner must be an existing collaborator on this tree" });
        }
      }

      const newTree = await storage.splitTree(sourceTreeId, {
        ...data,
        newOwnerId,
      });

      res.json(newTree);
    } catch (error) {
      console.error("Error splitting tree:", error);
      res.status(500).json({ message: "Failed to split tree" });
    }
  });

  // Update a tree
  app.patch("/api/trees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(id);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check if owner or co-owner
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, id);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Validate update data - only allow specific fields
      const allowedFields = ["name", "description", "privacy", "visibilityDefault", "treeType", "treeTypeLabel", "customRelationshipTypes", "preferredLayout"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (updateData.treeType) {
        const validTreeTypes = ["family", "church", "sports", "fraternity", "friends", "professional", "custom"];
        if (!validTreeTypes.includes(updateData.treeType)) {
          return res.status(400).json({ message: "Invalid tree type" });
        }
      }

      const updated = await storage.updateTree(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating tree:", error);
      res.status(400).json({ message: "Failed to update tree" });
    }
  });

  // Delete a tree
  app.delete("/api/trees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(id);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check if owner or co-owner
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, id);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.softDeleteTree(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tree:", error);
      res.status(500).json({ message: "Failed to delete tree" });
    }
  });

  // Get deleted trees for current user
  app.get("/api/deleted/trees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deletedTrees = await storage.getDeletedTrees(userId);
      res.json(deletedTrees);
    } catch (error) {
      console.error("Error fetching deleted trees:", error);
      res.status(500).json({ message: "Failed to fetch deleted trees" });
    }
  });

  // Get deleted members for a tree (owner can see even if tree is soft-deleted)
  app.get("/api/deleted/trees/:treeId/members", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const [tree] = await db.select().from(familyTrees).where(eq(familyTrees.id, treeId));
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role === "viewer") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const deletedMembers = await storage.getDeletedMembers(treeId);
      res.json(deletedMembers);
    } catch (error) {
      console.error("Error fetching deleted members:", error);
      res.status(500).json({ message: "Failed to fetch deleted members" });
    }
  });

  // Restore a soft-deleted tree
  app.patch("/api/deleted/trees/:id/restore", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const [tree] = await db.select().from(familyTrees).where(eq(familyTrees.id, id));
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only the tree owner can restore a deleted tree" });
      }

      if (!tree.deletedAt) {
        return res.status(400).json({ message: "Tree is not deleted" });
      }

      await storage.restoreTree(id);
      res.json({ message: "Tree restored successfully" });
    } catch (error) {
      console.error("Error restoring tree:", error);
      res.status(500).json({ message: "Failed to restore tree" });
    }
  });

  // Restore a soft-deleted member
  app.patch("/api/deleted/trees/:treeId/members/:memberId/restore", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, memberId } = req.params;
      const userId = req.user.claims.sub;

      const [tree] = await db.select().from(familyTrees).where(eq(familyTrees.id, treeId));
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const member = await storage.getMemberIncludingDeleted(memberId);
      if (!member || member.treeId !== treeId) {
        return res.status(404).json({ message: "Member not found in this tree" });
      }

      if (!member.deletedAt) {
        return res.status(400).json({ message: "Member is not deleted" });
      }

      await storage.restoreMember(memberId);
      res.json({ message: "Member restored successfully" });
    } catch (error) {
      console.error("Error restoring member:", error);
      res.status(500).json({ message: "Failed to restore member" });
    }
  });

  // Permanently delete a tree
  app.delete("/api/deleted/trees/:id/permanent", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const [tree] = await db.select().from(familyTrees).where(eq(familyTrees.id, id));
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only the tree owner can permanently delete a tree" });
      }

      await storage.permanentlyDeleteTree(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error permanently deleting tree:", error);
      res.status(500).json({ message: "Failed to permanently delete tree" });
    }
  });

  // Permanently delete a member
  app.delete("/api/deleted/trees/:treeId/members/:memberId/permanent", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, memberId } = req.params;
      const userId = req.user.claims.sub;

      const [tree] = await db.select().from(familyTrees).where(eq(familyTrees.id, treeId));
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only the tree owner can permanently delete a member" });
      }

      const member = await storage.getMemberIncludingDeleted(memberId);
      if (!member || member.treeId !== treeId) {
        return res.status(404).json({ message: "Member not found in this tree" });
      }

      await storage.permanentlyDeleteMember(memberId);
      res.status(204).send();
    } catch (error) {
      console.error("Error permanently deleting member:", error);
      res.status(500).json({ message: "Failed to permanently delete member" });
    }
  });

  // Tree Tags
  app.get("/api/trees/:treeId/tags", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const tags = await storage.getTreeTags(treeId);
      res.json(tags);
    } catch (error) {
      console.error("Error getting tree tags:", error);
      res.status(500).json({ message: "Failed to get tags" });
    }
  });

  app.post("/api/trees/:treeId/tags", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role === "viewer") {
          return res.status(403).json({ message: "Only editors, co-owners, or the owner can manage tags" });
        }
      }

      const { label, color } = req.body;
      if (!label || typeof label !== "string" || label.trim().length === 0) {
        return res.status(400).json({ message: "Tag label is required" });
      }

      if (label.trim().length > 50) {
        return res.status(400).json({ message: "Tag label must be 50 characters or less" });
      }

      const existingTags = await storage.getTreeTags(treeId);
      if (existingTags.some(t => t.label.toLowerCase() === label.trim().toLowerCase())) {
        return res.status(400).json({ message: "This tag already exists on this tree" });
      }

      const tag = await storage.createTreeTag({
        treeId,
        label: label.trim(),
        color: color || "#6366f1",
      });
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating tree tag:", error);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.delete("/api/trees/:treeId/tags/:tagId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, tagId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role === "viewer") {
          return res.status(403).json({ message: "Only editors, co-owners, or the owner can manage tags" });
        }
      }

      const deleted = await storage.deleteTreeTag(tagId);
      if (!deleted) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tree tag:", error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  // Member Tags - get all member-tag assignments for a tree
  app.get("/api/trees/:treeId/member-tags", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) return res.status(403).json({ message: "Access denied" });
      }
      const memberTagAssignments = await storage.getMemberTagsByTree(treeId);
      res.json(memberTagAssignments);
    } catch (error) {
      console.error("Error getting member tags:", error);
      res.status(500).json({ message: "Failed to get member tags" });
    }
  });

  // Add tag to a member
  app.post("/api/trees/:treeId/members/:memberId/tags", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, memberId } = req.params;
      const userId = req.user.claims.sub;
      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role === "viewer") return res.status(403).json({ message: "Access denied" });
      }
      const { tagId } = req.body;
      if (!tagId) return res.status(400).json({ message: "tagId is required" });
      const memberTag = await storage.addMemberTag({ tagId, memberId, treeId });
      res.status(201).json(memberTag);
    } catch (error) {
      console.error("Error adding member tag:", error);
      res.status(500).json({ message: "Failed to add tag to member" });
    }
  });

  // Remove tag from a member
  app.delete("/api/trees/:treeId/members/:memberId/tags/:tagId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, memberId, tagId } = req.params;
      const userId = req.user.claims.sub;
      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role === "viewer") return res.status(403).json({ message: "Access denied" });
      }
      await storage.removeMemberTag(tagId, memberId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing member tag:", error);
      res.status(500).json({ message: "Failed to remove tag from member" });
    }
  });

  // Bulk assign tag to multiple members
  app.post("/api/trees/:treeId/tags/:tagId/members", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, tagId } = req.params;
      const userId = req.user.claims.sub;
      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role === "viewer") return res.status(403).json({ message: "Access denied" });
      }
      const { memberIds } = req.body;
      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ message: "memberIds array is required" });
      }
      const results = await storage.bulkAddMemberTags(tagId, memberIds, treeId);
      res.status(201).json(results);
    } catch (error) {
      console.error("Error bulk adding member tags:", error);
      res.status(500).json({ message: "Failed to bulk add tags" });
    }
  });

  // Create a new tree from tagged members
  app.post("/api/trees/:treeId/tags/:tagId/create-tree", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, tagId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || (collab.role !== "co_owner")) {
          return res.status(403).json({ message: "Only the owner or co-owners can create trees from tags" });
        }
      }

      const tag = (await storage.getTreeTags(treeId)).find(t => t.id === tagId);
      if (!tag) return res.status(404).json({ message: "Tag not found" });

      const memberTagAssignments = await storage.getMemberTagsByTree(treeId);
      const taggedMemberIds = memberTagAssignments.filter(mt => mt.tagId === tagId).map(mt => mt.memberId);
      if (taggedMemberIds.length === 0) {
        return res.status(400).json({ message: "No members have this tag assigned" });
      }

      const allMembers = await storage.getMembers(treeId);
      if (taggedMemberIds.length >= allMembers.length) {
        return res.status(400).json({ message: "Cannot move all members. At least one must remain in the original tree." });
      }

      const { name, createAsSubGroup } = req.body;
      const treeName = (name && typeof name === "string" && name.trim()) ? name.trim() : tag.label;

      const newTree = await storage.splitTree(treeId, {
        name: treeName,
        treeType: tree.treeType || "family",
        treeTypeLabel: tree.treeTypeLabel,
        privacy: tree.privacy || "private",
        parentTreeId: createAsSubGroup ? treeId : null,
        newOwnerId: userId,
        memberIds: taggedMemberIds,
        createConnection: true,
      });

      res.status(201).json(newTree);
    } catch (error) {
      console.error("Error creating tree from tag:", error);
      res.status(500).json({ message: "Failed to create tree from tag" });
    }
  });

  // Email all tagged members
  app.post("/api/trees/:treeId/tags/:tagId/email", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, tagId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role === "viewer") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const tag = (await storage.getTreeTags(treeId)).find(t => t.id === tagId);
      if (!tag) return res.status(404).json({ message: "Tag not found" });

      const { subject, message } = req.body;
      if (!subject || typeof subject !== "string" || !subject.trim()) {
        return res.status(400).json({ message: "Subject is required" });
      }
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const memberTagAssignments = await storage.getMemberTagsByTree(treeId);
      const taggedMemberIds = new Set(memberTagAssignments.filter(mt => mt.tagId === tagId).map(mt => mt.memberId));
      const allMembers = await storage.getMembers(treeId);
      const taggedMembers = allMembers.filter(m => taggedMemberIds.has(m.id) && m.email);

      if (taggedMembers.length === 0) {
        return res.status(400).json({ message: "No tagged members have email addresses on file" });
      }

      const sender = await storage.getUser(userId);
      const senderName = sender?.name || "A FamilyRoots member";
      const { sendEmail } = await import("./lib/email");

      let sent = 0;
      let failed = 0;
      for (const member of taggedMembers) {
        try {
          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, ${tag.color || '#6366f1'}, ${tag.color || '#6366f1'}dd); padding: 24px; border-radius: 12px 12px 0 0;">
                <h2 style="color: white; margin: 0; font-size: 20px;">Message from ${tree.name}</h2>
                <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">Tag: ${tag.label}</p>
              </div>
              <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #374151; font-size: 14px; margin: 0 0 4px;">From: <strong>${senderName}</strong></p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
                <div style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message.trim()}</div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0 12px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent via FamilyRoots</p>
              </div>
            </div>
          `;
          await sendEmail(member.email!, subject.trim(), html);
          sent++;
        } catch (e) {
          console.error(`Failed to email ${member.email}:`, e);
          failed++;
        }
      }

      res.json({ sent, failed, total: taggedMembers.length });
    } catch (error) {
      console.error("Error emailing tagged group:", error);
      res.status(500).json({ message: "Failed to send emails" });
    }
  });

  // Add a family member
  app.post("/api/trees/:treeId/members", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check if user can edit
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Credit-based member limits: first 20 members free, then requires credits
      // Admin users bypass all limits
      const treeOwner = await storage.getUser(tree.ownerId);
      const adminBypass = isAdminAccount(tree.ownerId, treeOwner?.email);
      const totalMemberCount = await subscriptionService.calculateTotalMemberCount(tree.ownerId);
      const freeLimit = PRICING_CONFIG.freeTierCredits;
      
      if (!adminBypass && totalMemberCount >= freeLimit) {
        const ownerCredits = treeOwner?.memberCredits || 0;
        if (ownerCredits <= 0) {
          return res.status(402).json({ 
            message: "You've used all your free member slots. Purchase a member pack to add more family members.",
            code: "NO_CREDITS",
            freeLimit,
            current: totalMemberCount,
            credits: 0
          });
        }
      }

      // Sanitize date fields - ensure they are in YYYY-MM-DD format or null
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.birthDate === '' || sanitizedBody.birthDate === undefined) {
        sanitizedBody.birthDate = null;
      }
      if (sanitizedBody.deathDate === '' || sanitizedBody.deathDate === undefined) {
        sanitizedBody.deathDate = null;
      }
      
      const data = insertFamilyMemberSchema.parse({ ...sanitizedBody, treeId });
      
      // Normalize email to lowercase for consistent uniqueness checking
      if (data.email) {
        data.email = data.email.toLowerCase().trim();
      }
      
      // Check email uniqueness across network if email is provided
      let emailWarning: string | undefined;
      if (data.email) {
        const existingMembersWithEmail = await storage.getMembersByEmail(data.email);
        if (existingMembersWithEmail.length > 0) {
          // Get tree names for context
          const treeNames = await Promise.all(
            existingMembersWithEmail.map(async (m) => {
              const t = await storage.getTree(m.treeId);
              return t?.name || 'Unknown tree';
            })
          );
          emailWarning = `This email (${data.email}) already exists in the network: ${treeNames.join(', ')}. This may indicate a duplicate entry or the same person across trees.`;
        }
      }
      
      const member = await storage.createMember(data);

      // If this is the first member in the tree, set them as the root member
      if (!tree.rootMemberId) {
        const existingMembers = await storage.getMembers(treeId);
        if (existingMembers.length === 1) {
          await storage.updateTree(treeId, { rootMemberId: member.id });
          console.log(`Auto-set ${member.firstName} as root member for tree "${tree.name}"`);
        }
      }

      // Check if email was provided and if user doesn't exist - send invitation
      if (member.email) {
        try {
          const existingUser = await storage.getUserByEmail(member.email);
          if (!existingUser) {
            // Check if we've already sent an invitation for this email+member combo
            const existingInvitation = await storage.getMemberInvitationByEmail(member.email, member.id);
            if (!existingInvitation) {
              // Get the current user's name
              const currentUser = await storage.getUser(userId);
              const inviterName = currentUser?.firstName && currentUser?.lastName 
                ? `${currentUser.firstName} ${currentUser.lastName}` 
                : currentUser?.firstName || currentUser?.email || "A family member";
              
              const memberName = member.lastName 
                ? `${member.firstName} ${member.lastName}` 
                : member.firstName;

              // Send invitation email
              console.log(`Attempting to send invitation to ${member.email} for member "${memberName}" in tree "${tree.name}"...`);
              await sendFamilyMemberInvitation(
                member.email,
                memberName,
                tree.name,
                inviterName
              );
              console.log(`Successfully sent invitation email to ${member.email}`);

              // Track the invitation
              await storage.createMemberInvitation({
                email: member.email,
                memberId: member.id,
                treeId: tree.id,
                treeName: tree.name,
                invitedBy: userId,
                inviterName,
                memberName
              });

              console.log(`Recorded invitation in database for ${member.email}`);
            } else {
              console.log(`Skipping invitation to ${member.email} - already sent previously`);
            }
          } else {
            console.log(`Skipping invitation to ${member.email} - user already exists in system`);
          }
        } catch (emailError: any) {
          // Don't fail the member creation if email fails
          console.error(`Error sending member invitation email to ${member.email}:`, emailError?.message || emailError);
        }
      }

      // Trigger cross-tree match detection in the background (non-blocking)
      (async () => {
        try {
          const { findPotentialCrossTreeMatches } = await import('./crossTreeMatching');
          const matches = await findPotentialCrossTreeMatches(member, [treeId]);
          
          if (matches.length > 0) {
            console.log(`Found ${matches.length} potential cross-tree matches for ${member.firstName} ${member.lastName}`);
            
            // Fetch existing matches once for efficiency
            const existingMatches = await storage.getCrossTreeMatchesForTree(treeId);
            const existingMatchPairs = new Set(
              existingMatches.flatMap(m => [
                `${m.member1Id}-${m.member2Id}`,
                `${m.member2Id}-${m.member1Id}`
              ])
            );
            
            // Create pending match records for high-confidence matches
            for (const match of matches.filter(m => m.matchScore >= 0.6)) {
              try {
                // Check if this match already exists using cached set
                const matchKey1 = `${member.id}-${match.member.id}`;
                const matchKey2 = `${match.member.id}-${member.id}`;
                const alreadyExists = existingMatchPairs.has(matchKey1) || existingMatchPairs.has(matchKey2);
                
                if (!alreadyExists) {
                  // Add to set to prevent duplicates within same batch
                  existingMatchPairs.add(matchKey1);
                  const matchMember = match.member;
                  const matchTree = await storage.getTree(matchMember.treeId);
                  
                  await storage.createCrossTreeMatch({
                    member1Id: member.id,
                    tree1Id: treeId,
                    member2Id: matchMember.id,
                    tree2Id: matchMember.treeId,
                    matchType: match.externalIdMatch ? 'external_id' : 'name_date',
                    matchSource: 'auto_detection',
                    matchScore: match.matchScore,
                    status: 'pending',
                  });
                  
                  console.log(`Created cross-tree match record: ${member.firstName} <-> ${matchMember.firstName}`);
                  
                  // Send email notification to tree owner
                  if (matchTree && tree) {
                    const matchTreeOwner = await storage.getUser(matchTree.ownerId);
                    if (matchTreeOwner?.email) {
                      const { sendCrossTreeMatchNotification } = await import('./lib/email');
                      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
                        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                        : process.env.REPL_SLUG 
                          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
                          : 'https://familyroots.replit.app';
                      
                      await sendCrossTreeMatchNotification(
                        matchTreeOwner.email,
                        matchTreeOwner.firstName || 'there',
                        `${matchMember.firstName} ${matchMember.lastName}`,
                        matchTree.name,
                        `${member.firstName} ${member.lastName}`,
                        tree.name,
                        match.matchScore,
                        `${baseUrl}/dashboard`
                      );
                      console.log(`Sent match notification to ${matchTreeOwner.email}`);
                    }
                  }
                }
              } catch (matchError) {
                console.error('Error creating cross-tree match:', matchError);
              }
            }
          }
        } catch (matchError) {
          console.error('Error running cross-tree match detection:', matchError);
        }
      })();

      // Deduct credit if beyond free limit, track activity, check milestones (skip for admin)
      if (!adminBypass) {
        const updatedMemberCount = await subscriptionService.calculateTotalMemberCount(tree.ownerId);
        if (updatedMemberCount > PRICING_CONFIG.freeTierCredits) {
          await subscriptionService.deductCredit(tree.ownerId);
        }
      }
      await subscriptionService.incrementMonthlyAdds(tree.ownerId);
      await subscriptionService.checkAndGrantMilestoneReward(tree.ownerId);

      // Notify tree owner and collaborators about new member (non-blocking)
      (async () => {
        try {
          const adderUser = await storage.getUser(userId);
          const adderName = adderUser?.firstName 
            ? `${adderUser.firstName}${adderUser.lastName ? ' ' + adderUser.lastName : ''}` 
            : 'A collaborator';
          const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`;
          const description = `${adderName} added a new member: ${memberName}`;

          const sentEmails = new Set<string>();
          const notifyTargets: { email: string; name: string }[] = [];

          if (tree.ownerId !== userId) {
            const owner = await storage.getUser(tree.ownerId);
            if (owner?.email) {
              const prefs = owner.notificationPreferences as any;
              if (!prefs || prefs.emailEnabled !== false) {
                notifyTargets.push({ email: owner.email, name: owner.firstName || 'there' });
                sentEmails.add(owner.email.toLowerCase());
              }
            }
          }

          const collaborators = await storage.getCollaborators(tree.id);
          for (const collab of collaborators) {
            if (collab.userId === userId) continue;
            const collabUser = await storage.getUser(collab.userId);
            if (collabUser?.email && !sentEmails.has(collabUser.email.toLowerCase())) {
              const prefs = collabUser.notificationPreferences as any;
              if (!prefs || prefs.emailEnabled !== false) {
                notifyTargets.push({ email: collabUser.email, name: collabUser.firstName || 'there' });
                sentEmails.add(collabUser.email.toLowerCase());
              }
            }
          }

          for (const target of notifyTargets) {
            try {
              await sendTreeUpdateNotification(target.email, target.name, tree.name, adderName, description);
            } catch (e) {
              console.error(`Failed to send new member notification to ${target.email}:`, e);
            }
          }
        } catch (err) {
          console.error('Error sending new member notifications:', err);
        }
      })();

      // Return member with optional email warning
      res.status(201).json({ 
        ...member, 
        emailWarning: emailWarning || null 
      });
    } catch (error: any) {
      console.error("Error adding member:", error);
      
      // Check for Zod validation errors
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ message: `Validation error: ${fieldErrors}` });
      }
      
      // Check for database constraint errors
      if (error?.code === '23505') {
        return res.status(400).json({ message: "A member with this information already exists" });
      }
      if (error?.code === '22007' || error?.code === '22008') {
        return res.status(400).json({ message: "Invalid date format. Please use a valid date." });
      }
      if (error?.code === '22P02') {
        return res.status(400).json({ message: "Invalid data format provided" });
      }
      
      res.status(400).json({ message: error?.message || "Failed to add member" });
    }
  });

  // Update a family member
  app.patch("/api/trees/:treeId/members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Get existing member to check ownership and email
      const existingMember = await storage.getMember(memberId);
      if (!existingMember) {
        return res.status(404).json({ message: "Member not found" });
      }
      const oldEmail = existingMember?.email;
      
      // Check if user is the claimed owner of this profile
      const isClaimedOwner = existingMember.claimedByUserId === userId;
      
      // Check if user is the custodian of this deceased member
      const isCustodian = existingMember.custodianUserId === userId;
      
      // Check edit permissions
      let canEdit = false;
      if (tree.ownerId === userId) {
        canEdit = true;
      } else if (isClaimedOwner) {
        // Claimed users can edit their own profile
        canEdit = true;
      } else if (isCustodian) {
        // Custodians can edit deceased member's profiles (limited fields)
        canEdit = true;
      } else {
        const collaborators = await storage.getCollaborators(treeId);
        canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
      }
      
      if (!canEdit) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Determine which fields are allowed based on role
      const fullAllowedFields = ["firstName", "lastName", "nickname", "email", "gender", "birthDate", "birthPlace", "deathDate", "isLiving", "photoUrl", "notes", "visibilityOverride", "customPosition"];
      const custodianAllowedFields = ["firstName", "lastName", "deathDate", "notes", "photoUrl"];
      
      // Custodians can only edit limited fields (unless they're also the tree owner)
      const allowedFields = (isCustodian && tree.ownerId !== userId) 
        ? custodianAllowedFields 
        : fullAllowedFields;
        
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          // Sanitize date fields - convert empty strings to null
          if ((field === 'birthDate' || field === 'deathDate') && req.body[field] === '') {
            updateData[field] = null;
          } else if (field === 'email' && req.body[field]) {
            // Normalize email to lowercase for consistent uniqueness checking
            updateData[field] = req.body[field].toLowerCase().trim();
          } else {
            updateData[field] = req.body[field];
          }
        }
      }

      // Normalize oldEmail for comparison
      const normalizedOldEmail = oldEmail?.toLowerCase().trim();

      // Check email uniqueness across network if email is being changed
      let emailWarning: string | undefined;
      if (updateData.email && updateData.email !== normalizedOldEmail) {
        const existingMembersWithEmail = await storage.getMembersByEmail(updateData.email);
        // Filter out current member (we're updating this one)
        const otherMembersWithEmail = existingMembersWithEmail.filter(m => m.id !== memberId);
        if (otherMembersWithEmail.length > 0) {
          const treeNames = await Promise.all(
            otherMembersWithEmail.map(async (m) => {
              const t = await storage.getTree(m.treeId);
              return t?.name || 'Unknown tree';
            })
          );
          emailWarning = `This email (${updateData.email}) already exists in the network: ${treeNames.join(', ')}. This may indicate a duplicate entry or the same person across trees.`;
        }
      }

      const updated = await storage.updateMember(memberId, updateData);

      // If email was added or changed, check if we should send an invitation
      if (updated && updated.email && updated.email !== oldEmail) {
        try {
          const existingUser = await storage.getUserByEmail(updated.email);
          if (!existingUser) {
            // Check if we've already sent an invitation for this email+member combo
            const existingInvitation = await storage.getMemberInvitationByEmail(updated.email, memberId);
            if (!existingInvitation) {
              // Get the current user's name
              const currentUser = await storage.getUser(userId);
              const inviterName = currentUser?.firstName && currentUser?.lastName 
                ? `${currentUser.firstName} ${currentUser.lastName}` 
                : currentUser?.firstName || currentUser?.email || "A family member";
              
              const memberName = updated.lastName 
                ? `${updated.firstName} ${updated.lastName}` 
                : updated.firstName;

              // Send invitation email
              await sendFamilyMemberInvitation(
                updated.email,
                memberName,
                tree.name,
                inviterName
              );

              // Track the invitation
              await storage.createMemberInvitation({
                email: updated.email,
                memberId: updated.id,
                treeId: tree.id,
                treeName: tree.name,
                invitedBy: userId,
                inviterName,
                memberName
              });

              console.log(`Sent family member invitation to ${updated.email} for tree "${tree.name}"`);
            }
          }
        } catch (emailError) {
          // Don't fail the update if email fails
          console.error("Error sending member invitation email:", emailError);
        }
      }

      // Return updated member with optional email warning
      res.json({ 
        ...updated, 
        emailWarning: emailWarning || null 
      });
    } catch (error: any) {
      console.error("Error updating member:", error);
      
      // Check for Zod validation errors
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ message: `Validation error: ${fieldErrors}` });
      }
      
      // Check for database constraint errors
      if (error?.code === '23505') {
        return res.status(400).json({ message: "A member with this information already exists" });
      }
      if (error?.code === '22007' || error?.code === '22008') {
        return res.status(400).json({ message: "Invalid date format. Please use a valid date." });
      }
      if (error?.code === '22P02') {
        return res.status(400).json({ message: "Invalid data format provided" });
      }
      
      res.status(400).json({ message: error?.message || "Failed to update member" });
    }
  });

  // Delete a family member
  app.delete("/api/trees/:treeId/members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.softDeleteMember(memberId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting member:", error);
      res.status(500).json({ message: "Failed to delete member" });
    }
  });

  // Merge two members (source member is deleted, relationships transferred to target)
  app.post("/api/trees/:treeId/members/merge", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const { sourceMemberId, targetMemberId } = req.body;
      const userId = req.user.claims.sub;
      
      if (!sourceMemberId || !targetMemberId) {
        return res.status(400).json({ message: "Both sourceMemberId and targetMemberId are required" });
      }
      
      if (sourceMemberId === targetMemberId) {
        return res.status(400).json({ message: "Cannot merge a member with itself" });
      }
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Only tree owner or editors can merge
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Get both members
      const sourceMember = await storage.getMember(sourceMemberId);
      const targetMember = await storage.getMember(targetMemberId);
      
      if (!sourceMember || !targetMember) {
        return res.status(404).json({ message: "One or both members not found" });
      }
      
      if (sourceMember.treeId !== treeId || targetMember.treeId !== treeId) {
        return res.status(400).json({ message: "Both members must be from the same tree" });
      }
      
      if (sourceMember.claimedByUserId && sourceMember.claimedByUserId !== userId) {
        return res.status(400).json({ 
          message: "Cannot merge a member that has been claimed by another user." 
        });
      }
      
      if (targetMember.claimedByUserId && targetMember.claimedByUserId !== userId) {
        return res.status(400).json({ 
          message: "Cannot merge into a member that has been claimed by another user." 
        });
      }
      
      // Call the merge function (survivorId=target to keep, mergedId=source to delete)
      const result = await storage.mergeMembers(targetMemberId, sourceMemberId, userId);
      
      // Update tree's root member if needed
      if (tree.rootMemberId === sourceMemberId) {
        await storage.updateTree(treeId, { rootMemberId: targetMemberId });
      }
      
      res.json({ 
        success: true, 
        message: `Successfully merged ${sourceMember.firstName} ${sourceMember.lastName || ''} into ${targetMember.firstName} ${targetMember.lastName || ''}`.trim(),
        mergeHistoryId: result.mergeHistoryId
      });
    } catch (error) {
      console.error("Error merging members:", error);
      res.status(500).json({ message: "Failed to merge members" });
    }
  });

  // Search members
  app.get("/api/trees/:treeId/members/search", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const { q } = req.query;
      
      if (!q || typeof q !== "string") {
        return res.status(400).json({ message: "Search query required" });
      }

      const members = await storage.searchMembers(treeId, q);
      res.json(members);
    } catch (error) {
      console.error("Error searching members:", error);
      res.status(500).json({ message: "Failed to search members" });
    }
  });

  // Calculate relationship between two members
  app.get("/api/trees/:treeId/relationship", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const { fromMemberId, toMemberId } = req.query;
      const userId = req.user.claims.sub;
      
      if (!fromMemberId || !toMemberId || typeof fromMemberId !== "string" || typeof toMemberId !== "string") {
        return res.status(400).json({ message: "Both fromMemberId and toMemberId are required" });
      }
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check if user has access (owner or collaborator)
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const hasAccess = collaborators.some(c => c.userId === userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const members = await storage.getMembers(treeId);
      const relationships = await storage.getRelationships(treeId);
      
      // Check for DIRECT relationships first (co-parent, spouse, sibling) - these override path calculation
      const directRelationship = relationships.find(r => 
        (r.fromMemberId === fromMemberId && r.toMemberId === toMemberId) ||
        (r.fromMemberId === toMemberId && r.toMemberId === fromMemberId)
      );
      
      if (directRelationship && ['coparent', 'spouse', 'sibling'].includes(directRelationship.relationshipType)) {
        const fromMember = members.find(m => m.id === fromMemberId);
        const toMember = members.find(m => m.id === toMemberId);
        
        let relationshipName: string = directRelationship.relationshipType;
        if (directRelationship.relationshipType === 'coparent') {
          relationshipName = 'co-parent';
        } else if (directRelationship.relationshipType === 'spouse') {
          relationshipName = toMember?.gender === 'female' ? 'wife' : toMember?.gender === 'male' ? 'husband' : 'spouse';
        } else if (directRelationship.relationshipType === 'sibling') {
          relationshipName = toMember?.gender === 'female' ? 'sister' : toMember?.gender === 'male' ? 'brother' : 'sibling';
        }
        
        return res.json({
          relationshipName,
          path: [fromMemberId, toMemberId],
          pathWithNames: [
            { id: fromMemberId, name: fromMember ? `${fromMember.firstName} ${fromMember.lastName}` : 'Unknown' },
            { id: toMemberId, name: toMember ? `${toMember.firstName} ${toMember.lastName}` : 'Unknown' }
          ],
          commonAncestors: [],
          generationsFromA: 0,
          generationsFromB: 0,
          isDirectLine: true
        });
      }
      
      const result = calculateRelationship(fromMemberId, toMemberId, members, relationships);
      
      if (!result) {
        return res.json({ 
          relationshipName: "not directly related",
          path: [],
          commonAncestors: [],
          generationsFromA: 0,
          generationsFromB: 0,
          isDirectLine: false
        });
      }
      
      // Enhance with member names for the path
      const membersMap = new Map(members.map(m => [m.id, m]));
      const pathWithNames = result.path.map(id => {
        const member = membersMap.get(id);
        return member ? { id, name: `${member.firstName} ${member.lastName}` } : { id, name: "Unknown" };
      });
      
      res.json({
        ...result,
        pathWithNames
      });
    } catch (error) {
      console.error("Error calculating relationship:", error);
      res.status(500).json({ message: "Failed to calculate relationship" });
    }
  });

  // Get subtree between two members
  app.get("/api/trees/:treeId/subtree", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const { fromMemberId, toMemberId } = req.query;
      const userId = req.user.claims.sub;
      
      if (!fromMemberId || !toMemberId || typeof fromMemberId !== "string" || typeof toMemberId !== "string") {
        return res.status(400).json({ message: "Both fromMemberId and toMemberId are required" });
      }
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check if user has access (owner or collaborator)
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const hasAccess = collaborators.some(c => c.userId === userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const members = await storage.getMembers(treeId);
      const relationships = await storage.getRelationships(treeId);
      
      const subtree = getSubtreeBetweenMembers(fromMemberId, toMemberId, members, relationships);
      
      res.json(subtree);
    } catch (error) {
      console.error("Error getting subtree:", error);
      res.status(500).json({ message: "Failed to get subtree" });
    }
  });

  // Add a relationship
  app.post("/api/trees/:treeId/relationships", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const data = insertRelationshipSchema.parse({ ...req.body, treeId });
      
      // Validate relationship type against tree type
      const treeTypeForValidation = (tree.treeType || "family") as TreeType;
      const customTypesForValidation = tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null;
      const validRelTypes = getValidRelationshipValues(treeTypeForValidation, customTypesForValidation);
      if (!validRelTypes.includes(data.relationshipType)) {
        return res.status(400).json({ message: `Invalid relationship type '${data.relationshipType}' for this tree type` });
      }
      
      // Age validation for parent/child relationships (family trees only)
      if (data.relationshipType === "parent" || data.relationshipType === "child") {
        const members = await storage.getMembers(treeId);
        const fromMember = members.find(m => m.id === data.fromMemberId);
        const toMember = members.find(m => m.id === data.toMemberId);
        
        if (fromMember?.birthDate && toMember?.birthDate) {
          const fromBirth = new Date(fromMember.birthDate);
          const toBirth = new Date(toMember.birthDate);
          
          // For "parent" relationship: fromMember should be older (born before toMember)
          // For "child" relationship: fromMember should be younger (born after toMember)
          if (data.relationshipType === "parent") {
            // fromMember is the parent, so they should be older (earlier birth date)
            if (fromBirth >= toBirth) {
              const fromName = `${fromMember.firstName} ${fromMember.lastName || ''}`.trim();
              const toName = `${toMember.firstName} ${toMember.lastName || ''}`.trim();
              return res.status(400).json({ 
                message: `Age error: ${fromName} (born ${fromBirth.getFullYear()}) cannot be a parent of ${toName} (born ${toBirth.getFullYear()}). A parent must be older than their child.` 
              });
            }
          } else if (data.relationshipType === "child") {
            // fromMember is the child, so they should be younger (later birth date)
            if (fromBirth <= toBirth) {
              const fromName = `${fromMember.firstName} ${fromMember.lastName || ''}`.trim();
              const toName = `${toMember.firstName} ${toMember.lastName || ''}`.trim();
              return res.status(400).json({ 
                message: `Age error: ${fromName} (born ${fromBirth.getFullYear()}) cannot be a child of ${toName} (born ${toBirth.getFullYear()}). A child must be younger than their parent.` 
              });
            }
          }
        }
      }

      const relationship = await storage.createRelationship(data);
      res.status(201).json(relationship);
    } catch (error) {
      console.error("Error adding relationship:", error);
      res.status(400).json({ message: "Failed to add relationship" });
    }
  });

  // Bulk-update relationship types
  app.patch("/api/trees/:treeId/relationships/bulk-update", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const { relationshipIds, newRelationshipType } = req.body;

      if (!Array.isArray(relationshipIds) || relationshipIds.length === 0) {
        return res.status(400).json({ message: "relationshipIds must be a non-empty array" });
      }

      if (!newRelationshipType || typeof newRelationshipType !== "string") {
        return res.status(400).json({ message: "newRelationshipType is required" });
      }

      const treeType = (tree.treeType || "family") as TreeType;
      const customTypes = tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null;
      const validTypes = getValidRelationshipValues(treeType, customTypes);
      if (!validTypes.includes(newRelationshipType)) {
        return res.status(400).json({ message: `Invalid relationship type '${newRelationshipType}'` });
      }

      const existingRelationships = await storage.getRelationships(treeId);
      const treeRelIds = new Set(existingRelationships.map(r => r.id));
      const validIds = relationshipIds.filter((id: string) => treeRelIds.has(id));

      if (validIds.length === 0) {
        return res.status(400).json({ message: "No valid relationship IDs found for this tree" });
      }

      let updated = 0;
      for (const relId of validIds) {
        const result = await storage.updateRelationship(relId, { relationshipType: newRelationshipType });
        if (result) updated++;
      }

      res.json({ updated, total: validIds.length });
    } catch (error) {
      console.error("Error bulk-updating relationships:", error);
      res.status(500).json({ message: "Failed to bulk-update relationships" });
    }
  });

  // Update a relationship (change type or qualifier)
  app.patch("/api/trees/:treeId/relationships/:relationshipId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, relationshipId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check ownership or edit permission
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const { relationshipType, qualifier, customLabel, swapDirection } = req.body;
      
      // Validate relationship type dynamically based on tree type
      const treeType = (tree.treeType || "family") as TreeType;
      const customTypes = tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null;
      const validTypes = getValidRelationshipValues(treeType, customTypes);
      if (relationshipType && !validTypes.includes(relationshipType)) {
        return res.status(400).json({ message: "Invalid relationship type" });
      }
      
      // Validate qualifier if provided
      const validQualifiers = ["biological", "step", "adopted", "foster", "half", "in-law", null];
      if (qualifier !== undefined && !validQualifiers.includes(qualifier)) {
        return res.status(400).json({ message: "Invalid qualifier" });
      }

      const updatePayload: Record<string, any> = {};
      if (relationshipType !== undefined) updatePayload.relationshipType = relationshipType;
      if (qualifier !== undefined) updatePayload.qualifier = qualifier === null ? null : qualifier;
      if (customLabel !== undefined) updatePayload.customLabel = customLabel === "" ? null : customLabel;

      if (swapDirection) {
        const treeRels = await storage.getRelationships(treeId);
        const existing = treeRels.find(r => r.id === relationshipId);
        if (!existing) {
          return res.status(404).json({ message: "Relationship not found in this tree" });
        }
        updatePayload.fromMemberId = existing.toMemberId;
        updatePayload.toMemberId = existing.fromMemberId;
      }

      const updated = await storage.updateRelationship(relationshipId, updatePayload);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating relationship:", error);
      res.status(500).json({ message: "Failed to update relationship" });
    }
  });

  app.delete("/api/trees/:treeId/relationships/:relationshipId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, relationshipId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteRelationship(relationshipId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting relationship:", error);
      res.status(500).json({ message: "Failed to delete relationship" });
    }
  });

  // Auto-create relationships in bulk
  app.post("/api/trees/:treeId/auto-relationships", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const { mode, leaderId, leaderRelationshipType, memberRelationshipType, peerRelationshipType } = req.body;
      const treeType = (tree.treeType || "family") as TreeType;
      const customTypes = tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null;
      const validRelTypes = getValidRelationshipValues(treeType, customTypes);
      const members = await storage.getMembers(treeId);
      const existingRelationships = await storage.getRelationships(treeId);

      const existingPairs = new Set<string>();
      for (const rel of existingRelationships) {
        existingPairs.add(`${rel.fromMemberId}-${rel.toMemberId}`);
        existingPairs.add(`${rel.toMemberId}-${rel.fromMemberId}`);
      }

      let created = 0;
      let skipped = 0;

      if (mode === "leader" && leaderId) {
        const defaults = getDefaultLeaderRelationship(treeType);
        const lType = leaderRelationshipType || defaults?.leaderType || "leader";
        const mType = memberRelationshipType || defaults?.memberType || "member";

        if (!validRelTypes.includes(lType)) {
          return res.status(400).json({ message: `Invalid leader relationship type '${lType}'` });
        }

        for (const member of members) {
          if (member.id === leaderId) continue;
          const pairKey = `${leaderId}-${member.id}`;
          if (existingPairs.has(pairKey)) {
            skipped++;
            continue;
          }
          await storage.createRelationship({
            treeId,
            fromMemberId: leaderId,
            toMemberId: member.id,
            relationshipType: lType,
          });
          existingPairs.add(pairKey);
          existingPairs.add(`${member.id}-${leaderId}`);
          created++;
        }
      } else if (mode === "peer") {
        const pType = peerRelationshipType || getDefaultPeerRelationship(treeType);

        if (!validRelTypes.includes(pType)) {
          return res.status(400).json({ message: `Invalid peer relationship type '${pType}'` });
        }

        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const pairKey = `${members[i].id}-${members[j].id}`;
            if (existingPairs.has(pairKey)) {
              skipped++;
              continue;
            }
            await storage.createRelationship({
              treeId,
              fromMemberId: members[i].id,
              toMemberId: members[j].id,
              relationshipType: pType,
            });
            existingPairs.add(pairKey);
            existingPairs.add(`${members[j].id}-${members[i].id}`);
            created++;
          }
        }
      } else {
        return res.status(400).json({ message: "Invalid mode. Use 'leader' or 'peer'." });
      }

      res.json({ created, skipped, total: members.length });
    } catch (error) {
      console.error("Error creating auto-relationships:", error);
      res.status(500).json({ message: "Failed to create auto-relationships" });
    }
  });

  // Get events for a tree
  app.get("/api/trees/:treeId/events", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const events = await storage.getEvents(treeId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Add an event
  app.post("/api/trees/:treeId/events", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const data = insertFamilyEventSchema.parse({ ...req.body, treeId });
      const event = await storage.createEvent(data);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error adding event:", error);
      res.status(400).json({ message: "Failed to add event" });
    }
  });

  // ==================== COLLABORATION ROUTES ====================

  // Generate invite link for a tree
  app.post("/api/trees/:treeId/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      // Validate request body
      const parseResult = createInvitationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: parseResult.error.errors 
        });
      }
      
      const { role = "viewer", expiresInDays, maxUses } = parseResult.data;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Only owner or co-owners can create invitations
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Only owners can create invitations" });
        }
      }

      const inviteCode = crypto.randomBytes(16).toString("hex");
      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
      
      const invitation = await storage.createInvitation({
        treeId,
        inviteCode,
        role,
        createdBy: userId,
        expiresAt,
        maxUses: maxUses ? String(maxUses) : null,
        isActive: true,
      });
      
      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/trees/:treeId/invite-link", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Only owners can get invite links" });
        }
      }

      const existing = await storage.getInvitationsByTree(treeId);
      const permanentLink = existing.find(
        (inv) => inv.isActive && !inv.expiresAt && !inv.maxUses
      );

      if (permanentLink) {
        return res.json({ inviteCode: permanentLink.inviteCode });
      }

      const inviteCode = crypto.randomBytes(16).toString("hex");
      await storage.createInvitation({
        treeId,
        inviteCode,
        role: "viewer",
        createdBy: userId,
        expiresAt: null,
        maxUses: null,
        isActive: true,
      });

      res.json({ inviteCode });
    } catch (error) {
      console.error("Error getting invite link:", error);
      res.status(500).json({ message: "Failed to get invite link" });
    }
  });

  // Get all invitations for a tree
  app.get("/api/trees/:treeId/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Only owner or co-owners can view invitations
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const invitations = await storage.getInvitationsByTree(treeId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Get invitation details by invite code (public - for join page)
  app.get("/api/invitations/:inviteCode", async (req, res) => {
    try {
      const { inviteCode } = req.params;
      const invitation = await storage.getInvitation(inviteCode);
      
      if (!invitation || !invitation.isActive) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }

      // Check expiration
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Invitation has expired" });
      }

      // Check max uses
      if (invitation.maxUses && parseInt(invitation.usedCount || "0") >= parseInt(invitation.maxUses)) {
        return res.status(410).json({ message: "Invitation has reached maximum uses" });
      }

      const tree = await storage.getTree(invitation.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      res.json({ 
        invitation: { ...invitation, inviteCode: undefined },
        treeName: tree.name,
        role: invitation.role
      });
    } catch (error) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });

  // Accept an invitation and join a tree
  app.post("/api/invitations/:inviteCode/accept", isAuthenticated, async (req: any, res) => {
    try {
      const { inviteCode } = req.params;
      const userId = req.user.claims.sub;
      
      const invitation = await storage.getInvitation(inviteCode);
      
      if (!invitation || !invitation.isActive) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }

      // Check expiration
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Invitation has expired" });
      }

      // Check max uses
      const usedCount = parseInt(invitation.usedCount || "0");
      if (invitation.maxUses && usedCount >= parseInt(invitation.maxUses)) {
        return res.status(410).json({ message: "Invitation has reached maximum uses" });
      }

      const tree = await storage.getTree(invitation.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      // Check if user is already owner
      if (tree.ownerId === userId) {
        return res.status(400).json({ message: "You are already the owner of this tree" });
      }

      // Check if already a collaborator
      const existingCollab = await storage.getCollaboratorByUserAndTree(userId, invitation.treeId);
      if (existingCollab) {
        return res.status(400).json({ message: "You are already a collaborator on this tree" });
      }

      // Atomically increment the used count FIRST to prevent over-subscription
      // This ensures only one concurrent request succeeds per available slot
      const incrementSuccess = await storage.atomicIncrementInvitationUsage(invitation.id, usedCount);
      if (!incrementSuccess) {
        return res.status(410).json({ message: "Invitation has reached maximum uses" });
      }

      // Try to add collaborator, with rollback on failure
      try {
        const canEdit = invitation.role === "editor" || invitation.role === "co_owner";
        const collaborator = await storage.addCollaborator({
          treeId: invitation.treeId,
          userId,
          role: invitation.role,
          canEdit,
          acceptedAt: new Date(),
        });

        // Notify tree owner that someone joined (non-blocking)
        (async () => {
          try {
            const joiningUser = await storage.getUser(userId);
            const owner = await storage.getUser(tree.ownerId);
            if (owner?.email && owner.id !== userId) {
              const ownerPrefs = owner.notificationPreferences as any;
              if (!ownerPrefs || ownerPrefs.emailEnabled !== false) {
                const joinerName = joiningUser?.firstName 
                  ? `${joiningUser.firstName}${joiningUser.lastName ? ' ' + joiningUser.lastName : ''}` 
                  : joiningUser?.email || 'Someone';
                const roleName = invitation.role === 'co_owner' ? 'Co-owner' : invitation.role === 'editor' ? 'Editor' : 'Viewer';
                await sendTreeUpdateNotification(
                  owner.email,
                  owner.firstName || 'there',
                  tree.name,
                  joinerName,
                  `${joinerName} accepted your invitation and joined as ${roleName}`
                );
              }
            }
          } catch (e) {
            console.error('Error sending join notification:', e);
          }
        })();

        res.status(201).json({ collaborator, treeName: tree.name });
      } catch (collaboratorError) {
        // Roll back the increment if collaborator insert fails
        await storage.atomicDecrementInvitationUsage(invitation.id, usedCount + 1);
        throw collaboratorError;
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Delete an invitation
  app.delete("/api/trees/:treeId/invitations/:invitationId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, invitationId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteInvitation(invitationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });

  // Get collaborators for a tree
  app.get("/api/trees/:treeId/collaborators", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check access
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const collaborators = await storage.getCollaborators(treeId);
      res.json(collaborators);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  // Update collaborator role
  app.patch("/api/trees/:treeId/collaborators/:collaboratorId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, collaboratorId } = req.params;
      const userId = req.user.claims.sub;
      
      // Validate request body
      const parseResult = updateCollaboratorRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: parseResult.error.errors 
        });
      }
      
      const { role } = parseResult.data;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Only owner or co-owners can change roles
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Only owners can change roles" });
        }
      }

      const canEdit = role === "editor" || role === "co_owner";
      const updated = await storage.updateCollaborator(collaboratorId, { role, canEdit });
      res.json(updated);
    } catch (error) {
      console.error("Error updating collaborator:", error);
      res.status(500).json({ message: "Failed to update collaborator" });
    }
  });

  // Remove a collaborator
  app.delete("/api/trees/:treeId/collaborators/:collaboratorId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, collaboratorId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Only owner or co-owners can remove collaborators
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.removeCollaborator(collaboratorId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing collaborator:", error);
      res.status(500).json({ message: "Failed to remove collaborator" });
    }
  });

  // ==================== MEMBER INVITATIONS ROUTES ====================

  // Get all member invitations for a tree (for tracking email status)
  app.get("/api/trees/:treeId/member-invitations", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      // Check ownership or collaboration
      if (tree.ownerId !== userId) {
        const collaboration = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collaboration) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const invitations = await storage.getMemberInvitationsByTree(treeId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching member invitations:", error);
      res.status(500).json({ message: "Failed to fetch member invitations" });
    }
  });

  // Resend invitation email for a member
  app.post("/api/trees/:treeId/member-invitations/:invitationId/resend", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, invitationId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      // Check ownership or editor permission
      if (tree.ownerId !== userId) {
        const collaboration = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collaboration || collaboration.role === 'viewer') {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Get the invitation
      const invitations = await storage.getMemberInvitationsByTree(treeId);
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Get the current user's name
      const currentUser = await storage.getUser(userId);
      const inviterName = currentUser?.firstName && currentUser?.lastName 
        ? `${currentUser.firstName} ${currentUser.lastName}` 
        : currentUser?.firstName || currentUser?.email || "A family member";

      // Resend the email
      console.log(`Resending invitation to ${invitation.email} for tree "${tree.name}"...`);
      await sendFamilyMemberInvitation(
        invitation.email,
        invitation.memberName,
        tree.name,
        inviterName
      );
      console.log(`Successfully resent invitation to ${invitation.email}`);

      res.json({ message: "Invitation resent successfully" });
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      res.status(500).json({ message: error?.message || "Failed to resend invitation" });
    }
  });

  // Delete a member invitation
  app.delete("/api/trees/:treeId/member-invitations/:invitationId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, invitationId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      // Check ownership or editor permission
      if (tree.ownerId !== userId) {
        const collaboration = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collaboration || collaboration.role === 'viewer') {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Verify invitation belongs to this tree
      const invitations = await storage.getMemberInvitationsByTree(treeId);
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Delete the invitation
      await storage.deleteMemberInvitation(invitationId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ message: error?.message || "Failed to delete invitation" });
    }
  });

  // ==================== COMMUNITY DISCOVERY ROUTES ====================

  app.get("/api/discover", async (req, res) => {
    try {
      const { search, category, treeType } = req.query;
      const trees = await storage.getDiscoverableTrees({
        search: search as string,
        category: category as string,
        treeType: treeType as string,
      });

      const treesWithChildren = await Promise.all(
        trees.map(async (tree) => {
          const children = await storage.getChildTrees(tree.id);
          return { ...tree, childCount: children.length };
        })
      );

      res.json(treesWithChildren);
    } catch (error: any) {
      console.error("Error fetching discoverable trees:", error);
      res.status(500).json({ message: "Failed to fetch discoverable communities" });
    }
  });

  app.post("/api/discover/:treeId/join", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Community not found" });
      }
      if (!tree.isDiscoverable) {
        return res.status(403).json({ message: "This community is not open for discovery" });
      }
      if (tree.ownerId === userId) {
        return res.status(400).json({ message: "You already own this community" });
      }

      const existingCollab = await storage.getCollaboratorByUserAndTree(userId, treeId);
      if (existingCollab) {
        return res.status(400).json({ message: "You are already a member of this community" });
      }

      if (tree.autoJoin) {
        await storage.addCollaborator({
          treeId,
          userId,
          role: "viewer",
          canEdit: false,
        });

        const user = await storage.getUser(userId);
        const firstName = user?.firstName || "New";
        const lastName = user?.lastName || "Member";
        await storage.addMember({
          treeId,
          firstName,
          lastName,
          isLiving: true,
          claimedByUserId: userId,
          claimedAt: new Date(),
        } as any);

        res.status(201).json({ message: "Welcome! You've joined the community.", joined: true });
      } else {
        const invitations = await storage.getInvitationsByTree(treeId);
        let inviteCode: string;
        if (invitations.length > 0) {
          inviteCode = invitations[0].inviteCode;
        } else {
          const crypto = await import('crypto');
          inviteCode = crypto.randomBytes(8).toString('hex');
          await storage.createInvitation({
            treeId,
            inviteCode,
            createdBy: tree.ownerId,
          });
        }

        await storage.addCollaborator({
          treeId,
          userId,
          role: "viewer",
          canEdit: false,
        });

        res.status(201).json({ message: "You've joined as a viewer. Browse the community and claim your profile!", joined: true });
      }
    } catch (error: any) {
      console.error("Error joining community:", error);
      res.status(500).json({ message: error?.message || "Failed to join community" });
    }
  });

  app.patch("/api/trees/:treeId/discovery", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      if (tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only the tree owner can change discovery settings" });
      }

      const { isDiscoverable, discoveryDescription, discoveryCategory, discoveryLocation, autoJoin } = req.body;

      const updated = await storage.updateTree(treeId, {
        isDiscoverable: isDiscoverable ?? tree.isDiscoverable,
        discoveryDescription: discoveryDescription !== undefined ? discoveryDescription : tree.discoveryDescription,
        discoveryCategory: discoveryCategory !== undefined ? discoveryCategory : tree.discoveryCategory,
        discoveryLocation: discoveryLocation !== undefined ? discoveryLocation : tree.discoveryLocation,
        autoJoin: autoJoin ?? tree.autoJoin,
      } as any);

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating discovery settings:", error);
      res.status(500).json({ message: "Failed to update discovery settings" });
    }
  });

  // ==================== MEMBER MUTE ROUTES ====================

  app.get("/api/trees/:treeId/mutes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;
      const mutes = await storage.getMutesForUser(userId, treeId);
      res.json(mutes);
    } catch (error: any) {
      console.error("Error fetching mutes:", error);
      res.status(500).json({ message: "Failed to fetch mutes" });
    }
  });

  app.post("/api/trees/:treeId/mutes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;
      const { memberId, scope } = req.body;

      if (!memberId) {
        return res.status(400).json({ message: "memberId is required" });
      }

      if (scope && scope !== "member" && scope !== "branch") {
        return res.status(400).json({ message: "scope must be 'member' or 'branch'" });
      }

      const member = await storage.getMember(memberId);
      if (!member || member.treeId !== treeId) {
        return res.status(404).json({ message: "Member not found in this tree" });
      }

      const existing = await storage.getMuteByUserAndMember(userId, treeId, memberId);
      if (existing) {
        return res.status(409).json({ message: "Already muted" });
      }

      const mute = await storage.createMute({
        userId,
        treeId,
        memberId,
        scope: scope || "member",
      });

      res.status(201).json(mute);
    } catch (error: any) {
      console.error("Error creating mute:", error);
      res.status(500).json({ message: "Failed to mute member" });
    }
  });

  app.delete("/api/trees/:treeId/mutes/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId, memberId } = req.params;

      await storage.deleteMute(userId, treeId, memberId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting mute:", error);
      res.status(500).json({ message: "Failed to unmute member" });
    }
  });

  app.get("/api/trees/:treeId/muted-member-ids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;

      const members = await storage.getMembers(treeId);
      const relationships = await storage.getRelationships(treeId);

      const mutedIds = await storage.getAllMutedMemberIds(userId, treeId, members, relationships);
      res.json(mutedIds);
    } catch (error: any) {
      console.error("Error fetching muted member IDs:", error);
      res.status(500).json({ message: "Failed to fetch muted member IDs" });
    }
  });

  // ==================== PROFILE CLAIM ROUTES ====================

  // Get pending claim requests for trees owned by the current user
  app.get("/api/profile-claims/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get all trees owned by this user
      const userTrees = await storage.getTrees(userId);
      
      // Get all pending claims for these trees
      const allPendingClaims = [];
      for (const tree of userTrees) {
        const claims = await storage.getProfileClaimRequestsByTree(tree.id);
        const pendingClaims = claims.filter(c => c.status === 'pending');
        for (const claim of pendingClaims) {
          const member = await storage.getMember(claim.memberId);
          allPendingClaims.push({
            ...claim,
            memberName: member ? `${member.firstName} ${member.lastName || ''}`.trim() : 'Unknown',
            treeName: tree.name,
          });
        }
      }
      
      res.json(allPendingClaims);
    } catch (error: any) {
      console.error("Error fetching pending claims:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch pending claims" });
    }
  });

  // Get profiles claimed by the current user
  app.get("/api/profile-claims/my-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const claimedProfiles = await storage.getClaimedProfilesByUser(userId);
      
      // Enrich with tree info
      const enrichedProfiles = await Promise.all(claimedProfiles.map(async (member) => {
        const tree = await storage.getTree(member.treeId);
        return {
          ...member,
          treeName: tree?.name || 'Unknown Tree',
        };
      }));
      
      res.json(enrichedProfiles);
    } catch (error: any) {
      console.error("Error fetching claimed profiles:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch claimed profiles" });
    }
  });

  // Submit a claim request for a family member profile
  app.post("/api/members/:memberId/claim", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      const { message } = req.body;
      
      // Get the member
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      // Check if member is already claimed
      if (member.claimedByUserId) {
        return res.status(400).json({ message: "This profile has already been claimed" });
      }
      
      // Check if member is marked as deceased
      if (!member.isLiving) {
        return res.status(400).json({ message: "Cannot claim profiles of deceased family members" });
      }
      
      // Check if user already has a pending claim for this member
      const existingClaim = await storage.getProfileClaimRequestByRequester(userId, memberId);
      if (existingClaim && existingClaim.status === 'pending') {
        return res.status(400).json({ message: "You already have a pending claim for this profile" });
      }
      
      // Get the current user's email
      const currentUser = await storage.getUser(userId);
      
      // Create the claim request
      const claimRequest = await storage.createProfileClaimRequest({
        memberId,
        treeId: member.treeId,
        requesterId: userId,
        requesterEmail: currentUser?.email || undefined,
        message: message || undefined,
        status: 'pending',
      });

      // Notify tree owner about the claim request (non-blocking)
      (async () => {
        try {
          const tree = await storage.getTree(member.treeId);
          if (tree) {
            const owner = await storage.getUser(tree.ownerId);
            if (owner?.email && owner.id !== userId) {
              const ownerPrefs = owner.notificationPreferences as any;
              if (!ownerPrefs || ownerPrefs.emailEnabled !== false) {
                const claimerName = currentUser?.firstName 
                  ? `${currentUser.firstName}${currentUser.lastName ? ' ' + currentUser.lastName : ''}` 
                  : currentUser?.email || 'Someone';
                const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`;
                await sendTreeUpdateNotification(
                  owner.email,
                  owner.firstName || 'there',
                  tree.name,
                  claimerName,
                  `${claimerName} is requesting to claim the profile of ${memberName}. Please review this request on your dashboard.`
                );
              }
            }
          }
        } catch (e) {
          console.error('Error sending claim notification:', e);
        }
      })();
      
      res.status(201).json(claimRequest);
    } catch (error: any) {
      console.error("Error creating claim request:", error);
      res.status(500).json({ message: error?.message || "Failed to submit claim request" });
    }
  });

  // Get claim status for a member
  app.get("/api/members/:memberId/claim-status", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      // Check if already claimed by this user
      if (member.claimedByUserId === userId) {
        return res.json({ status: 'owned', claimedAt: member.claimedAt });
      }
      
      // Check if claimed by someone else
      if (member.claimedByUserId) {
        return res.json({ status: 'claimed_by_other' });
      }
      
      // Check for pending claim by this user
      const existingClaim = await storage.getProfileClaimRequestByRequester(userId, memberId);
      if (existingClaim) {
        return res.json({ 
          status: existingClaim.status === 'pending' ? 'pending' : existingClaim.status,
          claimId: existingClaim.id,
          denialReason: existingClaim.denialReason,
        });
      }
      
      // Not claimed and no pending request
      res.json({ status: 'available' });
    } catch (error: any) {
      console.error("Error fetching claim status:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch claim status" });
    }
  });

  // Approve a claim request (tree owner only)
  app.post("/api/profile-claims/:claimId/approve", isAuthenticated, async (req: any, res) => {
    try {
      const { claimId } = req.params;
      const userId = req.user.claims.sub;
      
      const claim = await storage.getProfileClaimRequest(claimId);
      if (!claim) {
        return res.status(404).json({ message: "Claim request not found" });
      }
      
      // Verify the current user owns the tree
      const tree = await storage.getTree(claim.treeId);
      if (!tree || tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only the tree owner can approve claims" });
      }
      
      if (claim.status !== 'pending') {
        return res.status(400).json({ message: "This claim has already been processed" });
      }
      
      const approvedClaim = await storage.approveProfileClaim(claimId, userId);
      res.json(approvedClaim);
    } catch (error: any) {
      console.error("Error approving claim:", error);
      res.status(500).json({ message: error?.message || "Failed to approve claim" });
    }
  });

  // Deny a claim request (tree owner only)
  app.post("/api/profile-claims/:claimId/deny", isAuthenticated, async (req: any, res) => {
    try {
      const { claimId } = req.params;
      const userId = req.user.claims.sub;
      const { reason } = req.body;
      
      const claim = await storage.getProfileClaimRequest(claimId);
      if (!claim) {
        return res.status(404).json({ message: "Claim request not found" });
      }
      
      // Verify the current user owns the tree
      const tree = await storage.getTree(claim.treeId);
      if (!tree || tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only the tree owner can deny claims" });
      }
      
      if (claim.status !== 'pending') {
        return res.status(400).json({ message: "This claim has already been processed" });
      }
      
      const deniedClaim = await storage.denyProfileClaim(claimId, userId, reason);
      res.json(deniedClaim);
    } catch (error: any) {
      console.error("Error denying claim:", error);
      res.status(500).json({ message: error?.message || "Failed to deny claim" });
    }
  });

  // Unclaim / disassociate from a profile (claimed member only)
  app.post("/api/members/:memberId/unclaim", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      if (member.claimedByUserId !== userId) {
        return res.status(403).json({ message: "You can only unclaim profiles that you own" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId === userId) {
        return res.status(400).json({ message: "Tree owners cannot unclaim their own profile from their own tree" });
      }
      
      const disassociatedName = [member.firstName, member.lastName].filter(Boolean).join(" ");
      
      const updatedMember = await storage.updateMember(memberId, {
        claimedByUserId: null,
        claimedAt: null,
        disassociatedAt: new Date(),
        disassociatedName: disassociatedName || null,
        photoUrl: null,
        nickname: null,
        email: null,
        gender: null,
        birthDate: null,
        birthPlace: null,
        notes: null,
        currentCity: null,
        currentRegion: null,
        currentCountry: null,
        locationVisible: false,
        visibilityOverride: null,
      } as any);
      
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
      if (collaborator) {
        await storage.removeCollaborator(collaborator.id);
      }
      
      res.json({ message: "You have been disassociated from this profile. The tree owner's original entry has been preserved." });
    } catch (error: any) {
      console.error("Error unclaiming profile:", error);
      res.status(500).json({ message: error?.message || "Failed to unclaim profile" });
    }
  });

  // ==================== CUSTODIANSHIP ROUTES ====================

  // Get pending custodianship requests for trees owned by the current user (including co-owned)
  app.get("/api/custodianship/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get all trees owned by this user
      const ownedTrees = await storage.getTrees(userId);
      
      // Get pending custodianship requests for all owned trees
      const ownedTreeRequests = await Promise.all(
        ownedTrees.map(async (tree) => {
          const requests = await storage.getCustodianshipRequestsByTree(tree.id);
          return requests.filter(r => r.status === 'pending');
        })
      );
      
      res.json(ownedTreeRequests.flat());
    } catch (error) {
      console.error("Error fetching pending custodianship requests:", error);
      res.status(500).json({ message: "Failed to fetch pending requests" });
    }
  });

  // Request custodianship of a deceased member
  app.post("/api/members/:memberId/custodianship", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email;

      // Get the member
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if member is deceased
      if (!member.deathDate) {
        return res.status(400).json({ message: "Custodianship can only be requested for deceased members" });
      }

      // Check if someone already has custodianship
      if (member.custodianUserId) {
        return res.status(400).json({ message: "This member already has a custodian assigned" });
      }

      // Check for existing pending request from this user
      const existingRequest = await storage.getCustodianshipRequestByRequester(userId, memberId);
      if (existingRequest) {
        return res.status(400).json({ message: "You already have a pending custodianship request for this member" });
      }

      // Calculate 30 days from now for expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const data = insertCustodianshipRequestSchema.parse({
        memberId,
        treeId: member.treeId,
        requesterId: userId,
        requesterEmail: userEmail,
        relationshipToMember: req.body.relationshipToMember,
        reason: req.body.reason,
        expiresAt,
      });

      const request = await storage.createCustodianshipRequest(data);
      res.status(201).json(request);
    } catch (error: any) {
      console.error("Error creating custodianship request:", error);
      res.status(400).json({ message: error?.message || "Failed to create custodianship request" });
    }
  });

  // Get custodianship requests for a specific member
  app.get("/api/members/:memberId/custodianship", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const requests = await storage.getCustodianshipRequestsByMember(memberId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching custodianship requests:", error);
      res.status(500).json({ message: "Failed to fetch custodianship requests" });
    }
  });

  // Approve a custodianship request (tree owner only)
  app.post("/api/custodianship/:requestId/approve", isAuthenticated, async (req: any, res) => {
    try {
      const { requestId } = req.params;
      const userId = req.user.claims.sub;

      const request = await storage.getCustodianshipRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Verify user is tree owner
      const tree = await storage.getTree(request.treeId);
      if (!tree || tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only tree owner can approve custodianship requests" });
      }

      const approved = await storage.approveCustodianship(requestId, userId);
      res.json(approved);
    } catch (error: any) {
      console.error("Error approving custodianship:", error);
      res.status(500).json({ message: error?.message || "Failed to approve custodianship" });
    }
  });

  // Deny a custodianship request (tree owner only)
  app.post("/api/custodianship/:requestId/deny", isAuthenticated, async (req: any, res) => {
    try {
      const { requestId } = req.params;
      const userId = req.user.claims.sub;
      const { reason } = req.body;

      const request = await storage.getCustodianshipRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Verify user is tree owner
      const tree = await storage.getTree(request.treeId);
      if (!tree || tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only tree owner can deny custodianship requests" });
      }

      const denied = await storage.denyCustodianship(requestId, userId, reason);
      res.json(denied);
    } catch (error: any) {
      console.error("Error denying custodianship:", error);
      res.status(500).json({ message: error?.message || "Failed to deny custodianship" });
    }
  });

  // ==================== NOTIFICATION PREFERENCES ROUTES ====================

  // Get notification preferences
  app.get("/api/user/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Return default preferences if none set
      const defaults = {
        births: false,
        deaths: false,
        marriages: false,
        divorces: false,
        milestones: false,
        emailEnabled: false,
      };
      
      res.json(user?.notificationPreferences || defaults);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  // Update notification preferences
  app.put("/api/user/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = req.body;
      
      const updated = await storage.updateUserNotificationPreferences(userId, preferences);
      res.json(updated?.notificationPreferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // ==================== USER PROFILE ROUTES (Single Source of Truth) ====================

  app.get("/api/user/badge-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const trees = await storage.getTrees(userId);
      const { collaboratedTrees } = await storage.getCollaboratedTrees(userId);
      const allTrees = [...trees, ...collaboratedTrees];
      let totalMembers = 0;
      const treeNames: string[] = [];
      for (const tree of allTrees) {
        const members = await storage.getMembers(tree.id);
        totalMembers += members.length;
        treeNames.push(tree.name);
      }

      const referrals = await storage.getReferralsByUser(userId);
      const completedReferrals = referrals.filter((r: any) => r.status === "completed").length;

      res.json({
        treeCount: allTrees.length,
        totalMembers,
        treeNames: treeNames.slice(0, 5),
        completedReferrals,
        memberSince: user.createdAt,
        referralCode: referrals[0]?.referralCode || null,
      });
    } catch (error) {
      console.error("Error fetching badge stats:", error);
      res.status(500).json({ message: "Failed to fetch badge stats" });
    }
  });

  // Get current user's profile
  app.get("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return profile data (excluding sensitive fields)
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        nickname: user.nickname,
        gender: user.gender,
        birthDate: user.birthDate,
        birthPlace: user.birthPlace,
        bio: user.bio,
        currentCity: user.currentCity,
        currentRegion: user.currentRegion,
        currentCountry: user.currentCountry,
        locationVisible: user.locationVisible,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Update current user's profile
  app.put("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validatedData = updateUserProfileSchema.parse(req.body);
      
      // Filter out null/undefined values for update
      const updateData: Record<string, any> = {};
      for (const [key, value] of Object.entries(validatedData)) {
        if (value !== undefined) {
          updateData[key] = value === null ? undefined : value;
        }
      }
      
      const updated = await storage.updateUserProfile(userId, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        profileImageUrl: updated.profileImageUrl,
        nickname: updated.nickname,
        gender: updated.gender,
        birthDate: updated.birthDate,
        birthPlace: updated.birthPlace,
        bio: updated.bio,
        currentCity: updated.currentCity,
        currentRegion: updated.currentRegion,
        currentCountry: updated.currentCountry,
        locationVisible: updated.locationVisible,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid profile data", 
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Get all profiles claimed by the current user across all trees
  app.get("/api/user/claimed-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const claimedProfiles = await storage.getAllClaimedProfilesForUser(userId);
      
      // Include tree info for each claimed profile
      const profilesWithTreeInfo = await Promise.all(
        claimedProfiles.map(async (profile) => {
          const tree = await storage.getTree(profile.treeId);
          return {
            ...profile,
            treeName: tree?.name || "Unknown Tree",
            treeOwnerId: tree?.ownerId,
          };
        })
      );
      
      res.json(profilesWithTreeInfo);
    } catch (error) {
      console.error("Error fetching claimed profiles:", error);
      res.status(500).json({ message: "Failed to fetch claimed profiles" });
    }
  });

  // Import data from a claimed profile into user's canonical profile
  // Only imports non-empty fields from the claimed profile if user's field is empty
  app.post("/api/user/import-profile-data/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      
      // Verify the member is claimed by this user
      const member = await storage.getMember(memberId);
      if (!member || member.claimedByUserId !== userId) {
        return res.status(403).json({ message: "You can only import data from profiles you have claimed" });
      }
      
      // Get current user profile
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Build update object - only import fields where user's field is empty
      const importData: any = {};
      
      if (!user.nickname && member.nickname) importData.nickname = member.nickname;
      if (!user.gender && member.gender) importData.gender = member.gender;
      if (!user.birthDate && member.birthDate) importData.birthDate = member.birthDate;
      if (!user.birthPlace && member.birthPlace) importData.birthPlace = member.birthPlace;
      if (!user.bio && member.notes) importData.bio = member.notes;
      if (!user.currentCity && member.currentCity) importData.currentCity = member.currentCity;
      if (!user.currentRegion && member.currentRegion) importData.currentRegion = member.currentRegion;
      if (!user.currentCountry && member.currentCountry) importData.currentCountry = member.currentCountry;
      
      // Check if there's anything to import
      if (Object.keys(importData).length === 0) {
        return res.json({ 
          message: "No new data to import - your profile already has all available information",
          imported: false,
          fieldsImported: []
        });
      }
      
      // Update user profile
      const updated = await storage.updateUserProfile(userId, importData);
      
      res.json({
        message: "Profile data imported successfully",
        imported: true,
        fieldsImported: Object.keys(importData),
        profile: {
          id: updated?.id,
          nickname: updated?.nickname,
          gender: updated?.gender,
          birthDate: updated?.birthDate,
          birthPlace: updated?.birthPlace,
          bio: updated?.bio,
          currentCity: updated?.currentCity,
          currentRegion: updated?.currentRegion,
          currentCountry: updated?.currentCountry,
        }
      });
    } catch (error) {
      console.error("Error importing profile data:", error);
      res.status(500).json({ message: "Failed to import profile data" });
    }
  });

  // ==================== NETWORK CONNECTION REQUESTS ====================

  // Get pending network connection requests for current user
  app.get("/api/user/network-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getNetworkConnectionRequestsForUser(userId);
      
      // Enrich with tree info
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        const fromTree = await storage.getTree(request.fromTreeId);
        const toTree = await storage.getTree(request.toTreeId);
        const viaTree = await storage.getTree(request.viaTreeId);
        return {
          ...request,
          fromTreeName: fromTree?.name || 'Unknown Tree',
          toTreeName: toTree?.name || 'Unknown Tree',
          viaTreeName: viaTree?.name || 'Unknown Tree',
        };
      }));
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching network requests:", error);
      res.status(500).json({ message: "Failed to fetch network requests" });
    }
  });

  // Respond to a network connection request (approve/deny)
  app.post("/api/user/network-requests/:requestId/respond", isAuthenticated, async (req: any, res) => {
    try {
      const { requestId } = req.params;
      const { action } = req.body; // "approve" or "deny"
      const userId = req.user.claims.sub;

      if (!action || !["approve", "deny"].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Must be 'approve' or 'deny'" });
      }

      // Get the request
      const request = await storage.getNetworkConnectionRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Verify user owns the target tree
      if (request.toOwnerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "Request already processed" });
      }

      if (action === "approve") {
        // Create the tree connection
        const fromTree = await storage.getTree(request.fromTreeId);
        const toTree = await storage.getTree(request.toTreeId);
        
        if (!fromTree || !toTree) {
          return res.status(404).json({ message: "One or both trees not found" });
        }

        // Check if connection already exists
        const existingConnection = await storage.getTreeConnectionBetween(request.fromTreeId, request.toTreeId);
        if (!existingConnection) {
          await storage.createTreeConnection({
            tree1Id: request.fromTreeId,
            tree2Id: request.toTreeId,
            connectionType: "family",
            createdBy: userId,
          });
        }

        await storage.updateNetworkConnectionRequestStatus(requestId, "approved");
        res.json({ success: true, message: "Connection request approved" });
      } else {
        await storage.updateNetworkConnectionRequestStatus(requestId, "denied");
        res.json({ success: true, message: "Connection request denied" });
      }
    } catch (error) {
      console.error("Error responding to network request:", error);
      res.status(500).json({ message: "Failed to respond to request" });
    }
  });

  // ==================== LIFE EVENTS ROUTES ====================

  // Get event by ID
  app.get("/api/events/:eventId", isAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Get events for a specific member
  app.get("/api/members/:memberId/events", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const events = await storage.getEventsByMember(memberId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching member events:", error);
      res.status(500).json({ message: "Failed to fetch member events" });
    }
  });

  // Create a life event with optional media attachments
  app.post("/api/trees/:treeId/events", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      // Check tree access
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      // Check if user can edit (owner or collaborator with edit access)
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const data = insertFamilyEventSchema.parse({
        ...req.body,
        treeId,
        createdBy: userId,
      });

      const event = await storage.createEvent(data);
      
      // Send notifications to users with opt-in preferences for this event type
      try {
        const eventTypeToPreference: Record<string, keyof import("@shared/models/auth").NotificationPreferences> = {
          'birth': 'births',
          'death': 'deaths',
          'marriage': 'marriages',
          'divorce': 'divorces',
          'milestone': 'milestones',
          'graduation': 'milestones',
          'achievement': 'milestones',
        };
        
        let canSendGroupNotifications = true;
        if (tree.isDiscoverable && tree.ownerId !== userId) {
          const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
          if (!collab || collab.role !== 'co_owner') {
            canSendGroupNotifications = false;
          }
        }
        
        const prefKey = eventTypeToPreference[event.eventType];
        if (prefKey && canSendGroupNotifications) {
          const treeUsers = await storage.getTreeMembersWithNotificationPrefs(treeId);
          
          // Get member name for the notification
          const member = event.memberId ? await storage.getMember(event.memberId) : null;
          const memberName = member ? `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}` : 'A family member';
          
          const members = await storage.getMembers(treeId);
          const rels = await storage.getRelationships(treeId);
          
          const mutedIdsCache = new Map<string, string[]>();
          
          for (const treeUser of treeUsers) {
            if (treeUser.id === userId) continue;
            
            if (event.memberId) {
              let mutedIds = mutedIdsCache.get(treeUser.id);
              if (!mutedIds) {
                mutedIds = await storage.getAllMutedMemberIds(treeUser.id, treeId, members, rels);
                mutedIdsCache.set(treeUser.id, mutedIds);
              }
              if (mutedIds.includes(event.memberId)) continue;
            }
            
            const prefs = treeUser.notificationPreferences;
            if (treeUser.email && prefs?.emailEnabled && prefs[prefKey]) {
              await sendLifeEventNotification(
                treeUser.email,
                treeUser.firstName || 'Family member',
                memberName,
                event.eventType,
                event.title,
                event.eventDate ? String(event.eventDate) : new Date().toISOString(),
                tree.name,
                treeId
              );
            }
          }
        }
      } catch (notificationError) {
        console.error("Error sending life event notifications:", notificationError);
      }
      
      res.status(201).json(event);
    } catch (error: any) {
      console.error("Error creating event:", error);
      res.status(400).json({ message: error?.message || "Failed to create event" });
    }
  });

  // Update an event (for adding media attachments)
  app.put("/api/events/:eventId", isAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user.claims.sub;

      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check tree access
      const tree = await storage.getTree(event.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, event.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const updated = await storage.updateEvent(eventId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating event:", error);
      res.status(400).json({ message: error?.message || "Failed to update event" });
    }
  });

  // ==================== ANNOUNCEMENT BROADCAST ROUTES ====================

  app.post("/api/announcements/broadcast", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sourceTreeId, targetTreeIds, title, message, eventType, eventId } = req.body;

      if (!sourceTreeId || !targetTreeIds || !title || !eventType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const sourceTree = await storage.getTree(sourceTreeId);
      if (!sourceTree) {
        return res.status(404).json({ message: "Source tree not found" });
      }
      if (sourceTree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, sourceTreeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied to source tree" });
        }
      }

      if (eventId) {
        const event = await storage.getEvent(eventId);
        if (!event || event.treeId !== sourceTreeId) {
          return res.status(400).json({ message: "Event does not belong to source tree" });
        }
      }

      const verifiedTargetIds: string[] = [];
      for (const treeId of targetTreeIds) {
        const tree = await storage.getTree(treeId);
        if (!tree) continue;
        if (tree.ownerId === userId) {
          verifiedTargetIds.push(treeId);
          continue;
        }
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (collab) {
          verifiedTargetIds.push(treeId);
        }
      }

      if (verifiedTargetIds.length === 0) {
        return res.status(400).json({ message: "No valid target trees" });
      }

      const announcement = await storage.createAnnouncement({
        createdBy: userId,
        sourceTreeId,
        eventId: eventId || null,
        title,
        message: message || null,
        eventType,
        targetTreeIds: verifiedTargetIds,
        notificationsSent: false,
      });

      const eventTypeToPreference: Record<string, string> = {
        'birth': 'births',
        'death': 'deaths',
        'marriage': 'marriages',
        'divorce': 'divorces',
        'milestone': 'milestones',
        'graduation': 'milestones',
        'achievement': 'milestones',
        'general': 'milestones',
      };

      let emailsSent = 0;
      try {
        const prefKey = eventTypeToPreference[eventType] || 'milestones';
        const allTreeIds = [sourceTreeId, ...verifiedTargetIds];
        const seenUserIds = new Set<string>();
        seenUserIds.add(userId);

        for (const treeId of allTreeIds) {
          const tree = await storage.getTree(treeId);
          if (!tree) continue;
          const treeUsers = await storage.getTreeMembersWithNotificationPrefs(treeId);

          for (const treeUser of treeUsers) {
            if (seenUserIds.has(treeUser.id)) continue;
            seenUserIds.add(treeUser.id);

            const prefs = treeUser.notificationPreferences;
            if (treeUser.email && prefs?.emailEnabled && (prefs as any)[prefKey]) {
              await sendLifeEventNotification(
                treeUser.email,
                treeUser.firstName || 'Member',
                sourceTree.name,
                eventType,
                title,
                new Date().toISOString(),
                tree.name,
                treeId
              );
              emailsSent++;
            }
          }
        }
      } catch (notificationError) {
        console.error("Error sending broadcast notifications:", notificationError);
      }

      res.status(201).json({ ...announcement, emailsSent });
    } catch (error: any) {
      console.error("Error broadcasting announcement:", error);
      res.status(400).json({ message: error?.message || "Failed to broadcast" });
    }
  });

  app.get("/api/announcements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getAnnouncementsByUser(userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.get("/api/trees/:treeId/announcements", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const result = await storage.getAnnouncementsForTree(treeId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  // ==================== NAME HISTORY ROUTES ====================

  // Get name history for a member
  app.get("/api/members/:memberId/name-history", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const history = await storage.getNameHistory(memberId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching name history:", error);
      res.status(500).json({ message: "Failed to fetch name history" });
    }
  });

  // Add name history entry
  app.post("/api/members/:memberId/name-history", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      // Get the member to check tree access
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check if user can edit
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const data = insertNameHistorySchema.parse({ ...req.body, memberId });
      const entry = await storage.createNameHistory(data);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error adding name history:", error);
      res.status(400).json({ message: "Failed to add name history" });
    }
  });

  // Update name history entry
  app.patch("/api/members/:memberId/name-history/:historyId", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, historyId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const allowedFields = ["firstName", "lastName", "maidenName", "reason", "effectiveDate", "endDate", "spouseId", "notes"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const updated = await storage.updateNameHistory(historyId, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating name history:", error);
      res.status(400).json({ message: "Failed to update name history" });
    }
  });

  // Delete name history entry
  app.delete("/api/members/:memberId/name-history/:historyId", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, historyId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteNameHistory(historyId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting name history:", error);
      res.status(500).json({ message: "Failed to delete name history" });
    }
  });

  // ==================== EDUCATION HISTORY ROUTES ====================

  // Get education history for a member
  app.get("/api/members/:memberId/education", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const education = await storage.getEducationHistory(memberId);
      res.json(education);
    } catch (error) {
      console.error("Error getting education history:", error);
      res.status(500).json({ message: "Failed to get education history" });
    }
  });

  // Create education history entry
  app.post("/api/members/:memberId/education", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const education = await storage.createEducationHistory({
        memberId,
        institution: req.body.institution,
        degree: req.body.degree,
        fieldOfStudy: req.body.fieldOfStudy,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        graduated: req.body.graduated,
        honors: req.body.honors,
        location: req.body.location,
        notes: req.body.notes,
      });
      res.status(201).json(education);
    } catch (error) {
      console.error("Error creating education history:", error);
      res.status(500).json({ message: "Failed to create education history" });
    }
  });

  // Update education history entry
  app.patch("/api/members/:memberId/education/:educationId", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, educationId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const updated = await storage.updateEducationHistory(educationId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Education entry not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating education history:", error);
      res.status(500).json({ message: "Failed to update education history" });
    }
  });

  // Delete education history entry
  app.delete("/api/members/:memberId/education/:educationId", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, educationId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteEducationHistory(educationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting education history:", error);
      res.status(500).json({ message: "Failed to delete education history" });
    }
  });

  // ==================== CAREER HISTORY ROUTES ====================

  // Get career history for a member
  app.get("/api/members/:memberId/career", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const career = await storage.getCareerHistory(memberId);
      res.json(career);
    } catch (error) {
      console.error("Error getting career history:", error);
      res.status(500).json({ message: "Failed to get career history" });
    }
  });

  // Create career history entry
  app.post("/api/members/:memberId/career", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const career = await storage.createCareerHistory({
        memberId,
        employer: req.body.employer,
        jobTitle: req.body.jobTitle,
        industry: req.body.industry,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        isCurrent: req.body.isCurrent,
        location: req.body.location,
        achievements: req.body.achievements,
        notes: req.body.notes,
      });
      res.status(201).json(career);
    } catch (error) {
      console.error("Error creating career history:", error);
      res.status(500).json({ message: "Failed to create career history" });
    }
  });

  // Update career history entry
  app.patch("/api/members/:memberId/career/:careerId", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, careerId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const updated = await storage.updateCareerHistory(careerId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Career entry not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating career history:", error);
      res.status(500).json({ message: "Failed to update career history" });
    }
  });

  // Delete career history entry
  app.delete("/api/members/:memberId/career/:careerId", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, careerId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteCareerHistory(careerId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting career history:", error);
      res.status(500).json({ message: "Failed to delete career history" });
    }
  });

  // ==================== MEMBER DISCOVERABILITY ROUTES ====================

  // Get discoverability settings for a member
  app.get("/api/members/:memberId/discoverability", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const discoverability = await storage.getDiscoverableMember(memberId);
      res.json(discoverability || { memberId, isDiscoverable: false });
    } catch (error) {
      console.error("Error getting discoverability settings:", error);
      res.status(500).json({ message: "Failed to get discoverability settings" });
    }
  });

  // Update discoverability settings for a member
  app.post("/api/members/:memberId/discoverability", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const discoverability = await storage.createOrUpdateDiscoverableMember({
        memberId,
        treeId: member.treeId,
        isDiscoverable: req.body.isDiscoverable ?? false,
        matchByEmail: req.body.matchByEmail ?? false,
        matchByName: req.body.matchByName ?? false,
        matchByNickname: req.body.matchByNickname ?? false,
        matchByBirthdate: req.body.matchByBirthdate ?? false,
        matchByBirthplace: req.body.matchByBirthplace ?? false,
      });
      res.json(discoverability);
    } catch (error) {
      console.error("Error updating discoverability settings:", error);
      res.status(500).json({ message: "Failed to update discoverability settings" });
    }
  });

  // Find potential matches for a member
  app.get("/api/members/:memberId/potential-matches", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const userId = req.user.claims.sub;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const matches = await storage.findPotentialMatches(memberId);
      
      // Don't return full member details, just basic info for privacy
      const safeMatches = matches.map(m => ({
        matchScore: m.matchScore,
        matchCriteria: m.matchCriteria,
        member: {
          id: m.member.id,
          firstName: m.member.firstName,
          lastName: m.member.lastName,
          treeId: m.member.treeId,
        }
      }));
      
      res.json(safeMatches);
    } catch (error) {
      console.error("Error finding potential matches:", error);
      res.status(500).json({ message: "Failed to find potential matches" });
    }
  });

  // ==================== MATCH REQUEST ROUTES ====================

  // Get match requests for a tree (incoming)
  app.get("/api/trees/:treeId/match-requests", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const requests = await storage.getMatchRequests(treeId);
      
      // Enrich with member and tree info
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const requestingMember = await storage.getMember(request.requestingMemberId);
          const targetMember = await storage.getMember(request.targetMemberId);
          const requestingTree = await storage.getTree(request.requestingTreeId);
          return {
            ...request,
            requestingMember: requestingMember ? {
              id: requestingMember.id,
              firstName: requestingMember.firstName,
              lastName: requestingMember.lastName,
            } : null,
            targetMember: targetMember ? {
              id: targetMember.id,
              firstName: targetMember.firstName,
              lastName: targetMember.lastName,
            } : null,
            requestingTree: requestingTree ? { id: requestingTree.id, name: requestingTree.name } : null,
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error getting match requests:", error);
      res.status(500).json({ message: "Failed to get match requests" });
    }
  });

  // Get sent match requests for a tree
  app.get("/api/trees/:treeId/match-requests/sent", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const requests = await storage.getSentMatchRequests(treeId);
      
      // Enrich with member and tree info
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const requestingMember = await storage.getMember(request.requestingMemberId);
          const targetMember = await storage.getMember(request.targetMemberId);
          const targetTree = await storage.getTree(request.targetTreeId);
          return {
            ...request,
            requestingMember: requestingMember ? {
              id: requestingMember.id,
              firstName: requestingMember.firstName,
              lastName: requestingMember.lastName,
            } : null,
            targetMember: targetMember ? {
              id: targetMember.id,
              firstName: targetMember.firstName,
              lastName: targetMember.lastName,
            } : null,
            targetTree: targetTree ? { id: targetTree.id, name: targetTree.name } : null,
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error getting sent match requests:", error);
      res.status(500).json({ message: "Failed to get sent match requests" });
    }
  });

  // Create a match request
  app.post("/api/match-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestingMemberId, targetMemberId, message } = req.body;
      
      const requestingMember = await storage.getMember(requestingMemberId);
      if (!requestingMember) {
        return res.status(404).json({ message: "Requesting member not found" });
      }
      
      const targetMember = await storage.getMember(targetMemberId);
      if (!targetMember) {
        return res.status(404).json({ message: "Target member not found" });
      }
      
      const requestingTree = await storage.getTree(requestingMember.treeId);
      if (!requestingTree) {
        return res.status(404).json({ message: "Requesting tree not found" });
      }
      
      if (requestingTree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, requestingMember.treeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const request = await storage.createMatchRequest({
        requestingTreeId: requestingMember.treeId,
        requestingMemberId,
        targetTreeId: targetMember.treeId,
        targetMemberId,
        requestedBy: userId,
        message,
      });
      
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating match request:", error);
      res.status(500).json({ message: "Failed to create match request" });
    }
  });

  // Respond to a match request (accept/decline)
  app.patch("/api/match-requests/:requestId", isAuthenticated, async (req: any, res) => {
    try {
      const { requestId } = req.params;
      const { status } = req.body;
      const userId = req.user.claims.sub;
      
      const request = await storage.getMatchRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Match request not found" });
      }
      
      const targetTree = await storage.getTree(request.targetTreeId);
      if (!targetTree) {
        return res.status(404).json({ message: "Target tree not found" });
      }
      
      if (targetTree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, request.targetTreeId);
        if (!collab || !collab.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (!["accepted", "declined"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Use 'accepted' or 'declined'" });
      }

      const updated = await storage.updateMatchRequest(requestId, { status });
      
      // If accepted, create a tree connection
      if (status === "accepted" && updated) {
        await storage.createTreeConnection({
          tree1Id: request.requestingTreeId,
          tree2Id: request.targetTreeId,
          connector1MemberId: request.requestingMemberId,
          connector2MemberId: request.targetMemberId,
          connectionType: "shared_member",
          createdBy: userId,
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error responding to match request:", error);
      res.status(500).json({ message: "Failed to respond to match request" });
    }
  });

  // Delete a match request
  app.delete("/api/match-requests/:requestId", isAuthenticated, async (req: any, res) => {
    try {
      const { requestId } = req.params;
      const userId = req.user.claims.sub;
      
      const request = await storage.getMatchRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Match request not found" });
      }
      
      // Check if user owns the requesting tree (can cancel) or target tree
      const requestingTree = await storage.getTree(request.requestingTreeId);
      const targetTree = await storage.getTree(request.targetTreeId);
      
      const ownsRequesting = requestingTree?.ownerId === userId;
      const ownsTarget = targetTree?.ownerId === userId;
      
      if (!ownsRequesting && !ownsTarget) {
        const requestingCollab = await storage.getCollaboratorByUserAndTree(userId, request.requestingTreeId);
        const targetCollab = await storage.getCollaboratorByUserAndTree(userId, request.targetTreeId);
        if (!requestingCollab?.canEdit && !targetCollab?.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteMatchRequest(requestId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting match request:", error);
      res.status(500).json({ message: "Failed to delete match request" });
    }
  });

  // ==================== TREE CONNECTION ROUTES ====================

  // Get connections for a tree
  app.get("/api/trees/:treeId/connections", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check access
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const connections = await storage.getTreeConnections(treeId);
      
      // Enrich with tree info
      const enrichedConnections = await Promise.all(
        connections.map(async (conn) => {
          const otherTreeId = conn.tree1Id === treeId ? conn.tree2Id : conn.tree1Id;
          const otherTree = await storage.getTree(otherTreeId);
          return {
            ...conn,
            connectedTree: otherTree ? { id: otherTree.id, name: otherTree.name } : null,
          };
        })
      );
      
      res.json(enrichedConnections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Connect two trees
  app.post("/api/trees/:treeId/connections", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      // Validate request body
      const parseResult = createTreeConnectionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: parseResult.error.errors 
        });
      }
      
      const { targetTreeId, connector1MemberId, connector2MemberId, connectionType } = parseResult.data;

      // Prevent self-connection
      if (treeId === targetTreeId) {
        return res.status(400).json({ message: "Cannot connect a tree to itself" });
      }

      const tree1 = await storage.getTree(treeId);
      const tree2 = await storage.getTree(targetTreeId);
      
      if (!tree1 || !tree2) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Check for existing connection (deduplication)
      const existingConnections = await storage.getTreeConnections(treeId);
      const alreadyConnected = existingConnections.some(
        c => (c.tree1Id === treeId && c.tree2Id === targetTreeId) ||
             (c.tree1Id === targetTreeId && c.tree2Id === treeId)
      );
      if (alreadyConnected) {
        return res.status(409).json({ message: "These trees are already connected" });
      }
      
      // Check if user is owner or co-owner of tree1
      if (tree1.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "You must be an owner to connect trees" });
        }
      }

      // Check if user can connect to tree2:
      // Either they own/co-own tree2, OR they are connected (user-to-user) with tree2's owner
      let canConnectToTree2 = false;
      
      if (tree2.ownerId === userId) {
        canConnectToTree2 = true;
      } else {
        const collab = await storage.getCollaboratorByUserAndTree(userId, targetTreeId);
        if (collab && collab.role === "co_owner") {
          canConnectToTree2 = true;
        } else {
          // Check if user is connected (user-to-user) with the tree2 owner
          const userConnection = await storage.getExistingUserConnection(userId, tree2.ownerId);
          if (userConnection) {
            canConnectToTree2 = true;
          }
        }
      }
      
      if (!canConnectToTree2) {
        return res.status(403).json({ 
          message: "You must be connected with the tree owner to link your trees. Send a connection request first." 
        });
      }

      // Auto-find connector members based on claimed profiles if not provided
      let finalConnector1Id = connector1MemberId || null;
      let finalConnector2Id = connector2MemberId || null;
      
      // If connectors not provided, try to find them from claimed profiles
      if (!finalConnector1Id || !finalConnector2Id) {
        // Get tree1 owner's claimed profile in tree1
        const tree1Members = await storage.getMembers(treeId);
        const tree1OwnerClaimed = tree1Members.find(m => m.claimedByUserId === tree1.ownerId);
        
        // Get tree2 owner's claimed profile in tree2
        const tree2Members = await storage.getMembers(targetTreeId);
        const tree2OwnerClaimed = tree2Members.find(m => m.claimedByUserId === tree2.ownerId);
        
        if (tree1OwnerClaimed && !finalConnector1Id) {
          finalConnector1Id = tree1OwnerClaimed.id;
        }
        if (tree2OwnerClaimed && !finalConnector2Id) {
          finalConnector2Id = tree2OwnerClaimed.id;
        }
      }

      // Create the connection with auto-discovered connectors
      const connection = await storage.createTreeConnection({
        tree1Id: treeId,
        tree2Id: targetTreeId,
        connector1MemberId: finalConnector1Id,
        connector2MemberId: finalConnector2Id,
        connectionType: connectionType || "marriage",
        createdBy: userId,
      });

      // Determine if user owns/co-owns both trees (for granting edit access)
      const userOwnsBothTrees = (tree1.ownerId === userId || 
        (await storage.getCollaboratorByUserAndTree(userId, treeId))?.role === "co_owner") &&
        (tree2.ownerId === userId || 
        (await storage.getCollaboratorByUserAndTree(userId, targetTreeId))?.role === "co_owner");

      // Only auto-grant co-owner access if user owns/co-owns BOTH trees
      // If connected via user connection only, grant viewer access for merged view (not edit)
      if (tree1.ownerId !== tree2.ownerId) {
        if (userOwnsBothTrees) {
          // Full co-owner access - user explicitly owns both trees
          const existing1 = await storage.getCollaboratorByUserAndTree(tree1.ownerId, targetTreeId);
          if (!existing1) {
            await storage.addCollaborator({
              treeId: targetTreeId,
              userId: tree1.ownerId,
              role: "co_owner",
              canEdit: true,
              acceptedAt: new Date(),
            });
          }

          const existing2 = await storage.getCollaboratorByUserAndTree(tree2.ownerId, treeId);
          if (!existing2) {
            await storage.addCollaborator({
              treeId: treeId,
              userId: tree2.ownerId,
              role: "co_owner",
              canEdit: true,
              acceptedAt: new Date(),
            });
          }
        } else {
          // Connected via user connection - grant viewer access only (for merged view)
          const existing1 = await storage.getCollaboratorByUserAndTree(tree1.ownerId, targetTreeId);
          if (!existing1) {
            await storage.addCollaborator({
              treeId: targetTreeId,
              userId: tree1.ownerId,
              role: "viewer",
              canEdit: false,
              acceptedAt: new Date(),
            });
          }

          const existing2 = await storage.getCollaboratorByUserAndTree(tree2.ownerId, treeId);
          if (!existing2) {
            await storage.addCollaborator({
              treeId: treeId,
              userId: tree2.ownerId,
              role: "viewer",
              canEdit: false,
              acceptedAt: new Date(),
            });
          }
        }
      }

      // Auto-detect cross-tree matches (same person appearing in both trees)
      // Fire-and-forget: don't await to keep connection response fast
      import("./crossTreeMatching").then(({ detectAndCreateCrossTreeMatches }) => {
        detectAndCreateCrossTreeMatches(treeId, targetTreeId)
          .then(crossMatches => {
            if (crossMatches.length > 0) {
              console.log(`[CrossMatch] Detected ${crossMatches.length} potential matches between trees ${treeId} and ${targetTreeId}`);
            }
          })
          .catch(matchError => {
            console.error("[CrossMatch] Error detecting cross-tree matches:", matchError);
          });
      }).catch(err => console.error("[CrossMatch] Failed to import module:", err));

      // Auto-generate network connection requests for extended family
      // Find trees that tree2 is connected to (that are not tree1)
      try {
        const tree2Connections = await storage.getTreeConnections(targetTreeId);
        for (const otherConn of tree2Connections) {
          const otherTreeId = otherConn.tree1Id === targetTreeId ? otherConn.tree2Id : otherConn.tree1Id;
          
          // Skip if this is the same tree we just connected to
          if (otherTreeId === treeId) continue;
          
          const otherTree = await storage.getTree(otherTreeId);
          if (!otherTree) continue;
          
          // Check if already connected or request already exists
          const existingConnection = await storage.getTreeConnectionBetween(treeId, otherTreeId);
          if (existingConnection) continue;
          
          const existingRequest = await storage.getNetworkConnectionRequest(treeId, otherTreeId);
          if (existingRequest) continue;
          
          // Create auto-generated request
          await storage.createNetworkConnectionRequest({
            fromTreeId: treeId,
            toTreeId: otherTreeId,
            viaConnectionId: connection.id,
            viaTreeId: targetTreeId,
            requestedBy: userId,
            toOwnerId: otherTree.ownerId,
            status: "pending",
            message: `${tree1.name || 'A family tree'} connected to ${tree2.name || 'your connected tree'} and is requesting to join your extended family network.`,
          });
          
          console.log(`[Network] Auto-generated connection request from ${treeId} to ${otherTreeId} via ${targetTreeId}`);
        }
        
        // Also find trees that tree1 is connected to (for tree2's owner)
        const tree1Connections = await storage.getTreeConnections(treeId);
        for (const otherConn of tree1Connections) {
          const otherTreeId = otherConn.tree1Id === treeId ? otherConn.tree2Id : otherConn.tree1Id;
          
          // Skip if this is the same tree we just connected to
          if (otherTreeId === targetTreeId) continue;
          
          const otherTree = await storage.getTree(otherTreeId);
          if (!otherTree) continue;
          
          // Check if already connected or request already exists
          const existingConnection = await storage.getTreeConnectionBetween(targetTreeId, otherTreeId);
          if (existingConnection) continue;
          
          const existingRequest = await storage.getNetworkConnectionRequest(targetTreeId, otherTreeId);
          if (existingRequest) continue;
          
          // Create auto-generated request from tree2 to tree1's other connections
          await storage.createNetworkConnectionRequest({
            fromTreeId: targetTreeId,
            toTreeId: otherTreeId,
            viaConnectionId: connection.id,
            viaTreeId: treeId,
            requestedBy: tree2.ownerId,
            toOwnerId: otherTree.ownerId,
            status: "pending",
            message: `${tree2.name || 'A family tree'} connected to ${tree1.name || 'your connected tree'} and is requesting to join your extended family network.`,
          });
          
          console.log(`[Network] Auto-generated connection request from ${targetTreeId} to ${otherTreeId} via ${treeId}`);
        }
      } catch (networkError) {
        // Non-fatal error - log but don't fail the main connection
        console.error("[Network] Error generating network requests:", networkError);
      }

      res.status(201).json(connection);
    } catch (error) {
      console.error("Error connecting trees:", error);
      res.status(500).json({ message: "Failed to connect trees" });
    }
  });

  // Delete a tree connection
  app.delete("/api/trees/:treeId/connections/:connectionId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, connectionId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteTreeConnection(connectionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  // Get import preview for a branch (shows which members would be imported)
  app.get("/api/trees/:treeId/connections/:connectionId/import-preview", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, connectionId } = req.params;
      const { rootMemberId, scope = "immediate_family", includeSpouses = "true", includeParents = "false", includeChildren = "true" } = req.query;
      const userId = req.user.claims.sub;

      // Verify access to the target tree
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || (collab.role !== "co_owner" && collab.role !== "editor")) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Get the connection
      const connections = await storage.getTreeConnections(treeId);
      const connection = connections.find(c => c.id === connectionId);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      // Determine source tree (the other tree in the connection)
      const sourceTreeId = connection.tree1Id === treeId ? connection.tree2Id : connection.tree1Id;
      const sourceTree = await storage.getTree(sourceTreeId);
      if (!sourceTree) {
        return res.status(404).json({ message: "Source tree not found" });
      }

      // Get all members from source tree
      const sourceMembers = await storage.getMembers(sourceTreeId);
      const sourceRelationships = await storage.getRelationships(sourceTreeId);

      // If no root member specified, use the connector member as root
      const actualRootMemberId = rootMemberId || (connection.tree1Id === treeId ? connection.connector2MemberId : connection.connector1MemberId);
      
      if (!actualRootMemberId) {
        return res.status(400).json({ message: "Root member ID required" });
      }

      // Find the root member
      const rootMember = sourceMembers.find(m => m.id === actualRootMemberId);
      if (!rootMember) {
        return res.status(404).json({ message: "Root member not found in source tree" });
      }

      // Build relationship map
      const getRelatedMembers = (memberId: string): { parents: string[], children: string[], spouses: string[], siblings: string[] } => {
        const parents: string[] = [];
        const children: string[] = [];
        const spouses: string[] = [];
        const siblings: string[] = [];

        for (const rel of sourceRelationships) {
          if (rel.fromMemberId === memberId) {
            if (rel.relationshipType === "parent") children.push(rel.toMemberId);
            if (rel.relationshipType === "spouse") spouses.push(rel.toMemberId);
            if (rel.relationshipType === "sibling") siblings.push(rel.toMemberId);
          }
          if (rel.toMemberId === memberId) {
            if (rel.relationshipType === "parent") parents.push(rel.fromMemberId);
            if (rel.relationshipType === "spouse") spouses.push(rel.fromMemberId);
            if (rel.relationshipType === "sibling") siblings.push(rel.fromMemberId);
          }
        }
        return { parents, children, spouses, siblings };
      };

      // Collect members based on scope
      const selectedMemberIds = new Set<string>();
      selectedMemberIds.add(actualRootMemberId);

      const addSpouses = includeSpouses === "true";
      const addParents = includeParents === "true";
      const addChildren = includeChildren === "true";

      if (scope === "single") {
        // Just the root member
      } else if (scope === "immediate_family") {
        const related = getRelatedMembers(actualRootMemberId);
        if (addSpouses) related.spouses.forEach(id => selectedMemberIds.add(id));
        if (addParents) related.parents.forEach(id => selectedMemberIds.add(id));
        if (addChildren) related.children.forEach(id => selectedMemberIds.add(id));
        related.siblings.forEach(id => selectedMemberIds.add(id));
      } else if (scope === "descendants") {
        // BFS to find all descendants
        const queue = [actualRootMemberId];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const related = getRelatedMembers(currentId);
          if (addSpouses) related.spouses.forEach(id => { if (!selectedMemberIds.has(id)) { selectedMemberIds.add(id); } });
          related.children.forEach(id => { if (!selectedMemberIds.has(id)) { selectedMemberIds.add(id); queue.push(id); } });
        }
      } else if (scope === "ancestors") {
        // BFS to find all ancestors
        const queue = [actualRootMemberId];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const related = getRelatedMembers(currentId);
          if (addSpouses) related.spouses.forEach(id => { if (!selectedMemberIds.has(id)) { selectedMemberIds.add(id); } });
          related.parents.forEach(id => { if (!selectedMemberIds.has(id)) { selectedMemberIds.add(id); queue.push(id); } });
        }
      }

      // Get the actual member objects
      const selectedMembers = sourceMembers.filter(m => selectedMemberIds.has(m.id));

      // Calculate pricing impact
      const currentImported = await storage.getImportedMemberCount(treeId);
      const ownedMembers = await storage.getMembers(treeId);
      const currentTotal = ownedMembers.length + currentImported;
      const newTotal = currentTotal + selectedMembers.length;

      // Pricing tiers
      const getPricingTier = (count: number) => {
        if (count >= 100) return { price: 0, label: "FREE" };
        if (count >= 75) return { price: 2.50, label: "75% off" };
        if (count >= 50) return { price: 4.99, label: "50% off" };
        if (count >= 25) return { price: 7.49, label: "25% off" };
        return { price: 9.99, label: "Base" };
      };

      const currentTier = getPricingTier(currentTotal);
      const newTier = getPricingTier(newTotal);

      res.json({
        sourceTree: { id: sourceTree.id, name: sourceTree.name },
        rootMember: { id: rootMember.id, firstName: rootMember.firstName, lastName: rootMember.lastName },
        scope,
        membersToImport: selectedMembers.map(m => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          photoUrl: m.photoUrl
        })),
        memberCount: selectedMembers.length,
        pricingImpact: {
          currentTotal,
          newTotal,
          currentTier,
          newTier,
          tierChange: currentTier.price !== newTier.price
        }
      });
    } catch (error) {
      console.error("Error getting import preview:", error);
      res.status(500).json({ message: "Failed to get import preview" });
    }
  });

  // Commit an import (actually import the selected branch)
  app.post("/api/trees/:treeId/connections/:connectionId/import", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, connectionId } = req.params;
      const { rootMemberId, scope = "immediate_family", includeSpouses = true, includeParents = false, includeChildren = true } = req.body;
      const userId = req.user.claims.sub;

      // Verify access to the target tree (must be owner or co-owner)
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Only tree owners or co-owners can import branches" });
        }
      }

      // Get the connection
      const connections = await storage.getTreeConnections(treeId);
      const connection = connections.find(c => c.id === connectionId);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      // Determine source tree
      const sourceTreeId = connection.tree1Id === treeId ? connection.tree2Id : connection.tree1Id;

      // Create import config
      const importConfig = await storage.createImportConfig({
        connectionId,
        sourceTreeId,
        targetTreeId: treeId,
        importRootMemberId: rootMemberId,
        importScope: scope,
        includeSpouses,
        includeParents,
        includeChildren,
        createdBy: userId
      });

      // Get members based on the same logic as preview
      const sourceMembers = await storage.getMembers(sourceTreeId);
      const sourceRelationships = await storage.getRelationships(sourceTreeId);

      const getRelatedMembers = (memberId: string): { parents: string[], children: string[], spouses: string[], siblings: string[] } => {
        const parents: string[] = [];
        const children: string[] = [];
        const spouses: string[] = [];
        const siblings: string[] = [];

        for (const rel of sourceRelationships) {
          if (rel.fromMemberId === memberId) {
            if (rel.relationshipType === "parent") children.push(rel.toMemberId);
            if (rel.relationshipType === "spouse") spouses.push(rel.toMemberId);
            if (rel.relationshipType === "sibling") siblings.push(rel.toMemberId);
          }
          if (rel.toMemberId === memberId) {
            if (rel.relationshipType === "parent") parents.push(rel.fromMemberId);
            if (rel.relationshipType === "spouse") spouses.push(rel.fromMemberId);
            if (rel.relationshipType === "sibling") siblings.push(rel.fromMemberId);
          }
        }
        return { parents, children, spouses, siblings };
      };

      const selectedMemberIds = new Set<string>();
      selectedMemberIds.add(rootMemberId);

      if (scope === "single") {
        // Just root
      } else if (scope === "immediate_family") {
        const related = getRelatedMembers(rootMemberId);
        if (includeSpouses) related.spouses.forEach(id => selectedMemberIds.add(id));
        if (includeParents) related.parents.forEach(id => selectedMemberIds.add(id));
        if (includeChildren) related.children.forEach(id => selectedMemberIds.add(id));
        related.siblings.forEach(id => selectedMemberIds.add(id));
      } else if (scope === "descendants") {
        const queue = [rootMemberId];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const related = getRelatedMembers(currentId);
          if (includeSpouses) related.spouses.forEach(id => { if (!selectedMemberIds.has(id)) { selectedMemberIds.add(id); } });
          related.children.forEach(id => { if (!selectedMemberIds.has(id)) { selectedMemberIds.add(id); queue.push(id); } });
        }
      } else if (scope === "ancestors") {
        const queue = [rootMemberId];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const related = getRelatedMembers(currentId);
          if (includeSpouses) related.spouses.forEach(id => { if (!selectedMemberIds.has(id)) { selectedMemberIds.add(id); } });
          related.parents.forEach(id => { if (!selectedMemberIds.has(id)) { selectedMemberIds.add(id); queue.push(id); } });
        }
      }

      // Create imported member records
      let importedCount = 0;
      for (const memberId of Array.from(selectedMemberIds)) {
        await storage.createImportedMember({
          importConfigId: importConfig.id,
          connectionId,
          sourceMemberId: memberId,
          sourceTreeId,
          targetTreeId: treeId,
          importedBy: userId
        });
        importedCount++;
      }

      res.status(201).json({
        importConfig,
        importedCount,
        message: `Successfully imported ${importedCount} members`
      });
    } catch (error) {
      console.error("Error importing branch:", error);
      res.status(500).json({ message: "Failed to import branch" });
    }
  });

  // Get import configs for a connection
  app.get("/api/trees/:treeId/connections/:connectionId/imports", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, connectionId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const importConfigs = await storage.getImportConfigsForConnection(connectionId);
      
      // Enrich with member counts
      const enrichedConfigs = await Promise.all(importConfigs.map(async (config) => {
        const members = await storage.getImportedMembersForConfig(config.id);
        return {
          ...config,
          importedMemberCount: members.length
        };
      }));

      res.json(enrichedConfigs);
    } catch (error) {
      console.error("Error getting import configs:", error);
      res.status(500).json({ message: "Failed to get import configs" });
    }
  });

  // Delete an import config (remove imported branch)
  app.delete("/api/trees/:treeId/connections/:connectionId/imports/:importId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, importId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "Only tree owners or co-owners can remove imports" });
        }
      }

      await storage.deleteImportConfig(importId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting import:", error);
      res.status(500).json({ message: "Failed to delete import" });
    }
  });

  // Get all imported members for a tree (for pricing calculation)
  app.get("/api/trees/:treeId/imported-members", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const importedMembers = await storage.getImportedMembersForTree(treeId);
      const count = await storage.getImportedMemberCount(treeId);

      res.json({
        importedMembers,
        uniqueCount: count
      });
    } catch (error) {
      console.error("Error getting imported members:", error);
      res.status(500).json({ message: "Failed to get imported members" });
    }
  });

  // Get merged tree view (combines connected trees into one visualization)
  app.get("/api/trees/:treeId/merged", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;
      
      // Check access to the main tree (consistent with /api/trees/:id)
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      // Allow access if: owner, collaborator, or public tree
      const isOwner = tree.ownerId === userId;
      const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
      const isPublic = tree.privacy === 'public';
      
      if (!isOwner && !collab && !isPublic) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all connections for this tree
      const connections = await storage.getTreeConnections(treeId);
      
      // Collect all tree IDs (main tree + connected trees) and verify access to each
      const accessibleTreeIds: string[] = [treeId];
      
      for (const conn of connections) {
        const otherTreeId = conn.tree1Id === treeId ? conn.tree2Id : conn.tree1Id;
        if (!accessibleTreeIds.includes(otherTreeId)) {
          // Check if user has access to connected tree
          const otherTree = await storage.getTree(otherTreeId);
          if (otherTree) {
            const isOtherOwner = otherTree.ownerId === userId;
            const otherCollab = await storage.getCollaboratorByUserAndTree(userId, otherTreeId);
            const isOtherPublic = otherTree.privacy === 'public';
            
            // Only include trees user has access to
            if (isOtherOwner || otherCollab || isOtherPublic) {
              accessibleTreeIds.push(otherTreeId);
            }
          }
        }
      }

      // Fetch data from all accessible trees
      const allMembers: any[] = [];
      const allRelationships: any[] = [];
      const treeInfoMap = new Map<string, { name: string; ownerId: string }>();
      
      // Track claimed users to deduplicate members across trees
      // Key: claimedByUserId, Value: { preferredMember, allMemberIds (for relationship remapping) }
      const claimedUserMap = new Map<string, { preferredMember: any; allMemberIds: string[] }>();
      const memberIdRemapping = new Map<string, string>(); // Maps duplicate member IDs to the preferred one
      
      for (const id of accessibleTreeIds) {
        const treeInfo = await storage.getTree(id);
        if (treeInfo) {
          treeInfoMap.set(id, { name: treeInfo.name, ownerId: treeInfo.ownerId });
          const members = await storage.getMembers(id);
          const relationships = await storage.getRelationships(id);
          
          // Add source tree info to each member and handle deduplication
          members.forEach((m: any) => {
            const memberWithSource = {
              ...m,
              sourceTreeId: id,
              sourceTreeName: treeInfo.name,
              isFromConnectedTree: id !== treeId
            };
            
            // Check if this member is claimed by a user
            if (m.claimedByUserId) {
              const existing = claimedUserMap.get(m.claimedByUserId);
              if (existing) {
                // Prefer member from main tree, otherwise prefer the one with more data
                const shouldReplace = id === treeId && existing.preferredMember.sourceTreeId !== treeId;
                console.log(`[MERGE DEDUP] Found duplicate claimed member: ${m.firstName} ${m.lastName} (id: ${m.id}, claimedBy: ${m.claimedByUserId}) - remapping to ${existing.preferredMember.id}`);
                if (shouldReplace) {
                  // Remap the old preferred member ID to this one
                  memberIdRemapping.set(existing.preferredMember.id, m.id);
                  existing.allMemberIds.push(existing.preferredMember.id);
                  existing.preferredMember = memberWithSource;
                  existing.allMemberIds.push(m.id);
                } else {
                  // This is a duplicate, remap it to the preferred one
                  memberIdRemapping.set(m.id, existing.preferredMember.id);
                  existing.allMemberIds.push(m.id);
                }
              } else {
                claimedUserMap.set(m.claimedByUserId, {
                  preferredMember: memberWithSource,
                  allMemberIds: [m.id]
                });
                allMembers.push(memberWithSource);
              }
            } else {
              // Unclaimed members are always added
              allMembers.push(memberWithSource);
            }
          });
          
          allRelationships.push(...relationships);
        }
      }
      
      // Also add preferred members from claimed users (in case they weren't added from main tree first)
      claimedUserMap.forEach(({ preferredMember }) => {
        if (!allMembers.find(m => m.id === preferredMember.id)) {
          allMembers.push(preferredMember);
        }
      });
      
      // Second pass: deduplicate unclaimed members that match claimed members by name
      // This handles cases where an unclaimed member exists alongside a claimed version
      // Use multiple name keys for fuzzy matching (exact, first-word-only, last-name-only)
      const claimedMembersByExactName = new Map<string, any>();
      const claimedMembersByLastName = new Map<string, any[]>(); // Multiple members can share last name
      
      allMembers.forEach(m => {
        if (m.claimedByUserId) {
          const firstName = (m.firstName || '').toLowerCase().trim();
          const lastName = (m.lastName || '').toLowerCase().trim();
          const exactKey = `${firstName}-${lastName}`;
          
          if (!claimedMembersByExactName.has(exactKey)) {
            claimedMembersByExactName.set(exactKey, m);
          }
          
          // Also index by last name for fuzzy matching
          if (lastName) {
            const existing = claimedMembersByLastName.get(lastName) || [];
            existing.push(m);
            claimedMembersByLastName.set(lastName, existing);
          }
        }
      });
      
      // Generational suffixes that indicate different people with same name
      const generationalSuffixes = ['jr', 'jr.', 'junior', 'sr', 'sr.', 'senior', 'ii', 'iii', 'iv', 'v', '2nd', '3rd', '4th', '5th'];
      
      // Extract generational suffix from a name
      const extractSuffix = (name: string): { baseName: string, suffix: string | null } => {
        if (!name) return { baseName: '', suffix: null };
        const parts = name.toLowerCase().trim().split(/\s+/);
        const lastPart = parts[parts.length - 1];
        if (generationalSuffixes.includes(lastPart)) {
          return { baseName: parts.slice(0, -1).join(' '), suffix: lastPart };
        }
        return { baseName: name.toLowerCase().trim(), suffix: null };
      };
      
      // Check if birth years are close enough to be the same generation (within 15 years)
      const sameGeneration = (date1: string | null | undefined, date2: string | null | undefined): boolean => {
        if (!date1 || !date2) return true; // If we don't know, assume possible match
        try {
          const year1 = new Date(date1).getFullYear();
          const year2 = new Date(date2).getFullYear();
          return Math.abs(year1 - year2) <= 15;
        } catch {
          return true; // If dates are invalid, assume possible match
        }
      };
      
      // Helper to check if first names are similar enough AND are the same generation
      const firstNameMatches = (name1: string, name2: string): boolean => {
        if (!name1 || !name2) return false;
        const n1 = name1.toLowerCase().trim();
        const n2 = name2.toLowerCase().trim();
        if (n1 === n2) return true;
        // Check if one starts with the other (e.g., "Peter" vs "Peter A")
        const firstWord1 = n1.split(/\s+/)[0];
        const firstWord2 = n2.split(/\s+/)[0];
        return firstWord1 === firstWord2;
      };
      
      // Check if two members are likely the same person (same name, same generation, no suffix differences)
      const areLikelySamePerson = (m1: any, m2: any): boolean => {
        const firstName1 = (m1.firstName || '').toLowerCase().trim();
        const firstName2 = (m2.firstName || '').toLowerCase().trim();
        const lastName1 = (m1.lastName || '').toLowerCase().trim();
        const lastName2 = (m2.lastName || '').toLowerCase().trim();
        
        // Check for generational suffixes in first name OR last name
        const suffix1First = extractSuffix(firstName1);
        const suffix2First = extractSuffix(firstName2);
        const suffix1Last = extractSuffix(lastName1);
        const suffix2Last = extractSuffix(lastName2);
        
        // If one has a generational suffix and the other doesn't, they're different people
        const hasGenerationalDifference = 
          (suffix1First.suffix && !suffix2First.suffix) ||
          (!suffix1First.suffix && suffix2First.suffix) ||
          (suffix1Last.suffix && !suffix2Last.suffix) ||
          (!suffix1Last.suffix && suffix2Last.suffix) ||
          (suffix1First.suffix !== suffix2First.suffix && suffix1First.suffix && suffix2First.suffix) ||
          (suffix1Last.suffix !== suffix2Last.suffix && suffix1Last.suffix && suffix2Last.suffix);
        
        if (hasGenerationalDifference) {
          console.log(`[MERGE DEDUP] Generational difference detected: "${m1.firstName} ${m1.lastName}" vs "${m2.firstName} ${m2.lastName}" - NOT duplicates`);
          return false;
        }
        
        // Check if birth years suggest different generations
        if (!sameGeneration(m1.birthDate, m2.birthDate)) {
          console.log(`[MERGE DEDUP] Different generations by birth date: "${m1.firstName} ${m1.lastName}" vs "${m2.firstName} ${m2.lastName}" - NOT duplicates`);
          return false;
        }
        
        // If we get here, names match and no generational indicators suggest they're different
        return true;
      };
      
      // Filter out unclaimed duplicates that match claimed members by name AND same generation
      const afterClaimedDedup = allMembers.filter(m => {
        if (m.claimedByUserId) return true; // Keep all claimed members
        
        const firstName = (m.firstName || '').toLowerCase().trim();
        const lastName = (m.lastName || '').toLowerCase().trim();
        const exactKey = `${firstName}-${lastName}`;
        
        // Check exact match first - but still verify they're the same generation
        const exactMatch = claimedMembersByExactName.get(exactKey);
        if (exactMatch && areLikelySamePerson(m, exactMatch)) {
          console.log(`[MERGE DEDUP] Exact name match (same generation): unclaimed "${m.firstName} ${m.lastName}" (${m.id}) -> claimed (${exactMatch.id})`);
          memberIdRemapping.set(m.id, exactMatch.id);
          return false;
        }
        
        // Check fuzzy match by last name + similar first name + same generation
        const sameSurname = claimedMembersByLastName.get(lastName) || [];
        for (const claimed of sameSurname) {
          if (firstNameMatches(m.firstName, claimed.firstName) && areLikelySamePerson(m, claimed)) {
            console.log(`[MERGE DEDUP] Fuzzy name match (same generation): unclaimed "${m.firstName} ${m.lastName}" (${m.id}) -> claimed "${claimed.firstName} ${claimed.lastName}" (${claimed.id})`);
            memberIdRemapping.set(m.id, claimed.id);
            return false;
          }
        }
        
        return true;
      });
      
      // Third pass: deduplicate unclaimed members against each other (for cases where 
      // both duplicates are unclaimed but have similar names across different trees)
      // Use a list to check against all potential matches (not just first seen)
      const seenUnclaimedByKey = new Map<string, any[]>();
      const deduplicatedMembers = afterClaimedDedup.filter(m => {
        if (m.claimedByUserId) return true; // Keep all claimed members
        
        const firstName = (m.firstName || '').toLowerCase().trim();
        const lastName = (m.lastName || '').toLowerCase().trim();
        const firstWord = firstName.split(/\s+/)[0] || '';
        const fuzzyKey = `${firstWord}-${lastName}`;
        
        const existing = seenUnclaimedByKey.get(fuzzyKey) || [];
        
        // Check each potential match - but only merge if they're actually the same person
        for (const candidate of existing) {
          if (areLikelySamePerson(m, candidate)) {
            // Prefer member from main tree
            if (m.sourceTreeId === treeId && candidate.sourceTreeId !== treeId) {
              // This one is from main tree, remap the existing one
              console.log(`[MERGE DEDUP] Unclaimed match (keeping main): "${m.firstName} ${m.lastName}" (${m.id}) kept, remapping (${candidate.id})`);
              memberIdRemapping.set(candidate.id, m.id);
              // Replace candidate with m in the list
              const idx = existing.indexOf(candidate);
              if (idx >= 0) existing[idx] = m;
              return true;
            } else {
              // Keep existing, remap this one
              console.log(`[MERGE DEDUP] Unclaimed match: "${m.firstName} ${m.lastName}" (${m.id}) -> (${candidate.id})`);
              memberIdRemapping.set(m.id, candidate.id);
              return false;
            }
          }
        }
        
        // No match found - add to the seen list
        existing.push(m);
        seenUnclaimedByKey.set(fuzzyKey, existing);
        return true;
      });
      
      console.log(`[MERGE DEDUP] Summary: ${allMembers.length} members -> ${deduplicatedMembers.length} after deduplication`);
      
      // Remap relationship IDs to use preferred member IDs (deduplicated)
      const remappedRelationships = allRelationships.map((rel: any) => ({
        ...rel,
        fromMemberId: memberIdRemapping.get(rel.fromMemberId) || rel.fromMemberId,
        toMemberId: memberIdRemapping.get(rel.toMemberId) || rel.toMemberId
      }));

      // Create bridge relationships between connector members from different trees
      // Only for connections where both trees are accessible
      const bridgeRelationships: any[] = [];
      connections.forEach(conn => {
        if (conn.connector1MemberId && conn.connector2MemberId) {
          // Only create bridge if both trees are accessible
          if (accessibleTreeIds.includes(conn.tree1Id) && accessibleTreeIds.includes(conn.tree2Id)) {
            // Determine relationship type based on connection type (marriage/adoption/other)
            let relType = 'spouse'; // Default for marriage
            if (conn.connectionType === 'adoption') {
              relType = 'parent';
            }
            // 'other' defaults to spouse connection for visualization purposes
            
            // Remap connector member IDs to use deduplicated preferred members
            const fromMemberId = memberIdRemapping.get(conn.connector1MemberId) || conn.connector1MemberId;
            const toMemberId = memberIdRemapping.get(conn.connector2MemberId) || conn.connector2MemberId;
            
            bridgeRelationships.push({
              id: `bridge-${conn.id}`,
              treeId: treeId,
              fromMemberId,
              toMemberId,
              relationshipType: relType,
              isBridge: true,
              connectionId: conn.id,
              createdAt: conn.createdAt
            });
          }
        }
      });

      res.json({
        mainTree: tree,
        connections: connections.filter(c => 
          accessibleTreeIds.includes(c.tree1Id) && accessibleTreeIds.includes(c.tree2Id)
        ),
        members: deduplicatedMembers,
        relationships: [...remappedRelationships, ...bridgeRelationships],
        connectedTrees: Array.from(treeInfoMap.entries()).map(([id, info]) => ({
          id,
          name: info.name,
          isMainTree: id === treeId
        }))
      });
    } catch (error) {
      console.error("Error fetching merged tree:", error);
      res.status(500).json({ message: "Failed to fetch merged tree data" });
    }
  });

  // Stripe Routes - all gracefully handle missing Stripe configuration
  
  // Get publishable key
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Stripe not configured:", error);
      res.json({ publishableKey: null, configured: false });
    }
  });

  // Get products with prices - returns default plans if Stripe not configured
  app.get("/api/products", async (req, res) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
          });
        }
      }

      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Products fetch error (Stripe may not be configured):", error);
      // Return default products when Stripe is not available
      res.json({ 
        data: [
          {
            id: 'default_free',
            name: 'Free Plan',
            description: 'Perfect for getting started',
            metadata: { tier: 'free', maxTrees: '1', maxMembers: '20' },
            prices: [{ id: 'free_price', unit_amount: 0, currency: 'usd', recurring: { interval: 'month' } }]
          },
          {
            id: 'default_premium',
            name: 'Premium Plan',
            description: 'Unlimited features for genealogists',
            metadata: { tier: 'premium', maxTrees: 'unlimited', maxMembers: 'unlimited' },
            prices: [{ id: 'premium_price', unit_amount: 999, currency: 'usd', recurring: { interval: 'month' } }]
          }
        ],
        configured: false
      });
    }
  });

  // Get user subscription status with tiered pricing info
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Admin users get unlimited access
      if (isAdminAccount(userId, user?.email)) {
        return res.json({
          subscription: { id: "admin", status: "active" },
          tier: "unlimited",
          totalMembers: 0,
          credits: 999999,
          freeLimit: 999999,
          isAdmin: true,
          config: SUBSCRIPTION_CONFIG,
        });
      }
      
      const subscriptionInfo = await subscriptionService.getUserSubscriptionInfo(userId);
      
      let stripeSubscription = null;
      if (user?.stripeCustomerId) {
        stripeSubscription = await stripeService.getCustomerSubscription(user.stripeCustomerId) as { id: string; status: string } | null;
      }
      
      res.json({
        subscription: stripeSubscription,
        ...subscriptionInfo,
        config: SUBSCRIPTION_CONFIG,
      });
    } catch (error) {
      console.error("Subscription check error:", error);
      res.status(500).json({ message: "Failed to get subscription info" });
    }
  });

  // Get subscription pricing config
  app.get("/api/subscription/config", async (req, res) => {
    res.json(SUBSCRIPTION_CONFIG);
  });

  // Create checkout session
  app.post("/api/checkout", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not available" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID required" });
      }

      let customerId = user?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user?.email || `user-${userId}@familyroots.family`,
          userId
        );
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/dashboard?checkout=success`,
        `${baseUrl}/pricing?checkout=cancel`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Customer portal
  app.post("/api/customer-portal", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment portal is not available" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No customer found" });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/dashboard`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });

  // Email invite routes
  
  // Send email invites to family members
  app.post("/api/invites/email", isAuthenticated, async (req: any, res) => {
    try {
      const { emails, message, referralCode } = req.body;
      const userId = req.user.claims.sub;
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: "At least one email address is required" });
      }
      
      if (emails.length > 10) {
        return res.status(400).json({ message: "Maximum 10 emails per request" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmails = emails.filter((email: string) => 
        typeof email === 'string' && emailRegex.test(email.trim())
      );
      
      if (validEmails.length === 0) {
        return res.status(400).json({ message: "No valid email addresses provided" });
      }
      
      // Get user info for the invite
      const user = await storage.getUser(userId);
      const inviterName = user?.firstName 
        ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
        : 'A FamilyRoots user';
      
      // Get or create referral link
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'familyroots.replit.app'}`;
      let inviteLink = baseUrl;
      
      if (referralCode) {
        inviteLink = `${baseUrl}/?ref=${referralCode}`;
      } else {
        // Create referral if none exists
        let userReferrals = await storage.getReferralsByUser(userId);
        if (userReferrals.length === 0) {
          const code = `FR${userId.slice(0, 6).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
          await storage.createReferral(userId, code);
          userReferrals = await storage.getReferralsByUser(userId);
        }
        if (userReferrals[0]) {
          inviteLink = `${baseUrl}/?ref=${userReferrals[0].referralCode}`;
        }
      }
      
      // Send emails (using validated emails only)
      const { sendFamilyReferralInvite } = await import('./lib/email');
      const results = await Promise.allSettled(
        validEmails.map((email: string) => 
          sendFamilyReferralInvite(email.trim(), inviterName, message || '', inviteLink)
        )
      );
      
      const sent = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const skipped = emails.length - validEmails.length;
      
      res.json({ 
        success: true, 
        sent, 
        failed,
        skipped,
        message: `Successfully sent ${sent} invite${sent !== 1 ? 's' : ''}${failed > 0 ? `. ${failed} failed.` : '.'}${skipped > 0 ? ` ${skipped} invalid emails skipped.` : ''}`
      });
    } catch (error: any) {
      console.error("Error sending email invites:", error);
      res.status(500).json({ message: "Failed to send invites" });
    }
  });

  // Referral routes
  
  // Get user's referral code and stats
  app.get("/api/referrals/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user already has a referral code
      let userReferrals = await storage.getReferralsByUser(userId);
      
      // If no referral code exists, create one
      if (userReferrals.length === 0) {
        const code = `FR${userId.slice(0, 6).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
        await storage.createReferral(userId, code);
        userReferrals = await storage.getReferralsByUser(userId);
      }
      
      const stats = await storage.getUserReferralStats(userId);
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'familyroots.replit.app'}`;
      const referralLink = `${baseUrl}/?ref=${userReferrals[0]?.referralCode}`;
      
      res.json({
        referralCode: userReferrals[0]?.referralCode,
        referralLink,
        ...stats,
        referrals: userReferrals.map(r => ({
          id: r.id,
          status: r.status,
          clickCount: r.clickCount,
          completedAt: r.completedAt,
          createdAt: r.createdAt,
        }))
      });
    } catch (error: any) {
      console.error("Error getting referrals:", error);
      res.status(500).json({ message: "Failed to get referral info" });
    }
  });
  
  // Track referral link click (public)
  app.post("/api/referrals/click/:code", async (req, res) => {
    try {
      const { code } = req.params;
      if (!code || code.length < 3) {
        return res.status(400).json({ message: "Invalid referral code" });
      }
      const referral = await storage.getReferralByCode(code);
      if (!referral) {
        return res.status(404).json({ message: "Referral code not found" });
      }
      await storage.incrementReferralClick(code);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to track click" });
    }
  });
  
  // Complete a referral (called when new user signs up with referral code)
  app.post("/api/referrals/complete", isAuthenticated, async (req: any, res) => {
    try {
      const { code } = req.body;
      const userId = req.user.claims.sub;
      
      if (!code) {
        return res.status(400).json({ message: "Referral code required" });
      }
      
      const referral = await storage.getReferralByCode(code);
      if (!referral) {
        return res.status(404).json({ message: "Invalid referral code" });
      }
      
      if (referral.referrerUserId === userId) {
        return res.status(400).json({ message: "Cannot refer yourself" });
      }
      
      if (referral.status !== "pending") {
        return res.status(400).json({ message: "Referral already used" });
      }
      
      // Check if this user has already completed any referral (prevent gaming)
      const existingCompletion = await storage.hasUserCompletedAnyReferral(userId);
      if (existingCompletion) {
        return res.status(400).json({ message: "You have already used a referral code" });
      }
      
      const completed = await storage.completeReferral(code, userId);
      res.json({ success: true, referral: completed });
    } catch (error: any) {
      console.error("Error completing referral:", error);
      res.status(500).json({ message: "Failed to complete referral" });
    }
  });

  // Create tiered subscription checkout
  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not available" });
      }

      const userId = req.user.claims.sub;
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const billingInterval = req.body.billingInterval === 'year' ? 'year' : 'month';
      
      const session = await subscriptionService.createSubscriptionCheckout(
        userId,
        `${baseUrl}/pricing?checkout=success`,
        `${baseUrl}/pricing?checkout=cancel`,
        billingInterval
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating subscription checkout:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Create milestone payment checkout (for 100+ member users)
  app.post("/api/subscription/milestone-payment", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not available" });
      }

      const userId = req.user.claims.sub;
      const { milestone } = req.body;

      if (!milestone || typeof milestone !== 'number' || milestone <= 100) {
        return res.status(400).json({ message: "Invalid milestone value" });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await subscriptionService.createMilestonePaymentCheckout(
        userId,
        milestone,
        `${baseUrl}/pricing?milestone=success`,
        `${baseUrl}/pricing?milestone=cancel`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating milestone payment checkout:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Refresh user member count (updates tier)
  app.post("/api/subscription/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscriptionInfo = await subscriptionService.updateUserMemberCount(userId);
      res.json(subscriptionInfo);
    } catch (error) {
      console.error("Error refreshing subscription:", error);
      res.status(500).json({ message: "Failed to refresh subscription info" });
    }
  });

  // Get milestone payment history
  app.get("/api/subscription/milestones", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const milestones = await subscriptionService.getUserMilestonePayments(userId);
      res.json(milestones);
    } catch (error) {
      console.error("Error getting milestones:", error);
      res.status(500).json({ message: "Failed to get milestone history" });
    }
  });

  // ==================== NEW PRICING MODEL ROUTES ====================

  // Get pricing config (public)
  app.get("/api/pricing/config", async (req, res) => {
    res.json(PRICING_CONFIG);
  });

  // Get user credits and pricing info
  app.get("/api/pricing/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscriptionInfo = await subscriptionService.getUserSubscriptionInfo(userId);
      const purchases = await subscriptionService.getUserPurchaseHistory(userId);
      const rewards = await subscriptionService.getUserRewards(userId);
      const activeReward = await subscriptionService.getActiveReward(userId);

      res.json({
        ...subscriptionInfo,
        config: PRICING_CONFIG,
        purchases,
        rewards,
        activeReward,
      });
    } catch (error) {
      console.error("Error getting pricing status:", error);
      res.status(500).json({ message: "Failed to get pricing status" });
    }
  });

  // Purchase bulk add pack
  app.post("/api/pricing/bulk-pack/checkout", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not available" });
      }

      const userId = req.user.claims.sub;
      const { packType } = req.body;

      if (!['starter_10', 'growth_25', 'family_50'].includes(packType)) {
        return res.status(400).json({ message: "Invalid pack type" });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await subscriptionService.createBulkPackCheckout(
        userId,
        packType,
        `${baseUrl}/pricing?purchase=success`,
        `${baseUrl}/pricing?purchase=cancel`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating bulk pack checkout:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Purchase premium subscription
  app.post("/api/pricing/premium/checkout", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not available" });
      }

      const userId = req.user.claims.sub;
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await subscriptionService.createPremiumCheckout(
        userId,
        `${baseUrl}/pricing?premium=success`,
        `${baseUrl}/pricing?premium=cancel`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating premium checkout:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // AI Chatbot endpoint (streaming)
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history = [] } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      // Set up SSE for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let fullResponse = "";

      // Handle client disconnect
      let aborted = false;
      res.on("close", () => {
        aborted = true;
      });

      for await (const chunk of streamChatResponse(message, history)) {
        if (aborted) break;
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true, fullContent: fullResponse })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process chat message" });
      }
    }
  });

  // HeyGen Video Routes (Admin only)
  
  // Test Bluesky connection
  app.get("/api/admin/test-bluesky", isAuthenticated, async (req: any, res) => {
    try {
      const result = await testBlueskyConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Test Discord connection
  app.get("/api/admin/test-discord", isAuthenticated, async (req: any, res) => {
    try {
      const result = await testDiscordConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Send Discord notification (admin only)
  app.post("/api/admin/discord/notify", isAuthenticated, async (req: any, res) => {
    try {
      const { channelId, message, embed } = req.body;
      if (!channelId || !message) {
        return res.status(400).json({ message: "channelId and message are required" });
      }
      await sendDiscordNotification({ channelId, message, embed });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get available avatars
  app.get("/api/admin/heygen/avatars", isAuthenticated, async (req: any, res) => {
    try {
      const avatars = await getAvatars();
      res.json(avatars);
    } catch (error: any) {
      console.error("Error fetching avatars:", error);
      res.status(500).json({ message: error.message || "Failed to fetch avatars" });
    }
  });

  // Get available voices
  app.get("/api/admin/heygen/voices", isAuthenticated, async (req: any, res) => {
    try {
      const voices = await getVoices();
      res.json(voices);
    } catch (error: any) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ message: error.message || "Failed to fetch voices" });
    }
  });

  // Generate a video
  app.post("/api/admin/videos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, script, avatarId, voiceId, backgroundUrl, destinationUrl } = req.body;

      if (!title || !script || !avatarId || !voiceId || !destinationUrl) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const video = await generateVideo({
        title,
        script,
        avatarId,
        voiceId,
        backgroundUrl,
        destinationUrl,
        createdBy: userId,
      });

      res.status(201).json(video);
    } catch (error: any) {
      console.error("Error generating video:", error);
      res.status(500).json({ message: error.message || "Failed to generate video" });
    }
  });

  // Get all videos
  app.get("/api/admin/videos", isAuthenticated, async (req: any, res) => {
    try {
      const videos = await getAllVideos();
      res.json(videos);
    } catch (error: any) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: error.message || "Failed to fetch videos" });
    }
  });

  // Sync video status from HeyGen
  app.post("/api/admin/videos/:id/sync", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const video = await syncVideoStatus(id);
      res.json(video);
    } catch (error: any) {
      console.error("Error syncing video:", error);
      res.status(500).json({ message: error.message || "Failed to sync video status" });
    }
  });

  // Delete a video
  app.delete("/api/admin/videos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await deleteVideo(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: error.message || "Failed to delete video" });
    }
  });

  // Post video to Bluesky
  app.post("/api/admin/videos/:id/share/bluesky", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;

      const video = await getVideoById(id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      if (video.status !== "completed" || !video.videoUrl) {
        return res.status(400).json({ message: "Video is not ready for sharing" });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const videoPageUrl = `${baseUrl}/video/${video.id}`;

      const result = await postToBluesky({
        message: message || `Check out this video: ${video.title}`,
        url: videoPageUrl,
        title: video.title,
        description: video.script.substring(0, 200) + (video.script.length > 200 ? "..." : ""),
        thumbnailUrl: video.thumbnailUrl || undefined,
      });

      res.json({ success: true, postUri: result.uri });
    } catch (error: any) {
      console.error("Error posting to Bluesky:", error);
      res.status(500).json({ message: error.message || "Failed to post to Bluesky" });
    }
  });

  // Public video page - get video by ID (no auth required)
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const video = await getVideoById(id);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      if (video.status !== "completed" || !video.videoUrl) {
        return res.status(404).json({ message: "Video not available" });
      }

      res.json({
        id: video.id,
        title: video.title,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        destinationUrl: video.destinationUrl,
        duration: video.duration,
      });
    } catch (error: any) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  // ========================================
  // DEADMAN SWITCH / ACCOUNT HEIR ROUTES
  // ========================================

  // Get current user's designated heir
  app.get("/api/account/heir", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const heir = await storage.getAccountHeir(userId);
      res.json(heir || null);
    } catch (error: any) {
      console.error("Error fetching account heir:", error);
      res.status(500).json({ message: "Failed to fetch account heir" });
    }
  });

  // Create or update account heir
  app.post("/api/account/heir", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertAccountHeirSchema.safeParse({
        ...req.body,
        userId,
      });
      
      if (!validatedData.success) {
        return res.status(400).json({ 
          message: "Invalid heir data", 
          errors: validatedData.error.errors 
        });
      }

      const existingHeir = await storage.getAccountHeir(userId);
      
      if (existingHeir) {
        const updated = await storage.updateAccountHeir(existingHeir.id, validatedData.data);
        res.json(updated);
      } else {
        const created = await storage.createAccountHeir(validatedData.data);
        res.status(201).json(created);
      }
    } catch (error: any) {
      console.error("Error saving account heir:", error);
      res.status(500).json({ message: "Failed to save account heir" });
    }
  });

  // Delete account heir
  app.delete("/api/account/heir", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existingHeir = await storage.getAccountHeir(userId);
      
      if (!existingHeir) {
        return res.status(404).json({ message: "No heir designation found" });
      }

      await storage.deleteAccountHeir(existingHeir.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting account heir:", error);
      res.status(500).json({ message: "Failed to delete account heir" });
    }
  });

  // Update user activity (called on various user actions)
  app.post("/api/account/activity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUserActivity(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating user activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  // Admin endpoint: Check for inactive accounts and send reminders / perform transfers
  // In production, this would be called by a cron job
  app.post("/api/admin/check-inactive-accounts", isAuthenticated, async (req: any, res) => {
    try {
      const results = {
        remindersent: 0,
        transferred: 0,
        errors: [] as string[],
      };

      // Get all inactive users (6+ months)
      const inactiveUsers = await storage.getInactiveUsers(6);

      for (const user of inactiveUsers) {
        const heir = await storage.getAccountHeir(user.id);
        if (!heir) continue;

        const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';

        // Check if reminder was already sent
        if (heir.status === "pending" && !user.inactivityReminderSentAt) {
          // Send reminder email (30 days to respond)
          try {
            if (user.email) {
              await sendInactivityReminder(user.email, userName, heir.heirName, 30);
            }
            await storage.updateUserInactivityReminder(user.id);
            await storage.updateAccountHeir(heir.id, { status: "notified", reminderSentAt: new Date() });
            results.remindersent++;
          } catch (emailError: any) {
            results.errors.push(`Failed to send reminder to ${user.email}: ${emailError.message}`);
          }
        } 
        // Check if 30 days passed since reminder - time to transfer
        else if (heir.status === "notified" && heir.reminderSentAt) {
          const daysSinceReminder = Math.floor(
            (Date.now() - new Date(heir.reminderSentAt).getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceReminder >= 30) {
            try {
              // Transfer all trees to heir
              const userTrees = await storage.getTrees(user.id);
              
              // Check if heir has an account, create connection if they do
              let heirUser = await storage.getUserByEmail(heir.heirEmail);
              
              for (const tree of userTrees) {
                if (heirUser) {
                  // Transfer ownership to existing heir user
                  await storage.updateTree(tree.id, { ownerId: heirUser.id });
                } else {
                  // Add heir as co-owner until they create an account
                  await storage.addCollaborator({
                    treeId: tree.id,
                    userId: heir.heirEmail, // Use email as placeholder
                    role: "co_owner",
                    canEdit: true,
                    acceptedAt: new Date(),
                  });
                }
              }

              // Send notification to heir
              await sendAccountTransferNotification(
                heir.heirEmail,
                heir.heirName,
                userName,
                userTrees.length
              );

              // Mark transfer as complete
              await storage.updateAccountHeir(heir.id, { 
                status: "transferred", 
                transferredAt: new Date() 
              });

              results.transferred++;
            } catch (transferError: any) {
              results.errors.push(`Failed to transfer account for ${user.email}: ${transferError.message}`);
            }
          }
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error checking inactive accounts:", error);
      res.status(500).json({ message: "Failed to check inactive accounts" });
    }
  });

  // ============== ADMIN USER MANAGEMENT ROUTES ==============
  
  // List of admin emails - only these users can access admin routes
  const ADMIN_EMAILS = [
    "pawint@me.com",
  ];
  
  // Also allow if the user ID matches known admin IDs
  const ADMIN_USER_IDS = ["52852375"];

  // Admin middleware - checks if user email is in admin list
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Check if user email is in admin list (case-insensitive)
      const userEmail = user.email?.toLowerCase() || "";
      const isAdminUser = ADMIN_EMAILS.some(adminEmail => 
        adminEmail.toLowerCase() === userEmail
      );
      
      const isAdminById = ADMIN_USER_IDS.includes(userId);
      
      if (!isAdminUser && !isAdminById) {
        console.log(`Admin access denied for user: ${userId}, email: ${user.email}`);
        return res.status(403).json({ message: "Admin access required" });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({ message: "Failed to verify admin status" });
    }
  };

  // Check if current user is admin
  app.get("/api/admin/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const isAdminByEmail = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
      const isAdminById = ADMIN_USER_IDS.includes(userId);
      res.json({ isAdmin: isAdminByEmail || isAdminById });
    } catch (error: any) {
      console.error("Error checking admin status:", error);
      res.status(500).json({ isAdmin: false });
    }
  });

  // Get all users (admin only)
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { search } = req.query;
      const users = await storage.getAllUsers(search as string | undefined);
      
      // Get tree count for each user
      const usersWithStats = await Promise.all(users.map(async (user) => {
        const treeCount = await storage.getUserTreeCount(user.id);
        return {
          ...user,
          treeCount,
        };
      }));
      
      res.json(usersWithStats);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get subscription metrics for revenue forecast (admin only)
  app.get("/api/admin/subscription-metrics", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const metrics = await storage.getSubscriptionMetrics();
      res.json(metrics);
    } catch (error: any) {
      console.error("Error fetching subscription metrics:", error);
      res.status(500).json({ message: "Failed to fetch subscription metrics" });
    }
  });

  // Get specific user details (admin only)
  app.get("/api/admin/users/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const trees = await storage.getTrees(userId);
      const treeCount = trees.length;
      const connections = await storage.getUserConnections(userId);
      
      res.json({
        ...user,
        treeCount,
        trees,
        connectionCount: connections.length,
      });
    } catch (error: any) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  // Transfer all data from one user to another (admin only)
  app.post("/api/admin/users/:fromUserId/transfer/:toUserId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { fromUserId, toUserId } = req.params;
      
      const fromUser = await storage.getUser(fromUserId);
      const toUser = await storage.getUser(toUserId);
      
      if (!fromUser) {
        return res.status(404).json({ message: "Source user not found" });
      }
      if (!toUser) {
        return res.status(404).json({ message: "Target user not found" });
      }
      
      await storage.transferUserOwnership(fromUserId, toUserId);
      
      res.json({ 
        message: "Successfully transferred all data",
        fromUser: { id: fromUser.id, email: fromUser.email },
        toUser: { id: toUser.id, email: toUser.email },
      });
    } catch (error: any) {
      console.error("Error transferring user data:", error);
      res.status(500).json({ message: "Failed to transfer user data" });
    }
  });

  // Delete a user (admin only) - only works if user has no trees
  app.delete("/api/admin/users/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete all user's trees first (cascade delete)
      const userTrees = await storage.getTrees(userId);
      for (const tree of userTrees) {
        // Delete all members in the tree
        const members = await storage.getMembers(tree.id);
        for (const member of members) {
          await storage.deleteMember(member.id);
        }
        // Delete the tree
        await storage.deleteTree(tree.id);
      }
      
      // Delete user connections
      await storage.deleteUserConnections(userId);
      
      // Delete connection requests
      await storage.deleteUserConnectionRequests(userId);
      
      // Delete the user
      await storage.deleteUser(userId);
      res.json({ message: "User and all associated data deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin: Update any family member directly
  app.patch("/api/admin/members/:memberId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const member = await storage.getMember(memberId);
      
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const allowedFields = ["firstName", "lastName", "nickname", "email", "gender", "birthDate", "birthPlace", "deathDate", "isLiving", "photoUrl", "notes"];
      const updateData: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if ((field === 'birthDate' || field === 'deathDate') && req.body[field] === '') {
            updateData[field] = null;
          } else {
            updateData[field] = req.body[field];
          }
        }
      }
      
      const updated = await storage.updateMember(memberId, updateData);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating member (admin):", error);
      res.status(500).json({ message: error?.message || "Failed to update member" });
    }
  });

  // Admin: Get all members for a tree
  app.get("/api/admin/trees/:treeId/members", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const members = await storage.getMembers(treeId);
      res.json(members);
    } catch (error: any) {
      console.error("Error getting members (admin):", error);
      res.status(500).json({ message: "Failed to get members" });
    }
  });

  // Admin: Get all user connections
  app.get("/api/admin/connections", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { search } = req.query;
      const connections = await storage.getAllUserConnections(search as string | undefined);
      
      // Enrich with user info
      const enrichedConnections = await Promise.all(
        connections.map(async (conn: any) => {
          const user1 = await storage.getUser(conn.userId1);
          const user2 = await storage.getUser(conn.userId2);
          return {
            ...conn,
            user1: user1 ? {
              id: user1.id,
              email: user1.email,
              firstName: user1.firstName,
              lastName: user1.lastName,
            } : null,
            user2: user2 ? {
              id: user2.id,
              email: user2.email,
              firstName: user2.firstName,
              lastName: user2.lastName,
            } : null,
          };
        })
      );
      
      res.json(enrichedConnections);
    } catch (error: any) {
      console.error("Error fetching connections (admin):", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Admin: Delete a user connection
  app.delete("/api/admin/connections/:connectionId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { connectionId } = req.params;
      await storage.adminDeleteUserConnection(connectionId);
      res.json({ message: "Connection deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting connection (admin):", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  // Get all tree connections (admin only) - for debugging merged view issues
  app.get("/api/admin/tree-connections", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { search } = req.query;
      const connections = await storage.getAllTreeConnections(search as string | undefined);
      res.json(connections);
    } catch (error: any) {
      console.error("Error fetching tree connections (admin):", error);
      res.status(500).json({ message: "Failed to fetch tree connections" });
    }
  });

  // Get account settings including activity info
  app.get("/api/account/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const heir = await storage.getAccountHeir(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        lastActivityAt: user.lastActivityAt,
        inactivityReminderSentAt: user.inactivityReminderSentAt,
        heir: heir || null,
      });
    } catch (error: any) {
      console.error("Error fetching account settings:", error);
      res.status(500).json({ message: "Failed to fetch account settings" });
    }
  });

  // Update user email
  app.patch("/api/account/email", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Check if email is already used by another user
      const existingUser = await storage.getUserByEmail(email.trim());
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: "This email is already in use by another account" });
      }

      // Update the user's email
      await storage.updateUserEmail(userId, email.trim());

      res.json({ success: true, email: email.trim() });
    } catch (error: any) {
      console.error("Error updating email:", error);
      res.status(500).json({ message: "Failed to update email" });
    }
  });

  // ============== MERCHANDISE / PRINTFUL ROUTES ==============
  
  // Get recommended products for merchandise
  app.get("/api/merchandise/products", async (req, res) => {
    try {
      const products = await printfulService.getRecommendedProducts();
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get product variants
  app.get("/api/merchandise/products/:productId/variants", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const variants = await printfulService.getProductVariants(productId);
      res.json(variants);
    } catch (error: any) {
      console.error("Error fetching variants:", error);
      res.status(500).json({ message: "Failed to fetch product variants" });
    }
  });

  // Calculate shipping rates
  app.post("/api/merchandise/shipping", isAuthenticated, async (req: any, res) => {
    try {
      const { address, items } = req.body;
      
      if (!address || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Address and items are required" });
      }
      
      const rates = await printfulService.calculateShipping(address, items);
      res.json(rates);
    } catch (error: any) {
      console.error("Error calculating shipping:", error);
      res.status(500).json({ message: "Failed to calculate shipping" });
    }
  });

  app.get("/api/qr-image", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ message: "URL parameter required" });
      const QRCode = await import("qrcode");
      const pngBuffer = await QRCode.default.toBuffer(url, {
        type: "png",
        width: 300,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      res.set("Content-Type", "image/png");
      res.send(pngBuffer);
    } catch (error) {
      console.error("Error generating QR image:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Create merchandise order (with Stripe payment)
  app.post("/api/merchandise/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        treeId, productId, variantId, productName, variantName,
        quantity, treeImageUrl, shippingAddress, includeTree, includeQR,
        treePlacement, qrPlacement,
        includeCustomImage, customImageUrl, customImagePlacement,
        includeCustomText, customText, customTextPlacement
      } = req.body;

      // Validate required fields
      if (!productId || !variantId || !productName) {
        return res.status(400).json({ message: "Missing required order fields" });
      }

      // Must include at least one print element
      if (!includeTree && !includeQR && !includeCustomImage && !includeCustomText) {
        return res.status(400).json({ message: "Please include at least one element on your product" });
      }

      // SECURITY: Validate tree ownership/access (only if tree is included)
      if (treeId) {
        const tree = await storage.getTree(treeId);
        if (!tree) {
          return res.status(404).json({ message: "Family tree not found" });
        }
        
        const isOwner = tree.ownerId === userId;
        const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!isOwner && !collaborator) {
          return res.status(403).json({ message: "You don't have access to this family tree" });
        }
      }

      // Validate shipping address
      if (!shippingAddress) {
        return res.status(400).json({ message: "Shipping address is required" });
      }

      // Validate shipping address format
      const { shippingAddressSchema } = await import("@shared/schema");
      const addressValidation = shippingAddressSchema.safeParse(shippingAddress);
      if (!addressValidation.success) {
        return res.status(400).json({ 
          message: "Invalid shipping address", 
          errors: addressValidation.error.errors 
        });
      }

      const orderQuantity = quantity || 1;

      // SERVER-SIDE PRICE VALIDATION: Get variant price from Printful API
      const variantPrice = await printfulService.getVariantPrice(productId, variantId);
      if (variantPrice === null) {
        return res.status(400).json({ message: "Invalid product variant or unable to fetch price" });
      }

      // Fetch actual product and variant names from Printful (don't trust frontend)
      const printfulProduct = await printfulService.getProduct(productId);
      const printfulVariant = await printfulService.getVariant(productId, variantId);
      const verifiedProductName = printfulProduct 
        ? [printfulProduct.brand, printfulProduct.model].filter(Boolean).join(' ') || printfulProduct.type_name || productName
        : productName;
      const verifiedVariantName = printfulVariant?.name || variantName;

      // Calculate subtotal from verified Printful price
      const subtotal = variantPrice * orderQuantity;

      // Get shipping cost from Printful (use standard shipping)
      const printfulAddress = {
        name: shippingAddress.name,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state_code: shippingAddress.stateCode,
        country_code: shippingAddress.countryCode,
        zip: shippingAddress.zip,
      };

      const shippingRates = await printfulService.calculateShipping(
        printfulAddress,
        [{ variant_id: variantId, quantity: orderQuantity }]
      );

      // Use MINIMUM (cheapest) available shipping rate for deterministic pricing
      // Sort rates by cost and pick the cheapest to prevent manipulation
      let shippingCost = 599; // Default $5.99 if no rates available
      if (shippingRates.length > 0) {
        const sortedRates = [...shippingRates].sort((a, b) => 
          parseFloat(a.rate) - parseFloat(b.rate)
        );
        shippingCost = Math.round(parseFloat(sortedRates[0].rate) * 100);
      }

      // Calculate commission (10% markup on subtotal)
      const commission = Math.round(subtotal * 0.10);

      // Calculate total: subtotal + shipping + commission
      const totalAmount = subtotal + shippingCost + commission;

      const qrProfileUrl = includeQR ? `${req.protocol}://${req.get('host')}/profile/${userId}` : null;
      const finalTreeImageUrl = treeImageUrl 
        ? (includeQR ? `${treeImageUrl}?includeQR=true&qrUrl=${encodeURIComponent(qrProfileUrl || '')}` : treeImageUrl)
        : null;

      const placementConfig: Record<string, any> = {
        treePlacement: treePlacement || 'default',
        qrPlacement: includeQR ? (qrPlacement || null) : null,
        qrProfileUrl,
      };

      if (includeCustomImage && customImageUrl) {
        placementConfig.customImageUrl = customImageUrl;
        placementConfig.customImagePlacement = customImagePlacement || 'front';
      }

      if (includeCustomText && customText) {
        placementConfig.customText = customText;
        placementConfig.customTextPlacement = customTextPlacement || 'front';
      }

      const order = await storage.createMerchandiseOrder({
        userId,
        treeId: treeId || null,
        productId,
        variantId,
        productName: verifiedProductName,
        variantName: verifiedVariantName || variantName || null,
        quantity: orderQuantity,
        treeImageUrl: finalTreeImageUrl || '',
        subtotal,
        shippingCost,
        totalAmount,
        commission,
        shippingAddress: addressValidation.data,
        placementConfig,
        status: "pending",
      });

      res.status(201).json(order);
    } catch (error: any) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  // Get user's merchandise orders
  app.get("/api/merchandise/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getMerchandiseOrders(userId);
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get single order
  app.get("/api/merchandise/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const order = await storage.getMerchandiseOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(order);
    } catch (error: any) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Submit order to Printful after payment
  app.post("/api/merchandise/orders/:id/submit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const order = await storage.getMerchandiseOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (order.status !== "paid") {
        return res.status(400).json({ message: "Order must be paid before submission" });
      }

      const { shippingAddress } = req.body;
      if (!shippingAddress) {
        return res.status(400).json({ message: "Shipping address is required" });
      }

      // Build Printful files array based on placement configuration
      const placement = order.placementConfig as { treePlacement?: string; qrPlacement?: string | null; qrProfileUrl?: string | null } | null;
      const printfulFiles: Array<{ type: string; url: string }> = [{
        type: placement?.treePlacement || "default",
        url: order.treeImageUrl,
      }];

      if (placement?.qrPlacement && placement?.qrProfileUrl) {
        printfulFiles.push({
          type: placement.qrPlacement,
          url: `${req.protocol}://${req.get('host')}/api/qr-image?url=${encodeURIComponent(placement.qrProfileUrl)}`,
        });
      }

      // Create order in Printful
      const printfulOrder = await printfulService.createOrder(
        shippingAddress,
        [{
          variant_id: order.variantId,
          quantity: order.quantity,
          files: printfulFiles,
        }],
        true // confirm the order
      );

      if (!printfulOrder) {
        return res.status(500).json({ message: "Failed to submit order to Printful" });
      }

      // Update order with Printful details
      const updated = await storage.updateMerchandiseOrder(order.id, {
        printfulOrderId: printfulOrder.orderId.toString(),
        status: "submitted",
        shippingAddress,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error submitting order:", error);
      res.status(500).json({ message: "Failed to submit order" });
    }
  });

  // Test Printful connection
  app.get("/api/merchandise/test-connection", isAuthenticated, async (req, res) => {
    try {
      const connected = await printfulService.testConnection();
      res.json({ connected });
    } catch (error: any) {
      console.error("Error testing Printful connection:", error);
      res.status(500).json({ connected: false, error: error.message });
    }
  });

  // Printful webhook for order status updates (shipping, delivered, etc.)
  app.post("/api/webhooks/printful", async (req, res) => {
    try {
      const { type, data } = req.body;
      console.log(`Printful webhook received: ${type}`);

      if (type === "package_shipped" && data?.shipment) {
        const printfulOrderId = String(data.order?.id || data.shipment?.order_id);
        if (!printfulOrderId || printfulOrderId === "undefined") {
          return res.json({ success: true });
        }

        const allOrders = await storage.getMerchandiseOrderByPrintfulId(printfulOrderId);
        if (!allOrders) {
          console.log(`No matching order found for Printful order ${printfulOrderId}`);
          return res.json({ success: true });
        }

        // Only process if order is in expected state (submitted or paid)
        if (!["submitted", "paid"].includes(allOrders.status)) {
          console.log(`Order ${allOrders.id} already in status ${allOrders.status}, skipping webhook`);
          return res.json({ success: true });
        }

        const trackingNumber = data.shipment.tracking_number || null;
        const trackingUrl = data.shipment.tracking_url || null;
        const carrier = data.shipment.carrier || '';

        await storage.updateMerchandiseOrder(allOrders.id, {
          status: "shipped",
          trackingNumber,
          trackingUrl,
        });

        // Send shipping notification email with tracking info
        try {
          const orderUser = await storage.getUser(allOrders.userId);
          if (orderUser?.email) {
            const { sendEmail } = await import("./lib/email");
            const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
            const shippingHtml = `
              <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Your Order Has Shipped!</h1>
                  <p style="color: #d1fae5; margin: 8px 0 0; font-size: 14px;">Your FamilyRoots merchandise is on its way</p>
                </div>
                <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                  <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">Hi ${orderUser.firstName || 'there'},</p>
                  <p style="margin: 0 0 20px; color: #374151; font-size: 14px;">Great news! Your <strong>${allOrders.productName}</strong> order has been shipped${carrier ? ` via ${carrier}` : ''}.</p>

                  ${trackingNumber ? `
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #166534; font-size: 13px; font-weight: 500;">Tracking Number</p>
                    <p style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 600; letter-spacing: 1px;">${trackingNumber}</p>
                    ${trackingUrl ? `<a href="${trackingUrl}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 500; font-size: 14px;">Track Your Package</a>` : ''}
                  </div>` : ''}

                  <div style="text-align: center; margin: 24px 0 16px;">
                    <a href="${baseUrl}/merchandise?tab=orders" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px;">View My Orders</a>
                  </div>
                </div>
                <div style="padding: 16px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">FamilyRoots - Preserving Your Family Legacy</p>
                </div>
              </div>
            `;
            await sendEmail(orderUser.email, `Your Order Has Shipped - ${allOrders.productName} #${allOrders.id.slice(0, 8).toUpperCase()}`, shippingHtml);
            console.log(`Shipping notification sent to ${orderUser.email} for order ${allOrders.id}`);
          }
        } catch (emailError) {
          console.error("Failed to send shipping email:", emailError);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Printful webhook error:", error);
      res.status(200).json({ success: true }); // Always return 200 to Printful
    }
  });

  // Create checkout session for merchandise order
  app.post("/api/merchandise/orders/:id/checkout", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not available" });
      }

      const userId = req.user.claims.sub;
      const order = await storage.getMerchandiseOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (order.status !== "pending") {
        return res.status(400).json({ message: "Order is not in pending state" });
      }

      const user = await storage.getUser(userId);
      let customerId = user?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user?.email || `user-${userId}@familyroots.family`,
          userId
        );
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      // Create a checkout session for one-time payment
      const displayName = order.variantName || order.productName;
      const session = await stripeService.createMerchandiseCheckoutSession(
        customerId,
        displayName,
        `Custom ${displayName} with your family tree`,
        order.totalAmount,
        order.quantity,
        `${baseUrl}/merchandise?checkout=success&order=${order.id}`,
        `${baseUrl}/merchandise?checkout=cancel`,
        { orderId: order.id, type: 'merchandise' }
      );

      // Update order with Stripe session ID
      await storage.updateMerchandiseOrder(order.id, {
        stripePaymentIntentId: session.id,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating merchandise checkout:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Handle successful merchandise payment (called after Stripe redirect)
  app.post("/api/merchandise/orders/:id/confirm-payment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const order = await storage.getMerchandiseOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Prevent duplicate submissions - only process if order is pending
      if (order.status !== 'pending') {
        // Order already processed - return current status
        return res.json({ success: true, status: order.status, message: "Order already processed" });
      }

      // Verify payment with Stripe
      if (order.stripePaymentIntentId) {
        try {
          const session = await stripeService.retrieveCheckoutSession(order.stripePaymentIntentId);
          if (session.payment_status === 'paid') {
            // Mark as paid first to prevent race conditions
            await storage.updateMerchandiseOrder(order.id, { status: "paid" });

            // AUTO-SUBMIT TO PRINTFUL after successful payment
            if (order.shippingAddress) {
              const shippingAddr = order.shippingAddress as any;
              const printfulAddress = {
                name: shippingAddr.name,
                address1: shippingAddr.address1,
                address2: shippingAddr.address2 || '',
                city: shippingAddr.city,
                state_code: shippingAddr.stateCode,
                country_code: shippingAddr.countryCode,
                zip: shippingAddr.zip,
                email: shippingAddr.email,
                phone: shippingAddr.phone,
              };

              const printfulResult = await printfulService.createOrder(
                printfulAddress,
                [{
                  variant_id: order.variantId,
                  quantity: order.quantity,
                  files: [{
                    type: 'default',
                    url: order.treeImageUrl,
                  }],
                }],
                true // confirm order immediately
              );

              if (printfulResult) {
                await storage.updateMerchandiseOrder(order.id, {
                  status: "submitted",
                  printfulOrderId: String(printfulResult.orderId),
                });

                // Send order confirmation email
                try {
                  const orderUser = await storage.getUser(userId);
                  if (orderUser?.email) {
                    const { sendEmail } = await import("./lib/email");
                    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
                    const shippingAddr = order.shippingAddress as any;
                    const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    const subtotalDisplay = ((order.subtotal || 0) / 100).toFixed(2);
                    const shippingDisplay = ((order.shippingCost || 0) / 100).toFixed(2);
                    const totalDisplay = ((order.totalAmount || 0) / 100).toFixed(2);

                    const confirmationHtml = `
                      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Order Confirmed!</h1>
                          <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Thank you for your FamilyRoots merchandise order</p>
                        </div>
                        <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                          <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">Hi ${orderUser.firstName || 'there'},</p>
                          <p style="margin: 0 0 20px; color: #374151; font-size: 14px;">Your order has been placed successfully and is being prepared. Here are your order details:</p>

                          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                            <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Order Summary</h3>
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                              <tr><td style="padding: 4px 0; color: #6b7280;">Order ID</td><td style="padding: 4px 0; text-align: right; color: #111827; font-weight: 500;">${order.id.slice(0, 8).toUpperCase()}</td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Date</td><td style="padding: 4px 0; text-align: right; color: #111827;">${orderDate}</td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Item</td><td style="padding: 4px 0; text-align: right; color: #111827;">${order.productName}${order.variantName ? ` - ${order.variantName}` : ''}</td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Quantity</td><td style="padding: 4px 0; text-align: right; color: #111827;">${order.quantity}</td></tr>
                              <tr><td colspan="2" style="padding: 8px 0 4px;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Subtotal</td><td style="padding: 4px 0; text-align: right; color: #111827;">$${subtotalDisplay}</td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Shipping</td><td style="padding: 4px 0; text-align: right; color: #111827;">$${shippingDisplay}</td></tr>
                              <tr><td colspan="2" style="padding: 8px 0 4px;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
                              <tr><td style="padding: 4px 0; color: #111827; font-weight: 600;">Total</td><td style="padding: 4px 0; text-align: right; color: #111827; font-weight: 600;">$${totalDisplay}</td></tr>
                            </table>
                          </div>

                          ${shippingAddr ? `
                          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                            <h3 style="margin: 0 0 8px; color: #111827; font-size: 16px;">Shipping To</h3>
                            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                              ${shippingAddr.name || ''}<br>
                              ${shippingAddr.address1 || ''}${shippingAddr.address2 ? '<br>' + shippingAddr.address2 : ''}<br>
                              ${shippingAddr.city || ''}, ${shippingAddr.stateCode || ''} ${shippingAddr.zip || ''}<br>
                              ${shippingAddr.countryCode || ''}
                            </p>
                          </div>` : ''}

                          <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">You'll receive another email with tracking information once your order ships.</p>

                          <div style="text-align: center; margin: 24px 0 16px;">
                            <a href="${baseUrl}/merchandise?tab=orders" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px;">View My Orders</a>
                          </div>
                        </div>
                        <div style="padding: 16px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                          <p style="margin: 0; color: #9ca3af; font-size: 12px;">FamilyRoots - Preserving Your Family Legacy</p>
                        </div>
                      </div>
                    `;

                    await sendEmail(orderUser.email, `Order Confirmed - ${order.productName} #${order.id.slice(0, 8).toUpperCase()}`, confirmationHtml);
                    console.log(`Order confirmation email sent to ${orderUser.email} for order ${order.id}`);
                  }
                } catch (emailError) {
                  console.error("Failed to send order confirmation email:", emailError);
                }

                return res.json({ success: true, status: "submitted", printfulOrderId: printfulResult.orderId });
              } else {
                console.error("Failed to submit order to Printful, keeping as paid");

                // Still send confirmation email even if Printful submission fails
                try {
                  const orderUser = await storage.getUser(userId);
                  if (orderUser?.email) {
                    const { sendEmail } = await import("./lib/email");
                    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
                    const shippingAddr = order.shippingAddress as any;
                    const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    const subtotalDisplay = ((order.subtotal || 0) / 100).toFixed(2);
                    const shippingDisplay = ((order.shippingCost || 0) / 100).toFixed(2);
                    const totalDisplay = ((order.totalAmount || 0) / 100).toFixed(2);

                    const confirmationHtml = `
                      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Payment Received!</h1>
                          <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Your FamilyRoots merchandise order is being processed</p>
                        </div>
                        <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                          <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">Hi ${orderUser.firstName || 'there'},</p>
                          <p style="margin: 0 0 20px; color: #374151; font-size: 14px;">We received your payment and your order is being processed. Here are your order details:</p>

                          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                            <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Order Summary</h3>
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                              <tr><td style="padding: 4px 0; color: #6b7280;">Order ID</td><td style="padding: 4px 0; text-align: right; color: #111827; font-weight: 500;">${order.id.slice(0, 8).toUpperCase()}</td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Date</td><td style="padding: 4px 0; text-align: right; color: #111827;">${orderDate}</td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Item</td><td style="padding: 4px 0; text-align: right; color: #111827;">${order.productName}${order.variantName ? ` - ${order.variantName}` : ''}</td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Quantity</td><td style="padding: 4px 0; text-align: right; color: #111827;">${order.quantity}</td></tr>
                              <tr><td colspan="2" style="padding: 8px 0 4px;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Subtotal</td><td style="padding: 4px 0; text-align: right; color: #111827;">$${subtotalDisplay}</td></tr>
                              <tr><td style="padding: 4px 0; color: #6b7280;">Shipping</td><td style="padding: 4px 0; text-align: right; color: #111827;">$${shippingDisplay}</td></tr>
                              <tr><td colspan="2" style="padding: 8px 0 4px;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
                              <tr><td style="padding: 4px 0; color: #111827; font-weight: 600;">Total</td><td style="padding: 4px 0; text-align: right; color: #111827; font-weight: 600;">$${totalDisplay}</td></tr>
                            </table>
                          </div>

                          ${shippingAddr ? `
                          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                            <h3 style="margin: 0 0 8px; color: #111827; font-size: 16px;">Shipping To</h3>
                            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                              ${shippingAddr.name || ''}<br>
                              ${shippingAddr.address1 || ''}${shippingAddr.address2 ? '<br>' + shippingAddr.address2 : ''}<br>
                              ${shippingAddr.city || ''}, ${shippingAddr.stateCode || ''} ${shippingAddr.zip || ''}<br>
                              ${shippingAddr.countryCode || ''}
                            </p>
                          </div>` : ''}

                          <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">You'll receive another email with tracking information once your order ships.</p>

                          <div style="text-align: center; margin: 24px 0 16px;">
                            <a href="${baseUrl}/merchandise?tab=orders" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px;">View My Orders</a>
                          </div>
                        </div>
                        <div style="padding: 16px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                          <p style="margin: 0; color: #9ca3af; font-size: 12px;">FamilyRoots - Preserving Your Family Legacy</p>
                        </div>
                      </div>
                    `;
                    await sendEmail(orderUser.email, `Payment Received - ${order.productName} #${order.id.slice(0, 8).toUpperCase()}`, confirmationHtml);
                  }
                } catch (emailError) {
                  console.error("Failed to send payment confirmation email:", emailError);
                }

                return res.json({ success: true, status: "paid", printfulError: true });
              }
            }

            return res.json({ success: true, status: "paid" });
          }
        } catch (e) {
          console.error("Error verifying payment:", e);
        }
      }

      res.json({ success: false, status: order.status });
    } catch (error: any) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // ==================== SPECIAL CONNECTIONS ROUTES ====================

  // Get special connections for a member
  app.get("/api/members/:memberId/connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;

      // Verify user has access to view this member's connections
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if user can access this tree
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
      const hasAccess = isOwner || !!collaborator;

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const connections = await storage.getSpecialConnectionsByMember(memberId);
      
      // Enrich with member details
      const enrichedConnections = await Promise.all(
        connections.map(async (conn) => {
          const fromMember = await storage.getMember(conn.fromMemberId);
          const toMember = await storage.getMember(conn.toMemberId);
          return {
            ...conn,
            fromMember: fromMember ? { id: fromMember.id, firstName: fromMember.firstName, lastName: fromMember.lastName, photoUrl: fromMember.photoUrl } : null,
            toMember: toMember ? { id: toMember.id, firstName: toMember.firstName, lastName: toMember.lastName, photoUrl: toMember.photoUrl } : null,
          };
        })
      );
      
      res.json(enrichedConnections);
    } catch (error) {
      console.error("Error fetching special connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Get special connections for a tree
  app.get("/api/trees/:treeId/connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;

      // Verify user has access to this tree
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
      const hasAccess = isOwner || !!collaborator;

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const connections = await storage.getSpecialConnectionsByTree(treeId);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching tree connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Create a special connection directly (for tree owners/editors)
  app.post("/api/connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const parseResult = createSpecialConnectionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request data", errors: parseResult.error.errors });
      }
      const { fromMemberId, fromTreeId, toMemberId, toTreeId, connectionType, customLabel, notes } = parseResult.data;

      // Verify user has permission to create connection (must own or edit fromTree)
      const fromTree = await storage.getTree(fromTreeId);
      if (!fromTree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const collaborator = await storage.getCollaboratorByUserAndTree(userId, fromTreeId);
      const canEdit = fromTree.ownerId === userId || collaborator?.canEdit;

      if (!canEdit) {
        return res.status(403).json({ message: "You don't have permission to create connections" });
      }

      // Verify fromMember exists and belongs to fromTree
      const fromMember = await storage.getMember(fromMemberId);
      if (!fromMember || fromMember.treeId !== fromTreeId) {
        return res.status(400).json({ message: "Invalid from member" });
      }

      // Verify toMember exists
      const toMember = await storage.getMember(toMemberId);
      if (!toMember) {
        return res.status(400).json({ message: "Invalid to member" });
      }

      const connection = await storage.createSpecialConnection({
        fromMemberId,
        fromTreeId,
        toMemberId,
        toTreeId: toMember.treeId, // Use actual treeId from member
        connectionType,
        customLabel,
        notes,
        isReciprocal: true,
        createdBy: userId,
      });

      res.json(connection);
    } catch (error: any) {
      console.error("Error creating connection:", error);
      res.status(500).json({ message: error?.message || "Failed to create connection" });
    }
  });

  // Delete a special connection
  app.delete("/api/connections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const connection = await storage.getSpecialConnection(id);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      // Verify user has permission (must own or edit fromTree)
      const fromTree = await storage.getTree(connection.fromTreeId);
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, connection.fromTreeId);
      const canEdit = fromTree?.ownerId === userId || collaborator?.canEdit;

      if (!canEdit) {
        return res.status(403).json({ message: "You don't have permission to delete this connection" });
      }

      await storage.deleteSpecialConnection(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  // ==================== PUBLIC PROFILE ROUTES ====================

  app.get("/api/users/:userId/trees/public", async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const trees = await storage.getTrees(userId);
      const publicTrees = trees
        .filter(t => !t.deletedAt)
        .map(t => ({ id: t.id, name: t.name, treeType: t.treeType }));
      res.json(publicTrees);
    } catch (error) {
      console.error("Error fetching user public trees:", error);
      res.status(500).json({ message: "Failed to fetch trees" });
    }
  });

  // Get public profile data for a user (for QR code scanning)
  // Note: This endpoint intentionally exposes limited public info for discovery purposes
  // Only basic profile info is shared - no sensitive data like email, subscription details, etc.
  app.get("/api/users/:userId/public", async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Get user basic info
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get tree count for this user (only count, not tree details)
      const trees = await storage.getTrees(userId);
      const treeCount = trees.length;

      // Return only public-safe information
      // Excludes: email, stripeCustomerId, subscriptionTier, notificationPreferences, etc.
      res.json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        memberSince: user.createdAt,
        treeCount,
        totalMembers: user.totalMemberCount || 0,
      });
    } catch (error) {
      console.error("Error fetching public profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // ==================== TREE CONNECT INFO (public endpoint for connection invite pages) ====================

  app.get("/api/trees/:treeId/connect-info", async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const tree = await storage.getTree(treeId);
      if (!tree || tree.deletedAt) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const owner = await storage.getUser(tree.ownerId);
      const ownerProfiles = await storage.getAllClaimedProfilesForUser(tree.ownerId);
      const primaryProfile = ownerProfiles[0];

      res.json({
        treeId: tree.id,
        treeName: tree.name,
        treeType: tree.treeType || "family",
        ownerId: tree.ownerId,
        ownerFirstName: owner?.firstName || primaryProfile?.firstName || "Unknown",
        ownerLastName: owner?.lastName || primaryProfile?.lastName || "",
        ownerPhoto: owner?.profileImageUrl || primaryProfile?.photoUrl || null,
      });
    } catch (error) {
      console.error("Error fetching tree connect info:", error);
      res.status(500).json({ message: "Failed to fetch tree info" });
    }
  });

  // ==================== USER-TO-USER CONNECTION REQUESTS (QR Code) ====================

  // Send a user-to-user connection request (from scanned QR code)
  // Valid relationship types for user connections
  const VALID_RELATIONSHIP_TYPES = [
    "son", "daughter", "parent", "spouse", "sibling", 
    "grandparent", "grandchild", "aunt", "uncle", "niece", "nephew",
    "cousin", "in_law", "step_relative", "other",
    "child", "coparent", "unknown",
    "pastor", "elder", "worship_leader", "ministry_leader", "teacher", "member",
    "ministry_member", "student", "volunteer", "mentor", "mentee", "prayer_partner", "friend",
    "coach", "assistant_coach", "captain", "trainer", "manager", "player", "teammate", "alumni",
    "best_friend", "rival", "training_partner",
    "chapter_president", "advisor", "officer", "big", "little", "pledge_class", "active",
    "study_partner", "roommate",
    "close_friend", "neighbor", "acquaintance", "travel_buddy",
    "supervisor", "direct_report", "colleague", "intern", "client", "partner",
    "leader", "co_leader", "connected"
  ] as const;

  // Now properly stores the request with relationship type
  app.post("/api/user-connection-requests", isAuthenticated, async (req: any, res) => {
    try {
      const fromUserId = req.user.claims.sub;
      const { targetUserId, relationshipType, customLabel, message, targetTreeId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }

      if (!relationshipType) {
        return res.status(400).json({ message: "Relationship type is required" });
      }

      // Validate relationship type is one of the allowed values
      if (!VALID_RELATIONSHIP_TYPES.includes(relationshipType)) {
        return res.status(400).json({ message: "Invalid relationship type" });
      }

      // Validate custom label and message length
      if (customLabel && customLabel.length > 100) {
        return res.status(400).json({ message: "Custom label must be 100 characters or less" });
      }
      if (message && message.length > 500) {
        return res.status(400).json({ message: "Message must be 500 characters or less" });
      }

      if (fromUserId === targetUserId) {
        return res.status(400).json({ message: "Cannot send connection request to yourself" });
      }

      // Check if target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if already connected
      const existingConnection = await storage.getExistingUserConnection(fromUserId, targetUserId);
      if (existingConnection) {
        return res.status(400).json({ message: "You are already connected with this user" });
      }

      // Check if there's already a pending request
      const existingRequest = await storage.getExistingUserConnectionRequest(fromUserId, targetUserId);
      if (existingRequest) {
        return res.status(400).json({ message: "You already have a pending connection request with this user" });
      }

      // Check if the other person has sent a request to this user
      const reverseRequest = await storage.getExistingUserConnectionRequest(targetUserId, fromUserId);
      if (reverseRequest) {
        return res.status(400).json({ message: "This user has already sent you a connection request. Check your pending requests." });
      }

      // Resolve target tree info if provided
      let resolvedTreeId: string | null = null;
      let resolvedTreeName: string | null = null;
      if (targetTreeId) {
        const targetTree = await storage.getTree(targetTreeId);
        if (targetTree) {
          resolvedTreeId = targetTree.id;
          resolvedTreeName = targetTree.name;
        }
      }

      // Create the connection request
      const request = await storage.createUserConnectionRequest({
        fromUserId,
        toUserId: targetUserId,
        relationshipType,
        customLabel: relationshipType === "other" ? customLabel : null,
        message,
        sourceType: "qr_scan",
        targetTreeId: resolvedTreeId,
        targetTreeName: resolvedTreeName,
      });

      const fromUser = await storage.getUser(fromUserId);

      console.log(`[User Connection Request] From: ${fromUser?.firstName} ${fromUser?.lastName} (${fromUserId}) -> To: ${targetUser.firstName} ${targetUser.lastName} (${targetUserId}) as "${relationshipType}" for tree: ${resolvedTreeName || 'none specified'}`);

      res.json({ 
        success: true, 
        request,
        message: `Connection request sent to ${targetUser.firstName}! They will be notified to approve your connection.`,
      });
    } catch (error) {
      console.error("Error sending user connection request:", error);
      res.status(500).json({ message: "Failed to send connection request" });
    }
  });

  // Get pending connection requests for the current user (requests they need to respond to)
  app.get("/api/user-connection-requests/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getPendingUserConnectionRequestsForUser(userId);

      // Enrich with user info, claimed member profiles, and tree type
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const fromUser = await storage.getUser(request.fromUserId);
          const claimedProfiles = await storage.getAllClaimedProfilesForUser(request.fromUserId);
          const primaryProfile = claimedProfiles[0];
          const displayFirstName = fromUser?.firstName || primaryProfile?.firstName || null;
          const displayLastName = fromUser?.lastName || primaryProfile?.lastName || null;
          const displayPhoto = fromUser?.profileImageUrl || primaryProfile?.photoUrl || null;

          let targetTreeType: string | null = null;
          if (request.targetTreeId) {
            const targetTree = await storage.getTree(request.targetTreeId);
            targetTreeType = targetTree?.treeType || null;
          }

          return {
            ...request,
            targetTreeType,
            fromUser: {
              id: request.fromUserId,
              firstName: displayFirstName,
              lastName: displayLastName,
              profileImageUrl: displayPhoto,
            },
          };
        })
      );

      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching pending connection requests:", error);
      res.status(500).json({ message: "Failed to fetch pending requests" });
    }
  });

  // Get sent connection requests for the current user
  app.get("/api/user-connection-requests/sent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getSentUserConnectionRequests(userId);

      // Enrich with user info and claimed member profiles
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const toUser = await storage.getUser(request.toUserId);
          const claimedProfiles = await storage.getAllClaimedProfilesForUser(request.toUserId);
          const primaryProfile = claimedProfiles[0];
          const displayFirstName = toUser?.firstName || primaryProfile?.firstName || null;
          const displayLastName = toUser?.lastName || primaryProfile?.lastName || null;
          const displayPhoto = toUser?.profileImageUrl || primaryProfile?.photoUrl || null;

          return {
            ...request,
            toUser: {
              id: request.toUserId,
              firstName: displayFirstName,
              lastName: displayLastName,
              profileImageUrl: displayPhoto,
            },
          };
        })
      );

      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching sent connection requests:", error);
      res.status(500).json({ message: "Failed to fetch sent requests" });
    }
  });

  // Cancel an outgoing user connection request
  app.post("/api/user-connection-requests/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const request = await storage.getUserConnectionRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Connection request not found" });
      }

      if (request.fromUserId !== userId) {
        return res.status(403).json({ message: "You can only cancel requests you sent" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "This request has already been responded to" });
      }

      const updated = await storage.cancelUserConnectionRequest(id);
      res.json({ message: "Connection request cancelled", request: updated });
    } catch (error) {
      console.error("Error cancelling connection request:", error);
      res.status(500).json({ message: "Failed to cancel connection request" });
    }
  });

  // Approve a user connection request with approver's relationship selection
  app.post("/api/user-connection-requests/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { relationshipType: approverRelationshipType, customLabel: approverCustomLabel } = req.body;

      const request = await storage.getUserConnectionRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Connection request not found" });
      }

      if (request.toUserId !== userId) {
        return res.status(403).json({ message: "You can only approve requests sent to you" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "This request has already been responded to" });
      }

      // Validate approver's relationship type if provided
      if (approverRelationshipType && !VALID_RELATIONSHIP_TYPES.includes(approverRelationshipType)) {
        return res.status(400).json({ message: "Invalid relationship type" });
      }
      if (approverCustomLabel && approverCustomLabel.length > 100) {
        return res.status(400).json({ message: "Custom label must be 100 characters or less" });
      }

      // Approve the request with the approver's relationship perspective
      const approved = await storage.approveUserConnectionRequest(id, approverRelationshipType, approverCustomLabel);

      // Create the connection record (store users in consistent order for easier querying)
      const [userId1, userId2] = [request.fromUserId, request.toUserId].sort();
      
      // Determine relationship perspectives - each user has their own view
      const isUser1Requester = userId1 === request.fromUserId;
      
      // Requester's perspective is stored from original request
      // Approver's perspective is from the approval body (defaults to null if not provided)
      const requesterRelationship = request.relationshipType;
      const requesterCustomLabel = request.customLabel;
      
      await storage.createUserConnection({
        userId1,
        userId2,
        // Set each user's relationship perspective based on who is user1 vs user2
        relationshipFromUser1: isUser1Requester ? requesterRelationship : approverRelationshipType,
        customLabelFromUser1: isUser1Requester ? requesterCustomLabel : approverCustomLabel,
        relationshipFromUser2: isUser1Requester ? approverRelationshipType : requesterRelationship,
        customLabelFromUser2: isUser1Requester ? approverCustomLabel : requesterCustomLabel,
        sourceRequestId: request.id,
      });

      const fromUser = await storage.getUser(request.fromUserId);
      const toUser = await storage.getUser(request.toUserId);

      // === AUTO-CONNECT TREES AND ADD FAMILY MEMBERS ===
      // Use the target tree from the request if specified, otherwise fall back to first tree
      const fromUserTrees = await storage.getTrees(request.fromUserId);
      const toUserTrees = await storage.getTrees(request.toUserId);
      
      if (fromUserTrees.length > 0 && toUserTrees.length > 0) {
        const fromTree = fromUserTrees[0];
        const toTree = request.targetTreeId 
          ? (toUserTrees.find(t => t.id === request.targetTreeId) || toUserTrees[0])
          : toUserTrees[0];
        
        // Check if trees are already connected
        const existingConnections = await storage.getTreeConnections(fromTree.id);
        const alreadyConnected = existingConnections.some(
          c => (c.tree1Id === fromTree.id && c.tree2Id === toTree.id) ||
               (c.tree1Id === toTree.id && c.tree2Id === fromTree.id)
        );
        
        if (!alreadyConnected) {
          // Find or create member for fromUser in toTree
          const toTreeMembers = await storage.getMembers(toTree.id);
          let fromUserMemberInToTree = toTreeMembers.find(m => m.claimedByUserId === request.fromUserId);
          
          if (!fromUserMemberInToTree) {
            // Look for unclaimed member with matching name to claim instead of creating duplicate
            const matchingUnclaimed = toTreeMembers.find(m => 
              !m.claimedByUserId && 
              m.firstName?.toLowerCase() === fromUser?.firstName?.toLowerCase() &&
              m.lastName?.toLowerCase() === fromUser?.lastName?.toLowerCase()
            );
            
            if (matchingUnclaimed) {
              // Claim the existing member instead of creating a new one
              fromUserMemberInToTree = await storage.updateMember(matchingUnclaimed.id, {
                claimedByUserId: request.fromUserId,
                claimedAt: new Date(),
                photoUrl: fromUser?.profileImageUrl || matchingUnclaimed.photoUrl,
              });
            } else {
              // Create a member for the requester in the approver's tree
              fromUserMemberInToTree = await storage.createMember({
                treeId: toTree.id,
                firstName: fromUser?.firstName || 'Unknown',
                lastName: fromUser?.lastName || '',
                photoUrl: fromUser?.profileImageUrl || null,
                email: null,
                claimedByUserId: request.fromUserId,
                claimedAt: new Date(),
              });
            }
          }
          
          // Find or create member for toUser in fromTree
          const fromTreeMembers = await storage.getMembers(fromTree.id);
          let toUserMemberInFromTree = fromTreeMembers.find(m => m.claimedByUserId === request.toUserId);
          
          if (!toUserMemberInFromTree) {
            // Look for unclaimed member with matching name to claim instead of creating duplicate
            const matchingUnclaimed = fromTreeMembers.find(m => 
              !m.claimedByUserId && 
              m.firstName?.toLowerCase() === toUser?.firstName?.toLowerCase() &&
              m.lastName?.toLowerCase() === toUser?.lastName?.toLowerCase()
            );
            
            if (matchingUnclaimed) {
              // Claim the existing member instead of creating a new one
              toUserMemberInFromTree = await storage.updateMember(matchingUnclaimed.id, {
                claimedByUserId: request.toUserId,
                claimedAt: new Date(),
                photoUrl: toUser?.profileImageUrl || matchingUnclaimed.photoUrl,
              });
            } else {
              // Create a member for the approver in the requester's tree
              toUserMemberInFromTree = await storage.createMember({
                treeId: fromTree.id,
                firstName: toUser?.firstName || 'Unknown',
                lastName: toUser?.lastName || '',
                photoUrl: toUser?.profileImageUrl || null,
                email: null,
                claimedByUserId: request.toUserId,
                claimedAt: new Date(),
              });
            }
          }
          
          // Map user connection relationship to tree relationship
          // For family trees: maps family-specific types (son→parent, etc.)
          // For non-family trees: uses the relationship type directly from the tree's config
          const mapToTreeRelationship = (userRel: string): { type: string; fromId: string; toId: string } | null => {
            const treeType = toTree.treeType || 'family';
            
            if (treeType !== 'family') {
              // For non-family trees (church, sports, etc.), the relationship type
              // is used directly — it describes the requester's role in the tree
              // e.g., "player", "member", "mentor" — stored as a direct relationship
              return { type: userRel, fromId: 'from', toId: 'to' };
            }
            
            // Family tree mapping
            switch(userRel) {
              case 'son':
              case 'daughter':
                return { type: 'parent', fromId: 'from', toId: 'to' };
              case 'parent':
                return { type: 'parent', fromId: 'to', toId: 'from' };
              case 'spouse':
                return { type: 'spouse', fromId: 'from', toId: 'to' };
              case 'sibling':
                return { type: 'sibling', fromId: 'from', toId: 'to' };
              default:
                return null;
            }
          };
          
          const relMapping = mapToTreeRelationship(requesterRelationship);
          
          // Find or create the tree owner's own member in their tree (for creating relationship and tree connection)
          let toUserClaimedInOwnTree = toTreeMembers.find(m => m.claimedByUserId === request.toUserId);
          if (!toUserClaimedInOwnTree) {
            // Look for unclaimed member with matching name to claim instead of creating duplicate
            const matchingUnclaimedInToTree = toTreeMembers.find(m => 
              !m.claimedByUserId && 
              m.firstName?.toLowerCase() === toUser?.firstName?.toLowerCase() &&
              m.lastName?.toLowerCase() === toUser?.lastName?.toLowerCase()
            );
            
            if (matchingUnclaimedInToTree) {
              toUserClaimedInOwnTree = await storage.updateMember(matchingUnclaimedInToTree.id, {
                claimedByUserId: request.toUserId,
                claimedAt: new Date(),
                photoUrl: toUser?.profileImageUrl || matchingUnclaimedInToTree.photoUrl,
              });
            } else {
              toUserClaimedInOwnTree = await storage.createMember({
                treeId: toTree.id,
                firstName: toUser?.firstName || 'Me',
                lastName: toUser?.lastName || '',
                photoUrl: toUser?.profileImageUrl || null,
                email: null,
                claimedByUserId: request.toUserId,
                claimedAt: new Date(),
              });
            }
          }
          
          let fromUserClaimedInOwnTree = fromTreeMembers.find(m => m.claimedByUserId === request.fromUserId);
          if (!fromUserClaimedInOwnTree) {
            // Look for unclaimed member with matching name to claim instead of creating duplicate
            const matchingUnclaimedInFromTree = fromTreeMembers.find(m => 
              !m.claimedByUserId && 
              m.firstName?.toLowerCase() === fromUser?.firstName?.toLowerCase() &&
              m.lastName?.toLowerCase() === fromUser?.lastName?.toLowerCase()
            );
            
            if (matchingUnclaimedInFromTree) {
              fromUserClaimedInOwnTree = await storage.updateMember(matchingUnclaimedInFromTree.id, {
                claimedByUserId: request.fromUserId,
                claimedAt: new Date(),
                photoUrl: fromUser?.profileImageUrl || matchingUnclaimedInFromTree.photoUrl,
              });
            } else {
              fromUserClaimedInOwnTree = await storage.createMember({
                treeId: fromTree.id,
                firstName: fromUser?.firstName || 'Me',
                lastName: fromUser?.lastName || '',
                photoUrl: fromUser?.profileImageUrl || null,
                email: null,
                claimedByUserId: request.fromUserId,
                claimedAt: new Date(),
              });
            }
          }
          
          // Add relationship in approver's tree (toTree)
          if (relMapping && toUserClaimedInOwnTree && fromUserMemberInToTree) {
            const existingRels = await storage.getRelationships(toTree.id);
            const relExists = existingRels.some(r => 
              (r.fromMemberId === toUserClaimedInOwnTree.id && r.toMemberId === fromUserMemberInToTree!.id) ||
              (r.fromMemberId === fromUserMemberInToTree!.id && r.toMemberId === toUserClaimedInOwnTree.id)
            );
            
            if (!relExists) {
              const fromMember = relMapping.fromId === 'from' ? fromUserMemberInToTree.id : toUserClaimedInOwnTree.id;
              const toMember = relMapping.toId === 'from' ? fromUserMemberInToTree.id : toUserClaimedInOwnTree.id;
              
              await storage.createRelationship({
                treeId: toTree.id,
                fromMemberId: fromMember,
                toMemberId: toMember,
                relationshipType: relMapping.type as any,
              });
            }
          }
          
          // Add relationship in requester's tree (fromTree)
          if (relMapping && fromUserClaimedInOwnTree && toUserMemberInFromTree) {
            const existingRels = await storage.getRelationships(fromTree.id);
            const relExists = existingRels.some(r => 
              (r.fromMemberId === fromUserClaimedInOwnTree.id && r.toMemberId === toUserMemberInFromTree!.id) ||
              (r.fromMemberId === toUserMemberInFromTree!.id && r.toMemberId === fromUserClaimedInOwnTree.id)
            );
            
            if (!relExists) {
              // Flip the relationship direction for the other tree
              const fromMember = relMapping.fromId === 'from' ? fromUserClaimedInOwnTree.id : toUserMemberInFromTree.id;
              const toMember = relMapping.toId === 'from' ? fromUserClaimedInOwnTree.id : toUserMemberInFromTree.id;
              
              await storage.createRelationship({
                treeId: fromTree.id,
                fromMemberId: fromMember,
                toMemberId: toMember,
                relationshipType: relMapping.type as any,
              });
            }
          }
          
          // Connect the trees with the connector members
          await storage.createTreeConnection({
            tree1Id: fromTree.id,
            tree2Id: toTree.id,
            connector1MemberId: fromUserClaimedInOwnTree?.id || null,
            connector2MemberId: toUserClaimedInOwnTree?.id || null,
            connectionType: requesterRelationship === 'spouse' ? 'marriage' : 'other',
            createdBy: request.toUserId,
          });
          
          // Add viewer access for both users to each other's trees
          const existingCollab1 = await storage.getCollaboratorByUserAndTree(request.fromUserId, toTree.id);
          if (!existingCollab1) {
            await storage.addCollaborator({
              treeId: toTree.id,
              userId: request.fromUserId,
              role: "viewer",
              canEdit: false,
              acceptedAt: new Date(),
            });
          }
          
          const existingCollab2 = await storage.getCollaboratorByUserAndTree(request.toUserId, fromTree.id);
          if (!existingCollab2) {
            await storage.addCollaborator({
              treeId: fromTree.id,
              userId: request.toUserId,
              role: "viewer",
              canEdit: false,
              acceptedAt: new Date(),
            });
          }
        }
      }

      res.json({ 
        success: true, 
        request: approved,
        message: `You are now connected with ${fromUser?.firstName}! Your family trees have been linked.`,
      });
    } catch (error) {
      console.error("Error approving connection request:", error);
      res.status(500).json({ message: "Failed to approve request" });
    }
  });

  // Deny a user connection request
  app.post("/api/user-connection-requests/:id/deny", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const request = await storage.getUserConnectionRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Connection request not found" });
      }

      if (request.toUserId !== userId) {
        return res.status(403).json({ message: "You can only deny requests sent to you" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "This request has already been responded to" });
      }

      const denied = await storage.denyUserConnectionRequest(id);

      res.json({ 
        success: true, 
        request: denied,
        message: "Connection request denied",
      });
    } catch (error) {
      console.error("Error denying connection request:", error);
      res.status(500).json({ message: "Failed to deny request" });
    }
  });

  // Get user's connections
  app.get("/api/user-connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connections = await storage.getUserConnections(userId);

      // Enrich with user info for the "other" user
      const enrichedConnections = await Promise.all(
        connections.map(async (conn) => {
          const otherUserId = conn.userId1 === userId ? conn.userId2 : conn.userId1;
          const otherUser = await storage.getUser(otherUserId);
          const myRelationship = conn.userId1 === userId ? conn.relationshipFromUser1 : conn.relationshipFromUser2;
          const theirRelationship = conn.userId1 === userId ? conn.relationshipFromUser2 : conn.relationshipFromUser1;
          
          const claimedProfiles = await storage.getAllClaimedProfilesForUser(otherUserId);
          const memberProfiles = await Promise.all(
            claimedProfiles.map(async (member) => {
              const tree = await storage.getTree(member.treeId);
              return {
                memberId: member.id,
                firstName: member.firstName,
                lastName: member.lastName,
                photoUrl: member.photoUrl,
                treeName: tree?.name || null,
                treeId: member.treeId,
              };
            })
          );

          const primaryProfile = memberProfiles[0];
          const displayFirstName = otherUser?.firstName || primaryProfile?.firstName || null;
          const displayLastName = otherUser?.lastName || primaryProfile?.lastName || null;
          const displayPhoto = otherUser?.profileImageUrl || primaryProfile?.photoUrl || null;

          return {
            ...conn,
            otherUser: {
              id: otherUserId,
              firstName: displayFirstName,
              lastName: displayLastName,
              profileImageUrl: displayPhoto,
            },
            memberProfiles,
            myRelationshipToThem: myRelationship,
            theirRelationshipToMe: theirRelationship,
          };
        })
      );

      res.json(enrichedConnections);
    } catch (error) {
      console.error("Error fetching user connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Get trees owned by connected users (for tree connection feature)
  app.get("/api/connected-users-trees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get all user connections
      const connections = await storage.getUserConnections(userId);
      
      // Get my trees
      const myTrees = await storage.getTrees(userId);
      const myTreeIds = myTrees.map(t => t.id);
      
      // Get trees for each connected user and check for existing tree connections
      const connectedUsersTrees = await Promise.all(
        connections.map(async (conn) => {
          const otherUserId = conn.userId1 === userId ? conn.userId2 : conn.userId1;
          const otherUser = await storage.getUser(otherUserId);
          const theirTrees = await storage.getTrees(otherUserId);
          
          // For each of their trees, check if already connected to any of my trees
          const treesWithConnectionStatus = await Promise.all(
            theirTrees.map(async (tree) => {
              // Check if this tree is connected to any of my trees
              const treeConnections = await storage.getTreeConnections(tree.id);
              const connectedToMyTree = treeConnections.some(
                tc => myTreeIds.includes(tc.tree1Id) || myTreeIds.includes(tc.tree2Id)
              );
              
              return {
                id: tree.id,
                name: tree.name,
                isConnectedToMyTree: connectedToMyTree,
              };
            })
          );
          
          return {
            userId: otherUserId,
            user: otherUser ? {
              id: otherUser.id,
              firstName: otherUser.firstName,
              lastName: otherUser.lastName,
              profileImageUrl: otherUser.profileImageUrl,
            } : null,
            trees: treesWithConnectionStatus,
            relationshipToMe: conn.userId1 === userId ? conn.relationshipFromUser2 : conn.relationshipFromUser1,
          };
        })
      );
      
      // Filter out users with no trees
      const usersWithTrees = connectedUsersTrees.filter(u => u.trees.length > 0);
      
      res.json({
        myTrees: myTrees.map(t => ({ id: t.id, name: t.name })),
        connectedUsersTrees: usersWithTrees,
      });
    } catch (error) {
      console.error("Error fetching connected users' trees:", error);
      res.status(500).json({ message: "Failed to fetch connected users' trees" });
    }
  });

  // Check connection status with a specific user
  app.get("/api/user-connections/check/:targetUserId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { targetUserId } = req.params;

      if (userId === targetUserId) {
        return res.json({ status: "self", isConnected: false, hasPendingRequest: false });
      }

      // Check if already connected
      const existingConnection = await storage.getExistingUserConnection(userId, targetUserId);
      if (existingConnection) {
        return res.json({ 
          status: "connected", 
          isConnected: true, 
          hasPendingRequest: false,
          connection: existingConnection 
        });
      }

      // Check if there's a pending request from current user to target
      const sentRequest = await storage.getExistingUserConnectionRequest(userId, targetUserId);
      if (sentRequest) {
        return res.json({ 
          status: "pending_sent", 
          isConnected: false, 
          hasPendingRequest: true,
          direction: "sent" 
        });
      }

      // Check if there's a pending request from target to current user
      const receivedRequest = await storage.getExistingUserConnectionRequest(targetUserId, userId);
      if (receivedRequest) {
        return res.json({ 
          status: "pending_received", 
          isConnected: false, 
          hasPendingRequest: true,
          direction: "received",
          requestId: receivedRequest.id
        });
      }

      // No connection or pending request
      res.json({ status: "not_connected", isConnected: false, hasPendingRequest: false });
    } catch (error) {
      console.error("Error checking connection status:", error);
      res.status(500).json({ message: "Failed to check connection status" });
    }
  });

  // Delete a user connection
  app.delete("/api/user-connections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const deleted = await storage.deleteUserConnection(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Connection not found or you don't have permission to delete it" });
      }

      res.json({ success: true, message: "Connection removed" });
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  // Legacy endpoint - redirect to new endpoint
  app.post("/api/connection-requests", isAuthenticated, async (req: any, res) => {
    res.status(400).json({ 
      message: "This endpoint has moved. Please use /api/user-connection-requests with relationshipType parameter.",
      newEndpoint: "/api/user-connection-requests"
    });
  });

  // ==================== CONNECTION REQUESTS ROUTES ====================

  // Get pending connection requests for a tree (for tree owners)
  app.get("/api/trees/:treeId/connection-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;

      // Verify user owns or manages the tree
      const tree = await storage.getTree(treeId);
      if (!tree || tree.ownerId !== userId) {
        const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const requests = await storage.getPendingConnectionRequestsForTree(treeId);
      
      // Enrich with member details
      const enrichedRequests = await Promise.all(
        requests.map(async (req) => {
          const fromMember = await storage.getMember(req.fromMemberId);
          const toMember = await storage.getMember(req.toMemberId);
          return {
            ...req,
            fromMember: fromMember ? { id: fromMember.id, firstName: fromMember.firstName, lastName: fromMember.lastName, photoUrl: fromMember.photoUrl } : null,
            toMember: toMember ? { id: toMember.id, firstName: toMember.firstName, lastName: toMember.lastName, photoUrl: toMember.photoUrl } : null,
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching connection requests:", error);
      res.status(500).json({ message: "Failed to fetch connection requests" });
    }
  });

  // Create a connection request
  app.post("/api/connection-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const parseResult = createConnectionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request data", errors: parseResult.error.errors });
      }
      const { fromMemberId, fromTreeId, toMemberId, toTreeId, connectionType, customLabel, message } = parseResult.data;

      // Verify user has permission on fromTree (must own or be collaborator)
      const fromTree = await storage.getTree(fromTreeId);
      if (!fromTree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const isOwner = fromTree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, fromTreeId);
      const hasAccess = isOwner || !!collaborator;

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have permission to create connection requests from this tree" });
      }

      // Verify fromMember exists and belongs to fromTree
      const fromMember = await storage.getMember(fromMemberId);
      if (!fromMember || fromMember.treeId !== fromTreeId) {
        return res.status(400).json({ message: "Invalid from member" });
      }

      // Verify toMember exists
      const toMember = await storage.getMember(toMemberId);
      if (!toMember) {
        return res.status(400).json({ message: "Invalid to member" });
      }

      // Create the request
      const request = await storage.createConnectionRequest({
        fromMemberId,
        fromTreeId,
        toMemberId,
        toTreeId: toMember.treeId, // Use actual treeId
        requesterId: userId,
        connectionType,
        customLabel,
        message,
        status: 'pending',
      });

      res.json(request);
    } catch (error: any) {
      console.error("Error creating connection request:", error);
      res.status(500).json({ message: error?.message || "Failed to create connection request" });
    }
  });

  // Approve a connection request
  app.post("/api/connection-requests/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const request = await storage.getConnectionRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Verify user owns the target tree
      const tree = await storage.getTree(request.toTreeId);
      if (!tree || tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only tree owner can approve connection requests" });
      }

      const approved = await storage.approveConnectionRequest(id, userId);
      res.json(approved);
    } catch (error: any) {
      console.error("Error approving connection request:", error);
      res.status(500).json({ message: error?.message || "Failed to approve request" });
    }
  });

  // Deny a connection request
  app.post("/api/connection-requests/:id/deny", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const request = await storage.getConnectionRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Verify user owns the target tree
      const tree = await storage.getTree(request.toTreeId);
      if (!tree || tree.ownerId !== userId) {
        return res.status(403).json({ message: "Only tree owner can deny connection requests" });
      }

      const denied = await storage.denyConnectionRequest(id, userId);
      res.json(denied);
    } catch (error: any) {
      console.error("Error denying connection request:", error);
      res.status(500).json({ message: error?.message || "Failed to deny request" });
    }
  });

  // ==================== NETWORK DISCOVERY ROUTES ====================

  // Get network connections (connections of connections)
  app.get("/api/members/:memberId/network", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const network = await storage.getNetworkConnections(memberId);
      
      // Filter to only return visible information
      const filtered = network.map(({ member, connectionType, connectedVia }) => ({
        member: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName?.charAt(0) + '.', // Only show initial for privacy
          photoUrl: member.photoUrl,
          currentCity: member.currentCity,
          currentRegion: member.currentRegion,
          currentCountry: member.currentCountry,
        },
        connectionType,
        connectedVia: {
          id: connectedVia.id,
          firstName: connectedVia.firstName,
          lastName: connectedVia.lastName,
        },
      }));
      
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching network:", error);
      res.status(500).json({ message: "Failed to fetch network" });
    }
  });

  // Get shared connections across user's trees (members appearing in multiple trees)
  app.get("/api/network/shared", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ownedTrees = await storage.getTrees(userId);
      const { collaboratedTrees } = await storage.getCollaboratedTrees(userId);
      const allTrees = [...ownedTrees, ...collaboratedTrees];

      if (allTrees.length < 2) {
        return res.json([]);
      }

      const treeMembersMap = new Map<string, { tree: typeof allTrees[0]; members: any[] }>();
      for (const tree of allTrees) {
        const members = await storage.getMembers(tree.id);
        treeMembersMap.set(tree.id, { tree, members });
      }

      const emailIndex = new Map<string, { memberId: string; treeId: string; treeName: string; treeType: string; firstName: string; lastName: string; photoUrl: string | null }[]>();
      const nameIndex = new Map<string, { memberId: string; treeId: string; treeName: string; treeType: string; firstName: string; lastName: string; birthDate: string | null; photoUrl: string | null }[]>();

      for (const [treeId, { tree, members }] of treeMembersMap) {
        for (const m of members) {
          if (m.email) {
            const key = m.email.toLowerCase().trim();
            if (!emailIndex.has(key)) emailIndex.set(key, []);
            emailIndex.get(key)!.push({
              memberId: m.id,
              treeId,
              treeName: tree.name,
              treeType: tree.treeType || "family",
              firstName: m.firstName,
              lastName: m.lastName || "",
              photoUrl: m.photoUrl,
            });
          }
          const nameKey = `${(m.firstName || "").toLowerCase().trim()}|${(m.lastName || "").toLowerCase().trim()}`;
          if (nameKey !== "|") {
            if (!nameIndex.has(nameKey)) nameIndex.set(nameKey, []);
            nameIndex.get(nameKey)!.push({
              memberId: m.id,
              treeId,
              treeName: tree.name,
              treeType: tree.treeType || "family",
              firstName: m.firstName,
              lastName: m.lastName || "",
              birthDate: m.birthDate,
              photoUrl: m.photoUrl,
            });
          }
        }
      }

      const sharedConnections: {
        name: string;
        photoUrl: string | null;
        matchType: "email" | "name_and_date" | "name_only";
        appearances: { treeId: string; treeName: string; treeType: string; memberId: string }[];
      }[] = [];
      const seenGroups = new Set<string>();

      for (const [, entries] of emailIndex) {
        const uniqueTrees = new Map<string, typeof entries[0]>();
        for (const e of entries) uniqueTrees.set(e.treeId, e);
        if (uniqueTrees.size >= 2) {
          const sorted = Array.from(uniqueTrees.values()).sort((a, b) => a.treeId.localeCompare(b.treeId));
          const groupKey = sorted.map(s => s.memberId).join("|");
          if (!seenGroups.has(groupKey)) {
            seenGroups.add(groupKey);
            const first = sorted[0];
            sharedConnections.push({
              name: `${first.firstName} ${first.lastName}`.trim(),
              photoUrl: first.photoUrl,
              matchType: "email",
              appearances: sorted.map(s => ({ treeId: s.treeId, treeName: s.treeName, treeType: s.treeType, memberId: s.memberId })),
            });
          }
        }
      }

      for (const [, entries] of nameIndex) {
        const uniqueTrees = new Map<string, typeof entries[0]>();
        for (const e of entries) uniqueTrees.set(e.treeId, e);
        if (uniqueTrees.size >= 2) {
          const sorted = Array.from(uniqueTrees.values()).sort((a, b) => a.treeId.localeCompare(b.treeId));
          const groupKey = sorted.map(s => s.memberId).join("|");
          if (!seenGroups.has(groupKey)) {
            seenGroups.add(groupKey);
            const first = sorted[0];
            const hasBirthMatch = sorted.some(a => a.birthDate && sorted.some(b => b !== a && b.birthDate === a.birthDate));
            sharedConnections.push({
              name: `${first.firstName} ${first.lastName}`.trim(),
              photoUrl: first.photoUrl,
              matchType: hasBirthMatch ? "name_and_date" : "name_only",
              appearances: sorted.map(s => ({ treeId: s.treeId, treeName: s.treeName, treeType: s.treeType, memberId: s.memberId })),
            });
          }
        }
      }

      res.json(sharedConnections);
    } catch (error) {
      console.error("Error fetching shared connections:", error);
      res.status(500).json({ message: "Failed to fetch shared connections" });
    }
  });

  // Search members by location
  app.get("/api/members/search/location", isAuthenticated, async (req: any, res) => {
    try {
      const { city, region, country } = req.query;
      const members = await storage.getMembersByLocation(
        city as string | undefined,
        region as string | undefined,
        country as string | undefined
      );
      
      // Return limited info for privacy
      const filtered = members.map(m => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName?.charAt(0) + '.', // Only initial for privacy
        photoUrl: m.photoUrl,
        currentCity: m.currentCity,
        currentRegion: m.currentRegion,
        currentCountry: m.currentCountry,
        treeId: m.treeId,
      }));
      
      res.json(filtered);
    } catch (error) {
      console.error("Error searching by location:", error);
      res.status(500).json({ message: "Failed to search by location" });
    }
  });

  // Get connection types list (for dropdown options)
  app.get("/api/connection-types", async (_req, res) => {
    res.json([
      { value: "godparent", label: "Godparent" },
      { value: "godchild", label: "Godchild" },
      { value: "boyfriend", label: "Boyfriend" },
      { value: "girlfriend", label: "Girlfriend" },
      { value: "fiance", label: "Fiance" },
      { value: "fiancee", label: "Fiancee" },
      { value: "best_friend", label: "Best Friend" },
      { value: "family_friend", label: "Family Friend" },
      { value: "mentor", label: "Mentor" },
      { value: "mentee", label: "Mentee" },
      { value: "guardian", label: "Guardian" },
      { value: "ward", label: "Ward" },
      { value: "other", label: "Other" },
    ]);
  });

  // ==================== FAMILYSEARCH INTEGRATION ROUTES ====================

  // Get FamilySearch connection status
  app.get("/api/familysearch/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connection = await storage.getFamilySearchConnection(userId);
      const configured = familySearchService.isConfigured();
      
      res.json({
        configured,
        connected: !!connection,
        displayName: connection?.displayName || null,
        connectedAt: connection?.connectedAt || null,
        environment: familySearchService.getEnvironment(),
      });
    } catch (error) {
      console.error("Error getting FamilySearch status:", error);
      res.status(500).json({ message: "Failed to get FamilySearch status" });
    }
  });

  // Initiate FamilySearch OAuth
  app.get("/api/familysearch/auth", isAuthenticated, async (req: any, res) => {
    try {
      const state = familySearchService.generateState();
      
      // Store state in session for verification
      if (req.session) {
        req.session.familySearchState = state;
      }
      
      const authUrl = familySearchService.getAuthorizationUrl(state);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error initiating FamilySearch auth:", error);
      res.status(500).json({ message: "Failed to initiate FamilySearch authentication" });
    }
  });

  // FamilySearch OAuth callback
  app.get("/api/familysearch/callback", isAuthenticated, async (req: any, res) => {
    try {
      const { code, state, error: fsError } = req.query;
      const userId = req.user.claims.sub;
      
      // Handle FamilySearch error responses (e.g., user denied access)
      if (fsError) {
        console.error("FamilySearch returned error:", fsError);
        return res.redirect("/familysearch?error=callback_failed");
      }
      
      // Verify state - require it exists and matches
      const storedState = req.session?.familySearchState;
      console.log("[FamilySearch] Callback received - state match:", storedState === state, "has stored state:", !!storedState);
      if (!storedState || storedState !== state) {
        console.error("[FamilySearch] State mismatch - stored:", storedState, "received:", state);
        return res.redirect("/familysearch?error=invalid_state");
      }
      // Clear state after use to prevent reuse
      delete req.session.familySearchState;
      
      // Exchange code for token
      console.log("[FamilySearch] Exchanging code for token...");
      const tokenResponse = await familySearchService.exchangeCodeForToken(code as string);
      if (!tokenResponse) {
        console.error("[FamilySearch] Token exchange returned null");
        return res.redirect("/familysearch?error=token_exchange_failed");
      }
      console.log("[FamilySearch] Token exchange successful");
      
      // Get user info
      const fsUser = await familySearchService.getCurrentUser(tokenResponse.access_token);
      
      // Store or update connection
      const existing = await storage.getFamilySearchConnection(userId);
      const expiresAt = tokenResponse.expires_in 
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;
      
      if (existing) {
        await storage.updateFamilySearchConnection(userId, {
          accessToken: tokenResponse.access_token,
          tokenExpiresAt: expiresAt,
          familySearchId: fsUser?.id,
          displayName: fsUser?.display?.name,
          lastSyncAt: new Date(),
        });
      } else {
        await storage.createFamilySearchConnection({
          userId,
          accessToken: tokenResponse.access_token,
          tokenExpiresAt: expiresAt,
          familySearchId: fsUser?.id,
          displayName: fsUser?.display?.name,
        });
      }
      
      res.redirect("/familysearch?connected=true");
    } catch (error) {
      console.error("Error in FamilySearch callback:", error);
      res.redirect("/familysearch?error=callback_failed");
    }
  });

  // Disconnect FamilySearch
  app.delete("/api/familysearch/connection", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteFamilySearchConnection(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting FamilySearch:", error);
      res.status(500).json({ message: "Failed to disconnect FamilySearch" });
    }
  });

  // Search FamilySearch records
  app.get("/api/familysearch/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { givenName, surname, birthYear, birthPlace, deathYear, deathPlace, fatherName, motherName } = req.query;
      
      const connection = await storage.getFamilySearchConnection(userId);
      
      // If connected and configured, use real API
      if (connection?.accessToken && familySearchService.isConfigured()) {
        console.log("[FamilySearch] Search request from user", userId, "- givenName:", givenName, "surname:", surname);
        const results = await familySearchService.searchRecords(connection.accessToken, {
          givenName: givenName as string,
          surname: surname as string,
          birthYear: birthYear ? parseInt(birthYear as string) : undefined,
          birthPlace: birthPlace as string,
          deathYear: deathYear ? parseInt(deathYear as string) : undefined,
          deathPlace: deathPlace as string,
          fatherName: fatherName as string,
          motherName: motherName as string,
        });
        // If empty results, check if token expired
        if (results.length === 0) {
          const tokenValid = await familySearchService.getCurrentUserPersonId(connection.accessToken);
          if (!tokenValid) {
            await storage.deleteFamilySearchConnection(userId);
            return res.status(401).json({ 
              message: "Your FamilySearch session has expired. Please reconnect your account.",
              tokenExpired: true
            });
          }
        }
        return res.json(results);
      }
      
      // Otherwise use mock data for demonstration
      const mockResults = familySearchService.getMockSearchResults({
        givenName: givenName as string,
        surname: surname as string,
        birthYear: birthYear ? parseInt(birthYear as string) : undefined,
      });
      
      res.json(mockResults);
    } catch (error) {
      console.error("Error searching FamilySearch:", error);
      res.status(500).json({ message: "Failed to search records" });
    }
  });

  // Get FamilySearch tree data for import
  app.get("/api/familysearch/tree", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connection = await storage.getFamilySearchConnection(userId);
      
      // If connected and configured, use real API
      if (connection?.accessToken && familySearchService.isConfigured()) {
        // Get the user's person ID in FamilySearch
        const personId = await familySearchService.getCurrentUserPersonId(connection.accessToken);
        if (!personId) {
          // Token likely expired - auto-disconnect so user can reconnect
          console.log("[FamilySearch] Token appears expired, clearing connection for user:", userId);
          await storage.deleteFamilySearchConnection(userId);
          return res.status(401).json({ 
            message: "Your FamilySearch session has expired. Please reconnect your account.",
            tokenExpired: true
          });
        }
        
        console.log("[FamilySearch] Tree: fetching for personId:", personId);
        
        // Get ancestry (4 generations up), descendants (2 generations down), and immediate family
        const [ancestry, descendants, familyData] = await Promise.all([
          familySearchService.getAncestry(connection.accessToken, personId, 4),
          familySearchService.getDescendancy(connection.accessToken, personId, 2),
          familySearchService.getPersonWithFamily(connection.accessToken, personId),
        ]);
        
        console.log("[FamilySearch] Tree: ancestry persons:", ancestry?.persons.length || 0, 
          "descendants persons:", descendants?.persons.length || 0,
          "family persons:", familyData?.persons.length || 0);
        
        // Merge the tree data
        const persons = new Map<string, familySearchService.FamilySearchTreePerson>();
        const relationships: familySearchService.FamilySearchRelationship[] = [];
        
        const addRelationship = (r: familySearchService.FamilySearchRelationship) => {
          if (!relationships.some(existing => 
            existing.type === r.type && 
            existing.person1Id === r.person1Id && 
            existing.person2Id === r.person2Id
          )) {
            relationships.push(r);
          }
        };
        
        if (ancestry) {
          ancestry.persons.forEach(p => persons.set(p.id, p));
          ancestry.relationships.forEach(addRelationship);
        }
        if (descendants) {
          descendants.persons.forEach(p => persons.set(p.id, p));
          descendants.relationships.forEach(addRelationship);
        }
        if (familyData) {
          familyData.persons.forEach(p => persons.set(p.id, p));
          familyData.relationships.forEach(addRelationship);
        }
        
        console.log("[FamilySearch] Tree: total merged persons:", persons.size, "relationships:", relationships.length);
        
        return res.json({
          persons: Array.from(persons.values()),
          relationships,
          rootPersonId: personId,
          isMock: false,
        });
      }
      
      // Otherwise return mock data for demonstration
      const mockData = familySearchService.getMockTreeData();
      res.json({ ...mockData, isMock: true });
    } catch (error) {
      console.error("Error getting FamilySearch tree:", error);
      res.status(500).json({ message: "Failed to get tree data" });
    }
  });

  // Get a person's family from FamilySearch (for importing with relationships)
  app.get("/api/familysearch/person/:personId/family", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { personId } = req.params;
      const connection = await storage.getFamilySearchConnection(userId);
      
      if (!connection?.accessToken || !familySearchService.isConfigured()) {
        return res.status(400).json({ message: "Not connected to FamilySearch" });
      }
      
      console.log("[FamilySearch] Fetching family for person:", personId);
      const familyData = await familySearchService.getPersonWithFamily(connection.accessToken, personId);
      
      if (!familyData) {
        return res.status(404).json({ message: "Could not fetch person's family" });
      }
      
      console.log("[FamilySearch] Person family: persons:", familyData.persons.length, "relationships:", familyData.relationships.length);
      
      res.json({
        persons: familyData.persons,
        relationships: familyData.relationships,
        rootPersonId: personId,
      });
    } catch (error) {
      console.error("Error fetching person family:", error);
      res.status(500).json({ message: "Failed to fetch person's family" });
    }
  });

  // Import people from FamilySearch into a FamilyRoots tree
  app.post("/api/familysearch/import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId, persons, relationships } = req.body;
      let { rootPersonId } = req.body;
      
      console.log(`[Import] Starting import: treeId=${treeId}, persons=${persons?.length}, relationships=${relationships?.length}, rootPersonId=${rootPersonId || 'NONE (will attempt lookup)'}`);
      
      if (!treeId || !persons || !Array.isArray(persons)) {
        return res.status(400).json({ message: "Missing required fields: treeId, persons" });
      }
      
      // Verify user owns or can edit the tree
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
      const canEdit = tree.ownerId === userId || collaborator?.canEdit;
      
      if (!canEdit) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // Server-side fallback: if rootPersonId wasn't provided, try to look it up
      if (!rootPersonId) {
        try {
          const fsConnection = await storage.getFamilySearchConnection(userId);
          if (fsConnection?.accessToken && familySearchService.isConfigured()) {
            const fsPersonId = await familySearchService.getCurrentUserPersonId(fsConnection.accessToken);
            if (fsPersonId) {
              rootPersonId = fsPersonId;
              console.log(`[Import] rootPersonId resolved via FamilySearch lookup: ${rootPersonId}`);
            }
          }
        } catch (e) {
          console.log(`[Import] Could not resolve rootPersonId via FamilySearch lookup:`, e);
        }
      }
      
      // Get existing members to check for duplicates
      const existingMembers = await storage.getMembers(treeId);
      
      // Map FamilySearch IDs to created FamilyRoots member IDs
      const fsIdToMemberId = new Map<string, string>();
      const createdMembers: any[] = [];
      const skippedDuplicates: string[] = [];
      
      // Pre-map the FamilySearch root person (the user's "self") to their claimed member
      // This prevents the "self" from being matched to a same-named relative (e.g., Peter Wint Jr matching Peter Wint Sr)
      if (rootPersonId) {
        const claimedMember = existingMembers.find((m: any) => m.claimedByUserId === userId);
        if (claimedMember) {
          fsIdToMemberId.set(rootPersonId, claimedMember.id);
          skippedDuplicates.push(`${claimedMember.firstName} ${claimedMember.lastName || ''}`.trim());
          console.log(`[Import] Pre-mapped FamilySearch self (${rootPersonId}) to claimed member: ${claimedMember.firstName} ${claimedMember.lastName || ''} (${claimedMember.id})`);
          
          // Sync FamilySearch data into the claimed member (fill empty fields)
          const rootPerson = persons.find((p: any) => p.id === rootPersonId);
          if (rootPerson) {
            const nameParts = (rootPerson.name || "").split(" ");
            const updates: any = {};
            if (!claimedMember.birthDate && rootPerson.birthDate) {
              const yearMatch = rootPerson.birthDate.match(/\d{4}/);
              if (yearMatch) updates.birthDate = `${yearMatch[0]}-01-01`;
            }
            if (!claimedMember.birthPlace && rootPerson.birthPlace) updates.birthPlace = rootPerson.birthPlace;
            if (!claimedMember.gender && rootPerson.gender) {
              updates.gender = rootPerson.gender === "male" ? "male" : rootPerson.gender === "female" ? "female" : null;
            }
            if (!claimedMember.deathDate && rootPerson.deathDate) {
              const yearMatch = rootPerson.deathDate.match(/\d{4}/);
              if (yearMatch) updates.deathDate = `${yearMatch[0]}-01-01`;
            }
            if (Object.keys(updates).length > 0) {
              await storage.updateMember(claimedMember.id, updates);
              console.log(`[Import] Synced FamilySearch data to claimed member:`, updates);
            }
          }
        }
      }
      
      // Import each person
      for (const person of persons) {
        // Skip if already mapped (e.g., root person pre-mapped above)
        if (fsIdToMemberId.has(person.id)) {
          continue;
        }
        
        // Parse the name into first and last name
        const nameParts = (person.name || "Unknown").split(" ");
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.slice(1).join(" ") || null;
        
        // Check for potential duplicates by name and birth year
        const birthYearMatch = person.birthDate?.match(/\d{4}/);
        const birthYear = birthYearMatch ? birthYearMatch[0] : null;
        const duplicate = existingMembers.find((m: any) => {
          // Skip members already mapped to a FamilySearch ID (prevents double-matching)
          const alreadyMapped = Array.from(fsIdToMemberId.values()).includes(m.id);
          if (alreadyMapped) return false;
          
          const existingBirthYearMatch = m.birthDate?.match(/\d{4}/);
          const existingBirthYear = existingBirthYearMatch ? existingBirthYearMatch[0] : null;
          const nameMatch = m.firstName.toLowerCase() === firstName.toLowerCase() &&
            m.lastName?.toLowerCase() === lastName?.toLowerCase();
          if (!nameMatch) return false;
          if (birthYear && existingBirthYear) return existingBirthYear === birthYear;
          return !birthYear && !existingBirthYear;
        });
        
        if (duplicate) {
          // Map to existing member, don't create duplicate
          fsIdToMemberId.set(person.id, duplicate.id);
          skippedDuplicates.push(person.name);
          console.log(`[Import] Duplicate match: "${person.name}" (${person.id}) → existing member ${duplicate.firstName} ${duplicate.lastName || ''} (${duplicate.id})`);
          continue;
        }
        
        // Parse birth/death dates (FamilySearch dates can be like "1955" or "15 March 1955")
        let birthDate = null;
        let deathDate = null;
        
        if (person.birthDate) {
          const yearMatch = person.birthDate.match(/\d{4}/);
          if (yearMatch) {
            birthDate = `${yearMatch[0]}-01-01`;
          }
        }
        
        if (person.deathDate) {
          const yearMatch = person.deathDate.match(/\d{4}/);
          if (yearMatch) {
            deathDate = `${yearMatch[0]}-01-01`;
          }
        }
        
        const newMember = await storage.createMember({
          treeId,
          firstName,
          lastName,
          gender: person.gender === "male" ? "male" : person.gender === "female" ? "female" : null,
          birthDate,
          birthPlace: person.birthPlace || null,
          deathDate,
          isLiving: person.living ?? !person.deathDate,
        });
        
        fsIdToMemberId.set(person.id, newMember.id);
        createdMembers.push(newMember);
        console.log(`[Import] Created new member: "${firstName} ${lastName || ''}" (${newMember.id}) from FS person ${person.id}`);
      }
      
      // Log the complete mapping state before creating relationships
      console.log(`[Import] Member mapping complete: ${fsIdToMemberId.size} FamilySearch IDs mapped`);
      for (const [fsId, memberId] of fsIdToMemberId.entries()) {
        console.log(`[Import]   FS ${fsId} → Member ${memberId}`);
      }
      
      // Create relationships
      const createdRelationships: any[] = [];
      
      if (relationships && Array.isArray(relationships)) {
        for (const rel of relationships) {
          const member1Id = fsIdToMemberId.get(rel.person1Id);
          const member2Id = fsIdToMemberId.get(rel.person2Id);
          
          if (!member1Id || !member2Id) {
            console.log(`[Import] Skipping relationship: unmapped FS IDs ${rel.person1Id}→${rel.person2Id} (mapped: ${member1Id || 'NONE'}, ${member2Id || 'NONE'})`);
            continue;
          }
          
          // Check if relationship already exists
          const existingRels = await storage.getRelationships(treeId);
          const alreadyExists = existingRels.some((r: any) => 
            (r.fromMemberId === member1Id && r.toMemberId === member2Id) ||
            (r.fromMemberId === member2Id && r.toMemberId === member1Id)
          );
          
          if (alreadyExists) {
            console.log(`[Import] Relationship already exists between ${member1Id} and ${member2Id}, skipping`);
            continue;
          }
          
          const relType = rel.type?.toLowerCase() || "";
          const isParentChild = relType === "parent-child" || relType.includes("parentchild");
          const isCouple = relType === "couple" || relType.includes("couple");

          if (isParentChild) {
            const relationship = await storage.createRelationship({
              treeId,
              fromMemberId: member1Id,
              toMemberId: member2Id,
              relationshipType: "parent",
            });
            createdRelationships.push(relationship);
            console.log(`[Import] Created parent relationship: ${member1Id} → ${member2Id}`);
          } else if (isCouple) {
            const relationship = await storage.createRelationship({
              treeId,
              fromMemberId: member1Id,
              toMemberId: member2Id,
              relationshipType: "spouse",
            });
            createdRelationships.push(relationship);
            console.log(`[Import] Created spouse relationship: ${member1Id} ↔ ${member2Id}`);
          } else {
            console.log(`[Import] Unrecognized relationship type: "${rel.type}" between ${rel.person1Id} and ${rel.person2Id}`);
          }
        }
      }
      
      res.json({
        success: true,
        imported: {
          members: createdMembers.length,
          relationships: createdRelationships.length,
        },
        skipped: {
          duplicates: skippedDuplicates.length,
          names: skippedDuplicates,
        },
      });
    } catch (error) {
      console.error("Error importing from FamilySearch:", error);
      res.status(500).json({ message: "Failed to import tree data" });
    }
  });

  app.post("/api/familysearch/import-as-tree", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { targetTreeId, persons, relationships } = req.body;
      let { rootPersonId } = req.body;

      if (!targetTreeId || !persons || !Array.isArray(persons) || persons.length === 0) {
        return res.status(400).json({ message: "Missing required fields: targetTreeId, persons" });
      }

      const parentTree = await storage.getTree(targetTreeId);
      if (!parentTree) {
        return res.status(404).json({ message: "Target tree not found" });
      }

      const collaborator = await storage.getCollaboratorByUserAndTree(userId, targetTreeId);
      const canEdit = parentTree.ownerId === userId || collaborator?.canEdit;
      if (!canEdit) {
        return res.status(403).json({ message: "Permission denied" });
      }

      if (!rootPersonId) {
        try {
          const fsConnection = await storage.getFamilySearchConnection(userId);
          if (fsConnection?.accessToken && familySearchService.isConfigured()) {
            const fsPersonId = await familySearchService.getCurrentUserPersonId(fsConnection.accessToken);
            if (fsPersonId) {
              rootPersonId = fsPersonId;
            }
          }
        } catch (e) {
          console.log(`[ImportAsTree] Could not resolve rootPersonId:`, e);
        }
      }

      const existingChildTrees = await storage.getChildTrees(targetTreeId);
      for (const child of existingChildTrees) {
        if (child.name?.startsWith("FamilySearch Import") && child.ownerId === userId) {
          const childMembers = await storage.getMembers(child.id);
          if (childMembers.length === 0) {
            console.log(`[ImportAsTree] Cleaning up empty previous import sub-tree ${child.id}: "${child.name}"`);
            await storage.deleteTree(child.id);
          }
        }
      }

      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      const subTree = await storage.createTree({
        name: `FamilySearch Import - ${dateStr}`,
        ownerId: userId,
        parentTreeId: targetTreeId,
        treeType: parentTree.treeType || "family",
        privacy: parentTree.privacy || "private",
      } as any);

      const fsIdToMemberId = new Map<string, string>();
      const createdMembers: any[] = [];

      for (const person of persons) {
        const nameParts = (person.name || "Unknown").split(" ");
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.slice(1).join(" ") || null;

        let birthDate = null;
        let deathDate = null;

        if (person.birthDate) {
          const yearMatch = person.birthDate.match(/\d{4}/);
          if (yearMatch) {
            birthDate = `${yearMatch[0]}-01-01`;
          }
        }

        if (person.deathDate) {
          const yearMatch = person.deathDate.match(/\d{4}/);
          if (yearMatch) {
            deathDate = `${yearMatch[0]}-01-01`;
          }
        }

        const newMember = await storage.createMember({
          treeId: subTree.id,
          firstName,
          lastName,
          gender: person.gender === "male" ? "male" : person.gender === "female" ? "female" : null,
          birthDate,
          birthPlace: person.birthPlace || null,
          deathDate,
          isLiving: person.living ?? !person.deathDate,
        });

        fsIdToMemberId.set(person.id, newMember.id);
        createdMembers.push(newMember);

        if (person.id === rootPersonId) {
          await storage.updateTree(subTree.id, { rootMemberId: newMember.id });
        }
      }

      if (!rootPersonId && createdMembers.length > 0) {
        await storage.updateTree(subTree.id, { rootMemberId: createdMembers[0].id });
      }

      const createdRelationships: any[] = [];

      if (relationships && Array.isArray(relationships)) {
        console.log(`[ImportAsTree] Processing ${relationships.length} relationships`);
        for (const rel of relationships) {
          const member1Id = fsIdToMemberId.get(rel.person1Id);
          const member2Id = fsIdToMemberId.get(rel.person2Id);

          if (!member1Id || !member2Id) {
            console.log(`[ImportAsTree] Skipped relationship: person1=${rel.person1Id} (mapped=${!!member1Id}) person2=${rel.person2Id} (mapped=${!!member2Id}) type=${rel.type}`);
            continue;
          }

          const relType = rel.type?.toLowerCase() || "";
          const isParentChild = relType === "parent-child" || relType.includes("parentchild") || relType.includes("parent");
          const isCouple = relType === "couple" || relType.includes("couple") || relType.includes("spouse");

          if (isParentChild) {
            const relationship = await storage.createRelationship({
              treeId: subTree.id,
              fromMemberId: member1Id,
              toMemberId: member2Id,
              relationshipType: "parent",
            });
            createdRelationships.push(relationship);
          } else if (isCouple) {
            const relationship = await storage.createRelationship({
              treeId: subTree.id,
              fromMemberId: member1Id,
              toMemberId: member2Id,
              relationshipType: "spouse",
            });
            createdRelationships.push(relationship);
          } else {
            console.log(`[ImportAsTree] Unknown relationship type: "${rel.type}" between person1=${rel.person1Id} person2=${rel.person2Id}`);
          }
        }
      } else {
        console.log(`[ImportAsTree] No relationships provided in request body`);
      }

      console.log(`[ImportAsTree] Created ${createdRelationships.length} relationships for ${createdMembers.length} members in sub-tree ${subTree.id}`);

      res.json({
        success: true,
        subTreeId: subTree.id,
        subTreeName: subTree.name,
        parentTreeId: targetTreeId,
        imported: {
          members: createdMembers.length,
          relationships: createdRelationships.length,
        },
      });
    } catch (error) {
      console.error("Error importing FamilySearch as sub-tree:", error);
      res.status(500).json({ message: "Failed to import tree data as sub-tree" });
    }
  });

  // Detect conflicts between two trees (for import conflict resolution)
  app.post("/api/trees/:treeId/detect-conflicts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;
      const { sourceTreeId } = req.body;

      if (!sourceTreeId) {
        return res.status(400).json({ message: "sourceTreeId is required" });
      }

      const targetTree = await storage.getTree(treeId);
      if (!targetTree) {
        return res.status(404).json({ message: "Target tree not found" });
      }

      if (targetTree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || !["co_owner", "editor"].includes(collab.role)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const sourceTree = await storage.getTree(sourceTreeId);
      if (!sourceTree) {
        return res.status(404).json({ message: "Source tree not found" });
      }

      if (sourceTree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, sourceTreeId);
        if (!collab) {
          return res.status(403).json({ message: "Access denied to source tree" });
        }
      }

      const sourceMembers = await storage.getMembers(sourceTreeId);
      const targetMembers = await storage.getMembers(treeId);

      const isSourceRootMember = (memberId: string) => sourceTree.rootMemberId === memberId;
      const isTargetRootMember = (memberId: string) => targetTree.rootMemberId === memberId;

      const conflicts: Array<{
        sourceMember: any;
        targetMember: any;
        matchScore: number;
        differences: Array<{ field: string; sourceValue: any; targetValue: any }>;
      }> = [];
      const matchedSourceIds = new Set<string>();

      for (const sm of sourceMembers) {
        let bestMatch: typeof conflicts[0] | null = null;
        let bestScore = 0;

        for (const tm of targetMembers) {
          let score = 0;
          const diffs: Array<{ field: string; sourceValue: any; targetValue: any }> = [];

          const isRootToRoot = isSourceRootMember(sm.id) && isTargetRootMember(tm.id);
          if (isRootToRoot) {
            score += 40;
            if (sm.firstName !== tm.firstName) {
              diffs.push({ field: "firstName", sourceValue: sm.firstName, targetValue: tm.firstName });
            }
            if (sm.lastName !== tm.lastName) {
              diffs.push({ field: "lastName", sourceValue: sm.lastName, targetValue: tm.lastName });
            }
          }

          const sFirst = (sm.firstName || "").trim().toLowerCase();
          const tFirst = (tm.firstName || "").trim().toLowerCase();
          const sLast = (sm.lastName || "").trim().toLowerCase();
          const tLast = (tm.lastName || "").trim().toLowerCase();

          if (sFirst && tFirst && sFirst === tFirst) {
            score += 30;
          } else if (sFirst && tFirst) {
            diffs.push({ field: "firstName", sourceValue: sm.firstName, targetValue: tm.firstName });
          }

          if (sLast && tLast && sLast === tLast) {
            score += 30;
          } else if (sLast && tLast) {
            diffs.push({ field: "lastName", sourceValue: sm.lastName, targetValue: tm.lastName });
          }

          const sBirthYear = sm.birthDate ? sm.birthDate.match(/\d{4}/)?.[0] : null;
          const tBirthYear = tm.birthDate ? tm.birthDate.match(/\d{4}/)?.[0] : null;

          if (sBirthYear && tBirthYear) {
            const yearDiff = Math.abs(parseInt(sBirthYear) - parseInt(tBirthYear));
            if (yearDiff === 0) {
              score += 20;
            } else if (yearDiff <= 5) {
              score += 10;
              diffs.push({ field: "birthDate", sourceValue: sm.birthDate, targetValue: tm.birthDate });
            } else {
              diffs.push({ field: "birthDate", sourceValue: sm.birthDate, targetValue: tm.birthDate });
            }
          }

          const sBirthPlace = (sm.birthPlace || "").trim().toLowerCase();
          const tBirthPlace = (tm.birthPlace || "").trim().toLowerCase();

          if (sBirthPlace && tBirthPlace) {
            if (sBirthPlace === tBirthPlace) {
              score += 15;
            } else if (sBirthPlace.includes(tBirthPlace) || tBirthPlace.includes(sBirthPlace)) {
              score += 8;
              diffs.push({ field: "birthPlace", sourceValue: sm.birthPlace, targetValue: tm.birthPlace });
            } else {
              diffs.push({ field: "birthPlace", sourceValue: sm.birthPlace, targetValue: tm.birthPlace });
            }
          }

          if (sm.gender && tm.gender) {
            if (sm.gender === tm.gender) {
              score += 5;
            } else {
              diffs.push({ field: "gender", sourceValue: sm.gender, targetValue: tm.gender });
            }
          }

          const meetsThreshold = isRootToRoot || score >= 50;
          if (meetsThreshold && score > bestScore) {
            if (sm.birthDate !== tm.birthDate) {
              if (!diffs.find(d => d.field === "birthDate")) {
                diffs.push({ field: "birthDate", sourceValue: sm.birthDate, targetValue: tm.birthDate });
              }
            }
            if (sm.birthPlace !== tm.birthPlace) {
              if (!diffs.find(d => d.field === "birthPlace")) {
                diffs.push({ field: "birthPlace", sourceValue: sm.birthPlace, targetValue: tm.birthPlace });
              }
            }
            if (sm.gender !== tm.gender) {
              if (!diffs.find(d => d.field === "gender")) {
                diffs.push({ field: "gender", sourceValue: sm.gender, targetValue: tm.gender });
              }
            }

            bestScore = score;
            bestMatch = {
              sourceMember: sm,
              targetMember: tm,
              matchScore: score,
              differences: diffs,
            };
          }
        }

        if (bestMatch) {
          conflicts.push(bestMatch);
          matchedSourceIds.add(sm.id);
        }
      }

      const cleanMembers = sourceMembers.filter(m => !matchedSourceIds.has(m.id));

      res.json({
        conflicts,
        cleanMembers,
        summary: {
          totalSourceMembers: sourceMembers.length,
          totalTargetMembers: targetMembers.length,
          conflictsFound: conflicts.length,
          cleanImports: cleanMembers.length,
        },
      });
    } catch (error) {
      console.error("Error detecting conflicts:", error);
      res.status(500).json({ message: "Failed to detect conflicts between trees" });
    }
  });

  // Smart Match Scan — compare all members across connected trees
  app.post("/api/trees/:treeId/smart-match-scan", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) return res.status(403).json({ message: "Access denied" });
      }

      const connections = await storage.getTreeConnections(treeId);
      if (connections.length === 0) {
        return res.json({ matches: [], summary: { scannedTrees: 0, totalCompared: 0, matchesFound: 0 } });
      }

      const myMembers = await storage.getMembers(treeId);
      if (myMembers.length === 0) {
        return res.json({ matches: [], summary: { scannedTrees: 0, totalCompared: 0, matchesFound: 0 } });
      }

      const existingRequests = await storage.getSentMatchRequests(treeId);
      const existingIncoming = await storage.getMatchRequests(treeId);
      const alreadyRequestedPairs = new Set<string>();
      for (const r of [...existingRequests, ...existingIncoming]) {
        alreadyRequestedPairs.add(`${r.requestingMemberId}:${r.targetMemberId}`);
        alreadyRequestedPairs.add(`${r.targetMemberId}:${r.requestingMemberId}`);
      }

      const connectorMemberIds = new Set<string>();
      for (const conn of connections) {
        if (conn.connector1MemberId) connectorMemberIds.add(conn.connector1MemberId);
        if (conn.connector2MemberId) connectorMemberIds.add(conn.connector2MemberId);
      }

      const matches: Array<{
        sourceMember: { id: string; firstName: string; lastName?: string | null; birthDate?: string | null; birthPlace?: string | null; gender?: string | null };
        targetMember: { id: string; firstName: string; lastName?: string | null; birthDate?: string | null; birthPlace?: string | null; gender?: string | null; treeId: string };
        targetTree: { id: string; name: string };
        matchScore: number;
        matchCriteria: string[];
        alreadyRequested: boolean;
      }> = [];

      let scannedTrees = 0;
      let totalCompared = 0;

      for (const conn of connections) {
        const connectedTreeId = conn.tree1Id === treeId ? conn.tree2Id : conn.tree1Id;
        const connectedTree = await storage.getTree(connectedTreeId);
        if (!connectedTree) continue;

        const connectedMembers = await storage.getMembers(connectedTreeId);
        scannedTrees++;

        for (const myMember of myMembers) {
          for (const otherMember of connectedMembers) {
            totalCompared++;

            if (connectorMemberIds.has(myMember.id) && connectorMemberIds.has(otherMember.id)) continue;

            let score = 0;
            const criteria: string[] = [];

            const sFirst = (myMember.firstName || "").trim().toLowerCase();
            const tFirst = (otherMember.firstName || "").trim().toLowerCase();
            const sLast = (myMember.lastName || "").trim().toLowerCase();
            const tLast = (otherMember.lastName || "").trim().toLowerCase();

            if (sFirst && tFirst && sFirst === tFirst) {
              score += 30;
              criteria.push("firstName");
            }

            if (sLast && tLast && sLast === tLast) {
              score += 30;
              criteria.push("lastName");
            }

            const sBirthYear = myMember.birthDate ? myMember.birthDate.match(/\d{4}/)?.[0] : null;
            const tBirthYear = otherMember.birthDate ? otherMember.birthDate.match(/\d{4}/)?.[0] : null;
            if (sBirthYear && tBirthYear) {
              const yearDiff = Math.abs(parseInt(sBirthYear) - parseInt(tBirthYear));
              if (yearDiff === 0) {
                score += 20;
                criteria.push("birthYear");
              } else if (yearDiff <= 5) {
                score += 10;
                criteria.push("birthYearClose");
              }
            }

            const sBirthPlace = (myMember.birthPlace || "").trim().toLowerCase();
            const tBirthPlace = (otherMember.birthPlace || "").trim().toLowerCase();
            if (sBirthPlace && tBirthPlace) {
              if (sBirthPlace === tBirthPlace) {
                score += 15;
                criteria.push("birthPlace");
              } else if (sBirthPlace.includes(tBirthPlace) || tBirthPlace.includes(sBirthPlace)) {
                score += 8;
                criteria.push("birthPlacePartial");
              }
            }

            if (myMember.gender && otherMember.gender && myMember.gender === otherMember.gender) {
              score += 5;
              criteria.push("gender");
            }

            if (myMember.email && otherMember.email &&
                myMember.email.toLowerCase() === otherMember.email.toLowerCase()) {
              score += 40;
              criteria.push("email");
            }

            if (score >= 50) {
              const pairKey1 = `${myMember.id}:${otherMember.id}`;
              const pairKey2 = `${otherMember.id}:${myMember.id}`;
              matches.push({
                sourceMember: {
                  id: myMember.id,
                  firstName: myMember.firstName,
                  lastName: myMember.lastName,
                  birthDate: myMember.birthDate,
                  birthPlace: myMember.birthPlace,
                  gender: myMember.gender,
                },
                targetMember: {
                  id: otherMember.id,
                  firstName: otherMember.firstName,
                  lastName: otherMember.lastName,
                  birthDate: otherMember.birthDate,
                  birthPlace: otherMember.birthPlace,
                  gender: otherMember.gender,
                  treeId: connectedTreeId,
                },
                targetTree: { id: connectedTree.id, name: connectedTree.name },
                matchScore: Math.min(score, 100),
                matchCriteria: criteria,
                alreadyRequested: alreadyRequestedPairs.has(pairKey1) || alreadyRequestedPairs.has(pairKey2),
              });
            }
          }
        }
      }

      matches.sort((a, b) => b.matchScore - a.matchScore);
      const topMatches = matches.slice(0, 50);

      res.json({
        matches: topMatches,
        summary: {
          scannedTrees,
          totalCompared,
          matchesFound: matches.length,
        },
      });
    } catch (error) {
      console.error("Error running smart match scan:", error);
      res.status(500).json({ message: "Failed to run smart match scan" });
    }
  });

  // Attach a source to a family member
  app.post("/api/members/:memberId/sources", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      const { recordId, recordTitle, recordType, recordUrl, recordData, notes } = req.body;
      
      // Verify member exists and user has access
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
      const canEdit = tree.ownerId === userId || collaborator?.canEdit;
      
      if (!canEdit) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      const source = await storage.createFamilySearchSource({
        memberId,
        treeId: member.treeId,
        recordId,
        recordTitle,
        recordType,
        recordUrl,
        recordData,
        notes,
        addedBy: userId,
      });
      
      res.json(source);
    } catch (error) {
      console.error("Error attaching source:", error);
      res.status(500).json({ message: "Failed to attach source" });
    }
  });

  // Get sources for a member
  app.get("/api/members/:memberId/sources", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      // Verify access to tree
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
      
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const sources = await storage.getFamilySearchSources(memberId);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching sources:", error);
      res.status(500).json({ message: "Failed to fetch sources" });
    }
  });

  // Delete a source
  app.delete("/api/sources/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      // Verify user has access to the source's tree
      const source = await storage.getFamilySearchSourceById(id);
      if (!source) {
        return res.status(404).json({ message: "Source not found" });
      }
      
      const tree = await storage.getTree(source.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, source.treeId);
      const canEdit = tree.ownerId === userId || collaborator?.canEdit;
      
      if (!canEdit) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      await storage.deleteFamilySearchSource(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting source:", error);
      res.status(500).json({ message: "Failed to delete source" });
    }
  });

  // ==================== CROSS-TREE MATCHING ROUTES ====================

  // Get external identifiers for a member
  app.get("/api/members/:memberId/external-ids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
      
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const identifiers = await storage.getExternalIdentifiersForMember(memberId);
      res.json(identifiers);
    } catch (error) {
      console.error("Error fetching external identifiers:", error);
      res.status(500).json({ message: "Failed to fetch external identifiers" });
    }
  });

  // Link a member to an external source (FamilySearch, etc.)
  app.post("/api/members/:memberId/external-ids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      const { source, externalId, externalUrl, metadata } = req.body;
      
      if (!source || !externalId) {
        return res.status(400).json({ message: "Source and externalId are required" });
      }
      
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
      const canEdit = tree.ownerId === userId || collaborator?.canEdit;
      
      if (!canEdit) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // Import the cross-tree matching module dynamically
      const { linkMemberToExternalSource } = await import("./crossTreeMatching");
      
      const identifier = await linkMemberToExternalSource(
        memberId,
        member.treeId,
        source,
        externalId,
        userId,
        { ...metadata, externalUrl }
      );
      
      res.json(identifier);
    } catch (error) {
      console.error("Error linking external ID:", error);
      res.status(500).json({ message: "Failed to link external ID" });
    }
  });

  // Get cross-tree matches for a tree
  app.get("/api/trees/:treeId/cross-matches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
      
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const matches = await storage.getCrossTreeMatchesForTree(treeId);
      
      // Enrich with member and tree info
      const enrichedMatches = await Promise.all(matches.map(async (match) => {
        const member1 = await storage.getMember(match.member1Id);
        const member2 = await storage.getMember(match.member2Id);
        const tree1 = await storage.getTree(match.tree1Id);
        const tree2 = await storage.getTree(match.tree2Id);
        
        return {
          ...match,
          member1Name: member1 ? `${member1.firstName} ${member1.lastName}` : 'Unknown',
          member2Name: member2 ? `${member2.firstName} ${member2.lastName}` : 'Unknown',
          tree1Name: tree1?.name || 'Unknown',
          tree2Name: tree2?.name || 'Unknown',
        };
      }));
      
      res.json(enrichedMatches);
    } catch (error) {
      console.error("Error fetching cross-tree matches:", error);
      res.status(500).json({ message: "Failed to fetch cross-tree matches" });
    }
  });

  // Confirm a cross-tree match
  app.post("/api/cross-matches/:matchId/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { matchId } = req.params;
      
      const match = await storage.getCrossTreeMatchById(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      // Check if user owns one of the trees
      const tree1 = await storage.getTree(match.tree1Id);
      const tree2 = await storage.getTree(match.tree2Id);
      
      let userTreeId: string | null = null;
      if (tree1 && tree1.ownerId === userId) userTreeId = tree1.id;
      else if (tree2 && tree2.ownerId === userId) userTreeId = tree2.id;
      
      if (!userTreeId) {
        const collab1 = await storage.getCollaboratorByUserAndTree(userId, match.tree1Id);
        const collab2 = await storage.getCollaboratorByUserAndTree(userId, match.tree2Id);
        if (collab1?.canEdit) userTreeId = match.tree1Id;
        else if (collab2?.canEdit) userTreeId = match.tree2Id;
      }
      
      if (!userTreeId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.confirmCrossTreeMatch(matchId, userId, userTreeId);
      res.json(updated);
    } catch (error) {
      console.error("Error confirming cross-tree match:", error);
      res.status(500).json({ message: "Failed to confirm match" });
    }
  });

  // Reject a cross-tree match
  app.post("/api/cross-matches/:matchId/reject", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { matchId } = req.params;
      
      const match = await storage.getCrossTreeMatchById(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      // Check if user owns one of the trees
      const tree1 = await storage.getTree(match.tree1Id);
      const tree2 = await storage.getTree(match.tree2Id);
      
      const hasAccess = tree1?.ownerId === userId || tree2?.ownerId === userId;
      if (!hasAccess) {
        const collab1 = await storage.getCollaboratorByUserAndTree(userId, match.tree1Id);
        const collab2 = await storage.getCollaboratorByUserAndTree(userId, match.tree2Id);
        if (!collab1?.canEdit && !collab2?.canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const updated = await storage.updateCrossTreeMatch(matchId, { status: "rejected" });
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting cross-tree match:", error);
      res.status(500).json({ message: "Failed to reject match" });
    }
  });

  // Get all pending cross-tree matches for the current user across all their trees
  app.get("/api/user/pending-matches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get all trees owned by or accessible to the user
      const ownedTrees = await storage.getTrees(userId);
      const collaborations = await storage.getCollaboratorsByUser(userId);
      const collabTreeIds = collaborations.map(c => c.treeId);
      
      const allTreeIds = [...ownedTrees.map(t => t.id), ...collabTreeIds];
      
      // Get all pending matches for these trees
      const allMatches: any[] = [];
      for (const treeId of allTreeIds) {
        const matches = await storage.getCrossTreeMatchesForTree(treeId);
        const pendingMatches = matches.filter(m => m.status === 'pending');
        allMatches.push(...pendingMatches);
      }
      
      // Deduplicate matches (same match might appear for both trees)
      const uniqueMatches = Array.from(new Map(allMatches.map(m => [m.id, m])).values());
      
      // Enrich with member and tree info
      const enrichedMatches = await Promise.all(uniqueMatches.map(async (match) => {
        const member1 = await storage.getMember(match.member1Id);
        const member2 = await storage.getMember(match.member2Id);
        const tree1 = await storage.getTree(match.tree1Id);
        const tree2 = await storage.getTree(match.tree2Id);
        
        // Determine which tree belongs to the user
        const userOwnsTrees = ownedTrees.map(t => t.id);
        const isTree1Yours = userOwnsTrees.includes(match.tree1Id) || collabTreeIds.includes(match.tree1Id);
        const isTree2Yours = userOwnsTrees.includes(match.tree2Id) || collabTreeIds.includes(match.tree2Id);
        
        return {
          ...match,
          member1: member1 ? { 
            id: member1.id, 
            firstName: member1.firstName, 
            lastName: member1.lastName,
            birthDate: member1.birthDate,
            photoUrl: member1.photoUrl
          } : null,
          member2: member2 ? { 
            id: member2.id, 
            firstName: member2.firstName, 
            lastName: member2.lastName,
            birthDate: member2.birthDate,
            photoUrl: member2.photoUrl
          } : null,
          tree1: tree1 ? { id: tree1.id, name: tree1.name } : null,
          tree2: tree2 ? { id: tree2.id, name: tree2.name } : null,
          isTree1Yours,
          isTree2Yours,
        };
      }));
      
      // Sort by match score descending
      enrichedMatches.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      
      res.json(enrichedMatches);
    } catch (error) {
      console.error("Error fetching user pending matches:", error);
      res.status(500).json({ message: "Failed to fetch pending matches" });
    }
  });

  // Get pending member suggestions for a tree
  app.get("/api/trees/:treeId/suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
      
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const suggestions = await storage.getPendingMemberSuggestions(treeId);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  // Approve a member suggestion (create new member or merge with existing)
  app.post("/api/suggestions/:suggestionId/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { suggestionId } = req.params;
      const { mergeWithMemberId, relationshipData } = req.body;
      
      const suggestion = await storage.getPendingMemberSuggestionById(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }
      
      const tree = await storage.getTree(suggestion.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, suggestion.treeId);
      const canEdit = tree.ownerId === userId || collaborator?.canEdit;
      
      if (!canEdit) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      if (mergeWithMemberId) {
        // Merge with existing member
        const updated = await storage.approvePendingMemberSuggestion(
          suggestionId,
          userId,
          undefined,
          mergeWithMemberId
        );
        
        // Link the external ID to the existing member
        if (suggestion.externalId && suggestion.source) {
          await storage.createExternalIdentifier({
            memberId: mergeWithMemberId,
            treeId: suggestion.treeId,
            source: suggestion.source,
            externalId: suggestion.externalId,
            confidence: 1.0,
            verifiedAt: new Date(),
            verifiedBy: userId,
          });
        }
        
        res.json({ success: true, merged: true, memberId: mergeWithMemberId, suggestion: updated });
      } else {
        // Create new member
        const newMember = await storage.createMember({
          treeId: suggestion.treeId,
          firstName: suggestion.firstName || "Unknown",
          lastName: suggestion.lastName || "",
          gender: suggestion.gender as "male" | "female" | "other" | null,
          birthDate: suggestion.birthDate,
          birthPlace: suggestion.birthPlace,
          deathDate: suggestion.deathDate,
        });
        
        // Create relationship if specified
        if (suggestion.relatedToMemberId && suggestion.relationshipType) {
          await storage.createRelationship({
            treeId: suggestion.treeId,
            fromMemberId: newMember.id,
            toMemberId: suggestion.relatedToMemberId,
            relationshipType: suggestion.relationshipType as "parent" | "child" | "spouse" | "sibling",
          });
        }
        
        // Link the external ID
        if (suggestion.externalId && suggestion.source) {
          await storage.createExternalIdentifier({
            memberId: newMember.id,
            treeId: suggestion.treeId,
            source: suggestion.source,
            externalId: suggestion.externalId,
            confidence: 1.0,
            verifiedAt: new Date(),
            verifiedBy: userId,
          });
        }
        
        const updated = await storage.approvePendingMemberSuggestion(
          suggestionId,
          userId,
          newMember.id
        );
        
        res.json({ success: true, merged: false, memberId: newMember.id, suggestion: updated });
      }
    } catch (error) {
      console.error("Error approving suggestion:", error);
      res.status(500).json({ message: "Failed to approve suggestion" });
    }
  });

  // Reject a member suggestion
  app.post("/api/suggestions/:suggestionId/reject", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { suggestionId } = req.params;
      
      const suggestion = await storage.getPendingMemberSuggestionById(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }
      
      const tree = await storage.getTree(suggestion.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, suggestion.treeId);
      const canEdit = tree.ownerId === userId || collaborator?.canEdit;
      
      if (!canEdit) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      const updated = await storage.rejectPendingMemberSuggestion(suggestionId, userId);
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting suggestion:", error);
      res.status(500).json({ message: "Failed to reject suggestion" });
    }
  });

  // ==================== GIFT REGISTRY ROUTES ====================

  // Helper function to transform product URLs with affiliate IDs
  function addAffiliateTracking(url: string | null | undefined): string | null {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      
      // Amazon affiliate tracking (Amazon Associates ID: pawint-20)
      if (urlObj.hostname.includes('amazon.com') || urlObj.hostname.includes('amzn.to')) {
        urlObj.searchParams.set('tag', 'pawint-20');
        return urlObj.toString();
      }
      
      // Etsy affiliate tracking via Awin (Publisher ID: 2735710)
      if (urlObj.hostname.includes('etsy.com')) {
        const encodedUrl = encodeURIComponent(url);
        return `https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=${encodedUrl}`;
      }
      
      // Return unchanged for other URLs
      return url;
    } catch {
      return url;
    }
  }

  // Fetch product metadata from a URL (OG tags, meta tags)
  app.get("/api/product-metadata", isAuthenticated, async (req: any, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL" });
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ message: "Only HTTP/HTTPS URLs are supported" });
      }

      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '[::1]'];
      if (blockedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.local'))) {
        return res.status(400).json({ message: "URL not allowed" });
      }

      const isAmazon = parsed.hostname.includes('amazon.com') || parsed.hostname.includes('amazon.co') || parsed.hostname.includes('amzn.to') || parsed.hostname.includes('amzn.com');
      const isEtsy = parsed.hostname.includes('etsy.com');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          redirect: 'follow',
        });
        clearTimeout(timeout);

        if (!response.ok) {
          return res.status(422).json({ message: "Could not fetch page" });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          return res.status(422).json({ message: "URL does not point to a web page" });
        }

        const html = await response.text();
        const searchArea = html.substring(0, 80000);

        const getMetaContent = (nameOrProperty: string): string | null => {
          const patterns = [
            new RegExp(`<meta[^>]+(?:property|name)=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nameOrProperty}["']`, 'i'),
          ];
          for (const pattern of patterns) {
            const match = searchArea.match(pattern);
            if (match) return match[1].trim();
          }
          return null;
        };

        const titleMatch = searchArea.match(/<title[^>]*>([^<]+)<\/title>/i);

        let title = getMetaContent('og:title') || getMetaContent('twitter:title') || (titleMatch ? titleMatch[1].trim() : null);
        let image = getMetaContent('og:image') || getMetaContent('twitter:image');
        let description = getMetaContent('og:description') || getMetaContent('description') || getMetaContent('twitter:description');

        if (isAmazon) {
          if (!title) {
            const spanTitle = searchArea.match(/id="productTitle"[^>]*>\s*([^<]+)/i);
            if (spanTitle) title = spanTitle[1].trim();
          }
          if (!title) {
            const titleAlt = searchArea.match(/id="title"[^>]*>[\s\S]*?<span[^>]*>\s*([^<]+)/i);
            if (titleAlt) title = titleAlt[1].trim();
          }
          if (!image) {
            const landingImg = searchArea.match(/id="landingImage"[^>]+src="([^"]+)"/i);
            if (landingImg) image = landingImg[1];
          }
          if (!image) {
            const imgBlock = searchArea.match(/"hiRes"\s*:\s*"([^"]+)"/);
            if (imgBlock) image = imgBlock[1];
          }
          if (!image) {
            const mainImg = searchArea.match(/"large"\s*:\s*"([^"]+)"/);
            if (mainImg) image = mainImg[1];
          }
          if (title) {
            title = title.replace(/Amazon\.com\s*:\s*/i, '').replace(/\s*-\s*Amazon\.com$/i, '').trim();
          }
        }

        let price: number | null = null;
        const priceStr = getMetaContent('product:price:amount') || getMetaContent('og:price:amount');
        if (priceStr) {
          const parsed = parseFloat(priceStr);
          if (!isNaN(parsed)) price = parsed;
        }
        if (!price) {
          const priceMatch = searchArea.match(/\"price\"\s*:\s*[\"']?([\d.]+)/);
          if (priceMatch) {
            const parsed = parseFloat(priceMatch[1]);
            if (!isNaN(parsed) && parsed > 0 && parsed < 100000) price = parsed;
          }
        }
        if (!price && isAmazon) {
          const wholePart = searchArea.match(/class="a-price-whole"[^>]*>(\d[\d,]*)/);
          const fracPart = searchArea.match(/class="a-price-fraction"[^>]*>(\d+)/);
          if (wholePart) {
            const whole = wholePart[1].replace(/,/g, '');
            const frac = fracPart ? fracPart[1] : '00';
            const p = parseFloat(`${whole}.${frac}`);
            if (!isNaN(p) && p > 0 && p < 100000) price = p;
          }
        }
        if (!price) {
          const genericPrice = searchArea.match(/\$\s*([\d,]+\.?\d{0,2})/);
          if (genericPrice) {
            const p = parseFloat(genericPrice[1].replace(/,/g, ''));
            if (!isNaN(p) && p > 0 && p < 100000) price = p;
          }
        }

        const siteName = getMetaContent('og:site_name') || (isAmazon ? 'Amazon' : isEtsy ? 'Etsy' : null);

        res.json({
          title: title ? decodeHTMLEntities(title) : null,
          image,
          description: description ? decodeHTMLEntities(description) : null,
          price,
          siteName: siteName ? decodeHTMLEntities(siteName) : null,
          url,
        });
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (fetchError.name === 'AbortError') {
          return res.status(408).json({ message: "Request timed out" });
        }
        return res.status(422).json({ message: "Could not fetch page" });
      }
    } catch (error) {
      console.error("Error fetching product metadata:", error);
      res.status(500).json({ message: "Failed to fetch product metadata" });
    }
  });

  function decodeHTMLEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&nbsp;/g, ' ');
  }

  // Get all registries for a tree
  app.get("/api/trees/:treeId/registries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { treeId } = req.params;

      // Verify user has access to tree
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
      
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "Access denied" });
      }

      const registries = await storage.getGiftRegistriesByTree(treeId);
      
      // Enrich with member names and item counts
      const enrichedRegistries = await Promise.all(
        registries.map(async (registry) => {
          const member = await storage.getMember(registry.memberId);
          const items = await storage.getGiftRegistryItems(registry.id);
          const purchasedCount = items.filter(i => i.status === 'purchased').length;
          
          return {
            ...registry,
            memberName: member ? `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}` : 'Unknown',
            memberPhoto: member?.photoUrl,
            itemCount: items.length,
            purchasedCount,
            progress: items.length > 0 ? Math.round((purchasedCount / items.length) * 100) : 0,
          };
        })
      );

      res.json(enrichedRegistries);
    } catch (error) {
      console.error("Error fetching registries:", error);
      res.status(500).json({ message: "Failed to fetch registries" });
    }
  });

  // Get a specific registry with items
  app.get("/api/registries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const registry = await storage.getGiftRegistry(id);
      if (!registry) {
        return res.status(404).json({ message: "Registry not found" });
      }

      // Verify user has access to tree
      const tree = await storage.getTree(registry.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, registry.treeId);
      
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get member info
      const member = await storage.getMember(registry.memberId);
      
      // Get items with affiliate links
      const items = await storage.getGiftRegistryItems(id);
      const itemsWithAffiliateLinks = items.map(item => ({
        ...item,
        affiliateUrl: addAffiliateTracking(item.productUrl),
      }));

      res.json({
        ...registry,
        memberName: member ? `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}` : 'Unknown',
        memberPhoto: member?.photoUrl,
        items: itemsWithAffiliateLinks,
        isOwner: registry.createdByUserId === userId,
      });
    } catch (error) {
      console.error("Error fetching registry:", error);
      res.status(500).json({ message: "Failed to fetch registry" });
    }
  });

  // Create a new registry
  app.post("/api/registries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId, treeId, title, eventType, eventDate, description, isPublic } = req.body;

      if (!memberId || !treeId || !title || !eventType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Verify user has edit access to tree
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
      const canEdit = isOwner || collaborator?.canEdit;
      
      if (!canEdit) {
        return res.status(403).json({ message: "You don't have permission to create registries in this tree" });
      }

      // Verify member exists in tree
      const member = await storage.getMember(memberId);
      if (!member || member.treeId !== treeId) {
        return res.status(400).json({ message: "Invalid member" });
      }

      const registry = await storage.createGiftRegistry({
        memberId,
        treeId,
        createdByUserId: userId,
        title,
        eventType,
        eventDate: eventDate || null,
        description: description || null,
        isPublic: isPublic !== false,
        isActive: true,
      });

      if (req.body.notifyMembers) {
        try {
          const creatorUser = await storage.getUser(userId);
          const creatorName = creatorUser?.firstName 
            ? `${creatorUser.firstName} ${creatorUser.lastName || ''}`.trim() 
            : 'A family member';
          const treeMemberUsers = await storage.getTreeMembersWithNotificationPrefs(treeId);
          const notifyUsers = treeMemberUsers.filter(u => u.email && u.id !== userId);
          
          for (const recipient of notifyUsers) {
            try {
              await sendRegistryAnnouncementEmail(
                recipient.email!,
                recipient.firstName || 'Family Member',
                creatorName,
                member.firstName + (member.lastName ? ` ${member.lastName}` : ''),
                title,
                eventType,
                eventDate || null,
                registry.id,
                tree!.name
              );
            } catch (emailErr) {
              console.error(`Failed to send registry notification to ${recipient.email}:`, emailErr);
            }
          }
          console.log(`[registry] Sent ${notifyUsers.length} notification emails for registry ${registry.id}`);
        } catch (notifError) {
          console.error("Error sending registry notifications:", notifError);
        }
      }

      res.json(registry);
    } catch (error) {
      console.error("Error creating registry:", error);
      res.status(500).json({ message: "Failed to create registry" });
    }
  });

  // Update a registry
  app.patch("/api/registries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { title, eventType, eventDate, description, isPublic, isActive } = req.body;

      const registry = await storage.getGiftRegistry(id);
      if (!registry) {
        return res.status(404).json({ message: "Registry not found" });
      }

      // Only registry creator can update
      if (registry.createdByUserId !== userId) {
        return res.status(403).json({ message: "Only the registry creator can update it" });
      }

      const updated = await storage.updateGiftRegistry(id, {
        title,
        eventType,
        eventDate,
        description,
        isPublic,
        isActive,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating registry:", error);
      res.status(500).json({ message: "Failed to update registry" });
    }
  });

  // Delete a registry
  app.delete("/api/registries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const registry = await storage.getGiftRegistry(id);
      if (!registry) {
        return res.status(404).json({ message: "Registry not found" });
      }

      // Only registry creator or tree owner can delete
      const tree = await storage.getTree(registry.treeId);
      if (registry.createdByUserId !== userId && tree?.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete this registry" });
      }

      await storage.deleteGiftRegistry(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting registry:", error);
      res.status(500).json({ message: "Failed to delete registry" });
    }
  });

  // Add item to registry
  app.post("/api/registries/:registryId/items", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { registryId } = req.params;
      const { name, description, productUrl, imageUrl, price, quantity, priority, notes } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Item name is required" });
      }

      const registry = await storage.getGiftRegistry(registryId);
      if (!registry) {
        return res.status(404).json({ message: "Registry not found" });
      }

      // Only registry creator can add items
      if (registry.createdByUserId !== userId) {
        return res.status(403).json({ message: "Only the registry creator can add items" });
      }

      const item = await storage.createGiftRegistryItem({
        registryId,
        name,
        description: description || null,
        productUrl: productUrl || null,
        imageUrl: imageUrl || null,
        price: price ? Math.round(price * 100) : null, // Convert to cents
        quantity: quantity || 1,
        priority: priority || 0,
        notes: notes || null,
        status: 'available',
        quantityPurchased: 0,
      });

      res.json({
        ...item,
        affiliateUrl: addAffiliateTracking(item.productUrl),
      });
    } catch (error) {
      console.error("Error adding registry item:", error);
      res.status(500).json({ message: "Failed to add item" });
    }
  });

  // Update registry item
  app.patch("/api/registry-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { name, description, productUrl, imageUrl, price, quantity, priority, notes } = req.body;

      const item = await storage.getGiftRegistryItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const registry = await storage.getGiftRegistry(item.registryId);
      if (!registry || registry.createdByUserId !== userId) {
        return res.status(403).json({ message: "Only the registry creator can update items" });
      }

      const updated = await storage.updateGiftRegistryItem(id, {
        name,
        description,
        productUrl,
        imageUrl,
        price: price !== undefined ? Math.round(price * 100) : undefined,
        quantity,
        priority,
        notes,
      });

      res.json({
        ...updated,
        affiliateUrl: addAffiliateTracking(updated?.productUrl),
      });
    } catch (error) {
      console.error("Error updating registry item:", error);
      res.status(500).json({ message: "Failed to update item" });
    }
  });

  // Delete registry item
  app.delete("/api/registry-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const item = await storage.getGiftRegistryItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const registry = await storage.getGiftRegistry(item.registryId);
      if (!registry || registry.createdByUserId !== userId) {
        return res.status(403).json({ message: "Only the registry creator can delete items" });
      }

      await storage.deleteGiftRegistryItem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting registry item:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Mark item as purchased (by family member)
  app.post("/api/registry-items/:id/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { quantity } = req.body;

      const item = await storage.getGiftRegistryItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Verify registry is active
      const registry = await storage.getGiftRegistry(item.registryId);
      if (!registry || !registry.isActive) {
        return res.status(400).json({ message: "Registry is not active" });
      }

      // Verify user has access to tree
      const tree = await storage.getTree(registry.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, registry.treeId);
      
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "You don't have access to this registry" });
      }

      // Check quantity available
      const remaining = item.quantity - (item.quantityPurchased || 0);
      const purchaseQty = Math.min(quantity || 1, remaining);
      
      if (purchaseQty <= 0) {
        return res.status(400).json({ message: "Item is already fully purchased" });
      }

      const updated = await storage.markItemPurchased(id, userId, purchaseQty);

      // Notify registry creator about the purchase
      try {
        if (registry.createdByUserId !== userId) {
          const creatorUser = await storage.getUser(registry.createdByUserId);
          const buyerUser = await storage.getUser(userId);
          if (creatorUser?.email) {
            const allItems = await storage.getGiftRegistryItems(registry.id);
            const totalCount = allItems.length;
            const remainingCount = allItems.filter(i => i.status !== 'purchased').length;
            const buyerName = buyerUser?.firstName 
              ? `${buyerUser.firstName} ${buyerUser.lastName || ''}`.trim()
              : 'A family member';
            
            await sendRegistryItemPurchasedEmail(
              creatorUser.email,
              creatorUser.firstName || 'there',
              buyerName,
              item.name,
              registry.title,
              registry.id,
              remainingCount,
              totalCount
            );
          }
        }
      } catch (notifError) {
        console.error("Error sending purchase notification:", notifError);
      }

      res.json({
        ...updated,
        affiliateUrl: addAffiliateTracking(updated?.productUrl),
      });
    } catch (error) {
      console.error("Error marking item as purchased:", error);
      res.status(500).json({ message: "Failed to mark item as purchased" });
    }
  });

  // Get registries for a specific member
  app.get("/api/members/:memberId/registries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;

      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Verify user has access to tree
      const tree = await storage.getTree(member.treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }

      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, member.treeId);
      
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "Access denied" });
      }

      const registries = await storage.getGiftRegistriesByMember(memberId);
      
      // Enrich with item counts
      const enrichedRegistries = await Promise.all(
        registries.map(async (registry) => {
          const items = await storage.getGiftRegistryItems(registry.id);
          const purchasedCount = items.filter(i => i.status === 'purchased').length;
          
          return {
            ...registry,
            itemCount: items.length,
            purchasedCount,
            progress: items.length > 0 ? Math.round((purchasedCount / items.length) * 100) : 0,
          };
        })
      );

      res.json(enrichedRegistries);
    } catch (error) {
      console.error("Error fetching member registries:", error);
      res.status(500).json({ message: "Failed to fetch registries" });
    }
  });

  app.post("/api/trees/:treeId/resolve-conflicts", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const resolveConflictsSchema = z.object({
        sourceTreeId: z.string().min(1),
        resolutions: z.array(z.object({
          sourceMemberId: z.string().min(1),
          action: z.enum(["merge", "keep_both", "skip"]),
          targetMemberId: z.string().optional(),
        })),
      });

      const parsed = resolveConflictsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const { sourceTreeId, resolutions } = parsed.data;

      const targetTree = await storage.getTree(treeId);
      if (!targetTree) {
        return res.status(404).json({ message: "Target tree not found" });
      }

      if (targetTree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab || !["co_owner", "editor"].includes(collab.role)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const sourceTree = await storage.getTree(sourceTreeId);
      if (!sourceTree) {
        return res.status(404).json({ message: "Source tree not found" });
      }

      if (sourceTree.ownerId !== userId) {
        return res.status(403).json({ message: "You must own the source tree" });
      }

      const sourceMembers = await storage.getMembers(sourceTreeId);
      const sourceMemberMap = new Map(sourceMembers.map(m => [m.id, m]));
      const initialSourceRels = await storage.getRelationships(sourceTreeId);
      const initialTargetRels = await storage.getRelationships(treeId);

      console.log(`[resolve-conflicts] Starting: source tree ${sourceTreeId} has ${sourceMembers.length} members, ${initialSourceRels.length} relationships`);
      console.log(`[resolve-conflicts] Target tree ${treeId} has ${initialTargetRels.length} existing relationships`);

      const results: any[] = [];
      const mergedSourceToTarget = new Map<string, string>();
      const skippedIds = new Set<string>();
      const transferStats = { events: 0, nameHistory: 0, education: 0, career: 0, tags: 0, fsSources: 0, extIds: 0, specialConns: 0, giftRegistries: 0 };

      // === PHASE 1: Build resolution maps ===
      for (const resolution of resolutions) {
        if (resolution.action === "merge" && resolution.targetMemberId) {
          mergedSourceToTarget.set(resolution.sourceMemberId, resolution.targetMemberId);
        } else if (resolution.action === "skip") {
          skippedIds.add(resolution.sourceMemberId);
        }
      }
      console.log(`[resolve-conflicts] Phase 1: ${mergedSourceToTarget.size} merges, ${skippedIds.size} skips, ${sourceMembers.length - mergedSourceToTarget.size - skippedIds.size} keep/clean`);

      // Pre-compute source adjacency from ORIGINAL source relationships (before any dedup)
      // This ensures Phase 5 skip bridging has complete neighbor data even if relationships were deduped in Phase 3
      const sourceAdjacency = new Map<string, Array<{ otherId: string; relType: string; direction: "parent" | "child" | "spouse" | "other" }>>();
      for (const rel of initialSourceRels) {
        const addAdj = (memberId: string, otherId: string) => {
          if (!sourceAdjacency.has(memberId)) sourceAdjacency.set(memberId, []);
          const isParentRel = rel.relationshipType === "parent" || rel.relationshipType === "parent-child";
          const isChildRel = rel.relationshipType === "child";
          const isSpouseRel = rel.relationshipType === "spouse";
          let dir: "parent" | "child" | "spouse" | "other" = "other";
          if (isParentRel && rel.toMemberId === memberId) dir = "parent";
          else if (isParentRel && rel.fromMemberId === memberId) dir = "child";
          else if (isChildRel && rel.fromMemberId === memberId) dir = "parent";
          else if (isChildRel && rel.toMemberId === memberId) dir = "child";
          else if (isSpouseRel) dir = "spouse";
          sourceAdjacency.get(memberId)!.push({ otherId, relType: rel.relationshipType, direction: dir });
        };
        addAdj(rel.fromMemberId, rel.toMemberId);
        addAdj(rel.toMemberId, rel.fromMemberId);
      }

      // === PHASE 2: Move ALL source members into target tree FIRST ===
      // This ensures every member and relationship reference lives in one tree during processing.
      // Merged sources are deleted in Phase 4, skipped members are deleted in Phase 5.
      console.log(`[resolve-conflicts] Phase 2: Moving ALL ${sourceMembers.length} source members to target tree`);
      for (const member of sourceMembers) {
        await storage.updateMember(member.id, { treeId } as any);
      }

      // === PHASE 3: Move ALL source relationships into target tree ===
      // Helper: directional-aware duplicate check
      // Symmetric types (spouse, sibling, coparent) treat reversed pairs as duplicates
      // Directional types (parent, child, etc.) require exact from/to match
      const SYMMETRIC_REL_TYPES = new Set(["spouse", "sibling", "coparent"]);
      // Normalize parent-type relationships to canonical form for dedup:
      // "parent" A→B means A is parent of B
      // "child" A→B means A is child of B → normalize to "parent" B→A
      // "parent-child" same as "parent"
      const normalizeParentRel = (type: string, fromId: string, toId: string): [string, string, string] => {
        if (type === "child") return ["parent", toId, fromId];
        if (type === "parent-child") return ["parent", fromId, toId];
        return [type, fromId, toId];
      };
      const isRelDuplicate = (existing: { fromMemberId: string; toMemberId: string; relationshipType: string }, newRel: { fromMemberId: string; toMemberId: string; relationshipType: string }) => {
        if (existing.relationshipType !== newRel.relationshipType) return false;
        if (existing.fromMemberId === newRel.fromMemberId && existing.toMemberId === newRel.toMemberId) return true;
        if (SYMMETRIC_REL_TYPES.has(newRel.relationshipType) && existing.fromMemberId === newRel.toMemberId && existing.toMemberId === newRel.fromMemberId) return true;
        return false;
      };

      const sourceRelsNow = await storage.getRelationships(sourceTreeId);
      console.log(`[resolve-conflicts] Phase 3: Moving ${sourceRelsNow.length} relationships to target tree`);
      // Take a single snapshot of existing target relationships for efficient dedup
      const existingTargetRelsSnapshot = await storage.getRelationships(treeId);
      const targetRelSet = new Set<string>();
      for (const r of existingTargetRelsSnapshot) {
        const [nType, nFrom, nTo] = normalizeParentRel(r.relationshipType, r.fromMemberId, r.toMemberId);
        targetRelSet.add(`${nType}:${nFrom}:${nTo}`);
        if (SYMMETRIC_REL_TYPES.has(nType)) {
          targetRelSet.add(`${nType}:${nTo}:${nFrom}`);
        }
      }

      for (const rel of sourceRelsNow) {
        const [nType, nFrom, nTo] = normalizeParentRel(rel.relationshipType, rel.fromMemberId, rel.toMemberId);
        const exactKey = `${nType}:${nFrom}:${nTo}`;
        const reverseKey = `${nType}:${nTo}:${nFrom}`;
        const alreadyExists = targetRelSet.has(exactKey) || (SYMMETRIC_REL_TYPES.has(nType) && targetRelSet.has(reverseKey));

        if (!alreadyExists) {
          try {
            await storage.createRelationship({
              treeId,
              fromMemberId: rel.fromMemberId,
              toMemberId: rel.toMemberId,
              relationshipType: rel.relationshipType,
              qualifier: rel.qualifier,
            });
            targetRelSet.add(exactKey);
          } catch (e) {
            console.log(`[resolve-conflicts] Phase 3: Could not move relationship ${rel.id}:`, e);
          }
        }
        try { await storage.deleteRelationship(rel.id); } catch (e) { }
      }

      // Now all members and relationships are in the target tree
      console.log(`[resolve-conflicts] Phase 3 complete: All data now in target tree`);

      // === PHASE 4: Process merges — re-point relationships, sync data, transfer linked records ===
      // Build a tracking set of all existing relationship keys for O(1) dedup
      const mergeRelTracker = new Set<string>();
      const snapshotRelsForMerge = await storage.getRelationships(treeId);
      for (const r of snapshotRelsForMerge) {
        const [normType, normFrom, normTo] = normalizeParentRel(r.relationshipType, r.fromMemberId, r.toMemberId);
        mergeRelTracker.add(`${normType}:${normFrom}:${normTo}`);
        if (SYMMETRIC_REL_TYPES.has(normType)) {
          mergeRelTracker.add(`${normType}:${normTo}:${normFrom}`);
        }
      }

      for (const resolution of resolutions) {
        if (resolution.action !== "merge") continue;
        const { sourceMemberId, targetMemberId } = resolution;
        if (!targetMemberId) {
          results.push({ sourceMemberId, action: "merge", status: "error_no_target" });
          continue;
        }

        const sourceMember = sourceMemberMap.get(sourceMemberId);
        if (!sourceMember) {
          results.push({ sourceMemberId, action: "merge", status: "skipped_not_found" });
          continue;
        }

        const targetMember = await storage.getMember(targetMemberId);
        if (!targetMember) {
          results.push({ sourceMemberId, action: "merge", status: "error_target_not_found" });
          continue;
        }

        console.log(`[resolve-conflicts] Phase 4: Merging ${sourceMember.firstName} ${sourceMember.lastName || ''} → ${targetMember.firstName} ${targetMember.lastName || ''}`);

        const updates: Record<string, any> = {};
        const notesAppendParts: string[] = [];
        const syncField = (field: string, sourceVal: any, targetVal: any) => {
          const srcEmpty = sourceVal == null || sourceVal === '' || sourceVal === undefined;
          const tgtEmpty = targetVal == null || targetVal === '' || targetVal === undefined;
          if (tgtEmpty && !srcEmpty) {
            updates[field] = sourceVal;
          } else if (!tgtEmpty && !srcEmpty && String(targetVal) !== String(sourceVal)) {
            if (field === 'notes') {
              updates[field] = `${targetVal}\n\n[Merged from FamilySearch]: ${sourceVal}`;
            } else if (field === 'birthDate' || field === 'deathDate') {
              if (String(sourceVal).length > String(targetVal).length) {
                updates[field] = sourceVal;
                notesAppendParts.push(`Original ${field}: ${targetVal}`);
              } else {
                notesAppendParts.push(`Alternate ${field}: ${sourceVal}`);
              }
            } else if (field === 'birthPlace' || field === 'currentCity' || field === 'currentRegion' || field === 'currentCountry') {
              if (String(sourceVal).length > String(targetVal).length) {
                updates[field] = sourceVal;
                notesAppendParts.push(`Original ${field}: ${targetVal}`);
              } else {
                notesAppendParts.push(`Alternate ${field}: ${sourceVal}`);
              }
            } else if (field === 'nickname') {
              notesAppendParts.push(`Alternate name: ${sourceVal}`);
            } else if (field === 'firstName' || field === 'lastName') {
              notesAppendParts.push(`Alternate ${field}: ${sourceVal}`);
            } else if (field === 'suffix') {
              notesAppendParts.push(`Alternate suffix: ${sourceVal}`);
            }
          }
        };
        syncField('firstName', sourceMember.firstName, targetMember.firstName);
        syncField('lastName', sourceMember.lastName, targetMember.lastName);
        syncField('suffix', (sourceMember as any).suffix, (targetMember as any).suffix);
        syncField('nickname', sourceMember.nickname, targetMember.nickname);
        syncField('birthDate', sourceMember.birthDate, targetMember.birthDate);
        syncField('birthPlace', sourceMember.birthPlace, targetMember.birthPlace);
        syncField('deathDate', sourceMember.deathDate, targetMember.deathDate);
        syncField('photoUrl', sourceMember.photoUrl, targetMember.photoUrl);
        syncField('notes', sourceMember.notes, targetMember.notes);
        syncField('gender', sourceMember.gender, targetMember.gender);
        syncField('email', sourceMember.email, targetMember.email);
        syncField('isLiving', sourceMember.isLiving, targetMember.isLiving);
        syncField('currentCity', sourceMember.currentCity, targetMember.currentCity);
        syncField('currentRegion', sourceMember.currentRegion, targetMember.currentRegion);
        syncField('currentCountry', sourceMember.currentCountry, targetMember.currentCountry);
        if (!(targetMember as any).customPosition && (sourceMember as any).customPosition) {
          updates['customPosition'] = (sourceMember as any).customPosition;
        }

        if (notesAppendParts.length > 0) {
          const existingNotes = updates['notes'] || targetMember.notes || '';
          const appendText = `\n\n[FamilySearch alternate data]: ${notesAppendParts.join(', ')}`;
          updates['notes'] = existingNotes ? existingNotes + appendText : appendText.trim();
        }

        if (Object.keys(updates).length > 0) {
          await storage.updateMember(targetMemberId, updates);
          console.log(`[resolve-conflicts] Synced ${Object.keys(updates).length} fields to target: ${Object.keys(updates).join(', ')}`);
        }

        // Re-point all relationships from source member to target member
        // Fetch fresh snapshot for each merge to account for previous merge changes
        const allTreeRels = await storage.getRelationships(treeId);
        const affectedRels = allTreeRels.filter(
          r => r.fromMemberId === sourceMemberId || r.toMemberId === sourceMemberId
        );
        let repointed = 0;
        let skippedDups = 0;
        for (const rel of affectedRels) {
          const isFrom = rel.fromMemberId === sourceMemberId;
          const otherMemberId = isFrom ? rel.toMemberId : rel.fromMemberId;

          // Resolve BOTH sides through the merge map
          const resolvedOtherId = mergedSourceToTarget.get(otherMemberId) || otherMemberId;
          if (resolvedOtherId === targetMemberId) {
            try { await storage.deleteRelationship(rel.id); } catch (e) { }
            continue;
          }

          const newFromId = isFrom ? targetMemberId : resolvedOtherId;
          const newToId = isFrom ? resolvedOtherId : targetMemberId;

          // O(1) dedup check using the tracking set with normalization
          const [normType, normFrom, normTo] = normalizeParentRel(rel.relationshipType, newFromId, newToId);
          const exactKey = `${normType}:${normFrom}:${normTo}`;
          const reverseKey = `${normType}:${normTo}:${normFrom}`;
          const alreadyExists = mergeRelTracker.has(exactKey) ||
            (SYMMETRIC_REL_TYPES.has(normType) && mergeRelTracker.has(reverseKey));

          if (!alreadyExists) {
            try {
              await storage.createRelationship({
                treeId,
                fromMemberId: newFromId,
                toMemberId: newToId,
                relationshipType: rel.relationshipType,
                qualifier: rel.qualifier,
              });
              mergeRelTracker.add(exactKey);
              if (SYMMETRIC_REL_TYPES.has(normType)) {
                mergeRelTracker.add(reverseKey);
              }
              repointed++;
            } catch (e) {
              console.log(`[resolve-conflicts] Could not re-point relationship ${rel.relationshipType} ${newFromId.substring(0,8)}->${newToId.substring(0,8)}:`, e);
            }
          } else {
            skippedDups++;
          }
          // Remove old relationship keys from tracker and delete
          const [oldNormType, oldNormFrom, oldNormTo] = normalizeParentRel(rel.relationshipType, rel.fromMemberId, rel.toMemberId);
          mergeRelTracker.delete(`${oldNormType}:${oldNormFrom}:${oldNormTo}`);
          if (SYMMETRIC_REL_TYPES.has(oldNormType)) {
            mergeRelTracker.delete(`${oldNormType}:${oldNormTo}:${oldNormFrom}`);
          }
          try { await storage.deleteRelationship(rel.id); } catch (e) { }
        }
        console.log(`[resolve-conflicts] Re-pointed ${repointed} relationships, skipped ${skippedDups} duplicates for ${sourceMember.firstName} ${sourceMember.lastName || ''}`);

        // Transfer ALL linked records from source member to target member (true sync — nothing lost)
        const mergeLog: string[] = [];
        try {
          const srcEvents = await db.select().from(familyEvents).where(eq(familyEvents.memberId, sourceMemberId));
          if (srcEvents.length > 0) {
            await db.update(familyEvents).set({ memberId: targetMemberId }).where(eq(familyEvents.memberId, sourceMemberId));
            transferStats.events += srcEvents.length;
            mergeLog.push(`${srcEvents.length} life events`);
          }

          const srcNames = await db.select().from(nameHistory).where(eq(nameHistory.memberId, sourceMemberId));
          if (srcNames.length > 0) {
            await db.update(nameHistory).set({ memberId: targetMemberId }).where(eq(nameHistory.memberId, sourceMemberId));
            transferStats.nameHistory += srcNames.length;
            mergeLog.push(`${srcNames.length} name records`);
          }

          const srcEdu = await db.select().from(educationHistory).where(eq(educationHistory.memberId, sourceMemberId));
          if (srcEdu.length > 0) {
            await db.update(educationHistory).set({ memberId: targetMemberId }).where(eq(educationHistory.memberId, sourceMemberId));
            transferStats.education += srcEdu.length;
            mergeLog.push(`${srcEdu.length} education records`);
          }

          const srcCareer = await db.select().from(careerHistory).where(eq(careerHistory.memberId, sourceMemberId));
          if (srcCareer.length > 0) {
            await db.update(careerHistory).set({ memberId: targetMemberId }).where(eq(careerHistory.memberId, sourceMemberId));
            transferStats.career += srcCareer.length;
            mergeLog.push(`${srcCareer.length} career records`);
          }

          const srcTags = await db.select().from(memberTags).where(eq(memberTags.memberId, sourceMemberId));
          let tagsTransferred = 0;
          for (const tag of srcTags) {
            const existingTag = await db.select().from(memberTags).where(
              and(eq(memberTags.memberId, targetMemberId), eq(memberTags.tagId, tag.tagId))
            );
            if (existingTag.length === 0) {
              await db.update(memberTags).set({ memberId: targetMemberId }).where(eq(memberTags.id, tag.id));
              tagsTransferred++;
            } else {
              await db.delete(memberTags).where(eq(memberTags.id, tag.id));
            }
          }
          if (tagsTransferred > 0) {
            transferStats.tags += tagsTransferred;
            mergeLog.push(`${tagsTransferred} tags`);
          }

          const srcFsSources = await db.select().from(familySearchSources).where(eq(familySearchSources.memberId, sourceMemberId));
          if (srcFsSources.length > 0) {
            await db.update(familySearchSources).set({ memberId: targetMemberId }).where(eq(familySearchSources.memberId, sourceMemberId));
            transferStats.fsSources += srcFsSources.length;
            mergeLog.push(`${srcFsSources.length} FS sources`);
          }

          const srcExtIds = await db.select().from(externalPersonIdentifiers).where(eq(externalPersonIdentifiers.memberId, sourceMemberId));
          if (srcExtIds.length > 0) {
            await db.update(externalPersonIdentifiers).set({ memberId: targetMemberId }).where(eq(externalPersonIdentifiers.memberId, sourceMemberId));
            transferStats.extIds += srcExtIds.length;
            mergeLog.push(`${srcExtIds.length} external IDs`);
          }

          let specialConnsTransferred = 0;
          const srcSpecialFrom = await db.select().from(specialConnections).where(eq(specialConnections.fromMemberId, sourceMemberId));
          for (const conn of srcSpecialFrom) {
            const resolvedTo = mergedSourceToTarget.get(conn.toMemberId) || conn.toMemberId;
            if (resolvedTo === targetMemberId) {
              await db.delete(specialConnections).where(eq(specialConnections.id, conn.id));
            } else {
              await db.update(specialConnections).set({ fromMemberId: targetMemberId, toMemberId: resolvedTo }).where(eq(specialConnections.id, conn.id));
              specialConnsTransferred++;
            }
          }
          const srcSpecialTo = await db.select().from(specialConnections).where(eq(specialConnections.toMemberId, sourceMemberId));
          for (const conn of srcSpecialTo) {
            const resolvedFrom = mergedSourceToTarget.get(conn.fromMemberId) || conn.fromMemberId;
            if (resolvedFrom === targetMemberId) {
              await db.delete(specialConnections).where(eq(specialConnections.id, conn.id));
            } else {
              await db.update(specialConnections).set({ toMemberId: targetMemberId, fromMemberId: resolvedFrom }).where(eq(specialConnections.id, conn.id));
              specialConnsTransferred++;
            }
          }
          if (specialConnsTransferred > 0) {
            transferStats.specialConns += specialConnsTransferred;
            mergeLog.push(`${specialConnsTransferred} special connections`);
          }

          const srcRegistries = await db.select().from(giftRegistries).where(eq(giftRegistries.memberId, sourceMemberId));
          if (srcRegistries.length > 0) {
            await db.update(giftRegistries).set({ memberId: targetMemberId, treeId }).where(eq(giftRegistries.memberId, sourceMemberId));
            transferStats.giftRegistries += srcRegistries.length;
            mergeLog.push(`${srcRegistries.length} gift registries`);
          }

          if (mergeLog.length > 0) {
            console.log(`[resolve-conflicts] Transferred linked data for ${sourceMember.firstName} ${sourceMember.lastName || ''}: ${mergeLog.join(', ')}`);
          }
        } catch (e) {
          console.log(`[resolve-conflicts] Error transferring linked records for ${sourceMemberId}:`, e);
        }

        // Delete the source member (now fully merged)
        // First clean up any remaining relationships referencing this member
        const remainingRels = await storage.getRelationships(treeId);
        for (const rel of remainingRels) {
          if (rel.fromMemberId === sourceMemberId || rel.toMemberId === sourceMemberId) {
            try { await storage.deleteRelationship(rel.id); } catch (e) { }
          }
        }
        await storage.removeMemberRecord(sourceMemberId);
        results.push({ sourceMemberId, action: "merge", status: "merged", targetMemberId, repointed, skippedDups });
      }

      // === PHASE 5: Process skips — bridge parent-child AND spouse chains ===
      // Build a tracking set for skip phase dedup using directional normalization
      const skipRelTracker = new Set<string>();
      const skipPhaseRels = await storage.getRelationships(treeId);
      for (const r of skipPhaseRels) {
        const [nType, nFrom, nTo] = normalizeParentRel(r.relationshipType, r.fromMemberId, r.toMemberId);
        skipRelTracker.add(`${nType}:${nFrom}:${nTo}`);
        if (SYMMETRIC_REL_TYPES.has(nType)) {
          skipRelTracker.add(`${nType}:${nTo}:${nFrom}`);
        }
      }

      for (const resolution of resolutions) {
        if (resolution.action !== "skip") continue;
        const { sourceMemberId } = resolution;
        const sourceMember = sourceMemberMap.get(sourceMemberId);
        if (!sourceMember) {
          results.push({ sourceMemberId, action: "skip", status: "skipped_not_found" });
          continue;
        }

        // Safety: if no skip target, treat as keep_both to prevent data loss
        const resolvedSkipTarget = resolution.targetMemberId || mergedSourceToTarget.get(sourceMemberId);
        if (!resolvedSkipTarget) {
          console.log(`[resolve-conflicts] Phase 5: No skip target for ${sourceMember.firstName} ${sourceMember.lastName || ''} — keeping as separate member to prevent data loss`);
          results.push({ sourceMemberId, action: "skip", status: "kept_no_target" });
          continue;
        }

        console.log(`[resolve-conflicts] Phase 5: Skipping ${sourceMember.firstName} ${sourceMember.lastName || ''} → target ${resolvedSkipTarget.substring(0,8)}`);

        // Use BOTH current DB relationships AND pre-computed source adjacency for complete neighbor discovery
        const allRels = await storage.getRelationships(treeId);
        const affectedRels = allRels.filter(
          r => r.fromMemberId === sourceMemberId || r.toMemberId === sourceMemberId
        );

        // Build neighbors from DB relationships
        const neighborMap = new Map<string, { memberId: string; relType: string; direction: "parent" | "child" | "spouse" | "other" }>();
        for (const rel of affectedRels) {
          const otherId = rel.fromMemberId === sourceMemberId ? rel.toMemberId : rel.fromMemberId;
          if (skippedIds.has(otherId) && otherId !== sourceMemberId) continue;
          const resolvedOtherId = mergedSourceToTarget.get(otherId) || otherId;

          const isParentRel = rel.relationshipType === "parent" || rel.relationshipType === "parent-child";
          const isChildRel = rel.relationshipType === "child";
          const isSpouseRel = rel.relationshipType === "spouse";
          let direction: "parent" | "child" | "spouse" | "other" = "other";

          if (isParentRel && rel.toMemberId === sourceMemberId) direction = "parent";
          else if (isParentRel && rel.fromMemberId === sourceMemberId) direction = "child";
          else if (isChildRel && rel.fromMemberId === sourceMemberId) direction = "parent";
          else if (isChildRel && rel.toMemberId === sourceMemberId) direction = "child";
          else if (isSpouseRel) direction = "spouse";

          neighborMap.set(`${resolvedOtherId}:${direction}`, { memberId: resolvedOtherId, relType: rel.relationshipType, direction });
        }

        // Supplement with pre-computed source adjacency (catches relationships that were deduped in Phase 3)
        const srcAdj = sourceAdjacency.get(sourceMemberId) || [];
        for (const adj of srcAdj) {
          if (skippedIds.has(adj.otherId) && adj.otherId !== sourceMemberId) continue;
          const resolvedId = mergedSourceToTarget.get(adj.otherId) || adj.otherId;
          const key = `${resolvedId}:${adj.direction}`;
          if (!neighborMap.has(key)) {
            neighborMap.set(key, { memberId: resolvedId, relType: adj.relType, direction: adj.direction });
          }
        }

        const neighbors = Array.from(neighborMap.values());

        const parents = neighbors.filter(n => n.direction === "parent");
        const children = neighbors.filter(n => n.direction === "child");
        let bridged = 0;

        // Bridge parent-child chains
        if (parents.length > 0 && children.length > 0) {
          for (const parent of parents) {
            for (const child of children) {
              if (parent.memberId === child.memberId) continue;
              const key = `parent:${parent.memberId}:${child.memberId}`;
              const reverseKey = `parent:${child.memberId}:${parent.memberId}`;
              if (!skipRelTracker.has(key) && !skipRelTracker.has(reverseKey)) {
                try {
                  await storage.createRelationship({
                    treeId,
                    fromMemberId: parent.memberId,
                    toMemberId: child.memberId,
                    relationshipType: "parent",
                  });
                  skipRelTracker.add(key);
                  bridged++;
                  console.log(`[resolve-conflicts] Bridged parent-child: ${parent.memberId.substring(0,8)} -> ${child.memberId.substring(0,8)}`);
                } catch (e) {
                  console.log(`[resolve-conflicts] Could not bridge parent-child:`, e);
                }
              }
            }
          }
        }

        // Bridge spouse connections and re-route to skip target
        const spouses = neighbors.filter(n => n.direction === "spouse");
        let spouseBridged = 0;

        if (spouses.length > 0) {
          // 1. Re-route spouse connections to the skip target (the existing equivalent person)
          //    resolvedSkipTarget is guaranteed to exist (we checked above)
          for (const spouse of spouses) {
              if (spouse.memberId === resolvedSkipTarget) continue;
              const key = `spouse:${spouse.memberId}:${resolvedSkipTarget}`;
              const reverseKey = `spouse:${resolvedSkipTarget}:${spouse.memberId}`;
              if (!skipRelTracker.has(key) && !skipRelTracker.has(reverseKey)) {
                try {
                  await storage.createRelationship({
                    treeId,
                    fromMemberId: spouse.memberId,
                    toMemberId: resolvedSkipTarget,
                    relationshipType: "spouse",
                  });
                  skipRelTracker.add(key);
                  skipRelTracker.add(reverseKey);
                  spouseBridged++;
                  console.log(`[resolve-conflicts] Re-routed spouse to skip target: ${spouse.memberId.substring(0,8)} -> ${resolvedSkipTarget.substring(0,8)}`);
                } catch (e) {
                  console.log(`[resolve-conflicts] Could not re-route spouse:`, e);
                }
              }
          }

          // 2. If skipped member had children, make spouse a co-parent of those children
          for (const spouse of spouses) {
            for (const child of children) {
              if (spouse.memberId === child.memberId) continue;
              const key = `parent:${spouse.memberId}:${child.memberId}`;
              const reverseKey = `parent:${child.memberId}:${spouse.memberId}`;
              if (!skipRelTracker.has(key) && !skipRelTracker.has(reverseKey)) {
                try {
                  await storage.createRelationship({
                    treeId,
                    fromMemberId: spouse.memberId,
                    toMemberId: child.memberId,
                    relationshipType: "parent",
                  });
                  skipRelTracker.add(key);
                  spouseBridged++;
                  console.log(`[resolve-conflicts] Bridged spouse-to-child: ${spouse.memberId.substring(0,8)} -> ${child.memberId.substring(0,8)}`);
                } catch (e) {
                  console.log(`[resolve-conflicts] Could not bridge spouse-to-child:`, e);
                }
              }
            }
          }
        }

        // 3. Re-route parent relationships to skip target
        //    resolvedSkipTarget is guaranteed to exist (checked at top of loop)
        if (parents.length > 0) {
          for (const parent of parents) {
            if (parent.memberId === resolvedSkipTarget) continue;
            const [nType, nFrom, nTo] = normalizeParentRel("parent", parent.memberId, resolvedSkipTarget);
            const key = `${nType}:${nFrom}:${nTo}`;
            if (!skipRelTracker.has(key)) {
              try {
                await storage.createRelationship({
                  treeId,
                  fromMemberId: parent.memberId,
                  toMemberId: resolvedSkipTarget,
                  relationshipType: "parent",
                });
                skipRelTracker.add(key);
                bridged++;
                console.log(`[resolve-conflicts] Re-routed parent to skip target: ${parent.memberId.substring(0,8)} -> ${resolvedSkipTarget.substring(0,8)}`);
              } catch (e) {
                console.log(`[resolve-conflicts] Could not re-route parent to skip target:`, e);
              }
            }
          }
        }

        // Delete all relationships for the skipped member and remove from tracker
        for (const rel of affectedRels) {
          const [delNType, delNFrom, delNTo] = normalizeParentRel(rel.relationshipType, rel.fromMemberId, rel.toMemberId);
          skipRelTracker.delete(`${delNType}:${delNFrom}:${delNTo}`);
          if (SYMMETRIC_REL_TYPES.has(delNType)) {
            skipRelTracker.delete(`${delNType}:${delNTo}:${delNFrom}`);
          }
          try { await storage.deleteRelationship(rel.id); } catch (e) { }
        }

        // Delete the skipped member
        await storage.removeMemberRecord(sourceMemberId);
        results.push({ sourceMemberId, action: "skip", status: "removed", bridged, spouseBridged });
      }

      // Mark keep_both members in results
      for (const resolution of resolutions) {
        if (resolution.action === "keep_both") {
          results.push({ sourceMemberId: resolution.sourceMemberId, action: "keep_both", status: "kept" });
        }
      }

      // === PHASE 6: Clean up orphaned relationships and deduplicate ===
      const allFinalRels = await storage.getRelationships(treeId);
      const allFinalMemberIds = new Set((await storage.getMembers(treeId)).map(m => m.id));
      const relKeys = new Map<string, string>();
      let deduped = 0;
      let orphansCleaned = 0;
      for (const rel of allFinalRels) {
        if (!allFinalMemberIds.has(rel.fromMemberId) || !allFinalMemberIds.has(rel.toMemberId)) {
          try { await storage.deleteRelationship(rel.id); orphansCleaned++; } catch (e) { }
          continue;
        }
        const [nType, nFrom, nTo] = normalizeParentRel(rel.relationshipType, rel.fromMemberId, rel.toMemberId);
        const key1 = `${nType}:${nFrom}:${nTo}`;
        const key2 = SYMMETRIC_REL_TYPES.has(nType) ? `${nType}:${nTo}:${nFrom}` : null;
        if (relKeys.has(key1) || (key2 && relKeys.has(key2))) {
          try { await storage.deleteRelationship(rel.id); deduped++; } catch (e) { }
        } else {
          relKeys.set(key1, rel.id);
        }
      }
      if (deduped > 0 || orphansCleaned > 0) {
        console.log(`[resolve-conflicts] Phase 6: Removed ${deduped} duplicates and ${orphansCleaned} orphaned relationships`);
      }

      // === PHASE 7: Integrity check — verify all relationships and trace ancestor chains ===
      const finalMembers = await storage.getMembers(treeId);
      const finalRels = await storage.getRelationships(treeId);
      const memberIds = new Set(finalMembers.map(m => m.id));

      let orphanedRels = 0;
      for (const rel of finalRels) {
        if (!memberIds.has(rel.fromMemberId) || !memberIds.has(rel.toMemberId)) {
          orphanedRels++;
          console.log(`[resolve-conflicts] WARNING: Orphaned relationship ${rel.id}: ${rel.fromMemberId.substring(0,8)} -> ${rel.toMemberId.substring(0,8)} (type: ${rel.relationshipType})`);
          try { await storage.deleteRelationship(rel.id); } catch (e) { }
        }
      }

      // Build child→parents map for chain tracing
      const parentChildMap = new Map<string, string[]>();
      const childToParentsMap = new Map<string, string[]>();
      for (const rel of finalRels) {
        if (rel.relationshipType === "parent" || rel.relationshipType === "parent-child") {
          if (!parentChildMap.has(rel.fromMemberId)) parentChildMap.set(rel.fromMemberId, []);
          parentChildMap.get(rel.fromMemberId)!.push(rel.toMemberId);
          if (!childToParentsMap.has(rel.toMemberId)) childToParentsMap.set(rel.toMemberId, []);
          childToParentsMap.get(rel.toMemberId)!.push(rel.fromMemberId);
        } else if (rel.relationshipType === "child") {
          if (!parentChildMap.has(rel.toMemberId)) parentChildMap.set(rel.toMemberId, []);
          parentChildMap.get(rel.toMemberId)!.push(rel.fromMemberId);
          if (!childToParentsMap.has(rel.fromMemberId)) childToParentsMap.set(rel.fromMemberId, []);
          childToParentsMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        }
      }

      // Trace ancestor chains from each member up to root ancestors
      let maxChainDepth = 0;
      const traceUp = (memberId: string, depth: number, visited: Set<string>): number => {
        if (visited.has(memberId)) return depth;
        visited.add(memberId);
        const parents = childToParentsMap.get(memberId) || [];
        if (parents.length === 0) return depth;
        let maxDepth = depth;
        for (const parentId of parents) {
          maxDepth = Math.max(maxDepth, traceUp(parentId, depth + 1, visited));
        }
        return maxDepth;
      };
      for (const member of finalMembers) {
        const depth = traceUp(member.id, 0, new Set());
        maxChainDepth = Math.max(maxChainDepth, depth);
      }

      // Count relationship types
      const relTypeCounts: Record<string, number> = {};
      for (const rel of finalRels) {
        relTypeCounts[rel.relationshipType] = (relTypeCounts[rel.relationshipType] || 0) + 1;
      }

      // Log each parent-child chain for debugging
      const membersNoParents = finalMembers.filter(m => !childToParentsMap.has(m.id));
      const membersNoChildren = finalMembers.filter(m => !parentChildMap.has(m.id));
      console.log(`[resolve-conflicts] Chain analysis: ${membersNoParents.length} root ancestors (no parents), ${membersNoChildren.length} leaf members (no children)`);
      console.log(`[resolve-conflicts] Relationship types: ${JSON.stringify(relTypeCounts)}`);

      // Verify specific ancestor connections by logging chains
      for (const member of finalMembers) {
        const parents = childToParentsMap.get(member.id) || [];
        if (parents.length > 0) {
          const parentNames = parents.map(pid => {
            const p = finalMembers.find(m => m.id === pid);
            return p ? `${p.firstName} ${p.lastName || ''}` : pid.substring(0,8);
          });
          console.log(`[resolve-conflicts] ${member.firstName} ${member.lastName || ''} ← parents: [${parentNames.join(', ')}]`);
        }
      }

      // Clean up empty source tree
      const finalSourceMembers = await storage.getMembers(sourceTreeId);
      if (finalSourceMembers.length === 0) {
        console.log(`[resolve-conflicts] Sub-tree ${sourceTreeId} is now empty, deleting it`);
        try { await storage.deleteTree(sourceTreeId); } catch (e) { }
      }

      const mergeCount = results.filter(r => r.action === "merge" && r.status === "merged").length;
      const skipCount = results.filter(r => r.action === "skip" && r.status === "removed").length;
      const keepCount = results.filter(r => r.action === "keep_both").length;

      // Build chain verification details using precomputed name map (O(1) lookups)
      const memberNameMap = new Map<string, string>();
      for (const m of finalMembers) {
        memberNameMap.set(m.id, `${m.firstName} ${m.lastName || ''}`.trim());
      }

      const chainVerification: Array<{ name: string; depth: number; path: string[] }> = [];
      let cyclesDetected = 0;
      for (const member of finalMembers) {
        const visited = new Set<string>();
        const tracePath = (mid: string, path: string[]): { depth: number; path: string[] } => {
          if (visited.has(mid)) {
            cyclesDetected++;
            return { depth: path.length, path: [...path, `[cycle: ${memberNameMap.get(mid) || mid.substring(0, 8)}]`] };
          }
          visited.add(mid);
          const pars = childToParentsMap.get(mid) || [];
          if (pars.length === 0) return { depth: path.length, path };
          let best = { depth: path.length, path };
          for (const pid of pars) {
            const pName = memberNameMap.get(pid) || pid.substring(0, 8);
            const result = tracePath(pid, [...path, pName]);
            if (result.depth > best.depth) best = result;
          }
          return best;
        };
        const memberName = memberNameMap.get(member.id) || member.id.substring(0, 8);
        const result = tracePath(member.id, [memberName]);
        if (result.depth > 1) {
          chainVerification.push({ name: memberName, depth: result.depth - 1, path: result.path });
        }
      }
      chainVerification.sort((a, b) => b.depth - a.depth);
      const topChains = chainVerification.slice(0, 5);

      if (cyclesDetected > 0) {
        console.log(`[resolve-conflicts] WARNING: ${cyclesDetected} cycle(s) detected in ancestor chains`);
      }

      // Count members with spouse relationships
      const spouseRelCount = finalRels.filter(r => r.relationshipType === "spouse").length;

      const integrity = {
        totalMembers: finalMembers.length,
        totalRelationships: finalRels.length - orphanedRels,
        orphanedRelationships: orphanedRels,
        maxAncestorDepth: maxChainDepth,
        chainIntact: orphanedRels === 0 && cyclesDetected === 0,
        transferredData: transferStats,
        relationshipTypes: relTypeCounts,
        mergeCount,
        skipCount,
        keepCount,
        rootAncestors: membersNoParents.length,
        leafMembers: membersNoChildren.length,
        spouseConnections: spouseRelCount,
        chainVerification: topChains,
        duplicatesRemoved: deduped,
        cyclesDetected,
      };

      console.log(`[resolve-conflicts] COMPLETE. Tree now has ${finalMembers.length} members, ${finalRels.length} relationships, max ancestor depth: ${maxChainDepth}, orphaned: ${orphanedRels}`);
      console.log(`[resolve-conflicts] Summary: ${mergeCount} merged, ${skipCount} skipped, ${keepCount} kept separate`);
      console.log(`[resolve-conflicts] Transferred: ${transferStats.events} events, ${transferStats.nameHistory} name records, ${transferStats.education} education, ${transferStats.career} career, ${transferStats.tags} tags, ${transferStats.fsSources} FS sources, ${transferStats.extIds} external IDs, ${transferStats.specialConns} special connections, ${transferStats.giftRegistries} gift registries`);

      res.json({
        message: "Conflicts resolved and members integrated into tree",
        results,
        integrity,
        integratedMembers: finalSourceMembers.length === 0,
        parentTreeId: treeId,
      });
    } catch (error) {
      console.error("Error resolving conflicts:", error);
      res.status(500).json({ message: "Failed to resolve conflicts" });
    }
  });

  app.get("/api/trees/:treeId/relationship-chains", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) return res.status(403).json({ message: "Access denied" });
      }

      const members = await storage.getMembers(treeId);
      const rels = await storage.getRelationships(treeId);
      const memberMap = new Map(members.map(m => [m.id, m]));

      const chains: any[] = [];
      const childToParents = new Map<string, string[]>();
      for (const rel of rels) {
        if (rel.relationshipType === "parent" || rel.relationshipType === "parent-child") {
          if (!childToParents.has(rel.toMemberId)) childToParents.set(rel.toMemberId, []);
          childToParents.get(rel.toMemberId)!.push(rel.fromMemberId);
        }
      }

      const memberName = (id: string) => {
        const m = memberMap.get(id);
        return m ? `${m.firstName} ${m.lastName || ''}`.trim() : `Unknown(${id.substring(0,8)})`;
      };

      for (const member of members) {
        const parents = childToParents.get(member.id) || [];
        if (parents.length > 0) {
          chains.push({
            member: memberName(member.id),
            memberId: member.id,
            parents: parents.map(pid => ({ name: memberName(pid), id: pid })),
          });
        }
      }

      const relSummary = rels.map(r => ({
        type: r.relationshipType,
        from: memberName(r.fromMemberId),
        to: memberName(r.toMemberId),
        fromId: r.fromMemberId,
        toId: r.toMemberId,
      }));

      res.json({
        totalMembers: members.length,
        totalRelationships: rels.length,
        chains,
        relationships: relSummary,
      });
    } catch (error) {
      console.error("Error fetching relationship chains:", error);
      res.status(500).json({ message: "Failed to fetch relationship chains" });
    }
  });

  app.get("/api/trees/:treeId/upcoming-events", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId } = req.params;
      const userId = req.user.claims.sub;

      const tree = await storage.getTree(treeId);
      if (!tree) return res.status(404).json({ message: "Tree not found" });

      if (tree.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, treeId);
        if (!collab) return res.status(403).json({ message: "Access denied" });
      }

      const members = await storage.getMembers(treeId);
      const now = new Date();
      const currentYear = now.getFullYear();
      const upcomingDays = 30;
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + upcomingDays);

      const upcomingBirthdays: { memberId: string; date: string; daysUntil: number }[] = [];
      for (const member of members) {
        if (!member.birthDate || member.isLiving === false) continue;
        try {
          const bd = new Date(member.birthDate);
          const month = bd.getMonth();
          const day = bd.getDate();
          let nextBday = new Date(currentYear, month, day);
          if (nextBday < now) {
            nextBday = new Date(currentYear + 1, month, day);
          }
          const diffMs = nextBday.getTime() - now.getTime();
          const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (daysUntil <= upcomingDays) {
            upcomingBirthdays.push({ memberId: member.id, date: member.birthDate, daysUntil });
          }
        } catch (e) { }
      }

      const allRegistries = await db.select().from(giftRegistries)
        .where(and(eq(giftRegistries.treeId, treeId), eq(giftRegistries.isActive, true)));

      const activeRegistries: { memberId: string; registryId: string; title: string; eventDate: string | null; daysUntil: number | null }[] = [];
      for (const reg of allRegistries) {
        let daysUntil: number | null = null;
        if (reg.eventDate) {
          const evDate = new Date(reg.eventDate);
          const diffMs = evDate.getTime() - now.getTime();
          daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }
        activeRegistries.push({
          memberId: reg.memberId,
          registryId: reg.id,
          title: reg.title,
          eventDate: reg.eventDate ? String(reg.eventDate) : null,
          daysUntil,
        });
      }

      res.json({ upcomingBirthdays, activeRegistries });
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
      res.status(500).json({ message: "Failed to fetch upcoming events" });
    }
  });

  return httpServer;
}
