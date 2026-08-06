// tests/db.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDbPool, dbQuery } from "../db.js";

const { poolInstances } = vi.hoisted(() => ({ poolInstances: [] }));

vi.mock("pg", () => {
  class Pool {
    constructor(config) {
      this.config = config;
      this.handlers = {};
      this.ended = false;
      this.query = vi.fn();
      poolInstances.push(this);
    }
    on(event, cb) {
      this.handlers[event] = cb;
    }
    async end() {
      this.ended = true;
    }
  }
  return { default: { Pool } };
});

describe("db helpers without DATABASE_URL", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
    vi.restoreAllMocks();
  });

  it("getDbPool returns null when DATABASE_URL is missing", () => {
    expect(getDbPool()).toBeNull();
  });

  it("getDbPool returns null when DATABASE_URL is only whitespace", () => {
    process.env.DATABASE_URL = "   ";
    expect(getDbPool()).toBeNull();
  });

  it("dbQuery rejects when DATABASE_URL is missing", async () => {
    await expect(dbQuery("SELECT 1")).rejects.toThrow(
      "DATABASE_URL is not set on the server",
    );
  });
});

describe("db pool creation and querying (pg mocked)", () => {
  const originalUrl = process.env.DATABASE_URL;
  let db;

  beforeEach(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    poolInstances.length = 0;
    vi.resetModules();
    db = await import("../db.js");
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
    vi.restoreAllMocks();
  });

  it("creates a pool, enables SSL for remote hosts, and caches it", () => {
    process.env.DATABASE_URL = "postgres://user:pass@db.example.com:5432/app";
    const pool = db.getDbPool();

    expect(poolInstances).toHaveLength(1);
    expect(pool.config.connectionString).toBe(process.env.DATABASE_URL);
    expect(pool.config.ssl).toEqual({ rejectUnauthorized: false });
    // Second call with the same URL returns the cached pool.
    expect(db.getDbPool()).toBe(pool);
    expect(poolInstances).toHaveLength(1);
  });

  it("normalizes postgresql:// and disables SSL for localhost", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/app";
    const pool = db.getDbPool();
    expect(pool.config.connectionString).toBe(
      "postgres://user:pass@localhost:5432/app",
    );
    expect(pool.config.ssl).toBeUndefined();
  });

  it("recreates the pool when the connection string changes", () => {
    process.env.DATABASE_URL = "postgres://a@localhost:5432/one";
    const first = db.getDbPool();

    process.env.DATABASE_URL = "postgres://a@localhost:5432/two";
    const second = db.getDbPool();

    expect(second).not.toBe(first);
    expect(first.ended).toBe(true);
    expect(poolInstances).toHaveLength(2);
  });

  it("registers a pool error handler that clears the cached pool", () => {
    process.env.DATABASE_URL = "postgres://a@localhost:5432/app";
    const pool = db.getDbPool();
    expect(typeof pool.handlers.error).toBe("function");

    // Triggering the handler should reset the cache so a new pool is built.
    pool.handlers.error(new Error("connection lost"));
    const rebuilt = db.getDbPool();
    expect(rebuilt).not.toBe(pool);
  });

  it("dbQuery forwards text/params to the pool and returns rows", async () => {
    process.env.DATABASE_URL = "postgres://a@localhost:5432/app";
    const pool = db.getDbPool();
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    const result = await db.dbQuery("SELECT * FROM t WHERE id=$1", [1]);
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM t WHERE id=$1", [1]);
    expect(result.rows).toEqual([{ id: 1 }]);
  });

  it("dbQuery rethrows when the underlying query fails", async () => {
    process.env.DATABASE_URL = "postgres://a@localhost:5432/app";
    const pool = db.getDbPool();
    pool.query.mockRejectedValue(new Error("syntax error"));

    await expect(db.dbQuery("BAD SQL")).rejects.toThrow("syntax error");
  });
});
