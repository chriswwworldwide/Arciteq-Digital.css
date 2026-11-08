import pg from "pg";
import { databaseOptions } from "./src/database-config.js";

// Plain DATE columns (entry_date, next_action_at, period_start/end) stay as
// "YYYY-MM-DD" strings. By default pg turns them into local-midnight Date
// objects, which shift back a day when serialised to UTC during BST.
pg.types.setTypeParser(1082, (value) => value);

let pool = null;
let poolDatabaseUrl = "";

export function getDbPool() {
  const rawDatabaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!rawDatabaseUrl) {
    console.error(
      "db: missing DATABASE_URL at runtime",
      "hasEnv=",
      Object.prototype.hasOwnProperty.call(process.env, "DATABASE_URL"),
    );
    return null;
  }

  const options = databaseOptions(rawDatabaseUrl);
  const databaseUrl = JSON.stringify(options);

  if (pool && poolDatabaseUrl === databaseUrl) return pool;
  if (pool && poolDatabaseUrl !== databaseUrl) {
    pool.end().catch(() => {});
    pool = null;
    poolDatabaseUrl = "";
  }

  const { Pool } = pg;

  try {
    pool = new Pool({
      ...options,
      keepAlive: true,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5,
    });

    pool.on("error", (err) => {
      console.error("db: pool error", {
        code: String(err?.code || "DB_ERROR"),
      });
      try {
        pool?.end().catch(() => {});
      } catch {
        // ignore
      }
      pool = null;
      poolDatabaseUrl = "";
    });
  } catch (err) {
    console.error("db: Pool creation failed", {
      code: String(err?.code || "DB_ERROR"),
    });
    throw err;
  }

  poolDatabaseUrl = databaseUrl;

  return pool;
}

export async function dbQuery(text, params = []) {
  const p = getDbPool();
  if (!p) {
    throw new Error("DATABASE_URL is not set on the server");
  }
  try {
    return await p.query(text, params);
  } catch (err) {
    console.error("dbQuery failed", { code: String(err?.code || "DB_ERROR") });
    throw err;
  }
}
