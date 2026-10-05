import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "../db";
import { ASSISTANT_SCOPES } from "@shared/assistant";
import { AgentError, hash, mintKey, DAY, keyInput, keyState, type ActionType } from "./policy";
import { transaction, treeAccess } from "./data";
import { keyView, actionView, audit, currentKey, executeAction, reviewAction } from "./service";
import { assistantOpenApi } from "./spec";

function session(req: any, res: Response, next: NextFunction) {
  if (req.headers.authorization || !req.isAuthenticated?.() || !req.user?.claims?.sub) {
    return res.status(401).json({ error: "member_session_required", message: "Sign in on the site to manage assistant permissions." });
  }
  if (req.method !== "GET") {
    if (req.get("Sec-Fetch-Site") === "cross-site") return res.status(403).json({ error: "cross_site_request" });
    const origin = req.get("Origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.get("host")) return res.status(403).json({ error: "cross_site_request" });
      } catch { return res.status(403).json({ error: "invalid_origin" }); }
    }
  }
  next();
}
const handler = (fn: (req: any, res: Response) => Promise<unknown>) => (req: Request, res: Response) => {
  fn(req, res).catch(error => {
    if (error instanceof AgentError) return res.status(error.status).json({ error: error.code, message: error.message, ...error.detail });
    if (error instanceof z.ZodError) return res.status(422).json({ error: "invalid_request", message: error.issues[0]?.message });
    console.error("[assistant] Request failed", error instanceof Error ? error.name : "UnknownError");
    return res.status(500).json({ error: "assistant_unavailable", message: "Assistant access is temporarily unavailable." });
  });
};
async function bearerKey(req: any) {
  const auth = req.get("Authorization") || "";
  const match = /^Bearer (fr_agent_[a-f0-9-]{36}\.[A-Za-z0-9_-]{43})$/i.exec(auth);
  if (!match) throw new AgentError(401, "bearer_required", "Provide your assistant bearer key through the Authorization header.");
  const { rows: [key] } = await pool.query("SELECT * FROM assistant_keys WHERE token_hash=$1", [hash(match[1])]);
  if (!key || key.revoked_at) throw new AgentError(401, "invalid_key", "Invalid or revoked assistant key.");
  return key;
}
export function registerAssistantRoutes(app: Express) {
  app.use("/api/agent", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.get("/api/agent/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/agent/openapi.json", (req, res) => {
    // Published URLs verified through Replit's deployment service. No guessed production domain.
    const published = ["https://kinship.pawint-app.com", "https://familyroots.family", "https://kinship-chronicle--pawint.replit.app"];
    const matching = published.find(url => new URL(url).hostname === req.hostname);
    const dev = process.env.NODE_ENV === "development" && req.hostname === process.env.REPLIT_DEV_DOMAIN;
    const url = matching || (dev ? `https://${process.env.REPLIT_DEV_DOMAIN}` : published[0]);
    res.json({ ...assistantOpenApi, servers: [{ url }] });
  });
  app.get("/api/agent/settings", session, handler(async (req, res) => {
    const userId = req.user.claims.sub;
    const result = await transaction(async c => {
      const trees = (await c.query(`SELECT t.id,t.name FROM family_trees t WHERE t.deleted_at IS NULL AND
        (t.owner_id=$1 OR EXISTS(SELECT 1 FROM tree_collaborators WHERE tree_id=t.id AND user_id=$1 AND can_edit=true)) ORDER BY t.name`, [userId])).rows;
      for (const tree of trees) {
        tree.members = (await c.query(`SELECT id,trim(concat(first_name,' ',last_name)) AS name,claimed_by_user_id=$2 AS "claimedByMe"
          FROM family_members WHERE tree_id=$1 AND deleted_at IS NULL ORDER BY first_name,last_name`, [tree.id, userId])).rows;
      }
      const keys = (await c.query(`SELECT k.*,t.name AS tree_name FROM assistant_keys k LEFT JOIN family_trees t ON t.id=k.tree_id
        WHERE k.user_id=$1 ORDER BY k.created_at DESC`, [userId])).rows.map(keyView);
      const actions = (await c.query(`SELECT * FROM assistant_actions WHERE user_id=$1 AND
        (status IN ('draft','pending_confirmation') OR id IN (SELECT id FROM assistant_actions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100))
        ORDER BY created_at DESC`, [userId])).rows.map(actionView);
      return { trees, keys, actions, scopes: ASSISTANT_SCOPES };
    });
    res.json(result);
  }));
  app.post("/api/agent/keys", session, handler(async (req, res) => {
    const input = keyInput.parse(req.body);
    const generated = mintKey();
    const key = await transaction(async c => {
      // User-row locking prevents concurrent creation from exceeding the key limit.
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [req.user.claims.sub]);
      const tree = await treeAccess(c, req.user.claims.sub, input.treeId);
      const { rows: [count] } = await c.query("SELECT count(*)::int AS n FROM assistant_keys WHERE user_id=$1 AND revoked_at IS NULL", [req.user.claims.sub]);
      if (count.n >= 10) throw new AgentError(429, "key_limit", "Revoke an unused key before creating another. Ten active keys are allowed.");
      if (input.memberId) {
        const { rows: [member] } = await c.query("SELECT id FROM family_members WHERE id=$1 AND tree_id=$2 AND claimed_by_user_id=$3 AND deleted_at IS NULL", [input.memberId, input.treeId, req.user.claims.sub]);
        if (!member) throw new AgentError(422, "invalid_anchor", "Select your own claimed profile in this tree.");
      }
      const due = new Date(Date.now() + 30 * DAY), pause = new Date(due.getTime() + 7 * DAY);
      const { rows: [row] } = await c.query(`INSERT INTO assistant_keys(id,user_id,tree_id,member_id,name,token_hash,scopes,review_due_at,pause_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [generated.id, req.user.claims.sub, input.treeId, input.memberId || null, input.name, generated.tokenHash, JSON.stringify(input.scopes), due, pause]);
      await audit(c, req.user.claims.sub, input.treeId, row.id, "key:create", { keyId: row.id, scopes: input.scopes });
      return keyView({ ...row, tree_name: tree.name });
    });
    res.status(201).json({ key, token: generated.token });
  }));
  app.delete("/api/agent/keys/:id", session, handler(async (req, res) => {
    await transaction(async c => {
      const { rows: [key] } = await c.query("SELECT * FROM assistant_keys WHERE id=$1 AND user_id=$2 FOR UPDATE", [req.params.id, req.user.claims.sub]);
      if (!key) throw new AgentError(404, "key_not_found", "Key not found.");
      await c.query("UPDATE assistant_keys SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1", [key.id]);
      await c.query(`UPDATE assistant_actions SET status='cancelled',result='{"message":"Cancelled because the member revoked the key."}',completed_at=now(),http_status=401
        WHERE key_id=$1 AND status IN ('draft','pending_confirmation','sending')`, [key.id]);
      await audit(c, key.user_id, key.tree_id, key.id, "key:revoke", { keyId: key.id });
    });
    res.json({ revoked: true });
  }));
  app.post("/api/agent/keys/:id/review", session, handler(async (req, res) => {
    const { decision } = z.object({ decision: z.enum(["renew", "extend", "stop"]) }).strict().parse(req.body);
    const result = await transaction(async c => {
      const { rows: [lookup] } = await c.query("SELECT id FROM assistant_keys WHERE id=$1 AND user_id=$2", [req.params.id, req.user.claims.sub]);
      if (!lookup) throw new AgentError(404, "key_not_found", "Key not found.");
      const key = await currentKey(c, lookup.id, false);
      if (decision === "stop") await c.query("UPDATE assistant_keys SET stopped_at=now() WHERE id=$1", [key.id]);
      else {
        await treeAccess(c, key.user_id, key.tree_id);
        const due = decision === "renew" ? Date.now() + 30 * DAY : Math.max(Date.now(), new Date(key.review_due_at).getTime()) + 7 * DAY;
        await c.query("UPDATE assistant_keys SET review_due_at=$2,pause_at=$3,stopped_at=NULL WHERE id=$1", [key.id, new Date(due), new Date(due + 7 * DAY)]);
      }
      await audit(c, key.user_id, key.tree_id, key.id, `key:${decision}`, { keyId: key.id });
      return keyView((await c.query("SELECT k.*,t.name AS tree_name FROM assistant_keys k JOIN family_trees t ON t.id=k.tree_id WHERE k.id=$1", [key.id])).rows[0]);
    });
    res.json({ key: result });
  }));
  for (const [path, approve] of [["approve", true], ["reject", false]] as const) {
    app.post(`/api/agent/actions/:id/${path}`, session, handler(async (req, res) => {
      const input = z.object({
        confirmed: z.boolean().optional(), memberId: z.string().max(200).optional(),
        keepMemberId: z.string().max(200).optional(), mergeMemberId: z.string().max(200).optional(), of: z.string().max(200).optional(),
      }).strict().parse(req.body || {});
      const output = await reviewAction(req.user.claims.sub, req.params.id, approve, input);
      res.status(output.code).json(output.result);
    }));
  }
  app.get("/api/agent/tree", handler(async (req, res) => {
    const initial = await bearerKey(req);
    const result = await transaction(async c => {
      const key = await currentKey(c, initial.id, false);
      const tree = await treeAccess(c, key.user_id, key.tree_id);
      const members = (await c.query(`SELECT id,first_name AS "firstName",last_name AS "lastName",trim(concat(first_name,' ',last_name)) AS name
        FROM family_members WHERE tree_id=$1 AND deleted_at IS NULL ORDER BY first_name,last_name`, [key.tree_id])).rows;
      const labels = (await c.query(`SELECT r.id,r.from_member_id AS "memberId",r.to_member_id AS "of",r.relationship_type AS "relationshipType",r.custom_label AS label
        FROM relationships r JOIN family_members a ON a.id=r.from_member_id JOIN family_members b ON b.id=r.to_member_id
        WHERE r.tree_id=$1 AND r.deleted_at IS NULL AND a.deleted_at IS NULL AND b.deleted_at IS NULL`, [key.tree_id])).rows;
      await c.query("UPDATE assistant_keys SET last_used_at=now() WHERE id=$1", [key.id]);
      return { tree: { id: tree.id, name: tree.name, treeType: tree.tree_type }, members, labels,
        permissions: { scopes: key.scopes, state: keyState(key), reviewDueAt: key.review_due_at, pauseAt: key.pause_at } };
    });
    res.json(result);
  }));
  const routes: [string, ActionType][] = [
    ["people", "people:add"], ["labels", "labels:set"], ["invite", "invite:send"], ["email", "email:send"], ["merge", "people:merge"],
  ];
  for (const [path, action] of routes) {
    app.post(`/api/agent/${path}`, handler(async (req, res) => {
      const key = await bearerKey(req);
      const output = await executeAction(key.id, action, req.body, req.get("Idempotency-Key"));
      res.status(output.code).json(output.result);
    }));
  }
  app.post("/api/agent/actions", handler(async (req, res) => {
    const key = await bearerKey(req);
    const action = req.body?.action;
    if (!["delete_all", "email_all"].includes(action)) throw new AgentError(422, "unknown_action", "Use delete_all or email_all. Both require on-site confirmation.");
    const output = await executeAction(key.id, action, req.body, req.get("Idempotency-Key"));
    res.status(output.code).json(output.result);
  }));
}
