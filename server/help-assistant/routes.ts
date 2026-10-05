import type { Express } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { z } from "zod";
import { HelpError, reviewHelpAction } from "./service";

export function registerHelpAssistantRoutes(app: Express) {
  for (const decision of ["confirm", "cancel"] as const) {
    app.post(`/api/chat/actions/:actionId/${decision}`, isAuthenticated, async (req: any, res) => {
      try {
        const origin = req.get("origin");
        if (!origin || new URL(origin).host !== req.get("host")) throw new HelpError(403, "Confirm this task from FamilyRoots, in your signed-in session.");
        if (decision === "confirm") z.object({ confirmed: z.literal(true) }).strict().parse(req.body);
        else z.object({}).strict().parse(req.body);
        const actionId = z.string().uuid().parse(req.params.actionId);
        res.json(await reviewHelpAction(req.user.claims.sub, req.sessionID, actionId, decision === "confirm", origin));
      } catch (error) {
        res.status(error instanceof HelpError ? error.status : error instanceof z.ZodError ? 422 : 500).json({
          message: error instanceof HelpError ? error.message : error instanceof z.ZodError ? "Invalid confirmation request." : "This task could not be completed. No automatic retry will occur.",
        });
      }
    });
  }
}
