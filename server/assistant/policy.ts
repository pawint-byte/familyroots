import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { ASSISTANT_SCOPES } from "@shared/assistant";
import type { AssistantState } from "@shared/assistant";

export const DAY = 86_400_000;
export function keyState(key: { revoked_at?: unknown; stopped_at?: unknown; review_due_at: Date | string; pause_at: Date | string }, now = Date.now()): AssistantState {
  if (key.revoked_at) return "revoked";
  if (key.stopped_at || now >= new Date(key.pause_at).getTime()) return "paused";
  return now >= new Date(key.review_due_at).getTime() ? "review_due" : "active";
}
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function mintKey() {
  const id = randomUUID();
  const token = `fr_agent_${id}.${randomBytes(32).toString("base64url")}`;
  return { id, token, tokenHash: hash(token) };
}
export function fingerprint(action: string, body: unknown) {
  function canonical(value: any): any {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    return value;
  }
  return hash(JSON.stringify({ action, body: canonical(body) }));
}
export class AgentError extends Error {
  constructor(public status: number, public code: string, message: string, public detail: Record<string, any> = {}) { super(message); }
}
export class NeedsConfirmation extends AgentError {
  constructor(message: string, detail: Record<string, any> = {}) { super(409, "confirmation_required", message, detail); }
}
const text = (max = 200) => z.string().trim().min(1).max(max);
const reference = text();
const instruction = z.string().trim().max(2000).optional();
const requestId = z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/).optional();
const named = { memberId: reference.optional(), name: reference.optional(), instruction, requestId };
export const keyInput = z.object({
  name: text(80), treeId: reference, memberId: reference.optional(),
  scopes: z.array(z.enum(ASSISTANT_SCOPES)).max(5).refine(a => new Set(a).size === a.length, "Duplicate permissions"),
}).strict();
export const actionInputs = {
  "people:add": z.object({ name: text(), label: text(80).optional(), of: reference.optional(), instruction, requestId }).strict()
    .refine(b => Boolean(b.label) === Boolean(b.of), "Label and of must be supplied together"),
  "labels:set": z.object({ ...named, label: text(80), of: reference }).strict(),
  "invite:send": z.object({ ...named, email: z.string().trim().email().max(254) }).strict(),
  "email:send": z.object({ ...named, email: z.string().trim().email().max(254).optional(), subject: text(160), text: text(10000) }).strict(),
  "people:merge": z.object({ keepMemberId: reference.optional(), mergeMemberId: reference.optional(), keep: reference.optional(), merge: reference.optional(), instruction, requestId }).strict(),
  delete_all: z.object({ action: z.literal("delete_all"), instruction, requestId }).strict(),
  email_all: z.object({ action: z.literal("email_all"), subject: text(160), text: text(10000), instruction, requestId }).strict(),
};
export type ActionType = keyof typeof actionInputs;
export function parseAction(action: ActionType, body: unknown): Record<string, any> {
  const result = actionInputs[action].safeParse(body);
  if (!result.success) throw new AgentError(422, "invalid_request", result.error.issues[0]?.message || "Invalid request");
  return result.data;
}
export function resolveName(members: any[], reference: string | undefined, anchor?: string | null) {
  if (!reference) throw new AgentError(422, "missing_person", "Specify an existing person by memberId or exact name.");
  const lookup = reference === "member" ? anchor : reference;
  if (!lookup) throw new AgentError(422, "missing_anchor", "Select your claimed profile in the key settings or provide an explicit member ID.");
  const exact = members.find(m => m.id === lookup);
  if (exact) return exact;
  const matches = members.filter(m => `${m.first_name} ${m.last_name || ""}`.trim().toLocaleLowerCase() === lookup.toLocaleLowerCase());
  if (matches.length === 0) throw new AgentError(404, "person_not_found", "The referenced person is not in this tree.");
  if (matches.length > 1) throw new NeedsConfirmation("More than one person has that name. Choose an exact person on the site.", {
    candidates: matches.map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name || ""}`.trim() })),
  });
  return matches[0];
}
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
