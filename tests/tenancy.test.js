import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  requireAdmin,
  resolveTenantFromRequest,
  resolveTenantForPublicWrite,
  trustedBaseUrlForTenant,
} from "../server/tenancy.js";

const res = () => {
  const r = { code: 200, body: null };
  r.status = (c) => ((r.code = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const req = ({ host = "localhost:3000", referer, key } = {}) => ({
  headers: { host, ...(referer ? { referer } : {}), ...(key ? { "x-admin-key": key } : {}) },
});

describe("requireAdmin", () => {
  const saved = process.env.ADMIN_API_KEY;
  afterEach(() => {
    process.env.ADMIN_API_KEY = saved;
  });

  it("500s when no key is configured", () => {
    delete process.env.ADMIN_API_KEY;
    const r = res();
    requireAdmin(req({ key: "x" }), r);
    expect(r.code).toBe(500);
  });
  it("401s on a missing or wrong key, passes the right one", () => {
    process.env.ADMIN_API_KEY = "s3cret-key";
    const a = res();
    expect(requireAdmin(req({}), a)).toBe(a);
    expect(a.code).toBe(401);
    const b = res();
    requireAdmin(req({ key: "s3cret-kez" }), b);
    expect(b.code).toBe(401);
    expect(requireAdmin(req({ key: "s3cret-key" }), res())).toBeNull();
  });
});

describe("tenant resolution", () => {
  it("resolves real hostnames and falls back to default", () => {
    expect(resolveTenantFromRequest(req({ host: "roxjaya.com" })).tenant_id).toBe("roxjaya");
    expect(resolveTenantFromRequest(req({ host: "unknown.example" })).tenant_id).toBe("default");
  });

  it("accepts a shared-domain claim only when the page path matches", () => {
    const page = (p) => req({ referer: `http://localhost:3000${p}` });
    expect(resolveTenantForPublicWrite(page("/pacegym/"), "pacegym").tenant_id).toBe("pacegym");
    expect(resolveTenantForPublicWrite(page("/pacegym/pay/"), null).tenant_id).toBe("pacegym");
    expect(resolveTenantForPublicWrite(page("/roxjaya/"), "pacegym").tenant_id).toBe("default");
    expect(resolveTenantForPublicWrite(page("/nosuchsite/"), "nosuchsite").tenant_id).toBe("default");
  });

  it("never lets a claim override a real tenant hostname", () => {
    const r = req({ host: "roxjaya.com", referer: "http://roxjaya.com/pacegym/" });
    expect(resolveTenantForPublicWrite(r, "pacegym").tenant_id).toBe("roxjaya");
  });
});

describe("trustedBaseUrlForTenant", () => {
  const saved = process.env.PUBLIC_BASE_URL;
  beforeEach(() => {
    process.env.PUBLIC_BASE_URL = "https://platform.example/";
  });
  afterEach(() => {
    process.env.PUBLIC_BASE_URL = saved;
  });
  it("uses the tenant's real domain, else PUBLIC_BASE_URL — never request headers", () => {
    expect(trustedBaseUrlForTenant("roxjaya")).toBe("https://roxjaya.com");
    expect(trustedBaseUrlForTenant("pacegym")).toBe("https://platform.example");
  });
});
