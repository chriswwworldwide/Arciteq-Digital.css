import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createPitchRouter } from "../server/pitch.js";
import { dbQuery } from "../db.js";
import { sendAlertEmail } from "../server/email.js";

vi.mock("../db.js", () => ({ dbQuery: vi.fn() }));
vi.mock("../server/email.js", () => ({ sendAlertEmail: vi.fn() }));
let server;
let base;
const event = { slug: "trainedbytr", event: "play", sid: "demo-session-123" };
const post = (body, headers = {}) =>
  fetch(base + "/api/pitch-event", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("PITCH_NTFY_TOPIC", "");
  vi.stubEnv("PITCH_WEB3FORMS_KEY", "");
  vi.stubEnv("PITCH_NOTIFY_TO", "owner@example.test");
  dbQuery.mockResolvedValue({ rows: [] });
  sendAlertEmail.mockResolvedValue({ ok: true });
  const app = express();
  app.use(createPitchRouter({ adminApiKey: "test-admin-key" }));
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  vi.unstubAllEnvs();
});

describe("pitch security", () => {
  it("records repeat events but deduplicates owner notifications for a session event", async () => {
    for (let i = 0; i < 3; i++) expect((await post(event)).status).toBe(200);
    await vi.waitFor(() => expect(sendAlertEmail).toHaveBeenCalledTimes(1));
    expect(
      dbQuery.mock.calls.filter(([sql]) => sql.startsWith("INSERT")),
    ).toHaveLength(3);
  });
  it("bounds notification cost for many fabricated sessions", async () => {
    for (let i = 0; i < 35; i++)
      expect(
        (await post({ ...event, sid: `session-${String(i).padStart(8, "0")}` }))
          .status,
      ).toBe(200);
    expect(sendAlertEmail).toHaveBeenCalledTimes(30);
  });
  it("rate limits requests before recording events", async () => {
    for (let i = 0; i < 90; i++)
      expect(
        (await post({ ...event, event: "progress", pct: 25 })).status,
      ).toBe(200);
    const response = await post(event);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("600");
    expect(
      dbQuery.mock.calls.filter(([sql]) => sql.startsWith("INSERT")),
    ).toHaveLength(90);
  });
  it("rejects cross-site and oversized requests without sending alerts", async () => {
    expect(
      (await post(event, { Origin: "https://other.example.test" })).status,
    ).toBe(403);
    expect((await post({ ...event, extra: "x".repeat(6000) })).status).toBe(
      413,
    );
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });
  it("rejects missing sessions and returns clean JSON errors", async () => {
    expect((await post({ slug: "trainedbytr", event: "play" })).status).toBe(
      400,
    );
    const response = await fetch(base + "/api/pitch-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "Invalid JSON" });
  });
  it("requires a header key for the private summary, never a URL key", async () => {
    expect((await fetch(base + "/pitch-views?key=test-admin-key")).status).toBe(
      404,
    );
    const response = await fetch(base + "/pitch-views", {
      headers: { "x-admin-key": "test-admin-key" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("does not intercept shared stylesheet or player paths", async () => {
    const response = await fetch(base + "/pitch/pitch.css");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Cannot GET");
  });
});
