// Manual QA helper only. Never import into the server or run during build/start.
import { randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";
import { hashPassword, validatePassword } from "../server/services/email-auth";

type Database = Pick<PoolClient, "query">;
const demoIdPattern = /^qa-demo-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function assertQaDevelopment(env: NodeJS.ProcessEnv, confirmed: boolean) {
  if (!confirmed || env.NODE_ENV !== "development" || env.REPLIT_DEPLOYMENT ||
      !env.REPLIT_DEV_DOMAIN) {
    throw new Error("QA seeding requires an unpublished development workspace and --confirm-development.");
  }
}

export async function createDemoUser(
  db: Database, password: string, env: NodeJS.ProcessEnv, confirmed: boolean,
) {
  assertQaDevelopment(env, confirmed);
  if (!validatePassword(password).valid || password.length < 24 ||
      !/[^A-Za-z0-9]/.test(password)) {
    throw new Error("Use a random 24–128 character password with upper/lowercase, numbers, and a symbol.");
  }
  const id = `qa-demo-${randomUUID()}`;
  const email = `${id}@example.invalid`;
  await db.query(
    `INSERT INTO users
       (id, email, first_name, last_name, auth_provider, password_hash, email_verified, email_verify_token, is_admin)
     VALUES ($1, $2, 'Casey', 'Demo', 'email', $3, true, NULL, false)`,
    [id, email, await hashPassword(password)],
  );
  return { id, email };
}

// Run in a transaction: disable credentials and invalidate existing sessions together.
export async function revokeDemoUser(
  db: Database, id: string, env: NodeJS.ProcessEnv, confirmed: boolean,
) {
  assertQaDevelopment(env, confirmed);
  if (!demoIdPattern.test(id)) throw new Error("Not a seeded QA demo user ID.");
  const result = await db.query(
    `UPDATE users SET email_verified = false, password_hash = $3,
       email_verify_token = NULL, password_reset_token = NULL, password_reset_expires = NULL,
       updated_at = NOW()
     WHERE id = $1 AND email = $2 AND first_name = 'Casey' AND last_name = 'Demo'
       AND auth_provider = 'email' AND is_admin = false RETURNING id`,
    // A null hash triggers the app's legacy-account recovery email path.
    [id, `${id}@example.invalid`, await hashPassword(randomBytes(32).toString("hex"))],
  );
  if (result.rowCount !== 1) throw new Error("Seeded demo account not found; nothing revoked.");
  await db.query(
    `DELETE FROM sessions WHERE sess #>> '{passport,user,claims,sub}' = $1`,
    [id],
  );
}

async function main() {
  const [action, ...args] = process.argv.slice(2);
  const confirmed = args.includes("--confirm-development");
  assertQaDevelopment(process.env, confirmed);
  const id = args.find((arg) => arg !== "--confirm-development");
  if ((action !== "create" && action !== "revoke") ||
      (action === "create" && id) || (action === "revoke" && !id)) {
    throw new Error("Usage: qa-demo-user.ts create|revoke [demo-id] --confirm-development");
  }
  let password = "";
  if (action === "create") {
    if (process.stdin.isTTY) throw new Error("Supply the password via stdin from a hidden prompt or QA runner, never as an argument.");
    for await (const chunk of process.stdin) {
      password += chunk.toString();
      if (password.length > 130) throw new Error("Password input is too long.");
    }
    password = password.replace(/\r?\n$/, "");
  }
  // Load the workspace database only AFTER all environment guards have passed.
  const { pool } = await import("../server/db");
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (action === "create") {
        const demo = await createDemoUser(client, password, process.env, confirmed);
        await client.query("COMMIT");
        console.log(JSON.stringify(demo)); // No password, hash, tokens, or session data.
      } else {
        await revokeDemoUser(client, id!, process.env, confirmed);
        await client.query("COMMIT");
        console.log("Demo credentials and sessions revoked; demo content retained.");
      }
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    password = "";
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Database errors can include bound credentials; never dump them.
    console.error("QA command refused or failed. Check docs/qa-demo-account.md; no credentials logged.");
    process.exitCode = 1;
  });
}