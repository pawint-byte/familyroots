export const ASSISTANT_SCOPES = ["people:add", "labels:set", "invite:send", "email:send", "people:merge"] as const;
export type AssistantScope = typeof ASSISTANT_SCOPES[number];
export type AssistantState = "active" | "review_due" | "paused" | "revoked";
export interface AssistantKeyView {
  id: string; name: string; treeId: string; treeName: string;
  memberId: string | null; scopes: AssistantScope[]; state: AssistantState;
  reviewDueAt: string; pauseAt: string; createdAt: string; lastUsedAt: string | null;
}
export interface AssistantActionView {
  id: string; keyId: string | null; treeId: string; action: string; status: string;
  payload: Record<string, unknown>; result: Record<string, unknown> | null;
  createdAt: string; completedAt: string | null;
}
export interface AssistantSettings {
  keys: AssistantKeyView[];
  trees: { id: string; name: string; members: { id: string; name: string; claimedByMe: boolean }[] }[];
  actions: AssistantActionView[];
  scopes: readonly AssistantScope[];
}
