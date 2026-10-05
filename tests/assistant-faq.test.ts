import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faqCategories, getFaqStructuredData } from "../shared/faq";
import { assistantOpenApi } from "../server/assistant/spec";
import { parseAction } from "../server/assistant/policy";
test("assistant FAQ covers setup, compatible clients, privacy, lifetime, approvals and errors", () => {
  const category = faqCategories.find(c => c.title === "Connect Your Own AI");
  assert.ok(category && category.items.length >= 10);
  const text = JSON.stringify(category);
  for (const required of ["Account settings", "Only me", "MCP", "requestId", "seven-day", "Revoke", "30 days", "401", "409", "502", "private", "claimed profile"]) {
    assert.ok(text.includes(required), `Missing guidance: ${required}`);
  }
  assert.ok(getFaqStructuredData().mainEntity.some((item: any) => item.name === category.items[0].question));
});
test("GPT Action writes use JSON request IDs rather than unsupported custom headers", () => {
  for (const path of Object.values(assistantOpenApi.paths)) {
    if ("post" in path) {
      assert.ok(path.post.requestBody.content["application/json"].schema.required.includes("requestId"));
      assert.equal(path.post["x-openai-isConsequential"], true);
      assert.ok(!("parameters" in path.post));
    }
  }
  assert.equal(parseAction("people:add", { name: "Maria", requestId: "member-task-123" }).requestId, "member-task-123");
});
test("FAQ shortcuts resolve categories by title, not shifted positional indices", () => {
  const source = readFileSync("client/src/pages/faq.tsx", "utf8");
  assert.ok(source.includes('faqCategories.findIndex(category => category.title === "Features You Won\'t Find Elsewhere")'));
  assert.ok(source.includes('faqCategories.findIndex(category => category.title === "FamilySearch Integration")'));
  assert.equal((source.match(/categoryIdx: distinctiveFeaturesCategoryIndex/g) || []).length, 5);
  assert.equal((source.match(/categoryIdx: familySearchCategoryIndex/g) || []).length, 1);
  assert.match(faqCategories.find(c => c.title === "Features You Won't Find Elsewhere")!.items[0].question, /Profile Claiming/);
  assert.match(faqCategories.find(c => c.title === "FamilySearch Integration")!.items[0].question, /FamilySearch/);
});
