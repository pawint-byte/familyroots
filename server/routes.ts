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
      res.json(allTrees);
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

      const data = insertFamilyMemberSchema.parse({ ...req.body, treeId });
      const member = await storage.createMember(data);
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(400).json({ message: "Failed to add member" });
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

      // Validate update data - only allow specific fields
      const allowedFields = ["firstName", "lastName", "gender", "birthDate", "birthPlace", "deathDate", "isLiving", "photoUrl", "notes"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const updated = await storage.updateMember(memberId, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(400).json({ message: "Failed to update member" });
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

  return httpServer;
}
