import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { 
  insertFamilyTreeSchema, insertFamilyMemberSchema, 
  insertRelationshipSchema, insertFamilyEventSchema,
  insertNameHistorySchema, insertTreeConnectionSchema
} from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { calculateRelationship, getSubtreeBetweenMembers } from "./lib/relationship-calculator";

// Validation schemas for API requests
const createInvitationSchema = z.object({
  role: z.enum(["viewer", "editor", "co_owner"]),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  maxUses: z.number().int().min(1).max(1000).optional(),
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
import { stripeService } from "./stripeService";
import { getStripePublishableKey, isStripeConfigured } from "./stripeClient";
import { streamChatResponse } from "./chatbot";
import { 
  getAvatars, getVoices, generateVideo, syncVideoStatus, 
  getAllVideos, getVideoById, deleteVideo 
} from "./heygen";
import { postToBluesky, testBlueskyConnection } from "./bluesky";
import { sendInactivityReminder, sendAccountTransferNotification, sendFamilyMemberInvitation } from "./lib/email";
import { insertAccountHeirSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Setup object storage for photo uploads
  registerObjectStorageRoutes(app);

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

      res.json({ tree, members, relationships });
    } catch (error) {
      console.error("Error fetching tree:", error);
      res.status(500).json({ message: "Failed to fetch tree" });
    }
  });

  // Create a new tree
  app.post("/api/trees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const allowedFields = ["name", "description", "privacy"];
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
      
      if (tree.ownerId !== userId) {
        const collaborators = await storage.getCollaborators(treeId);
        const canEdit = collaborators.some(c => c.userId === userId && c.canEdit);
        if (!canEdit) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Get existing member to check if email is being added
      const existingMember = await storage.getMember(memberId);
      const oldEmail = existingMember?.email;

      // Validate update data - only allow specific fields
      const allowedFields = ["firstName", "lastName", "nickname", "email", "gender", "birthDate", "birthPlace", "deathDate", "isLiving", "photoUrl", "notes"];
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

  // Get user subscription status
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeCustomerId) {
        return res.json({ subscription: null, tier: "free" });
      }

      const subscription = await stripeService.getCustomerSubscription(user.stripeCustomerId) as { id: string; status: string } | null;
      
      if (subscription && subscription.status === "active") {
        if (user.stripeSubscriptionId !== subscription.id) {
          await storage.updateUserStripeInfo(userId, { stripeSubscriptionId: subscription.id });
        }
        return res.json({ subscription, tier: "premium" });
      }
      
      res.json({ subscription: null, tier: "free" });
    } catch (error) {
      console.error("Subscription check error:", error);
      res.json({ subscription: null, tier: "free" });
    }
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

  return httpServer;
}
