import pg from "pg";

let pool = null;
let poolDatabaseUrl = "";

export function getDbPool() {
  const rawDatabaseUrl = String(process.env.DATABASE_URL || "").trim();
  const databaseUrl = rawDatabaseUrl.replace(/^postgresql:\/\//, "postgres://");
  if (!databaseUrl) {
    console.error(
      "db: missing DATABASE_URL at runtime",
      "hasEnv=",
      Object.prototype.hasOwnProperty.call(process.env, "DATABASE_URL"),
    );
    return null;
  }

  if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
    console.error("db: unexpected DATABASE_URL scheme", databaseUrl.slice(0, 16));
  }

  if (pool && poolDatabaseUrl === databaseUrl) return pool;
  if (pool && poolDatabaseUrl !== databaseUrl) {
    pool.end().catch(() => {});
    pool = null;
    poolDatabaseUrl = "";
  }

  const { Pool } = pg;
  const needsSsl = !databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1");

  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      keepAlive: true,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5,
    });

    pool.on("error", (err) => {
      console.error("db: pool error", err);
      try {
        pool?.end().catch(() => {});
      } catch {
        // ignore
      }
      pool = null;
      poolDatabaseUrl = "";
    });
  } catch (err) {
    const urlTail = databaseUrl.slice(-18);
    const hasAt = databaseUrl.includes("@");
    const hasPort = databaseUrl.includes(":5432");
    console.error("db: Pool creation failed", {
      message: String(err?.message || err),
      hasAt,
      hasPort,
      tail: urlTail,
      needsSsl,
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
    console.error("dbQuery failed", err);
    throw err;
  }
}
