// tests/db.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDbPool, dbQuery } from "../db.js";

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
