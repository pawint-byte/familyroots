import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import type { Server } from "node:http";
import { registerAssistantRoutes } from "../server/assistant/routes";
import { executeAction, reviewAction } from "../server/assistant/service";
import { pool } from "../server/db";

// Explicit development-only integration suite; no real member, credential or inbox is used.
if (process.env.NODE_ENV !== "development" || !process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Run assistant integration tests only in the development workspace with NODE_ENV=development.");
}
const uid = randomUUID(), other = randomUUID(), tree = randomUUID(), foreignTree = randomUUID();
const anchor = randomUUID(), duplicate = randomUUID(), outside = randomUUID();
let server: Server, base: string, key: any, token: string;
let mails = 0;
const transport: any = async () => { mails++; return { data: { id: randomUUID() }, error: null }; };
async function call(path: string, method = "GET", body?: unknown, options: Record<string, string> = {}) {
  const response = await fetch(`${base}/api/agent${path}`, { method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...options },
    body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() as any };
}
const sessionHeaders = () => ({ "X-Test-Member": uid });
const bearerHeaders = () => ({ Authorization: `Bearer ${token}` });
test.before(async () => {
  await pool.query("INSERT INTO users(id,email,first_name,email_verified) VALUES($1,$2,'Assistant QA',true),($3,$4,'Foreign QA',true)",
    [uid, `assistant-${uid}@example.invalid`, other, `assistant-${other}@example.invalid`]);
  await pool.query("INSERT INTO family_trees(id,name,owner_id,root_member_id) VALUES($1,'Assistant integration fixture',$2,$3),($4,'Foreign fixture',$5,$6)",
    [tree, uid, anchor, foreignTree, other, outside]);
  await pool.query("INSERT INTO family_members(id,tree_id,first_name,email,claimed_by_user_id) VALUES($1,$2,'Member',$3,$4),($5,$2,'Duplicate',$6,NULL),($7,$8,'Foreign',$9,$10)",
    [anchor, tree, `member-${uid}@example.invalid`, uid, duplicate, `duplicate-${uid}@example.invalid`, outside, foreignTree, `foreign-${other}@example.invalid`, other]);
  const app = express();
  app.use(express.json());
  // Isolated unit-test server, not a runtime auth bypass in the application.
  app.use((req: any, _res, next) => { req.isAuthenticated = () => req.get("X-Test-Member") === uid; req.user = { claims: { sub: uid } }; next(); });
  registerAssistantRoutes(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  const created = await call("/keys", "POST", { name: "QA tool", treeId: tree, memberId: anchor,
    scopes: ["people:add", "labels:set", "invite:send", "email:send", "people:merge"] }, sessionHeaders());
  assert.equal(created.status, 201);
  key = created.data.key; token = created.data.token;
});
test.after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  for (const table of ["assistant_actions", "assistant_keys", "member_merge_history", "member_invitations", "relationships", "family_events", "discoverable_members"]) {
    await pool.query(`DELETE FROM ${table} WHERE tree_id=ANY($1::varchar[])`, [[tree, foreignTree]]);
  }
  await pool.query("DELETE FROM family_members WHERE tree_id=ANY($1::varchar[])", [[tree, foreignTree]]);
  await pool.query("DELETE FROM family_trees WHERE id=ANY($1::varchar[])", [[tree, foreignTree]]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[uid, other]]);
  await pool.end();
});
test("public health and documentation; sessions cannot execute bearer actions or bootstrap keys via bearer", async () => {
  assert.deepEqual((await call("/health")).data, { ok: true });
  assert.equal((await call("/openapi.json")).data.openapi, "3.0.3");
  assert.equal((await call("/keys", "POST", { name: "bad", treeId: tree, scopes: [] }, bearerHeaders())).status, 401);
  assert.equal((await call("/people", "POST", { name: "Maria" }, sessionHeaders())).status, 401);
  assert.equal((await call("/keys", "POST", { name: "bad", treeId: tree, scopes: [] }, { ...sessionHeaders(), Origin: "https://evil.invalid" })).status, 403);
});
test("names/labels are tree-scoped and keys are not exposed in settings/storage/audit", async () => {
  const read = await call("/tree", "GET", undefined, bearerHeaders());
  assert.equal(read.status, 200);
  assert.ok(read.data.members.every((m: any) => m.id !== outside && !("email" in m)));
  assert.equal((await call("/keys", "POST", { name: "foreign", treeId: foreignTree, scopes: [] }, sessionHeaders())).status, 403);
  assert.equal((await executeAction(key.id, "labels:set", { memberId: outside, of: anchor, label: "parent" }, randomUUID())).code, 404);
  const stored = (await pool.query("SELECT token_hash FROM assistant_keys WHERE id=$1", [key.id])).rows[0];
  assert.ok(stored.token_hash !== token);
  assert.ok(!JSON.stringify((await call("/settings", "GET", undefined, sessionHeaders())).data).includes(token));
});
test("person is a hidden draft until site acceptance; retries never duplicate people; approval is single-use", async () => {
  const taskId = randomUUID();
  const created = await call("/people", "POST", { name: "Maria", label: "mother", of: "member" }, { ...bearerHeaders(), "Idempotency-Key": taskId });
  assert.equal(created.status, 202);
  assert.equal((await pool.query("SELECT count(*)::int n FROM family_members WHERE tree_id=$1 AND first_name='Maria'", [tree])).rows[0].n, 0);
  const retry = await call("/people", "POST", { of: "member", label: "mother", name: "Maria" }, { ...bearerHeaders(), "Idempotency-Key": taskId });
  assert.equal(retry.data.actionId, created.data.actionId);
  assert.equal((await call("/people", "POST", { name: "Different" }, { ...bearerHeaders(), "Idempotency-Key": taskId })).status, 409);
  assert.equal((await call(`/actions/${created.data.actionId}/approve`, "POST", {}, bearerHeaders())).status, 401);
  const accepted = await call(`/actions/${created.data.actionId}/approve`, "POST", {}, sessionHeaders());
  assert.equal(accepted.status, 200);
  assert.equal((await call(`/actions/${created.data.actionId}/approve`, "POST", {}, sessionHeaders())).status, 409);
  const rel = (await pool.query("SELECT * FROM relationships WHERE from_member_id=$1 AND to_member_id=$2", [accepted.data.memberId, anchor])).rows[0];
  assert.equal(rel.custom_label, "mother");
  assert.equal((await call("/people", "POST", { name: "No request ID" }, bearerHeaders())).status, 400);
  assert.equal((await executeAction(key.id, "labels:set", { memberId: anchor, of: "Unknown", label: "parent" }, randomUUID())).code, 404);
});
test("JSON task IDs work for AI tools without custom headers and conflicting IDs fail", async () => {
  const body = { name: "JSON request-ID fixture", requestId: randomUUID() };
  const first = await call("/people", "POST", body, bearerHeaders());
  assert.equal(first.status, 202);
  const repeat = await call("/people", "POST", body, bearerHeaders());
  assert.equal(repeat.data.actionId, first.data.actionId);
  assert.equal(repeat.data.replayed, true);
  const conflicting = await call("/people", "POST", { name: "Conflict", requestId: randomUUID() }, { ...bearerHeaders(), "Idempotency-Key": randomUUID() });
  assert.equal(conflicting.status, 422);
});
test("single-person invite/email execute, retries do not resend, failures never retry, mismatch requires confirmation", async () => {
  const id = randomUUID();
  const output = await executeAction(key.id, "invite:send", { memberId: duplicate, email: `duplicate-${uid}@example.invalid` }, id, transport);
  assert.equal(output.code, 200); assert.equal(mails, 1);
  await executeAction(key.id, "invite:send", { memberId: duplicate, email: `duplicate-${uid}@example.invalid` }, id, transport);
  assert.equal(mails, 1);
  const email = await executeAction(key.id, "email:send", { memberId: anchor, subject: "Test", text: "<script>unsafe</script>" }, randomUUID(), async (_to, _sub, html) => {
    assert.ok(html.includes("&lt;script&gt;")); mails++; return { data: { id: "test" }, error: null };
  });
  assert.equal(email.code, 200);
  const pending = await executeAction(key.id, "email:send", { memberId: anchor, email: `different-${uid}@example.invalid`, subject: "Directed", text: "Hi" }, randomUUID(), transport);
  assert.equal(pending.code, 409);
  assert.equal((await reviewAction(uid, pending.result.actionId!, true, { confirmed: true }, transport)).code, 200);
  const failureId = randomUUID();
  let tries = 0;
  const failing: any = async () => { tries++; throw new Error("Simulated uncertain delivery"); };
  assert.equal((await executeAction(key.id, "email:send", { memberId: anchor, subject: "Failure", text: "No resend" }, failureId, failing)).code, 502);
  await executeAction(key.id, "email:send", { memberId: anchor, subject: "Failure", text: "No resend" }, failureId, failing);
  assert.equal(tries, 1);
});
test("duplicate names require exact on-site choice; merges preserve records and reject protected profiles", async () => {
  const maria = (await pool.query("SELECT id FROM family_members WHERE tree_id=$1 AND first_name='Maria'", [tree])).rows[0].id;
  const second = randomUUID();
  await pool.query("INSERT INTO family_members(id,tree_id,first_name) VALUES($1,$2,'Maria')", [second, tree]);
  const ambiguous = await executeAction(key.id, "people:merge", { keepMemberId: maria, merge: "Maria" }, randomUUID());
  assert.equal(ambiguous.code, 409);
  assert.equal(ambiguous.result.candidateGroups.keepMemberId.length, 1);
  await pool.query("INSERT INTO family_events(id,member_id,tree_id,event_type,title,event_date) VALUES($1,$2,$3,'other','Preserve this note','2020-01-01')", [randomUUID(), second, tree]);
  const merged = await reviewAction(uid, ambiguous.result.actionId!, true, { confirmed: true, keepMemberId: maria, mergeMemberId: second });
  assert.equal(merged.code, 200);
  assert.equal((await pool.query("SELECT member_id FROM family_events WHERE title='Preserve this note' AND member_id=$1", [maria])).rowCount, 1);
  assert.ok((await pool.query("SELECT deleted_at FROM family_members WHERE id=$1", [second])).rows[0].deleted_at);
  assert.equal((await pool.query("SELECT count(*)::int n FROM member_merge_history WHERE tree_id=$1", [tree])).rows[0].n, 1);
  await pool.query("UPDATE family_members SET claimed_by_user_id=$2 WHERE id=$1", [duplicate, other]);
  assert.equal((await executeAction(key.id, "people:merge", { keepMemberId: anchor, mergeMemberId: duplicate }, randomUUID())).code, 403);
  await pool.query("UPDATE family_members SET claimed_by_user_id=NULL WHERE id=$1", [duplicate]);
});
test("merge rollback preserves source and records after injected DB failure", async () => {
  const event = randomUUID();
  await pool.query("INSERT INTO family_events(id,member_id,tree_id,event_type,title,event_date) VALUES($1,$2,$3,'other','Rollback fixture','2020-01-01')", [event, duplicate, tree]);
  // Transaction-local trigger only on this fixture's source, removed immediately.
  const triggerName = `assistant_qa_${uid.replace(/-/g, "")}`;
  await pool.query(`CREATE FUNCTION ${triggerName}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.id='${duplicate}' AND NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'QA rollback'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${triggerName} BEFORE UPDATE ON family_members FOR EACH ROW EXECUTE FUNCTION ${triggerName}()`);
  try {
    const output = await executeAction(key.id, "people:merge", { keepMemberId: anchor, mergeMemberId: duplicate }, randomUUID());
    assert.equal(output.code, 500);
    assert.equal((await pool.query("SELECT deleted_at FROM family_members WHERE id=$1", [duplicate])).rows[0].deleted_at, null);
    assert.equal((await pool.query("SELECT member_id FROM family_events WHERE id=$1", [event])).rows[0].member_id, duplicate);
  } finally {
    await pool.query(`DROP TRIGGER ${triggerName} ON family_members`);
    await pool.query(`DROP FUNCTION ${triggerName}()`);
  }
});
test("scope restrictions, monthly review, pause/read distinction and renewal work", async () => {
  const readonly = await call("/keys", "POST", { name: "Read only", treeId: tree, scopes: [] }, sessionHeaders());
  assert.equal(readonly.status, 201);
  assert.equal((await executeAction(readonly.data.key.id, "people:add", { name: "Not permitted" }, randomUUID())).code, 403);
  await pool.query("UPDATE assistant_keys SET review_due_at=now()-interval '8 days',pause_at=now()-interval '1 day' WHERE id=$1", [key.id]);
  assert.equal((await call("/tree", "GET", undefined, bearerHeaders())).status, 200);
  assert.equal((await executeAction(key.id, "people:add", { name: "Paused" }, randomUUID())).code, 403);
  assert.equal((await call(`/keys/${key.id}/review`, "POST", { decision: "renew" }, sessionHeaders())).data.key.state, "active");
  assert.equal((await call(`/keys/${key.id}/review`, "POST", { decision: "stop" }, sessionHeaders())).data.key.state, "paused");
  assert.equal((await call(`/keys/${key.id}/review`, "POST", { decision: "extend" }, sessionHeaders())).data.key.state, "active");
});
test("bulk requests never run directly; explicit owner approval validates snapshot and archives people", async () => {
  const email = await executeAction(key.id, "email_all", { action: "email_all", subject: "Bulk test", text: "All selected" }, randomUUID(), transport);
  assert.equal(email.code, 409);
  const sent = await reviewAction(uid, email.result.actionId!, true, { confirmed: true }, transport);
  assert.equal(sent.code, 200);
  const bulk = await executeAction(key.id, "delete_all", { action: "delete_all" }, randomUUID());
  assert.equal(bulk.code, 409);
  assert.equal((await pool.query("SELECT count(*)::int n FROM family_members WHERE tree_id=$1 AND deleted_at IS NULL", [tree])).rows[0].n > 0, true);
  const deleted = await reviewAction(uid, bulk.result.actionId!, true, { confirmed: true });
  assert.equal(deleted.code, 200);
  assert.equal((await pool.query("SELECT count(*)::int n FROM family_members WHERE tree_id=$1 AND deleted_at IS NULL", [tree])).rows[0].n, 0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM family_members WHERE tree_id=$1", [tree])).rows[0].n > 0, true);
});
test("revocation does not wait for an in-flight provider and blocks remaining recipients", async () => {
  const recipients = [randomUUID(), randomUUID()];
  await pool.query("INSERT INTO family_members(id,tree_id,first_name,email) VALUES($1,$3,'Revocation one',$4),($2,$3,'Revocation two',$5)",
    [recipients[0], recipients[1], tree, `revocation1-${uid}@example.invalid`, `revocation2-${uid}@example.invalid`]);
  const separate = await call("/keys", "POST", { name: "Concurrent revocation", treeId: tree, scopes: ["email:send"] }, sessionHeaders());
  const concurrentKey = separate.data.key.id;
  const task = await executeAction(concurrentKey, "email_all", { action: "email_all", subject: "Controlled test", text: "No actual mail" }, randomUUID(), transport);
  assert.equal(task.code, 409);
  let started!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const hold = new Promise<void>(resolve => { release = resolve; });
  let attempts = 0;
  const blockedTransport: any = async () => { attempts++; started(); await hold; return { data: { id: "test" }, error: null }; };
  const delivery = reviewAction(uid, task.result.actionId!, true, { confirmed: true }, blockedTransport);
  await entered;
  try {
    const revoked = await Promise.race([
      call(`/keys/${concurrentKey}`, "DELETE", undefined, sessionHeaders()),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("Revocation blocked behind email provider")), 1500)),
    ]);
    assert.equal(revoked.status, 200);
  } finally { release(); }
  const result = await delivery;
  assert.equal(attempts, 1);
  assert.equal(result.result.status, "cancelled");
  await pool.query("UPDATE family_members SET deleted_at=now() WHERE id=ANY($1::varchar[])", [recipients]);
});
test("revocation cancels pending tasks and blocks reads/writes immediately", async () => {
  const pending = await executeAction(key.id, "people:add", { name: "Revoked draft" }, randomUUID());
  assert.equal(pending.code, 202);
  assert.equal((await call(`/keys/${key.id}`, "DELETE", undefined, sessionHeaders())).status, 200);
  assert.equal((await call("/tree", "GET", undefined, bearerHeaders())).status, 401);
  assert.equal((await call("/people", "POST", { name: "Blocked" }, { ...bearerHeaders(), "Idempotency-Key": randomUUID() })).status, 401);
  assert.equal((await pool.query("SELECT status FROM assistant_actions WHERE id=$1", [pending.result.actionId])).rows[0].status, "cancelled");
});
