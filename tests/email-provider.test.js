// tests/email-provider.test.js
import { describe, it, expect, vi } from "vitest";
import {
  resolveProviderName,
  createEmailProvider,
  ConsoleEmailProvider,
  MockEmailProvider,
  MailchimpEmailProvider,
} from "../src/email-provider.js";

describe("resolveProviderName", () => {
  it("defaults to console", () => {
    expect(resolveProviderName({})).toBe("console");
    expect(resolveProviderName()).toBe("console");
  });
  it("accepts known providers case-insensitively", () => {
    expect(resolveProviderName({ EMAIL_PROVIDER: "Mailchimp" })).toBe(
      "mailchimp",
    );
    expect(resolveProviderName({ EMAIL_PROVIDER: " mock " })).toBe("mock");
  });
  it("falls back to console on unknown values", () => {
    expect(resolveProviderName({ EMAIL_PROVIDER: "sendgrid" })).toBe("console");
  });
});

describe("createEmailProvider", () => {
  it("builds the console provider by default", () => {
    expect(createEmailProvider({})).toBeInstanceOf(ConsoleEmailProvider);
  });
  it("builds the mock provider", () => {
    expect(createEmailProvider({ EMAIL_PROVIDER: "mock" })).toBeInstanceOf(
      MockEmailProvider,
    );
  });
  it("builds the mailchimp provider from env config", () => {
    const p = createEmailProvider({
      EMAIL_PROVIDER: "mailchimp",
      MAILCHIMP_API_KEY: "k",
      MAILCHIMP_SERVER_PREFIX: "us1",
      MAILCHIMP_AUDIENCE_ID: "a1",
    });
    expect(p).toBeInstanceOf(MailchimpEmailProvider);
    expect(p.isConfigured()).toBe(true);
  });
});

describe("ConsoleEmailProvider", () => {
  it("logs and reports not delivered, never throws", async () => {
    const logger = { log: vi.fn() };
    const p = new ConsoleEmailProvider({ logger });
    const a = await p.upsertContact({
      tenantId: "t",
      email: "a@b.co",
      tags: ["bronze"],
    });
    const b = await p.sendCampaign({
      tenantId: "t",
      to: "a@b.co",
      subject: "Hi",
    });
    expect(a).toMatchObject({
      ok: true,
      provider: "console",
      delivered: false,
    });
    expect(b).toMatchObject({
      ok: true,
      provider: "console",
      delivered: false,
    });
    expect(logger.log).toHaveBeenCalledTimes(2);
  });
});

describe("MockEmailProvider", () => {
  it("records calls for assertions", async () => {
    const p = new MockEmailProvider();
    await p.upsertContact({ tenantId: "t", email: "a@b.co" });
    await p.sendCampaign({ tenantId: "t", to: "a@b.co", subject: "Hi" });
    expect(p.contacts).toHaveLength(1);
    expect(p.campaigns).toHaveLength(1);
    expect(p.campaigns[0].subject).toBe("Hi");
  });
});

describe("MailchimpEmailProvider", () => {
  it("skips gracefully (no throw, no send) when credentials are missing", async () => {
    const p = new MailchimpEmailProvider({});
    expect(p.isConfigured()).toBe(false);
    const a = await p.upsertContact({ tenantId: "t", email: "a@b.co" });
    const b = await p.sendCampaign({
      tenantId: "t",
      to: "a@b.co",
      subject: "Hi",
    });
    expect(a).toEqual({
      ok: false,
      provider: "mailchimp",
      skipped: "missing_credentials",
    });
    expect(b).toEqual({
      ok: false,
      provider: "mailchimp",
      skipped: "missing_credentials",
    });
  });
  it("is not implemented yet even when configured (no live API call)", async () => {
    const p = new MailchimpEmailProvider({
      apiKey: "k",
      serverPrefix: "us1",
      audienceId: "a1",
    });
    const a = await p.upsertContact({ tenantId: "t", email: "a@b.co" });
    const b = await p.sendCampaign({ tenantId: "t", to: "a@b.co", subject: "Hi" });
    expect(a).toMatchObject({
      ok: false,
      provider: "mailchimp",
      pending: "not_implemented",
    });
    expect(b).toMatchObject({
      ok: false,
      provider: "mailchimp",
      pending: "not_implemented",
    });
  });
});
