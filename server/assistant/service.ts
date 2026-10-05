import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { sendEmail } from "../lib/email";
import { ASSISTANT_SCOPES } from "@shared/assistant";
import { AgentError, NeedsConfirmation, keyState, fingerprint, parseAction, resolveName, escapeHtml, type ActionType } from "./policy";
import { transaction, treeAccess, activeMembers, relation, setLabel, acceptDraft, mergePeople, bulkSnapshot, deleteAll, resolveField } from "./data";

export function keyView(row: any) {
  return {
    id: row.id, name: row.name, treeId: row.tree_id, treeName: row.tree_name,
    memberId: row.member_id, scopes: row.scopes, state: keyState(row),
    reviewDueAt: row.review_due_at, pauseAt: row.pause_at, createdAt: row.created_at, lastUsedAt: row.last_used_at,
  };
}
export function actionView(row: any) {
  return { id: row.id, keyId: row.key_id, treeId: row.tree_id, action: row.action, status: row.status,
    payload: row.payload, result: row.result, createdAt: row.created_at, completedAt: row.completed_at };
}
export async function currentKey(c: PoolClient, id: string, write = true) {
  const { rows: [key] } = await c.query("SELECT * FROM assistant_keys WHERE id=$1 FOR UPDATE", [id]);
  if (!key || key.revoked_at) throw new AgentError(401, "key_revoked", "This assistant key has been revoked.");
  if (write && keyState(key) === "paused") throw new AgentError(403, "assistant_paused", "New actions are paused. Renew or extend permissions on the site.");
  return key;
}
export function allowed(key: any, action: ActionType) {
  const scope = action === "email_all" ? "email:send" : action === "delete_all" ? "people:merge" : action;
  if (!key.scopes.includes(scope)) throw new AgentError(403, "permission_denied", "This action is not enabled for this key.");
}
export async function audit(c: PoolClient, userId: string, treeId: string, keyId: string | null, action: string, result: any) {
  await c.query(`INSERT INTO assistant_actions(user_id,tree_id,key_id,request_id,fingerprint,action,status,payload,result,http_status,completed_at)
    VALUES($1,$2,$3,$4,'management',$5,'completed','{}',$6,200,now())`,
    [userId, treeId, keyId, randomUUID(), action, JSON.stringify(result)]);
}
async function finish(c: PoolClient, id: string, status: string, code: number, result: any, complete = true) {
  await c.query(`UPDATE assistant_actions SET status=$2,http_status=$3,result=$4,completed_at=CASE WHEN $5 THEN now() ELSE NULL END WHERE id=$1`,
    [id, status, code, JSON.stringify(result), complete]);
}
function errorResult(error: unknown) {
  if (error instanceof AgentError) return { code: error.status, result: { error: error.code, message: error.message, ...error.detail } };
  console.error("[assistant] Operation failed", error instanceof Error ? error.name : "UnknownError");
  return { code: 500, result: { error: "operation_failed", message: "The operation failed without completing. No automatic retry was made." } };
}
function actionReference(body: any) { return body.memberId || body.name; }
async function deliveries(c: PoolClient, tree: any, key: any, action: ActionType, body: any, confirmed: boolean, expected?: any[]) {
  const members = await activeMembers(c, tree.id);
  const { rows: [user] } = await c.query("SELECT first_name,last_name FROM users WHERE id=$1", [key.user_id]);
  const sender = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "A FamilyRoots member";
  let recipients: { id: string; name: string; email: string }[];
  if (action === "email_all") {
    if (tree.owner_id !== key.user_id) throw new AgentError(403, "owner_required", "Only the tree owner can confirm emailing all people.");
    recipients = (await bulkSnapshot(c, tree, action)) as { id: string; name: string; email: string }[];
    if (fingerprint("recipients", recipients) !== fingerprint("recipients", expected)) throw new NeedsConfirmation("Recipients changed. Reject this request and submit a new one.");
  } else {
    const person = resolveField(members, actionReference(body), key.member_id, "memberId");
    const email = (body.email || person.email || "").toLowerCase().trim();
    if (!email) throw new AgentError(422, "email_missing", "This person has no email address. Supply one explicitly.");
    if (!confirmed && person.email && person.email.toLowerCase().trim() !== email) {
      throw new NeedsConfirmation("Confirm the email address for this named person on the site.", {
        recipient: { id: person.id, name: `${person.first_name} ${person.last_name || ""}`.trim(), email },
      });
    }
    recipients = [{ id: person.id, name: `${person.first_name} ${person.last_name || ""}`.trim(), email }];
  }
  // One recipient address only once, even if several family profiles share an inbox.
  recipients = [...new Map(recipients.map(r => [r.email, r])).values()];
  if (!recipients.length) throw new AgentError(422, "no_recipients", "No named recipients have email addresses.");
  if (recipients.length > 30) throw new AgentError(429, "recipient_limit", "Assistant email batches are limited to 30 recipients.");
  const { rows: [usage] } = await c.query(`SELECT COALESCE(sum(COALESCE((result->>'recipientCount')::int,1)),0)::int AS n
    FROM assistant_actions WHERE user_id=$1 AND action IN ('email:send','invite:send','email_all')
    AND status IN ('sending','completed','delivery_uncertain','cancelled') AND created_at>now()-interval '24 hours'`, [key.user_id]);
  if (usage.n + recipients.length > 30) throw new AgentError(429, "email_rate_limit", "The member's assistant email allowance is 30 recipients per 24 hours.");
  const isInvite = action === "invite:send";
  return { recipients, sender, isInvite, subject: isInvite ? `Invitation to ${tree.name}` : body.subject, text: body.text || "", treeName: tree.name };
}
async function perform(c: PoolClient, key: any, tree: any, action: ActionType, body: any, confirmed = false, existingResult?: any) {
  const members = await activeMembers(c, tree.id);
  if (action === "people:add") {
    if (body.of) {
      const of = resolveField(members, body.of, key.member_id, "of");
      relation(tree, body.label);
      body = { ...body, of: of.id };
    }
    return { status: "draft", code: 202, result: { message: "Draft created. Accept it on the site to make the person visible." }, payload: body };
  }
  if (action === "labels:set") return { status: "completed", code: 200, result: await setLabel(c, tree, key, body, members) };
  if (action === "people:merge") return { status: "completed", code: 200, result: await mergePeople(c, tree, key, body, members) };
  if (action === "delete_all" || action === "email_all") {
    if (tree.owner_id !== key.user_id) throw new AgentError(403, "owner_required", "Bulk actions require the tree owner's on-site confirmation.");
    if (!confirmed) throw new NeedsConfirmation("Review and confirm this exact bulk action on the site.", {
      people: await bulkSnapshot(c, tree, action), warning: action === "delete_all" ? "All active people and relationships will be archived." : "Every listed recipient will receive this email.",
    });
    if (action === "delete_all") return { status: "completed", code: 200, result: await deleteAll(c, tree, key, existingResult.people) };
  }
  if (action === "invite:send" || action === "email:send" || action === "email_all") {
    const delivery = await deliveries(c, tree, key, action, body, confirmed, existingResult?.people);
    return { status: "sending", code: 202, result: { message: "Delivery accepted.", recipientCount: delivery.recipients.length }, delivery };
  }
  throw new AgentError(422, "unknown_action", "Unsupported assistant action.");
}
export async function executeAction(keyId: string, action: ActionType, rawBody: unknown, requestId: string | undefined, transport = sendEmail) {
  const bodyId = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>).requestId : undefined;
  const conflictingIds = Boolean(requestId && bodyId && requestId !== bodyId);
  if (!requestId && typeof bodyId === "string") requestId = bodyId;
  const fp = fingerprint(action, rawBody);
  const operation = await transaction(async c => {
    const { rows: [known] } = await c.query("SELECT * FROM assistant_keys WHERE id=$1 FOR UPDATE", [keyId]);
    if (!known) throw new AgentError(401, "invalid_key", "Invalid assistant key.");
    const validId = requestId && /^[A-Za-z0-9_.:-]{1,128}$/.test(requestId);
    if (validId) {
      const { rows: [previous] } = await c.query("SELECT * FROM assistant_actions WHERE key_id=$1 AND request_id=$2", [keyId, requestId]);
      if (previous) {
        // Revocation and lost access apply to replays too, even though they cannot execute again.
        const key = await currentKey(c, keyId);
        await treeAccess(c, key.user_id, key.tree_id);
        if (previous.fingerprint !== fp) throw new AgentError(409, "idempotency_conflict", "That request ID was already used for a different task.");
        return { code: previous.http_status || 409, result: { ...previous.result, actionId: previous.id, status: previous.status, replayed: true } };
      }
    }
    const id = randomUUID();
    await c.query(`INSERT INTO assistant_actions(id,user_id,key_id,tree_id,request_id,fingerprint,action,status,payload)
      VALUES($1,$2,$3,$4,$5,$6,$7,'in_progress','{}')`, [id, known.user_id, keyId, known.tree_id, validId ? requestId : randomUUID(), fp, action]);
    await c.query("SAVEPOINT operation");
    try {
      const key = await currentKey(c, keyId);
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [key.user_id]);
      const tree = await treeAccess(c, key.user_id, key.tree_id, true);
      allowed(key, action);
      if (conflictingIds) throw new AgentError(422, "request_id_conflict", "The body requestId and Idempotency-Key header must match.");
      if (!validId) throw new AgentError(400, "idempotency_required", "Provide a unique requestId in JSON, or an Idempotency-Key header, for each member-directed task.");
      const { rows: [rate] } = await c.query("SELECT count(*)::int AS n FROM assistant_actions WHERE user_id=$1 AND created_at>now()-interval '1 minute'", [key.user_id]);
      if (rate.n > 60) throw new AgentError(429, "write_rate_limit", "Too many assistant writes. Wait a minute.");
      const { rows: [pending] } = await c.query("SELECT count(*)::int AS n FROM assistant_actions WHERE user_id=$1 AND status IN ('draft','pending_confirmation')", [key.user_id]);
      if (pending.n >= 100) throw new AgentError(429, "pending_limit", "Review existing pending tasks before adding more.");
      const body = parseAction(action, rawBody);
      await c.query("UPDATE assistant_actions SET payload=$2 WHERE id=$1", [id, JSON.stringify(body)]);
      // A nested savepoint preserves the validated request and audit when execution rolls back.
      await c.query("SAVEPOINT task");
      try {
        const output = await perform(c, key, tree, action, body);
        if (output.payload) await c.query("UPDATE assistant_actions SET payload=$2 WHERE id=$1", [id, JSON.stringify(output.payload)]);
        await finish(c, id, output.status, output.code, output.result, output.status === "completed");
        await c.query("UPDATE assistant_keys SET last_used_at=now() WHERE id=$1", [keyId]);
        return { ...output, id, keyId, result: { ...output.result, actionId: id, status: output.status } };
      } catch (error) {
        await c.query("ROLLBACK TO SAVEPOINT task");
        const { code, result } = errorResult(error);
        const pending = error instanceof NeedsConfirmation;
        await finish(c, id, pending ? "pending_confirmation" : "failed", code, result, !pending);
        return { code, result: { ...result, actionId: id, status: pending ? "pending_confirmation" : "failed" } };
      }
    } catch (error) {
      await c.query("ROLLBACK TO SAVEPOINT operation");
      const { code, result } = errorResult(error);
      await finish(c, id, "failed", code, result);
      return { code, result: { ...result, actionId: id, status: "failed" } };
    }
  });
  if ("delivery" in operation && operation.delivery) return deliver(operation.id!, operation.keyId!, operation.delivery, transport);
  return operation;
}

export async function reviewAction(userId: string, id: string, approve: boolean, overrides: Record<string, any>, transport = sendEmail) {
  const operation = await transaction(async c => {
    // Lock ordering matches executeAction and revocation: key, then task, then tree.
    const { rows: [lookup] } = await c.query("SELECT * FROM assistant_actions WHERE id=$1 AND user_id=$2", [id, userId]);
    if (!lookup || !lookup.key_id) throw new AgentError(404, "task_not_found", "Task not found.");
    const key = await currentKey(c, lookup.key_id, approve);
    await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const { rows: [task] } = await c.query("SELECT * FROM assistant_actions WHERE id=$1 FOR UPDATE", [id]);
    if (!["draft", "pending_confirmation"].includes(task.status)) throw new AgentError(409, "task_not_pending", "This task has already been handled.");
    if (!approve) {
      await finish(c, id, "rejected", 200, { message: "Rejected by member." });
      await audit(c, userId, key.tree_id, key.id, "task:reject", { actionId: id });
      return { code: 200, result: { actionId: id, status: "rejected" } };
    }
    if (Date.now() - new Date(task.created_at).getTime() > 7 * 86_400_000) throw new AgentError(409, "confirmation_expired", "This request is over seven days old. Reject it and submit a fresh task.");
    const tree = await treeAccess(c, userId, key.tree_id, true);
    allowed(key, task.action);
    if (task.status === "pending_confirmation" && overrides.confirmed !== true) throw new AgentError(422, "confirmation_required", "Explicit confirmation is required.");
    const candidates = task.result?.candidates as any[] | undefined;
    const body = { ...task.payload };
    for (const field of ["memberId", "keepMemberId", "mergeMemberId", "of"]) {
      if (overrides[field]) {
        const permitted = task.result?.candidateGroups?.[field] || (task.result?.selectionField === field ? candidates : undefined);
        if (permitted && !permitted.some((p: any) => p.id === overrides[field])) throw new AgentError(422, "invalid_selection", "Choose one of the listed people.");
        if (candidates && task.result?.selectionField && field !== task.result.selectionField) throw new AgentError(422, "invalid_selection", "Only resolve the person requested in this confirmation.");
        body[field] = overrides[field];
      }
    }
    await c.query("SAVEPOINT approved_task");
    try {
      let output: any;
      if (task.status === "draft") output = { status: "completed", code: 200, result: await acceptDraft(c, tree, key, body) };
      else output = await perform(c, key, tree, task.action, body, true, task.result);
      await c.query("UPDATE assistant_actions SET payload=$2 WHERE id=$1", [id, JSON.stringify(body)]);
      await finish(c, id, output.status, output.code, output.result, ["completed"].includes(output.status));
      await audit(c, userId, key.tree_id, key.id, "task:approve", { actionId: id, status: output.status });
      return { ...output, id, keyId: key.id, result: { ...output.result, actionId: id, status: output.status } };
    } catch (error) {
      await c.query("ROLLBACK TO SAVEPOINT approved_task");
      const { code, result } = errorResult(error);
      if (error instanceof NeedsConfirmation) {
        await c.query("UPDATE assistant_actions SET payload=$2,result=$3,http_status=409 WHERE id=$1", [id, JSON.stringify(body), JSON.stringify(result)]);
      }
      await audit(c, userId, key.tree_id, key.id, "task:approval_failed", { actionId: id, ...result });
      return { code, result: { ...result, actionId: id } };
    }
  });
  if ("delivery" in operation && operation.delivery) return deliver(operation.id!, operation.keyId!, operation.delivery, transport);
  return operation;
}

async function deliver(id: string, keyId: string, delivery: any, transport: typeof sendEmail) {
  // The durable sending state precedes provider calls. A crash or uncertain result must NOT resend on replay.
  const results: any[] = [];
  let stopped = false;
  for (const recipient of delivery.recipients) {
    try {
      // Never hold a key lock across a network call. Revocation must not wait for
      // a provider or a whole batch. Re-authorize each recipient before starting.
      await transaction(async c => {
        const key = await currentKey(c, keyId);
        const tree = await treeAccess(c, key.user_id, key.tree_id);
        const { rows: [task] } = await c.query("SELECT * FROM assistant_actions WHERE id=$1 FOR UPDATE", [id]);
        if (task.status !== "sending") throw new AgentError(409, "delivery_stopped", "The remaining delivery was stopped.");
        allowed(key, task.action);
        if (delivery.isInvite) {
          await c.query(`INSERT INTO member_invitations(id,email,member_id,tree_id,tree_name,invited_by,inviter_name,member_name)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(), recipient.email, recipient.id, tree.id, tree.name, key.user_id, delivery.sender, recipient.name]);
        }
        await c.query("UPDATE assistant_actions SET result=$2 WHERE id=$1", [id, JSON.stringify({
          recipientCount: delivery.recipients.length, deliveries: results,
          inFlight: { memberId: recipient.id, email: recipient.email }, message: "Recipient authorized; delivery in progress. Do not resend.",
        })]);
      });
    } catch {
      stopped = true;
      results.push({ memberId: recipient.id, email: recipient.email, status: "cancelled" });
      break;
    }
    try {
      const content = delivery.isInvite
        ? `${escapeHtml(delivery.sender)} has invited ${escapeHtml(recipient.name)} to the ${escapeHtml(delivery.treeName)} tree on FamilyRoots. Sign in to FamilyRoots to review your invitation.`
        : escapeHtml(delivery.text).replace(/\n/g, "<br>");
      const response = await transport(recipient.email, delivery.subject,
        `<div><p>From ${escapeHtml(delivery.sender)} via FamilyRoots</p><p>${content}</p></div>`);
      if (response?.error) throw new Error("Provider rejected delivery");
      results.push({ memberId: recipient.id, email: recipient.email, status: "sent" });
    } catch {
        results.push({ memberId: recipient.id, email: recipient.email, status: "uncertain" });
    }
    await pool.query("UPDATE assistant_actions SET result=$2 WHERE id=$1", [id, JSON.stringify({
      recipientCount: delivery.recipients.length, deliveries: results, message: "Delivery in progress. Do not resend.",
    })]);
  }
  return transaction(async c => {
    const { rows: [task] } = await c.query("SELECT status FROM assistant_actions WHERE id=$1 FOR UPDATE", [id]);
    const cancelled = stopped || task?.status === "cancelled";
    const uncertain = results.some(r => r.status === "uncertain");
    const status = cancelled ? "cancelled" : uncertain ? "delivery_uncertain" : "completed";
    const result = { actionId: id, status, recipientCount: delivery.recipients.length, deliveries: results,
      message: cancelled ? "Remaining deliveries were stopped. Already authorized deliveries cannot be recalled."
        : uncertain ? "Some deliveries could not be confirmed. No automatic resend will occur." : "Email sent." };
    await finish(c, id, status, uncertain ? 502 : 200, result);
    return { code: uncertain ? 502 : 200, result };
  });
}
