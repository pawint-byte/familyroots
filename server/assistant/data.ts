import type { PoolClient } from "pg";
import { pool } from "../db";
import { randomUUID } from "node:crypto";
import { PRICING_CONFIG } from "../subscriptionService";
import { isAdminAccount } from "../adminConfig";
import { AgentError, NeedsConfirmation, resolveName } from "./policy";
import { getValidRelationshipValues, type TreeType } from "@shared/treeTypes";

export function resolveField(members: any[], reference: string | undefined, anchor: string | null, field: string) {
  try { return resolveName(members, reference, anchor); }
  catch (error) {
    if (error instanceof NeedsConfirmation) error.detail.selectionField = field;
    throw error;
  }
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query("BEGIN"); const result = await fn(c); await c.query("COMMIT"); return result; }
  catch (e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}
export async function treeAccess(c: PoolClient, userId: string, treeId: string, lock = false) {
  const { rows: [tree] } = await c.query(`SELECT t.* FROM family_trees t
    WHERE t.id=$1 AND t.deleted_at IS NULL AND
    (t.owner_id=$2 OR EXISTS(SELECT 1 FROM tree_collaborators WHERE tree_id=t.id AND user_id=$2 AND can_edit=true))
    ${lock ? "FOR UPDATE OF t" : ""}`, [treeId, userId]);
  if (!tree) throw new AgentError(403, "tree_access_denied", "You no longer have edit access to this tree.");
  return tree;
}
export async function activeMembers(c: PoolClient, treeId: string) {
  return (await c.query("SELECT * FROM family_members WHERE tree_id=$1 AND deleted_at IS NULL ORDER BY id", [treeId])).rows;
}
export function relation(tree: any, label: string) {
  const normalized = label.toLowerCase();
  const familyAliases: Record<string, string> = { mother: "parent", father: "parent", son: "child", daughter: "child", husband: "spouse", wife: "spouse", brother: "sibling", sister: "sibling" };
  const value = tree.tree_type === "family" ? familyAliases[normalized] || normalized : normalized;
  const valid = getValidRelationshipValues(tree.tree_type as TreeType, tree.custom_relationship_types);
  if (!valid.includes(value)) throw new AgentError(422, "invalid_label", "Use a supported relationship label.", { allowedLabels: valid });
  return { value, label };
}
export async function setLabel(c: PoolClient, tree: any, key: any, body: any, members: any[]) {
  const person = resolveField(members, body.memberId || body.name, key.member_id, "memberId");
  const of = resolveField(members, body.of, key.member_id, "of");
  if (person.id === of.id) throw new AgentError(422, "self_relationship", "A person cannot be related to themselves.");
  const rel = relation(tree, body.label);
  const changed = await c.query(`UPDATE relationships SET custom_label=$5 WHERE tree_id=$1 AND from_member_id=$2
    AND to_member_id=$3 AND relationship_type=$4 AND deleted_at IS NULL`,
    [tree.id, person.id, of.id, rel.value, rel.label]);
  if (!changed.rowCount) await c.query(`INSERT INTO relationships(id,tree_id,from_member_id,to_member_id,relationship_type,custom_label)
    VALUES($1,$2,$3,$4,$5,$6)`, [randomUUID(), tree.id, person.id, of.id, rel.value, rel.label]);
  return { memberId: person.id, of: of.id, label: rel.label };
}
export async function acceptDraft(c: PoolClient, tree: any, key: any, body: any) {
  // Lock the owner so simultaneous assistant approvals cannot spend the same credit.
  const { rows: [owner] } = await c.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [tree.owner_id]);
  if (!owner) throw new AgentError(403, "owner_not_found", "Tree owner unavailable.");
  const { rows: [count] } = await c.query(`SELECT count(*)::int AS n FROM family_members m JOIN family_trees t ON t.id=m.tree_id
    WHERE t.owner_id=$1 AND t.deleted_at IS NULL AND m.deleted_at IS NULL`, [tree.owner_id]);
  const charged = !isAdminAccount(tree.owner_id, owner.email) && count.n >= PRICING_CONFIG.freeTierCredits;
  if (charged && owner.member_credits <= 0) throw new AgentError(402, "NO_CREDITS", "No member slots remain. Existing member-pack rules apply.");
  const members = await activeMembers(c, tree.id);
  const anchor = body.of ? resolveName(members, body.of, key.member_id) : null;
  if (body.label) relation(tree, body.label);
  const memberId = randomUUID();
  await c.query("INSERT INTO family_members(id,tree_id,first_name) VALUES($1,$2,$3)", [memberId, tree.id, body.name]);
  if (!tree.root_member_id && members.length === 0) await c.query("UPDATE family_trees SET root_member_id=$2 WHERE id=$1", [tree.id, memberId]);
  if (anchor) await setLabel(c, tree, key, { memberId, of: anchor.id, label: body.label }, await activeMembers(c, tree.id));
  await c.query("UPDATE users SET member_credits=member_credits-$2,total_member_count=$3 WHERE id=$1",
    [tree.owner_id, charged ? 1 : 0, count.n + 1]);
  return { memberId, name: body.name, label: body.label || null };
}
export async function mergePeople(c: PoolClient, tree: any, key: any, body: any, members: any[]) {
  let keep: any, source: any;
  const groups: Record<string, any[]> = {};
  for (const [field, reference] of [["keepMemberId", body.keepMemberId || body.keep], ["mergeMemberId", body.mergeMemberId || body.merge]]) {
    try {
      const member = resolveName(members, reference, key.member_id);
      groups[field] = [{ id: member.id, name: `${member.first_name} ${member.last_name || ""}`.trim() }];
      if (field === "keepMemberId") keep = member;
      else source = member;
    } catch (error) {
      if (!(error instanceof NeedsConfirmation)) throw error;
      groups[field] = error.detail.candidates;
    }
  }
  if (!keep || !source) throw new NeedsConfirmation("Choose the exact survivor and duplicate on the site.", { candidateGroups: groups });
  if (keep.id === source.id) throw new AgentError(422, "same_person", "Choose two different people.");
  if ([keep, source].some(m => m.claimed_by_user_id && m.claimed_by_user_id !== key.user_id)) {
    throw new AgentError(403, "claimed_profile_protected", "An assistant cannot merge another member's claimed profile.");
  }
  // Capture the complete source record and all moved references before changing anything.
  // Reference columns come only from the DB catalog, never client-supplied SQL identifiers.
  const { rows: columns } = await c.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name ~ '(^member[12]?_id$|_member_id$)'
    AND table_name NOT IN ('member_merge_history','assistant_actions','assistant_keys') ORDER BY table_name,column_name`);
  const references: any[] = [];
  const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
  for (const col of columns) {
    const table = quote(col.table_name), column = quote(col.column_name);
    const rows = (await c.query(`SELECT * FROM ${table} WHERE ${column}=$1`, [source.id])).rows;
    if (!rows.length) continue;
    references.push({ table: col.table_name, column: col.column_name, rows });
    // Discovery is opt-in per person. Never increase the survivor's visibility by
    // copying the source's consent; retain conflicting source settings in the archive.
    if (col.table_name === "discoverable_members" &&
      (await c.query("SELECT id FROM discoverable_members WHERE member_id=$1", [keep.id])).rowCount) continue;
    await c.query(`UPDATE ${table} SET ${column}=$2 WHERE ${column}=$1`, [source.id, keep.id]);
  }
  await c.query("UPDATE relationships SET deleted_at=now() WHERE tree_id=$1 AND from_member_id=to_member_id AND deleted_at IS NULL", [tree.id]);
  await c.query(`WITH duplicates AS (SELECT id,row_number() OVER
    (PARTITION BY from_member_id,to_member_id,relationship_type,custom_label,qualifier ORDER BY created_at,id) AS n
    FROM relationships WHERE tree_id=$1 AND deleted_at IS NULL AND (from_member_id=$2 OR to_member_id=$2))
    UPDATE relationships SET deleted_at=now() WHERE id IN (SELECT id FROM duplicates WHERE n>1)`, [tree.id, keep.id]);
  const fields = ["email", "alternate_email", "gender", "birth_date", "birth_place", "death_date", "photo_url", "notes", "nickname", "suffix", "current_city", "current_region", "current_country", "claimed_by_user_id", "claimed_at", "custodian_user_id", "custodian_assigned_at"];
  for (const field of fields) {
    if ((keep[field] === null || keep[field] === "") && source[field] !== null && source[field] !== "") {
      await c.query(`UPDATE family_members SET ${quote(field)}=$2,updated_at=now() WHERE id=$1`, [keep.id, source[field]]);
    }
  }
  const historyId = randomUUID();
  await c.query(`INSERT INTO member_merge_history(id,tree_id,survivor_member_id,merged_member_id,merged_by_user_id,merged_member_data,remapped_relationships,notes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [historyId, tree.id, keep.id, source.id, key.user_id, JSON.stringify(source), JSON.stringify(references), "Member-directed assistant merge; complete source and reference snapshots retained."]);
  // Keep the complete original profile as a soft-deleted archive rather than destroying it.
  await c.query("UPDATE family_members SET deleted_at=now(),updated_at=now() WHERE id=$1", [source.id]);
  return { keepMemberId: keep.id, mergeMemberId: source.id, mergeHistoryId: historyId };
}
export async function bulkSnapshot(c: PoolClient, tree: any, action: string) {
  const members = await activeMembers(c, tree.id);
  if (action === "email_all") return members.filter(m => m.email).map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name || ""}`.trim(), email: m.email.toLowerCase() }));
  return members.map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name || ""}`.trim() }));
}
export async function deleteAll(c: PoolClient, tree: any, key: any, expected: any[]) {
  if (tree.owner_id !== key.user_id) throw new AgentError(403, "owner_required", "Only the tree owner can confirm deleting all people.");
  const members = await activeMembers(c, tree.id);
  if (members.some(m => m.claimed_by_user_id && m.claimed_by_user_id !== key.user_id)) throw new AgentError(403, "claimed_profile_protected", "Another member's claimed profile prevents bulk deletion.");
  const current = members.map(m => m.id).sort();
  if (JSON.stringify(current) !== JSON.stringify(expected.map(m => m.id).sort())) throw new NeedsConfirmation("The tree changed. Reject this request and submit a new one.");
  await c.query("UPDATE family_members SET deleted_at=now() WHERE tree_id=$1 AND deleted_at IS NULL", [tree.id]);
  await c.query("UPDATE relationships SET deleted_at=now() WHERE tree_id=$1 AND deleted_at IS NULL", [tree.id]);
  await c.query("UPDATE family_trees SET root_member_id=NULL,updated_at=now() WHERE id=$1", [tree.id]);
  return { deleted: members.length, archived: true, message: "People and relationships were archived, not permanently destroyed." };
}
