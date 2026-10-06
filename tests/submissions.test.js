import { describe, it, expect } from "vitest";
import {
  allowedKinds,
  validateSubmission,
  summarizePayloads,
  percentileRank,
  spamReason,
  createRateLimiter,
  SUBMISSION_MAX_BYTES,
} from "../src/submissions.js";

const tenant = { tenant_id: "t", submissions: { kinds: ["race_splits"] } };

describe("validateSubmission", () => {
  it("accepts a whitelisted kind with a sanitised payload", () => {
    const out = validateSubmission(tenant, {
      kind: " Race_Splits ",
      payload: { run_1: 300, division: " Women Open ", bad: { x: 1 } },
    });
    expect(out).toEqual({
      kind: "race_splits",
      payload: { run_1: 300, division: "Women Open" },
    });
  });

  it("rejects unknown kinds, bad kind strings and empty payloads", () => {
    expect(validateSubmission(tenant, { kind: "weight_log" }).error).toBe(
      "Unknown submission kind",
    );
    expect(validateSubmission(tenant, { kind: "Bad Kind!" }).error).toBe(
      "Invalid kind",
    );
    expect(
      validateSubmission(tenant, { kind: "race_splits", payload: {} }).error,
    ).toBe("Empty payload");
    expect(validateSubmission({}, { kind: "race_splits" }).error).toBe(
      "Unknown submission kind",
    );
  });

  it("allowedKinds ignores malformed entries", () => {
    expect(
      allowedKinds({ submissions: { kinds: ["ok_1", "Bad", 3] } }),
    ).toEqual(["ok_1"]);
    expect(allowedKinds(null)).toEqual([]);
  });
});

describe("spam and abuse guards", () => {
  it("flags a filled honeypot (top level or inside payload)", () => {
    expect(spamReason({ website: "x", payload: { a: "hi" } })).toBe("honeypot");
    expect(spamReason({ payload: { fax: "1", a: "hi" } })).toBe("honeypot");
    expect(spamReason({ website: "  ", payload: { a: "hi" } })).toBeNull();
  });

  it("allows normal captions, rejects link dumps, banned words and gibberish", () => {
    expect(
      spamReason({ payload: { caption: "Sled push felt strong at PIK2!" } }),
    ).toBeNull();
    expect(
      spamReason({
        payload: { caption: "see https://a.com https://b.com https://c.com" },
      }),
    ).toBe("too_many_links");
    expect(spamReason({ payload: { caption: "best casino bonus" } })).toBe(
      "blocked_words",
    );
    expect(spamReason({ payload: { caption: "judi slot online murah" } })).toBe(
      "blocked_words",
    );
    expect(
      spamReason({
        payload: { caption: "!!!!@@@@####$$$$%%%%^^^^&&&&****(((())))" },
      }),
    ).toBe("gibberish");
    expect(
      spamReason({
        payload: { caption: "a".repeat(20) + "zzzzzzzzzzzz" + "b".repeat(20) },
      }),
    ).toBe("repeated_chars");
  });

  it("validateSubmission rejects spam with a reason and oversized payloads", () => {
    const spam = validateSubmission(tenant, {
      kind: "race_splits",
      website: "bot",
      payload: { run_1: 300 },
    });
    expect(spam).toEqual({ error: "Submission rejected", reason: "honeypot" });

    const big = {};
    for (let i = 0; i < 24; i += 1) big[`f_${i}`] = "sled push row ski erg ".repeat(25);
    expect(JSON.stringify(big).length).toBeGreaterThan(SUBMISSION_MAX_BYTES);
    expect(
      validateSubmission(tenant, { kind: "race_splits", payload: big }),
    ).toEqual({ error: "Submission too large" });
  });

  it("rate limiter caps hits per key per window and resets after it", () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(rl.check("ip1", 0).ok).toBe(true);
    expect(rl.check("ip1", 10).ok).toBe(true);
    expect(rl.check("ip1", 20)).toEqual({ ok: true, remaining: 0 });
    expect(rl.check("ip1", 30).ok).toBe(false);
    expect(rl.check("ip2", 30).ok).toBe(true);
    expect(rl.check("ip1", 1001).ok).toBe(true);
  });
});

describe("summarizePayloads", () => {
  const rows = [1, 2, 3, 4, 5].map((i) => ({
    total: i * 100,
    run_1: 300 + i,
    division: i % 2 ? "Women Open" : "Women Pro",
    note: "x",
  }));

  it("summarises numeric fields only, with quartiles and best", () => {
    const s = summarizePayloads(rows);
    expect(s.rows).toBe(5);
    expect(s.fields.note).toBeUndefined();
    expect(s.fields.total).toEqual({
      n: 5,
      p25: 200,
      median: 300,
      p75: 400,
      best: 100,
    });
  });

  it("drops fields below minCount and supports a case-insensitive filter", () => {
    expect(summarizePayloads(rows, { minCount: 6 }).fields).toEqual({});
    const s = summarizePayloads(rows, {
      minCount: 1,
      filter: { division: "women open" },
    });
    expect(s.rows).toBe(3);
    expect(s.fields.total.median).toBe(300);
  });

  it("ignores junk input", () => {
    expect(summarizePayloads(null)).toEqual({ rows: 0, fields: {} });
    expect(summarizePayloads([null, 1, "x"])).toEqual({ rows: 0, fields: {} });
  });
});

describe("percentileRank", () => {
  it("returns share of peers strictly faster", () => {
    expect(percentileRank([100, 200, 300, 400], 250)).toBe(0.5);
    expect(percentileRank([100, 200], 50)).toBe(0);
    expect(percentileRank([], 50)).toBeNull();
  });
});
