import { describe, it, expect, vi } from "vitest";
import { securityHeaders, requestErrorHandler } from "../server/middleware.js";
import {
  isPrivateStaticPath,
  publicTenantConfig,
} from "../src/static-guard.js";
import { createRateLimiter } from "../src/submissions.js";

describe("shared security hardening", () => {
  it.each(["/.git/config", "/%ZZ", "/public/%00/file.js"])(
    "fails closed for hidden or malformed paths: %s",
    (file) => {
      expect(isPrivateStaticPath(file)).toBe(true);
    },
  );
  it("only projects explicitly public arrays, even for incomplete records", () => {
    expect(publicTenantConfig([{}]).tenants).toEqual([
      { tenant_id: "", hostnames: [], catalog: { heroProductIds: [] } },
    ]);
    expect(
      publicTenantConfig([
        {
          tenant_id: "example",
          hostnames: [null, "example.test"],
          catalog: { heroProductIds: [1, "two"] },
        },
      ]).tenants[0],
    ).toEqual({
      tenant_id: "example",
      hostnames: ["example.test"],
      catalog: { heroProductIds: ["two"] },
    });
  });
  it("does not expose internal exception text or stacks to clients or logs", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = {
      headersSent: false,
      setHeader: vi.fn(),
      json: vi.fn(),
      status: vi.fn(),
    };
    res.status.mockReturnValue(res);
    requestErrorHandler(
      new Error("private-test-value"),
      { path: "/api/example" },
      res,
      vi.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Something went wrong" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-test-value");
    log.mockRestore();
  });
  it("sets browser protections without blocking inline site code or partner frames", () => {
    const headers = {};
    const res = {
      setHeader: (key, value) => {
        headers[key] = value;
      },
      removeHeader: vi.fn(),
    };
    const next = vi.fn();
    securityHeaders()(
      { secure: true, path: "/", get: () => undefined },
      res,
      next,
    );
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'self'",
    );
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).not.toContain("script-src");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=15552000");
    expect(next).toHaveBeenCalledOnce();
  });
  it("does not set HSTS on local HTTP and prevents admin referrer leakage", () => {
    const headers = {};
    securityHeaders()(
      { secure: false, path: "/pitch-views", get: () => undefined },
      {
        setHeader: (key, value) => {
          headers[key] = value;
        },
        removeHeader: vi.fn(),
      },
      vi.fn(),
    );
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });
  it.each([
    "/public/../server/pitch.js",
    "/public/%2e%2e/server/pitch.js",
    "/public/%252e%252e/server/pitch.js",
    "/data/tenants.json",
    "/any/../data/alerts.json",
  ])("blocks private path aliases: %s", (file) => {
    expect(isPrivateStaticPath(file)).toBe(true);
  });
  it("does not publish tenant automation, private contacts or author configuration", () => {
    const result = publicTenantConfig([
      {
        tenant_id: "example",
        hostnames: ["example.com"],
        catalog: { heroProductIds: ["one"] },
        automation: { digestTo: "owner@example.test" },
        seo: { supportEmail: "private@example.test" },
        guides: { author: { name: "Private" } },
      },
    ]);
    expect(result.tenants).toEqual([
      {
        tenant_id: "example",
        hostnames: ["example.com"],
        catalog: { heroProductIds: ["one"] },
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private@example.test");
    expect(JSON.stringify(result)).not.toContain("owner@example.test");
  });
  it("bounds rate-limit keys and recovers space after expiry", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxKeys: 2 });
    expect(limiter.check("a", 0).ok).toBe(true);
    expect(limiter.check("b", 0).ok).toBe(true);
    expect(limiter.check("c", 1).ok).toBe(false);
    expect(limiter.check("c", 1001).ok).toBe(true);
    expect(limiter.check("a", 1002).ok).toBe(true);
  });
});
