// tests/contact-message.test.js
import { describe, it, expect } from "vitest";
import {
  normalizeContactMessage,
  isValidContactEmail,
} from "../src/contact-message.js";

describe("isValidContactEmail", () => {
  it("accepts a normal address and rejects malformed ones", () => {
    expect(isValidContactEmail("chris@example.com")).toBe(true);
    expect(isValidContactEmail("chris@example")).toBe(false);
    expect(isValidContactEmail("chris example.com")).toBe(false);
    expect(isValidContactEmail("")).toBe(false);
    expect(isValidContactEmail(null)).toBe(false);
  });
});

describe("normalizeContactMessage", () => {
  it("normalizes a valid submission", () => {
    const out = normalizeContactMessage({
      name: "  Chris   Wood ",
      email: "  Chris@Example.COM ",
      message: "  Which mat suits a senior collie?  ",
    });
    expect(out.ok).toBe(true);
    expect(out.value).toEqual({
      name: "Chris Wood",
      email: "chris@example.com",
      message: "Which mat suits a senior collie?",
    });
  });

  it("treats a missing or blank name as optional", () => {
    const out = normalizeContactMessage({
      email: "a@b.co",
      message: "hello",
    });
    expect(out.ok).toBe(true);
    expect(out.value.name).toBeNull();

    const blank = normalizeContactMessage({
      name: "   ",
      email: "a@b.co",
      message: "hello",
    });
    expect(blank.ok).toBe(true);
    expect(blank.value.name).toBeNull();
  });

  it("keeps newlines inside the message but trims the ends", () => {
    const out = normalizeContactMessage({
      email: "a@b.co",
      message: "\n line one\nline two \n",
    });
    expect(out.ok).toBe(true);
    expect(out.value.message).toBe("line one\nline two");
  });

  it("rejects a missing email", () => {
    expect(normalizeContactMessage({ message: "hi" })).toEqual({
      ok: false,
      error: "Email is required",
    });
  });

  it("rejects an invalid email", () => {
    expect(normalizeContactMessage({ email: "nope", message: "hi" })).toEqual({
      ok: false,
      error: "Invalid email",
    });
  });

  it("rejects an empty message", () => {
    expect(
      normalizeContactMessage({ email: "a@b.co", message: "   " }),
    ).toEqual({ ok: false, error: "Message is required" });
    expect(normalizeContactMessage({ email: "a@b.co" })).toEqual({
      ok: false,
      error: "Message is required",
    });
  });

  it("caps runaway name and message lengths", () => {
    const out = normalizeContactMessage({
      name: "n".repeat(500),
      email: "a@b.co",
      message: "m".repeat(9000),
    });
    expect(out.ok).toBe(true);
    expect(out.value.name).toHaveLength(120);
    expect(out.value.message).toHaveLength(4000);
  });

  it("tolerates being called with no argument", () => {
    expect(normalizeContactMessage().ok).toBe(false);
  });
});
