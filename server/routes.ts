import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { 
  insertFamilyTreeSchema, insertFamilyMemberSchema, 
  insertRelationshipSchema, insertFamilyEventSchema 
} from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey, isStripeConfigured } from "./stripeClient";
import { streamChatResponse } from "./chatbot";
import { 
  getAvatars, getVoices, generateVideo, syncVideoStatus, 
  getAllVideos, getVideoById, deleteVideo 
} from "./heygen";
import { postToBluesky } from "./bluesky";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Setup object storage for photo uploads
  registerObjectStorageRoutes(app);

  // Get all trees for the current user
  app.get("/api/trees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trees = await storage.getTrees(userId);
      res.json(trees);
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
      if (!tree || tree.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
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
      if (!tree || tree.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
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
