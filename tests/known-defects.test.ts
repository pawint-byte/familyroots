import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { memberCopyData } from "../server/lib/member-copy";
import { stripeObjectId } from "../server/lib/stripe-object-id";
import { apiRequest } from "../client/src/lib/queryClient";
import { insertFamilyMemberSchema } from "../shared/schema";

test("copying records preserves their content without reusing primary keys", () => {
  const mediaAttachments = [{ id: "media", url: "/objects/demo", type: "video", caption: "Family clip" }];
  const original = {
    id: "source", createdAt: new Date(), memberId: "old-member",
    title: "Graduation", notes: "Details", mediaAttachments,
  };
  const copy = { ...memberCopyData(original), memberId: "new-member" };
  assert.equal("id" in copy, false);
  assert.equal("createdAt" in copy, false);
  assert.equal(copy.memberId, "new-member");
  assert.equal(copy.notes, original.notes);
  assert.deepEqual(copy.mediaAttachments, mediaAttachments);
  assert.equal(original.memberId, "old-member");
});

test("Stripe ID extraction accepts normal, expanded, and absent references", () => {
  assert.equal(stripeObjectId("pi_example"), "pi_example");
  assert.equal(stripeObjectId({ id: "pi_example" }), "pi_example");
  assert.equal(stripeObjectId({ id: "sub_example" }), "sub_example");
  assert.equal(stripeObjectId(null), null);
});

test("member position validation rejects arbitrary JSON instead of passing it to storage", () => {
  const base = { treeId: "tree", firstName: "Casey" };
  assert.equal(insertFamilyMemberSchema.safeParse({ ...base, customPosition: { x: 3, y: 4 } }).success, true);
  assert.equal(insertFamilyMemberSchema.safeParse({ ...base, customPosition: null }).success, true);
  for (const customPosition of ["invalid", { x: "3", y: 4 }, { x: Infinity, y: 4 }]) {
    assert.equal(insertFamilyMemberSchema.safeParse({ ...base, customPosition }).success, false);
  }
});

test("API helper sends voice-note JSON and DELETE with the intended method and URL", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init: init! });
    return new Response("{}", { status: 200 });
  };
  try {
    const data = { audioUrl: "/objects/demo", durationSeconds: 3, title: "Voice note" };
    await apiRequest("POST", "/api/trees/tree/members/member/voice-notes", data);
    await apiRequest("DELETE", "/api/voice-notes/note");
    assert.equal(requests[0].init.method, "POST");
    assert.deepEqual(JSON.parse(String(requests[0].init.body)), data);
    assert.equal(requests[0].init.credentials, "include");
    assert.equal(requests[1].url, "/api/voice-notes/note");
    assert.equal(requests[1].init.method, "DELETE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed profile transfers cannot silently continue to deleting the source member", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const merge = routes.slice(routes.indexOf("const transferResults: Record<string, number>"), routes.indexOf("await storage.deleteMember(mergeMemberId)"));
  assert.equal(/catch[^}]+transferResults\.[\w]+\s*=\s*0/.test(merge), false);
  assert.equal((merge.match(/catch \(e\) \{ throw new Error/g) || []).length, 11);
  assert.equal(/storage\.(getLifeEvents|createLifeEvent|getEducationRecords|createCareerRecord|createVoiceNote)\(/.test(merge), false);
});