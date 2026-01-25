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
      
      // Age validation for parent/child relationships
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
      const claimedMembersByName = new Map<string, any>();
      allMembers.forEach(m => {
        if (m.claimedByUserId) {
          const nameKey = `${(m.firstName || '').toLowerCase().trim()}-${(m.lastName || '').toLowerCase().trim()}`;
          if (!claimedMembersByName.has(nameKey)) {
            claimedMembersByName.set(nameKey, m);
          }
        }
      });
      
      // Filter out unclaimed duplicates that match claimed members by name
      const deduplicatedMembers = allMembers.filter(m => {
        if (m.claimedByUserId) return true; // Keep all claimed members
        
        const nameKey = `${(m.firstName || '').toLowerCase().trim()}-${(m.lastName || '').toLowerCase().trim()}`;
        const claimedVersion = claimedMembersByName.get(nameKey);
        
        if (claimedVersion) {
          // This unclaimed member has a claimed version - remap and exclude
          memberIdRemapping.set(m.id, claimedVersion.id);
          return false;
        }
        return true;
      });
      
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

  // ============== ADMIN USER MANAGEMENT ROUTES ==============
  
  // List of admin emails - only these users can access admin routes
  const ADMIN_EMAILS = [
    "pawint@me.com",
    "andrew.wint@gmail.com",
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
      const toUser = await storage.getUser(request.toUserId);

      // === AUTO-CONNECT TREES AND ADD FAMILY MEMBERS ===
      // Get both users' trees (primary tree - first one they own)
      const fromUserTrees = await storage.getTrees(request.fromUserId);
      const toUserTrees = await storage.getTrees(request.toUserId);
      
      if (fromUserTrees.length > 0 && toUserTrees.length > 0) {
        const fromTree = fromUserTrees[0];
        const toTree = toUserTrees[0];
        
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
          
          // Map user connection relationship to family tree relationship
          // requesterRelationship is how the requester relates TO the approver
          // e.g., if requester says "I am your son", relationship should be: approver is parent of requester
          const mapToTreeRelationship = (userRel: string): { type: string; fromId: string; toId: string } | null => {
            // In both trees, we need to create the correct relationship
            // fromUserMemberInToTree = requester in approver's tree
            // toUserMemberInFromTree = approver in requester's tree
            
            switch(userRel) {
              case 'son':
              case 'daughter':
                // Requester is child of approver
                // In approver's tree: approver's member -> parent -> fromUser's member
                return { type: 'parent', fromId: 'from', toId: 'to' }; // from is child, to is parent
              case 'parent':
                // Requester is parent of approver
                return { type: 'parent', fromId: 'to', toId: 'from' }; // to is child, from is parent
              case 'spouse':
                return { type: 'spouse', fromId: 'from', toId: 'to' };
              case 'sibling':
                return { type: 'sibling', fromId: 'from', toId: 'to' };
              default:
                return null; // Complex relationships like grandparent need manual setup
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
