import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool, types } = pg;

types.setTypeParser(1082, (val: string) => val);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", () => {
  // Idle connection failures are recoverable. Do not crash the process or log credentials.
  console.error("Database pool connection failed; subsequent requests will reconnect.");
});
export const db = drizzle(pool, { schema });
