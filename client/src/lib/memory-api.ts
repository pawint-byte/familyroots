import { apiRequest } from "./queryClient";

export interface MemoryDraft {
  title: string;
  story: string;
  eventDate: string;
  category: string;
  memberId: string;
  photoUrl: string;
}

export function createMemory(treeId: string, draft: MemoryDraft) {
  return apiRequest("POST", `/api/trees/${treeId}/memories`, {
    title: draft.title.trim(),
    story: draft.story.trim() || null,
    eventDate: draft.eventDate || null,
    category: draft.category,
    memberId: draft.memberId && draft.memberId !== "none" ? draft.memberId : null,
    photoUrl: draft.photoUrl || null,
  });
}

export function deleteMemory(id: string) {
  return apiRequest("DELETE", `/api/memories/${id}`);
}

// apiRequest throws an Error containing "<status>: <response body>", not the
// response JSON itself. Only display the server's intended user-facing message.
export function memoryErrorToast(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const responseBody = message.match(/^\d{3}: ([\s\S]*)$/)?.[1];
  if (responseBody) {
    try {
      const body = JSON.parse(responseBody);
      if (typeof body?.message === "string" && body.message) {
        return {
          title: body.error === "tier_limit_reached" ? "Upload limit reached" : "Error",
          description: body.message,
        };
      }
    } catch {
      // Non-JSON responses and network errors use a safe, actionable fallback.
    }
  }
  return { title: "Error", description: fallback };
}