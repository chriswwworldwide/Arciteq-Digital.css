import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
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
  it("rejects compressed telemetry without parsing or recording it", async () => {
    const response = await fetch(base + "/api/pitch-event", { method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, body: "not-a-valid-compressed-body" });
    expect(response.status).toBe(415);
    expect(dbQuery).not.toHaveBeenCalled();
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });
  it("does not treat HEAD probes as prospect visits", async () => {
    await fetch(base + "/trainedbytr/", { method: "HEAD" });
    expect(dbQuery).not.toHaveBeenCalled();
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });
  it("accepts same-origin telemetry but rejects cross-site metadata", async () => {
    expect((await post(event, { Origin: base })).status).toBe(200);
    expect((await post(event, { "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
  });
  it("does not intercept shared stylesheet or player paths", async () => {
    const response = await fetch(base + "/pitch/pitch.css");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Cannot GET");
  });
});

describe("portfolio activity", () => {
  const visit = { slug: "portfolio", event: "view", sid: "portfolio-session-123" };

  it("records a portfolio visit without storing an IP or user agent and emails the correct page", async () => {
    expect((await post(visit)).status).toBe(200);
    await vi.waitFor(() => expect(sendAlertEmail).toHaveBeenCalledTimes(1));
    const insert = dbQuery.mock.calls.find(([sql]) => sql.startsWith("INSERT"));
    expect(insert[1]).toEqual([
      "portfolio", "view", null, visit.sid, null, null, null, "/portfolio.html",
    ]);
    expect(sendAlertEmail.mock.calls[0][0]).toMatchObject({
      to: "owner@example.test",
      subject: "Portfolio: opened Chris Wood's portfolio",
    });
    expect(sendAlertEmail.mock.calls[0][0].body).toContain("https://www.station9studio.co.uk/portfolio.html");
    expect(sendAlertEmail.mock.calls[0][0].body).not.toContain("/pitch/portfolio/");
  });

  it("records and labels outbound links and section shortcuts", async () => {
    for (const target of ["https://www.scmp.com/author/chris-wood", "#voice-system"]) {
      expect((await post({ ...visit, event: "link_click", target })).status).toBe(200);
    }
    await vi.waitFor(() => expect(sendAlertEmail).toHaveBeenCalledTimes(2));
    const inserts = dbQuery.mock.calls.filter(([sql]) => sql.startsWith("INSERT"));
    expect(inserts.map(([, params]) => params[7])).toEqual([
      "https://www.scmp.com/author/chris-wood", "#voice-system",
    ]);
    expect(sendAlertEmail.mock.calls[0][0].body).toContain("Bylined writing archive");
    expect(sendAlertEmail.mock.calls[1][0].body).toContain("Voice system section");
  });

  it("supports every link currently shown on the portfolio", async () => {
    const html = readFileSync(new URL("../portfolio.html", import.meta.url), "utf8");
    const targets = [...html.slice(html.indexOf("<body>")).matchAll(/<a\b[^>]*href="([^"]+)"/g)]
      .map((match) => match[1]);
    expect(targets).toHaveLength(12);
    for (const target of targets) {
      expect((await post({ ...visit, event: "link_click", target })).status).toBe(200);
    }
    await vi.waitFor(() => expect(sendAlertEmail).toHaveBeenCalledTimes(12));
  });

  it("logs repeat activity but groups repeat alerts across reloads", async () => {
    for (const sid of [visit.sid, "another-portfolio-session"]) {
      expect((await post({ ...visit, sid })).status).toBe(200);
      expect((await post({ ...visit, sid, event: "link_click", target: "#platform" })).status).toBe(200);
    }
    await vi.waitFor(() => expect(sendAlertEmail).toHaveBeenCalledTimes(2));
    expect(dbQuery.mock.calls.filter(([sql]) => sql.startsWith("INSERT"))).toHaveLength(4);
  });

  it("ignores known self visits, probes and bots without recording or emailing", async () => {
    for (const headers of [
      { "User-Agent": "Station9-selftest/probe-check" },
      { "User-Agent": "Googlebot" },
      { "User-Agent": "Mozilla/5.0 HeadlessChrome" },
      { "X-Forwarded-For": "152.233.29.1" },
    ]) {
      expect((await post(visit, headers)).status).toBe(200);
    }
    expect(dbQuery).not.toHaveBeenCalled();
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("rejects unapproved destinations and event types without recording or emailing", async () => {
    for (const body of [
      { ...visit, event: "link_click", target: "https://other.example.test/?email=private" },
      { ...visit, event: "link_click", target: "https://www.station9studio.co.uk/admin" },
      { ...visit, event: "link_click", target: "#voice-system?secret=private" },
      { ...visit, event: "complete" },
      { ...visit, target: "https://other.example.test" },
    ]) expect((await post(body)).status).toBe(400);
    expect(dbQuery).not.toHaveBeenCalled();
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("keeps the existing cross-site safeguards and coach event validation", async () => {
    expect((await post(visit, { Origin: "https://other.example.test" })).status).toBe(403);
    expect((await post({ ...event, event: "link_click", target: "#platform" })).status).toBe(400);
    expect(dbQuery).not.toHaveBeenCalled();
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });
});
