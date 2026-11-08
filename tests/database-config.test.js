import { describe, it, expect } from "vitest";
import { databaseOptions } from "../src/database-config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const railway = {
  DATABASE_TRANSPORT: "railway-private",
  RAILWAY_PROJECT_ID: "test-project",
  RAILWAY_ENVIRONMENT_ID: "test-environment",
  RAILWAY_SERVICE_ID: "test-service",
};

describe("database transport security", () => {
  it("rejects invalid private transport before the application starts listening", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../server.js", import.meta.url))],
      {
        env: {
          ...process.env,
          ...railway,
          NODE_ENV: "test",
          PORT: "0",
          STRIPE_SECRET_KEY: "",
          DATABASE_URL:
            "postgres://user:private-test-value@outside.example.test/app",
        },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Railway-private transport requires a valid railway.internal hostname",
    );
    expect(result.stderr).not.toContain("private-test-value");
    expect(result.stdout).not.toContain("Server running");
  });
  it("requires explicit opt-in for Railway private networking", () => {
    expect(
      databaseOptions(
        "postgres://user:example@postgres.railway.internal/app",
        {},
      ).ssl,
    ).toEqual({ rejectUnauthorized: true });
    expect(
      databaseOptions(
        "postgres://user:example@postgres.railway.internal/app",
        railway,
      ).ssl,
    ).toBe(false);
  });
  it.each([
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_SERVICE_ID",
  ])("rejects private mode without %s", (missing) => {
    expect(() =>
      databaseOptions("postgres://user:example@postgres.railway.internal/app", {
        ...railway,
        [missing]: "",
      }),
    ).toThrow(
      "Railway-private transport requires Railway deployment variables",
    );
  });
  it.each([
    "db.example.test",
    "postgres.railway.internal.evil.test",
    "evilrailway.internal",
    "railway.internal",
    "localhost",
    "127.0.0.1",
    "postgres..railway.internal",
    "-postgres.railway.internal",
  ])("rejects non-private or malformed hosts: %s", (host) => {
    expect(() =>
      databaseOptions(`postgres://user:example@${host}/app`, railway),
    ).toThrow(
      "Railway-private transport requires a valid railway.internal hostname",
    );
  });
  it.each(["host", "hostaddr", "port", "service", "servicefile"])(
    "rejects query-based routing overrides: %s",
    (field) => {
      expect(() =>
        databaseOptions(
          `postgres://user:example@postgres.railway.internal/app?${field}=outside.example.test`,
          railway,
        ),
      ).toThrow(
        "DATABASE_URL cannot override connection routing through query parameters",
      );
    },
  );
  it("rejects unknown modes rather than silently changing transport", () => {
    expect(() =>
      databaseOptions("postgres://user:example@db.example.test/app", {
        DATABASE_TRANSPORT: "no-verify",
      }),
    ).toThrow("Unsupported DATABASE_TRANSPORT");
  });
  it.each([
    "sslmode=require",
    "sslmode=verify-full",
    "sslmode=no-verify",
    "sslmode=disable&sslmode=require",
    "sslcert=anything",
    "ssl=true",
    "uselibpqcompat=true",
  ])("rejects contradictory private TLS settings: %s", (query) => {
    expect(() =>
      databaseOptions(
        `postgres://user:example@postgres.railway.internal/app?${query}`,
        railway,
      ),
    ).toThrow("Railway-private transport conflicts with TLS settings");
  });
  it("rejects a CA in private mode instead of silently ignoring it", () => {
    expect(() =>
      databaseOptions("postgres://user:example@postgres.railway.internal/app", {
        ...railway,
        DATABASE_SSL_CA: "example-ca",
      }),
    ).toThrow("Railway-private transport conflicts with TLS settings");
  });
  it("explicitly disables driver TLS only for the opted-in private connection", () => {
    const result = databaseOptions(
      "postgres://user:example@postgres.railway.internal/app?sslmode=disable&application_name=coach",
      { ...railway, PGSSLMODE: "require" },
    );
    expect(result.ssl).toBe(false);
    expect(result.connectionString).not.toContain("sslmode");
    expect(result.connectionString).toContain("application_name=coach");
    expect(
      databaseOptions("postgres://user:example@db.example.test/app", {
        DATABASE_TRANSPORT: "verify-full",
      }).ssl,
    ).toEqual({ rejectUnauthorized: true });
  });
  it("rejects malformed or hostless URLs without revealing input", () => {
    expect(() => databaseOptions("not a URL", {})).toThrow(
      "DATABASE_URL must be a valid PostgreSQL URL",
    );
    expect(() => databaseOptions("postgres:///app", {})).toThrow(
      "DATABASE_URL must use PostgreSQL",
    );
  });
  it("honours an explicit local TLS request but never skips verification", () => {
    expect(
      databaseOptions(
        "postgres://user:example@localhost/app?sslmode=require",
        {},
      ).ssl,
    ).toEqual({ rejectUnauthorized: true });
  });
  it("verifies certificates for remote databases", () => {
    expect(
      databaseOptions("postgres://user:example@db.example.test/app", {}).ssl,
    ).toEqual({ rejectUnauthorized: true });
  });
  it("uses hostname parsing, not credential or query substrings, for local exceptions", () => {
    expect(
      databaseOptions(
        "postgres://localhost:example@remote.example.test/app?name=127.0.0.1",
        {},
      ).ssl.rejectUnauthorized,
    ).toBe(true);
    expect(
      databaseOptions("postgres://user:example@localhost.evil.test/app", {}).ssl
        .rejectUnauthorized,
    ).toBe(true);
  });
  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "permits plain local PostgreSQL on %s",
    (host) => {
      expect(
        databaseOptions(`postgres://user:example@${host}/app`, {}).ssl,
      ).toBeUndefined();
    },
  );
  it("removes URL parameters that could override certificate verification", () => {
    const result = databaseOptions(
      "postgres://user:example@db.example.test/app?sslmode=no-verify&sslrootcert=anything&application_name=coach",
      {},
    );
    expect(result.ssl.rejectUnauthorized).toBe(true);
    expect(result.connectionString).not.toContain("sslmode");
    expect(result.connectionString).not.toContain("sslrootcert");
    expect(result.connectionString).toContain("application_name=coach");
  });
  it("accepts an explicitly configured provider CA without disabling verification", () => {
    expect(
      databaseOptions("postgres://user:example@db.example.test/app", {
        DATABASE_SSL_CA: "CERT\\nLINE",
      }).ssl,
    ).toEqual({ rejectUnauthorized: true, ca: "CERT\nLINE" });
  });
  it("does not echo invalid connection credentials into errors", () => {
    expect(() =>
      databaseOptions("https://user:private-value@example.test/app", {}),
    ).toThrow("DATABASE_URL must use PostgreSQL");
  });
});
