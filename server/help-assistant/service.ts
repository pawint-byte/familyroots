import { createHash, randomUUID, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "../db";
import { transaction } from "../assistant/data";
import { escapeHtml } from "../assistant/policy";
import { sendEmail } from "../lib/email";
import { helpActionSchema, type HelpActionInput, type HelpActionResult, type HelpConfirmation } from "../../shared/help-assistant";

export class HelpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const sessionHash = (sessionId: string) => createHash("sha256").update(sessionId).digest("hex");
const reference = z.string().trim().min(1).max(200);
const treeReference = z.object({ treeId: reference.optional(), treeName: reference.optional() }).strict();

async function ownTree(client: Pick<PoolClient, "query">, userId: string, input: { treeId?: string; treeName?: string }, lock = false) {
  if (!input.treeId && !input.treeName) throw new HelpError(422, "Choose one of your trees or circles first.");
  const { rows } = await client.query(`SELECT id,name,tree_type,root_member_id FROM family_trees
    WHERE owner_id=$1 AND deleted_at IS NULL AND ${input.treeId ? "id=$2" : "lower(name)=lower($2)"} ${lock ? "FOR UPDATE" : ""}`,
  [userId, input.treeId || input.treeName]);
  if (!rows.length) throw new HelpError(404, "I can only access a tree or circle you own. No matching owned item was found.");
  if (rows.length !== 1) throw new HelpError(409, "Several of your trees have that name. Please choose an exact tree ID.");
  if (input.treeId && input.treeName && rows[0].name !== input.treeName) throw new HelpError(409, "That tree changed. Please request a new confirmation.");
  return rows[0];
}

export async function readHelpTool(userId: string, name: string, raw: unknown) {
  if (name === "list_my_trees") {
    z.object({}).strict().parse(raw);
    const { rows } = await pool.query(`SELECT t.id,t.name,t.tree_type AS "treeType",t.privacy,
      (SELECT count(*)::int FROM family_members m WHERE m.tree_id=t.id AND m.deleted_at IS NULL) AS "memberCount"
      FROM family_trees t WHERE t.owner_id=$1 AND t.deleted_at IS NULL ORDER BY t.name,t.id`, [userId]);
    return { treesAndCircles: rows };
  }
  if (name === "list_my_members") {
    const input = treeReference.extend({ offset: z.number().int().min(0).max(100000).default(0) }).parse(raw);
    const tree = await ownTree(pool, userId, input);
    const { rows } = await pool.query(`SELECT id,concat_ws(' ',first_name,last_name) AS name FROM family_members
      WHERE tree_id=$1 AND deleted_at IS NULL ORDER BY id LIMIT 101 OFFSET $2`, [tree.id, input.offset]);
    const count = await pool.query("SELECT count(*)::int AS total FROM family_members WHERE tree_id=$1 AND deleted_at IS NULL", [tree.id]);
    return { treeId: tree.id, treeName: tree.name, memberCount: count.rows[0].total, members: rows.slice(0,100), nextOffset: rows.length > 100 ? input.offset + 100 : null };
  }
  if (name === "list_my_invites") {
    z.object({}).strict().parse(raw);
    // Never return recipient addresses, invitation codes, or another account's profile.
    const links = await pool.query(`SELECT i.id,i.tree_id AS "treeId",t.name AS "treeName",i.role,i.is_active AS active,
      i.used_count AS "usedCount",i.expires_at AS "expiresAt",
      coalesce((SELECT a.state FROM help_assistant_actions a WHERE a.resource_id=i.id AND a.user_id=$1 AND a.kind='send_invite' LIMIT 1),'link_created') AS "deliveryStatus"
      FROM tree_invitations i JOIN family_trees t ON t.id=i.tree_id
      WHERE i.created_by=$1 AND t.owner_id=$1 AND t.deleted_at IS NULL ORDER BY i.created_at DESC LIMIT 100`, [userId]);
    const invites = await pool.query(`SELECT i.id,i.status,i.tree_name AS "treeName",
      CASE WHEN i.invited_by=$1 THEN 'sent' ELSE 'received' END AS direction
      FROM member_invitations i JOIN users u ON u.id=$1
      WHERE i.invited_by=$1 OR lower(i.email)=lower(u.email) ORDER BY i.sent_at DESC LIMIT 100`, [userId]);
    return { myInvitationLinks: links.rows, mySentAndReceivedInvites: invites.rows };
  }
  throw new HelpError(422, "Unsupported tool.");
}

async function createdResource(client: Pick<PoolClient, "query">, userId: string, input: Extract<HelpActionInput, {kind:"delete_created"}>, lock = false) {
  if (!input.resourceId && !input.name) throw new HelpError(422, "Name the item the assistant created, or give its exact ID.");
  const { rows } = await client.query(`SELECT * FROM help_assistant_actions WHERE user_id=$1 AND state IN ('completed','uncertain')
    AND kind<>'delete_created' AND resource_type=$2 AND ${input.resourceId ? "resource_id=$3" : "(payload->>'name'=$3 OR payload->>'title'=$3)"}
    ORDER BY created_at DESC ${lock ? "FOR UPDATE" : ""}`, [userId, input.resourceType, input.resourceId || input.name]);
  if (!rows.length) throw new HelpError(404, "I can only delete an item this assistant created for your account.");
  if (rows.length !== 1) throw new HelpError(409, "Several created items match. Please specify the exact resource ID.");
  return rows[0];
}

export async function proposeHelpAction(userId: string, sessionId: string, raw: unknown): Promise<HelpConfirmation> {
  let input = helpActionSchema.parse(raw);
  return transaction(async c => {
    // Serializes proposals/confirmations per member and makes safety limits race-safe.
    await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const { rows: [limits] } = await c.query(`SELECT
      count(*) FILTER(WHERE state='pending' AND expires_at>now())::int AS pending,
      count(*) FILTER(WHERE created_at>now()-interval '1 minute')::int AS recent
      FROM help_assistant_actions WHERE user_id=$1`, [userId]);
    if (limits.pending >= 100 || limits.recent >= 60) throw new HelpError(429, "Please finish pending tasks or wait before requesting more.");
    let summary: string;
    if (input.kind === "create_tree") {
      summary = `Should I create the private ${input.treeType === "friends" ? "circle" : "tree"} “${input.name}”?`;
    } else if (input.kind === "delete_created") {
      const source = await createdResource(c, userId, input);
      input = { ...input, resourceId: source.resource_id };
      summary = `Should I ${input.resourceType === "tree" ? "archive" : "delete or deactivate"} the assistant-created ${input.resourceType} “${input.name || source.payload.name || source.payload.title || source.resource_id}”?`;
    } else {
      const selected = await ownTree(c, userId, input);
      input = { ...input, treeId: selected.id, treeName: selected.name };
      if (input.kind === "add_event" && input.memberId) {
        const member = await c.query("SELECT id FROM family_members WHERE id=$1 AND tree_id=$2 AND deleted_at IS NULL", [input.memberId, selected.id]);
        if (!member.rowCount) throw new HelpError(404, "That person is not in your selected tree.");
      }
      summary = input.kind === "add_event"
        ? `Should I add “${input.title}” on ${input.eventDate} to “${selected.name}”?`
        : `Should I send a viewer invitation for “${selected.name}” to ${input.email}?`;
    }
    const actionId = randomUUID(), expiresAt = new Date(Date.now() + 30 * 60000).toISOString();
    await c.query(`INSERT INTO help_assistant_actions(id,user_id,session_hash,kind,payload,expires_at) VALUES($1,$2,$3,$4,$5,$6)`,
      [actionId, userId, sessionHash(sessionId), input.kind, JSON.stringify(input), expiresAt]);
    return { actionId, kind: input.kind, summary, expiresAt };
  });
}

export async function reviewHelpAction(userId: string, sessionId: string, actionId: string, confirm: boolean, origin: string, transport = sendEmail): Promise<HelpActionResult> {
  const prepared = await transaction(async c => {
    await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const { rows: [task] } = await c.query(`SELECT * FROM help_assistant_actions WHERE id=$1 AND user_id=$2 AND session_hash=$3 FOR UPDATE`,
      [actionId, userId, sessionHash(sessionId)]);
    if (!task) throw new HelpError(404, "This confirmation does not belong to your signed-in session.");
    if (task.state !== "pending") return { result: task.result || { message: "This task is no longer pending.", status: task.state } };
    if (!confirm) {
      const result = { message: "Cancelled. No changes were made.", status: "cancelled" };
      await c.query("UPDATE help_assistant_actions SET state='cancelled',result=$2,completed_at=now() WHERE id=$1", [actionId, JSON.stringify(result)]);
      return { result };
    }
    if (+new Date(task.expires_at) <= Date.now()) throw new HelpError(409, "This confirmation expired. Ask for a new one.");
    const input = helpActionSchema.parse(task.payload);
    let result: HelpActionResult;
    if (input.kind === "create_tree") {
      const treeId = randomUUID(), memberId = randomUUID();
      const { rows: [user] } = await c.query("SELECT first_name,last_name,email FROM users WHERE id=$1", [userId]);
      await c.query(`INSERT INTO family_trees(id,name,owner_id,privacy,tree_type,root_member_id,is_discoverable)
        VALUES($1,$2,$3,'private',$4,$5,false)`, [treeId, input.name, userId, input.treeType, memberId]);
      await c.query(`INSERT INTO family_members(id,tree_id,first_name,last_name,email,claimed_by_user_id,claimed_at)
        VALUES($1,$2,$3,$4,$5,$6,now())`, [memberId, treeId, user.first_name || "Me", user.last_name, user.email, userId]);
      result = { message: `Created private ${input.treeType === "friends" ? "circle" : "tree"} “${input.name}”. It now appears in your network.`, resourceId: treeId, resourceType: "tree", treeId };
    } else if (input.kind === "add_event") {
      const selected = await ownTree(c, userId, input, true);
      if (input.memberId && !(await c.query("SELECT id FROM family_members WHERE id=$1 AND tree_id=$2 AND deleted_at IS NULL", [input.memberId, selected.id])).rowCount) {
        throw new HelpError(404, "That person is no longer in your selected tree.");
      }
      const id = randomUUID();
      await c.query(`INSERT INTO family_events(id,tree_id,member_id,event_type,event_date,title,description,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, selected.id, input.memberId || null, input.eventType, input.eventDate, input.title, input.description || null, userId]);
      result = { message: `Added “${input.title}” to “${selected.name}”.`, resourceId: id, resourceType: "event", treeId: selected.id };
    } else if (input.kind === "send_invite") {
      const selected = await ownTree(c, userId, input, true);
      const { rows: [limits] } = await c.query(`SELECT
        (SELECT count(*)::int FROM help_assistant_actions WHERE user_id=$1 AND kind='send_invite'
          AND state IN ('executing','completed','uncertain') AND created_at>now()-interval '24 hours')
        + (SELECT coalesce(sum(coalesce((result->>'recipientCount')::int,1)),0)::int FROM assistant_actions
          WHERE user_id=$1 AND action IN ('email:send','invite:send','email_all') AND status IN ('sending','completed','delivery_uncertain','cancelled')
          AND created_at>now()-interval '24 hours') AS total`, [userId]);
      if (limits.total >= 30) throw new HelpError(429, "The assistant email-recipient safety limit has been reached. Please wait.");
      const id = randomUUID(), code = randomBytes(16).toString("hex");
      await c.query(`INSERT INTO tree_invitations(id,tree_id,invite_code,role,created_by,expires_at,max_uses)
        VALUES($1,$2,$3,'viewer',$4,now()+interval '7 days','1')`, [id, selected.id, code, userId]);
      result = { message: "Invitation delivery is in progress. Do not resend.", status: "executing", resourceId: id, resourceType: "invite", treeId: selected.id };
      await c.query(`UPDATE help_assistant_actions SET state='executing',result=$2,resource_id=$3,resource_type='invite' WHERE id=$1`,
        [actionId, JSON.stringify(result), id]);
      return { result, delivery: { email: input.email, treeName: selected.name, code } };
    } else {
      const source = await createdResource(c, userId, input, true);
      const id = source.resource_id;
      if (input.resourceType === "tree") {
        const selected = await ownTree(c, userId, { treeId: id }, true);
        const root = await c.query("SELECT claimed_by_user_id FROM family_members WHERE id=$1 AND tree_id=$2 AND deleted_at IS NULL", [selected.root_member_id,id]);
        if (root.rowCount && root.rows[0].claimed_by_user_id !== userId) throw new HelpError(409, "Another member now owns this profile. Use the normal tree controls.");
        const { rows: [extra] } = await c.query(`SELECT
          (SELECT count(*) FROM family_members WHERE tree_id=$1 AND deleted_at IS NULL AND id<>$2)
          + (SELECT count(*) FROM family_events WHERE tree_id=$1)
          + (SELECT count(*) FROM tree_collaborators WHERE tree_id=$1)
          + (SELECT count(*) FROM tree_connections WHERE tree1_id=$1 OR tree2_id=$1)
          + (SELECT count(*) FROM tree_invitations WHERE tree_id=$1 AND is_active=true)
          + (SELECT count(*) FROM family_trees WHERE parent_tree_id=$1 AND deleted_at IS NULL) AS total`, [id, selected.root_member_id]);
        if (Number(extra.total)) throw new HelpError(409, "This item now contains other content or connections. Please manage it using the normal tree controls.");
        await c.query("UPDATE family_trees SET deleted_at=now(),updated_at=now() WHERE id=$1", [id]);
        await c.query("UPDATE family_members SET deleted_at=now() WHERE id=$1 AND tree_id=$2 AND claimed_by_user_id=$3", [selected.root_member_id, id, userId]);
      } else if (input.resourceType === "event") {
        const event = await c.query(`SELECT e.id FROM family_events e JOIN family_trees t ON t.id=e.tree_id
          WHERE e.id=$1 AND e.created_by=$2 AND t.owner_id=$2 AND t.deleted_at IS NULL FOR UPDATE OF e`, [id, userId]);
        if (!event.rowCount) throw new HelpError(404, "That assistant-created event is no longer available in your own tree.");
        await c.query("DELETE FROM family_events WHERE id=$1", [id]);
      } else {
        const invite = await c.query(`UPDATE tree_invitations i SET is_active=false FROM family_trees t
          WHERE i.id=$1 AND i.tree_id=t.id AND i.created_by=$2 AND t.owner_id=$2 AND t.deleted_at IS NULL RETURNING i.id`, [id, userId]);
        if (!invite.rowCount) throw new HelpError(404, "That assistant-created invitation is not available.");
      }
      await c.query("UPDATE help_assistant_actions SET state='resource_deleted' WHERE id=$1", [source.id]);
      result = { message: input.resourceType === "tree" ? "Archived the assistant-created circle/tree. It is no longer in your network."
        : input.resourceType === "invite" ? "Deactivated the invitation link. Any delivered email cannot be recalled." : "Deleted the assistant-created event.",
      resourceId: id, resourceType: input.resourceType };
    }
    result.status = "completed";
    await c.query(`UPDATE help_assistant_actions SET state='completed',result=$2,resource_id=$3,resource_type=$4,completed_at=now() WHERE id=$1`,
      [actionId, JSON.stringify(result), result.resourceId || null, result.resourceType || null]);
    return { result };
  });
  if (!prepared.delivery) return prepared.result;
  const { delivery } = prepared;
  let sent = false;
  try {
    const response = await transport(delivery.email, `FamilyRoots invitation: ${delivery.treeName}`,
      `<p>You have been invited to join ${escapeHtml(delivery.treeName)} on FamilyRoots as a viewer.</p><p><a href="${escapeHtml(origin)}/join/${delivery.code}">Review your invitation</a></p>`);
    sent = !response?.error;
  } catch { /* Unknown delivery outcome must not cause a resend. */ }
  const result = { ...prepared.result, status: sent ? "completed" : "uncertain",
    message: sent ? `Sent the viewer invitation for “${delivery.treeName}”.`
      : "The invitation was created, but email delivery could not be confirmed. No automatic resend will occur." };
  await pool.query("UPDATE help_assistant_actions SET state=$2,result=$3,completed_at=now() WHERE id=$1 AND state='executing'",
    [actionId, sent ? "completed" : "uncertain", JSON.stringify(result)]);
  return result;
}
