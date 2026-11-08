import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import { databaseOptions } from "../src/database-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const migrationsDir = path.join(__dirname, "..", "migrations");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const { Client } = pg;
const client = new Client(databaseOptions(databaseUrl));

async function main() {
  await client.connect();
  try {
    for (const file of migrationFiles) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8");
      await client.query(sql);
      console.log(`✅ Applied ${file}`);
    }
    console.log("✅ All migrations applied");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
