import test from "node:test";
import assert from "node:assert/strict";
import { mintKey, hash, keyState, DAY, parseAction, fingerprint, resolveName, AgentError, escapeHtml } from "../server/assistant/policy";
import { readFileSync } from "node:fs";

test("keys are unpredictable and only a digest is stored", () => {
  const first = mintKey(), second = mintKey();
  assert.ok(first.token !== second.token);
  assert.ok(first.tokenHash === hash(first.token));
  assert.ok(first.tokenHash !== first.token && first.tokenHash.length === 64);
  assert.ok(/^fr_agent_[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(first.token));
});
test("review after 30 days, seven-day grace, pause and irreversible revocation", () => {
  const key = { review_due_at: new Date(30 * DAY), pause_at: new Date(37 * DAY) };
  assert.equal(keyState(key, 29 * DAY), "active");
  assert.equal(keyState(key, 30 * DAY), "review_due");
  assert.equal(keyState(key, 37 * DAY), "paused");
  assert.equal(keyState({ ...key, stopped_at: new Date() }, 1), "paused");
  assert.equal(keyState({ ...key, revoked_at: new Date() }, 1), "revoked");
});
test("never guesses missing or duplicate names, and requires explicit member anchor", () => {
  const members = [{ id: "a", first_name: "Maria", last_name: "" }, { id: "b", first_name: "Maria", last_name: "" }];
  assert.throws(() => resolveName(members, "Unknown"), (e: any) => e instanceof AgentError && e.status === 404);
  assert.throws(() => resolveName(members, "Maria"), (e: any) => e.status === 409 && e.detail.candidates.length === 2);
  assert.throws(() => resolveName(members, "member"), (e: any) => e.status === 422);
  assert.equal(resolveName(members, "member", "a").id, "a");
  assert.equal(resolveName(members, "b").id, "b");
});
test("draft input is explicit, strict and does not invent a relative", () => {
  assert.deepEqual(parseAction("people:add", { name: "Maria", label: "mother", of: "member" }), { name: "Maria", label: "mother", of: "member" });
  assert.throws(() => parseAction("people:add", { name: "Maria", label: "mother" }));
  assert.throws(() => parseAction("people:add", { name: "Maria", isAdmin: true }));
  assert.throws(() => parseAction("invite:send", { name: "Maria", email: "bad" }));
  assert.throws(() => parseAction("email_all", { action: "email_all" }));
});
test("idempotency fingerprint tolerates object ordering but not changed tasks", () => {
  assert.equal(fingerprint("people:add", { name: "Maria", of: "a" }), fingerprint("people:add", { of: "a", name: "Maria" }));
  assert.notEqual(fingerprint("people:add", { name: "Maria" }), fingerprint("people:add", { name: "Anna" }));
});
test("email content escapes HTML and response logs cannot leak one-time keys", () => {
  assert.equal(escapeHtml('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
  assert.ok(!readFileSync("server/index.ts", "utf8").includes("JSON.stringify(capturedJsonResponse)"));
});
