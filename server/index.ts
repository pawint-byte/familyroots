import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { getVideoById } from './heygen';
import { storage } from './storage';
import { sendCustodianshipApproval, sendCustodianshipReminder, sendRegistryReminderEmail } from './lib/email';

const app = express();
const httpServer = createServer(app);

// Health check endpoint - responds immediately before any other initialization
// This is critical for Cloud Run deployment health checks
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/_health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    log('DATABASE_URL not found - skipping Stripe initialization', 'stripe');
    return;
  }

  try {
    log('Initializing Stripe schema...', 'stripe');
    await runMigrations({ databaseUrl });
    log('Stripe schema ready', 'stripe');

    let stripeSync;
    try {
      stripeSync = await getStripeSync();
    } catch (error: any) {
      log(`Stripe not configured: ${error.message}`, 'stripe');
      return;
    }

    log('Webhook configured: endpoint ready', 'stripe');

    stripeSync.syncBackfill()
      .then(() => {
        log('Stripe data synced', 'stripe');
      })
      .catch((err: Error) => {
        console.error('Error syncing Stripe data:', err);
      });
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer.');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const crawlerUserAgents = [
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'telegrambot',
  'whatsapp',
  'bsky',
  'baiduspider',
  'googlebot',
];

function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return crawlerUserAgents.some(crawler => ua.includes(crawler));
}

app.get('/video/:id', async (req, res, next) => {
  if (!isCrawler(req.headers['user-agent'])) {
    return next();
  }

  try {
    const video = await getVideoById(req.params.id);
    if (!video || video.status !== 'completed' || !video.videoUrl) {
      return next();
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const videoPageUrl = `${baseUrl}/video/${video.id}`;
    const description = video.script.substring(0, 200) + (video.script.length > 200 ? '...' : '');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${video.title} | FamilyRoots</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${videoPageUrl}">
  <meta property="og:title" content="${video.title}">
  <meta property="og:description" content="${description}">
  ${video.thumbnailUrl ? `<meta property="og:image" content="${video.thumbnailUrl}">` : ''}
  <meta property="og:video" content="${video.videoUrl}">
  <meta property="og:video:type" content="video/mp4">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:url" content="${videoPageUrl}">
  <meta name="twitter:title" content="${video.title}">
  <meta name="twitter:description" content="${description}">
  ${video.thumbnailUrl ? `<meta name="twitter:image" content="${video.thumbnailUrl}">` : ''}
  <meta name="twitter:player" content="${video.videoUrl}">
  
  <meta http-equiv="refresh" content="0;url=${videoPageUrl}">
</head>
<body>
  <p>Redirecting to video...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (error) {
    console.error('Error serving video meta tags:', error);
    return next();
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);
      
      // Initialize Stripe after server is listening (non-blocking)
      initStripe().catch(err => {
        console.error('Stripe initialization error:', err);
      });
      
      // Start scheduled tasks
      startCustodianshipScheduler();
      startRegistryReminderScheduler();
    },
  );
})();

// Scheduled task for processing custodianship requests
function startCustodianshipScheduler() {
  const HOUR_IN_MS = 60 * 60 * 1000;
  
  async function processCustodianshipRequests() {
    try {
      log('Processing custodianship requests...', 'scheduler');
      
      // Get all pending custodianship requests
      const pendingRequests = await storage.getPendingCustodianshipRequests();
      const now = new Date();
      
      for (const request of pendingRequests) {
        const daysSinceRequest = Math.floor((now.getTime() - request.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        const daysRemaining = 30 - daysSinceRequest;
        
        // Auto-approve if 30 days have passed
        if (daysRemaining <= 0) {
          log(`Auto-approving custodianship request ${request.id}`, 'scheduler');
          
          // Get related data for the approval
          const member = await storage.getMember(request.memberId);
          const tree = member ? await storage.getTree(member.treeId) : null;
          const requester = await storage.getUser(request.requesterId);
          
          if (member && tree && requester) {
            // Approve the request with auto_approved status
            await storage.updateCustodianshipRequest(request.id, {
              status: 'auto_approved',
              reviewedAt: new Date(),
            });
            
            // Update the member's custodian
            await storage.updateMember(request.memberId, {
              custodianUserId: request.requesterId,
            });
            
            // Send approval email to the custodian
            if (requester.email) {
              const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`;
              await sendCustodianshipApproval(
                requester.email,
                requester.firstName || 'Family member',
                memberName,
                tree.name,
                true // auto-approved
              );
            }
          }
        }
        // Send reminder emails at specific intervals (days 7, 14, 21, 28)
        // Only send if we haven't already sent this reminder (track by reminderCount)
        else {
          const reminderMilestones = [7, 14, 21, 28];
          const currentReminderCount = request.reminderCount || 0;
          const expectedReminderCount = reminderMilestones.filter(d => daysSinceRequest >= d).length;
          
          // Only send if we need to catch up on reminders
          if (expectedReminderCount > currentReminderCount) {
            log(`Sending reminder #${expectedReminderCount} for custodianship request ${request.id}`, 'scheduler');
            
            const member = await storage.getMember(request.memberId);
            const tree = member ? await storage.getTree(member.treeId) : null;
            const owner = tree ? await storage.getUser(tree.ownerId) : null;
            const requester = await storage.getUser(request.requesterId);
            
            if (member && tree) {
              const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`;
              
              // Send reminder to tree owner
              if (owner?.email) {
                await sendCustodianshipReminder(
                  owner.email,
                  owner.firstName || 'Tree owner',
                  memberName,
                  daysRemaining,
                  tree.name
                );
              }
              
              // Send status update to requester
              if (requester?.email) {
                await sendCustodianshipReminder(
                  requester.email,
                  requester.firstName || 'Family member',
                  memberName,
                  daysRemaining,
                  tree.name
                );
              }
              
              // Update reminder count to prevent duplicate sends
              await storage.updateCustodianshipRequest(request.id, {
                reminderCount: expectedReminderCount,
                lastReminderSentAt: new Date(),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing custodianship requests:', error);
    }
  }
  
  // Run immediately on startup
  processCustodianshipRequests();
  
  // Run every hour
  setInterval(processCustodianshipRequests, HOUR_IN_MS);
  
  log('Custodianship scheduler started', 'scheduler');
}

function startRegistryReminderScheduler() {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const sentReminders = new Set<string>();

  async function processRegistryReminders() {
    try {
      log('Checking upcoming registry event dates...', 'scheduler');
      const upcomingRegistries = await storage.getActiveRegistriesWithUpcomingDates();

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      for (const registry of upcomingRegistries) {
        if (!registry.eventDate) continue;

        const eventDateStr = typeof registry.eventDate === 'string' 
          ? registry.eventDate.split('T')[0] 
          : new Date(registry.eventDate).toISOString().split('T')[0];
        const eventDate = new Date(eventDateStr + 'T00:00:00Z');
        const today = new Date(todayStr + 'T00:00:00Z');
        const daysUntil = Math.round((eventDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

        const reminderKey7 = `${registry.id}-7`;
        const reminderKey1 = `${registry.id}-1`;

        const shouldSend7Day = daysUntil <= 7 && daysUntil > 1 && !sentReminders.has(reminderKey7);
        const shouldSend1Day = daysUntil <= 1 && daysUntil >= 0 && !sentReminders.has(reminderKey1);

        if (!shouldSend7Day && !shouldSend1Day) continue;

        try {
          const member = await storage.getMember(registry.memberId);
          const tree = await storage.getTree(registry.treeId);
          if (!member || !tree) continue;

          const allItems = await storage.getGiftRegistryItems(registry.id);
          const remainingItems = allItems.filter(i => i.status !== 'purchased').length;
          const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`;

          const treeMemberUsers = await storage.getTreeMembersWithNotificationPrefs(registry.treeId);
          const notifyUsers = treeMemberUsers.filter(u => u.email);
          const actualDays = shouldSend1Day ? (daysUntil <= 0 ? 0 : 1) : daysUntil;

          for (const recipient of notifyUsers) {
            try {
              await sendRegistryReminderEmail(
                recipient.email!,
                recipient.firstName || 'Family Member',
                memberName,
                registry.title,
                eventDateStr,
                registry.id,
                remainingItems,
                actualDays
              );
            } catch (emailErr) {
              console.error(`Failed to send registry reminder to ${recipient.email}:`, emailErr);
            }
          }

          if (shouldSend7Day) sentReminders.add(reminderKey7);
          if (shouldSend1Day) sentReminders.add(reminderKey1);
          log(`Sent ${actualDays}-day reminder for registry "${registry.title}" to ${notifyUsers.length} users`, 'scheduler');
        } catch (regError) {
          console.error(`Error processing reminder for registry ${registry.id}:`, regError);
        }
      }
    } catch (error) {
      console.error('Error processing registry reminders:', error);
    }
  }

  processRegistryReminders();
  setInterval(processRegistryReminders, SIX_HOURS_MS);
  log('Registry reminder scheduler started', 'scheduler');
}
