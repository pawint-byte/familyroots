import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import type { PoolClient } from "pg";
import { assertQaDevelopment, createDemoUser, revokeDemoUser } from "../scripts/qa-demo-user";
import { verifyPassword } from "../server/services/email-auth";

const development = { NODE_ENV: "development", REPLIT_DEV_DOMAIN: "qa.replit.dev" };

test("QA seeding fails closed outside explicitly confirmed unpublished development", async () => {
  for (const env of [
    {}, { ...development, NODE_ENV: "production" },
    { ...development, NODE_ENV: "test" }, { ...development, REPLIT_DEV_DOMAIN: "" },
    { ...development, REPLIT_DEPLOYMENT: "1" },
    { ...development, REPLIT_DEPLOYMENT: "true" },
    { ...development, REPLIT_DEPLOYMENT: "0" },
  ]) {
    assert.throws(() => assertQaDevelopment(env, true));
    const noDatabase = { query: () => { throw new Error("Database must not be called"); } };
    await assert.rejects(createDemoUser(noDatabase as any, "", env, true), /development workspace/);
    await assert.rejects(revokeDemoUser(noDatabase as any, "", env, true), /development workspace/);
  }
  assert.throws(() => assertQaDevelopment(development, false));
  assert.doesNotThrow(() => assertQaDevelopment(development, true));
});

test("creates only a synthetic verified non-admin user, hashes password, and returns no credential", async () => {
  const password = `Aa1!${randomBytes(24).toString("hex")}`;
  let calls = 0;
  const db = { query: async (sql: string, values: string[]) => {
    calls++;
    assert.match(sql, /^INSERT INTO users/);
    assert.match(sql, /'Casey', 'Demo', 'email', \$3, true, NULL, false/);
    assert.match(values[0], /^qa-demo-/);
    assert.equal(values[1], `${values[0]}@example.invalid`);
    assert.equal(await verifyPassword(password, values[2]), true);
    return { rowCount: 1 };
  }} as unknown as Pick<PoolClient, "query">;
  const user = await createDemoUser(db, password, development, true);
  assert.deepEqual(Object.keys(user).sort(), ["email", "id"]);
  assert.equal(calls, 1);
  await assert.rejects(createDemoUser(db, "Short1!", development, true), /random 24/);
  assert.equal(calls, 1);
});

test("revocation scopes both credentials and sessions to one seeded demo identity", async () => {
  const id = "qa-demo-00000000-0000-4000-8000-000000000000";
  const queries: string[] = [];
  const db = { query: async (sql: string, values: string[]) => {
    queries.push(sql);
    assert.equal(values[0], id);
    return { rowCount: 1 };
  }} as unknown as Pick<PoolClient, "query">;
  await revokeDemoUser(db, id, development, true);
  assert.match(queries[0], /password_hash = \$3/);
  assert.match(queries[0], /email = \$2/);
  assert.match(queries[0], /is_admin = false/);
  assert.match(queries[1], /DELETE FROM sessions WHERE sess #>> '\{passport,user,claims,sub\}' = \$1/);
  await assert.rejects(revokeDemoUser(db, "real-user", development, true), /Not a seeded/);
  assert.equal(queries.length, 2);
  const missing = { query: async () => ({ rowCount: 0 }) } as unknown as Pick<PoolClient, "query">;
  await assert.rejects(revokeDemoUser(missing, id, development, true), /not found/);
});