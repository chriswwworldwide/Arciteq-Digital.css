import { describe, it, expect } from "vitest";
import {
  sanitizeProfile,
  hasProfile,
  PROFILE_MAX_KEYS,
  PROFILE_MAX_VALUE_LENGTH,
} from "../src/lead-profile.js";

describe("sanitizeProfile", () => {
  it("keeps strings, string lists, booleans and numbers under snake_case keys", () => {
    expect(
      sanitizeProfile({
        goal: " First Hyrox ",
        race_date: "2027-03-14",
        injuries: ["knee", "", " shoulder "],
        pregnant: true,
        weekly_sessions: 4,
      }),
    ).toEqual({
      goal: "First Hyrox",
      race_date: "2027-03-14",
      injuries: ["knee", "shoulder"],
      pregnant: true,
      weekly_sessions: 4,
    });
  });

  it("drops bad keys, empty values, nested objects and non-finite numbers", () => {
    expect(
      sanitizeProfile({
        "Bad Key": "x",
        "": "x",
        "1abc": "x",
        nested: { a: 1 },
        empty: "   ",
        emptylist: [],
        nan: Number.NaN,
        fn: () => 1,
        ok: "yes",
      }),
    ).toEqual({ ok: "yes" });
  });

  it("caps value length and key count", () => {
    const long = "x".repeat(PROFILE_MAX_VALUE_LENGTH + 50);
    expect(sanitizeProfile({ note: long }).note).toHaveLength(
      PROFILE_MAX_VALUE_LENGTH,
    );
    const many = Object.fromEntries(
      Array.from({ length: PROFILE_MAX_KEYS + 10 }, (_, i) => [`k${i}`, "v"]),
    );
    expect(Object.keys(sanitizeProfile(many))).toHaveLength(PROFILE_MAX_KEYS);
  });

  it("returns {} for non-objects", () => {
    expect(sanitizeProfile(null)).toEqual({});
    expect(sanitizeProfile("str")).toEqual({});
    expect(sanitizeProfile([1, 2])).toEqual({});
  });
});

describe("hasProfile", () => {
  it("is true only for non-empty objects", () => {
    expect(hasProfile({})).toBe(false);
    expect(hasProfile(null)).toBe(false);
    expect(hasProfile({ goal: "x" })).toBe(true);
  });
});
