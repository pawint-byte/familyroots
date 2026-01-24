import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { 
  insertFamilyTreeSchema, insertFamilyMemberSchema, 
  insertRelationshipSchema, insertFamilyEventSchema,
  insertNameHistorySchema, insertTreeConnectionSchema,
  insertCustodianshipRequestSchema
} from "@shared/schema";
import { mergeMemberWithUserProfile } from "@shared/utils/profile-merge";
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
import { sendInactivityReminder, sendAccountTransferNotification, sendFamilyMemberInvitation, sendLifeEventNotification } from "./lib/email";
import { insertAccountHeirSchema } from "@shared/schema";
import { printfulService } from "./printful";
import { subscriptionService, SUBSCRIPTION_CONFIG } from "./subscriptionService";
import * as familySearchService from "./familySearch";

// Privacy visibility filtering for family members
type VisibilityTier = "full" | "extended" | "limited";

// Fields visible at each tier
const VISIBILITY_FIELDS: Record<VisibilityTier, string[]> = {
  full: ["id", "treeId", "firstName", "lastName", "nickname", "email", "gender", "birthDate", "birthPlace", "deathDate", "isLiving", "photoUrl", "notes", "isUnknown", "unknownLabel", "claimedByUserId", "claimedAt", "custodianUserId", "custodianAssignedAt", "visibilityOverride", "createdAt", "updatedAt"],
  extended: ["id", "treeId", "firstName", "lastName", "gender", "birthDate", "photoUrl", "isLiving", "isUnknown", "unknownLabel", "visibilityOverride"],
  limited: ["id", "treeId", "firstName", "lastName", "isLiving", "isUnknown", "unknownLabel", "visibilityOverride"],
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
          return {
            ...tree,
            memberCount: members.length,
          };
        })
      );
      
      res.json(treesWithCounts);
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

      // Merge claimed member data with user profiles (single source of truth)
      const mergedMembers = await Promise.all(
        members.map(async (member) => {
          if (member.claimedByUserId) {
            const claimedUser = await storage.getUser(member.claimedByUserId);
            const mergedProfile = mergeMemberWithUserProfile(member, claimedUser);
            return {
              ...member,
              // Apply merged personal data fields
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
              // Include source info for UI to show sync indicators
              _profileSourceInfo: mergedProfile._sourceInfo,
            };
          }
          return member;
        })
      );

      res.json({ tree, members: mergedMembers, relationships });
    } catch (error) {
      console.error("Error fetching tree:", error);
      res.status(500).json({ message: "Failed to fetch tree" });
    }
  });

  // Create a new tree
  app.post("/api/trees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check free tier limits: 1 tree without subscription
      const user = await storage.getUser(userId);
      let hasActiveSubscription = false;
      if (user?.stripeCustomerId) {
        const subscription = await stripeService.getCustomerSubscription(user.stripeCustomerId);
        hasActiveSubscription = subscription !== null;
      }
      
      if (!hasActiveSubscription) {
        const existingTrees = await storage.getTrees(userId);
        if (existingTrees.length >= 1) {
          return res.status(402).json({ 
            message: "Free tier limit reached. Subscribe to create more family trees.",
            code: "FREE_TIER_TREE_LIMIT",
            limit: 1,
            current: existingTrees.length
          });
        }
      }
      
      const data = insertFamilyTreeSchema.parse({ ...req.body, ownerId: userId });
      const tree = await storage.createTree(data);
      res.status(201).json(tree);
    } catch (error) {
      console.error("Error creating tree:", error);
      res.status(400).json({ message: "Failed to create tree" });
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
      const allowedFields = ["name", "description", "privacy", "visibilityDefault"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
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

      await storage.deleteTree(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tree:", error);
      res.status(500).json({ message: "Failed to delete tree" });
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
      
      // Check free tier limits: 20 members per tree without subscription
      const treeOwner = await storage.getUser(tree.ownerId);
      let ownerHasSubscription = false;
      if (treeOwner?.stripeCustomerId) {
        const subscription = await stripeService.getCustomerSubscription(treeOwner.stripeCustomerId);
        ownerHasSubscription = subscription !== null;
      }
      
      if (!ownerHasSubscription) {
        const existingMembers = await storage.getMembers(treeId);
        if (existingMembers.length >= 20) {
          return res.status(402).json({ 
            message: "Free tier limit reached. The tree owner needs to subscribe to add more family members.",
            code: "FREE_TIER_MEMBER_LIMIT",
            limit: 20,
            current: existingMembers.length
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
      const member = await storage.createMember(data);

      // Create parent placeholders (Mom and Dad) if user opted in:
      // - createParentPlaceholders flag is explicitly true
      // - The member is not already a placeholder (isUnknown)
      const createParentPlaceholders = sanitizedBody.createParentPlaceholders === true;
      if (createParentPlaceholders && !member.isUnknown) {
        try {
          // Check if member already has parents
          const existingRelationships = await storage.getRelationships(treeId);
          const hasParents = existingRelationships.some(
            r => r.toMemberId === member.id && r.relationshipType === 'parent'
          );

          if (!hasParents) {
            // Create Mom placeholder
            const momData = {
              treeId,
              firstName: "Mom",
              lastName: member.lastName || null,
              gender: "female" as const,
              isUnknown: true,
              unknownLabel: "Unknown Mother",
              isLiving: true,
            };
            const mom = await storage.createMember(momData);

            // Create Dad placeholder
            const dadData = {
              treeId,
              firstName: "Dad", 
              lastName: member.lastName || null,
              gender: "male" as const,
              isUnknown: true,
              unknownLabel: "Unknown Father",
              isLiving: true,
            };
            const dad = await storage.createMember(dadData);

            // Create parent relationships
            await storage.createRelationship({
              treeId,
              fromMemberId: mom.id,
              toMemberId: member.id,
              relationshipType: "parent",
            });
            await storage.createRelationship({
              treeId,
              fromMemberId: dad.id,
              toMemberId: member.id,
              relationshipType: "parent",
            });

            // Create spouse relationship between Mom and Dad
            await storage.createRelationship({
              treeId,
              fromMemberId: mom.id,
              toMemberId: dad.id,
              relationshipType: "spouse",
            });

            console.log(`Auto-created parent placeholders for ${member.firstName}`);
          }
        } catch (parentError) {
          // Don't fail member creation if parent placeholders fail
          console.error("Error creating parent placeholders:", parentError);
        }
      }

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

      res.status(201).json(member);
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
      const fullAllowedFields = ["firstName", "lastName", "nickname", "email", "gender", "birthDate", "birthPlace", "deathDate", "isLiving", "photoUrl", "notes", "visibilityOverride"];
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
          } else {
            updateData[field] = req.body[field];
          }
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

      res.json(updated);
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

      await storage.deleteMember(memberId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting member:", error);
      res.status(500).json({ message: "Failed to delete member" });
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
      const relationship = await storage.createRelationship(data);
      res.status(201).json(relationship);
    } catch (error) {
      console.error("Error adding relationship:", error);
      res.status(400).json({ message: "Failed to add relationship" });
    }
  });

  // Delete a relationship
  app.delete("/api/trees/:treeId/relationships/:relationshipId", isAuthenticated, async (req: any, res) => {
    try {
      const { treeId, relationshipId } = req.params;
      const userId = req.user.claims.sub;
      
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Tree not found" });
      }
      
      if (tree.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteRelationship(relationshipId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting relationship:", error);
      res.status(500).json({ message: "Failed to delete relationship" });
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
        
        const prefKey = eventTypeToPreference[event.eventType];
        if (prefKey) {
          const treeUsers = await storage.getTreeMembersWithNotificationPrefs(treeId);
          
          // Get member name for the notification
          const member = event.memberId ? await storage.getMember(event.memberId) : null;
          const memberName = member ? `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}` : 'A family member';
          
          for (const treeUser of treeUsers) {
            // Skip the user who created the event (they already know about it)
            if (treeUser.id === userId) continue;
            
            // Check if user has email and has opted in to this event type notification
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
        // Don't fail the request if notifications fail
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

      // Check if user is owner or co-owner of tree2
      if (tree2.ownerId !== userId) {
        const collab = await storage.getCollaboratorByUserAndTree(userId, targetTreeId);
        if (!collab || collab.role !== "co_owner") {
          return res.status(403).json({ message: "You must be an owner of both trees to connect them" });
        }
      }

      // Create the connection
      const connection = await storage.createTreeConnection({
        tree1Id: treeId,
        tree2Id: targetTreeId,
        connector1MemberId: connector1MemberId || null,
        connector2MemberId: connector2MemberId || null,
        connectionType: connectionType || "marriage",
        createdBy: userId,
      });

      // Make both owners co-owners of each other's trees
      if (tree1.ownerId !== tree2.ownerId) {
        // Add tree1 owner as co-owner of tree2
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

        // Add tree2 owner as co-owner of tree1
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
      const subscriptionInfo = await subscriptionService.getUserSubscriptionInfo(userId);
      const user = await storage.getUser(userId);
      
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
          user?.email || `user-${userId}@familyroots.app`,
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

  // Create tiered subscription checkout
  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not available" });
      }

      const userId = req.user.claims.sub;
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await subscriptionService.createSubscriptionCheckout(
        userId,
        `${baseUrl}/pricing?checkout=success`,
        `${baseUrl}/pricing?checkout=cancel`
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

  // ============== MERCHANDISE / PRINTFUL ROUTES ==============
  
  // Get recommended products for merchandise
  app.get("/api/merchandise/products", async (req, res) => {
    try {
      const products = printfulService.getRecommendedProducts();
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

  // Create merchandise order (with Stripe payment)
  app.post("/api/merchandise/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        treeId, productId, variantId, productName, variantName,
        quantity, treeImageUrl, shippingAddress
      } = req.body;

      // Validate required fields
      if (!treeId || !productId || !variantId || !productName || !treeImageUrl) {
        return res.status(400).json({ message: "Missing required order fields" });
      }

      // SECURITY: Validate tree ownership/access
      const tree = await storage.getTree(treeId);
      if (!tree) {
        return res.status(404).json({ message: "Family tree not found" });
      }
      
      // Check if user owns the tree or is a collaborator with access
      const isOwner = tree.ownerId === userId;
      const collaborator = await storage.getCollaboratorByUserAndTree(userId, treeId);
      if (!isOwner && !collaborator) {
        return res.status(403).json({ message: "You don't have access to this family tree" });
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

      // Create the order in pending state
      const order = await storage.createMerchandiseOrder({
        userId,
        treeId,
        productId,
        variantId,
        productName,
        variantName: variantName || null,
        quantity: orderQuantity,
        treeImageUrl,
        subtotal,
        shippingCost,
        totalAmount,
        commission,
        shippingAddress: addressValidation.data,
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

      // Create order in Printful
      const printfulOrder = await printfulService.createOrder(
        shippingAddress,
        [{
          variant_id: order.variantId,
          quantity: order.quantity,
          files: [{
            type: "default",
            url: order.treeImageUrl,
          }],
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
          user?.email || `user-${userId}@familyroots.app`,
          userId
        );
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      // Create a checkout session for one-time payment
      const session = await stripeService.createMerchandiseCheckoutSession(
        customerId,
        order.productName,
        `Custom ${order.productName} with your family tree`,
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
                return res.json({ success: true, status: "submitted", printfulOrderId: printfulResult.orderId });
              } else {
                console.error("Failed to submit order to Printful, keeping as paid");
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

  // ==================== USER-TO-USER CONNECTION REQUESTS (QR Code) ====================

  // Send a user-to-user connection request (from scanned QR code)
  // Valid relationship types for user connections
  const VALID_RELATIONSHIP_TYPES = [
    "son", "daughter", "parent", "spouse", "sibling", 
    "grandparent", "grandchild", "aunt", "uncle", "niece", "nephew",
    "cousin", "in_law", "step_relative", "other"
  ] as const;

  // Now properly stores the request with relationship type
  app.post("/api/user-connection-requests", isAuthenticated, async (req: any, res) => {
    try {
      const fromUserId = req.user.claims.sub;
      const { targetUserId, relationshipType, customLabel, message } = req.body;

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

      // Create the connection request
      const request = await storage.createUserConnectionRequest({
        fromUserId,
        toUserId: targetUserId,
        relationshipType,
        customLabel: relationshipType === "other" ? customLabel : null,
        message,
        sourceType: "qr_scan",
      });

      const fromUser = await storage.getUser(fromUserId);

      console.log(`[User Connection Request] From: ${fromUser?.firstName} ${fromUser?.lastName} (${fromUserId}) -> To: ${targetUser.firstName} ${targetUser.lastName} (${targetUserId}) as "${relationshipType}"`);

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

      // Enrich with user info
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const fromUser = await storage.getUser(request.fromUserId);
          return {
            ...request,
            fromUser: fromUser ? {
              id: fromUser.id,
              firstName: fromUser.firstName,
              lastName: fromUser.lastName,
              profileImageUrl: fromUser.profileImageUrl,
            } : null,
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

      // Enrich with user info
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const toUser = await storage.getUser(request.toUserId);
          return {
            ...request,
            toUser: toUser ? {
              id: toUser.id,
              firstName: toUser.firstName,
              lastName: toUser.lastName,
              profileImageUrl: toUser.profileImageUrl,
            } : null,
          };
        })
      );

      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching sent connection requests:", error);
      res.status(500).json({ message: "Failed to fetch sent requests" });
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

      res.json({ 
        success: true, 
        request: approved,
        message: `You are now connected with ${fromUser?.firstName}!`,
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
          
          return {
            ...conn,
            otherUser: otherUser ? {
              id: otherUser.id,
              firstName: otherUser.firstName,
              lastName: otherUser.lastName,
              profileImageUrl: otherUser.profileImageUrl,
            } : null,
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
      const { code, state } = req.query;
      const userId = req.user.claims.sub;
      
      // Verify state - require it exists and matches
      const storedState = req.session?.familySearchState;
      if (!storedState || storedState !== state) {
        return res.redirect("/records?error=invalid_state");
      }
      // Clear state after use to prevent reuse
      delete req.session.familySearchState;
      
      // Exchange code for token
      const tokenResponse = await familySearchService.exchangeCodeForToken(code as string);
      if (!tokenResponse) {
        return res.redirect("/records?error=token_exchange_failed");
      }
      
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
      
      res.redirect("/records?connected=true");
    } catch (error) {
      console.error("Error in FamilySearch callback:", error);
      res.redirect("/records?error=callback_failed");
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
      const { givenName, surname, birthYear, birthPlace, deathYear, deathPlace } = req.query;
      
      const connection = await storage.getFamilySearchConnection(userId);
      
      // If connected and configured, use real API
      if (connection?.accessToken && familySearchService.isConfigured()) {
        const results = await familySearchService.searchRecords(connection.accessToken, {
          givenName: givenName as string,
          surname: surname as string,
          birthYear: birthYear ? parseInt(birthYear as string) : undefined,
          birthPlace: birthPlace as string,
          deathYear: deathYear ? parseInt(deathYear as string) : undefined,
          deathPlace: deathPlace as string,
        });
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

  return httpServer;
}
