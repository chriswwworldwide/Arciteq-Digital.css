import { describe, expect, it } from "vitest";
import {
  TOPICS,
  buildPrompt,
  pickTopic,
  safetyError,
} from "../scripts/pawvigil-guide-autopilot.js";

describe("PawVigil guide autopilot", () => {
  it("moves to the next unused topic", () => {
    expect(pickTopic([{ source: TOPICS[0] }])).toBe(TOPICS[1]);
  });

  it("stops when every safe topic is already covered", () => {
    expect(pickTopic(TOPICS.map((source) => ({ source })))).toBeNull();
  });

  it("blocks medical and ingestible claims", () => {
    expect(
      safetyError({ body_html: "<p>This device will cure pain.</p>" }),
    ).toMatch(/blocked safety language/);
    expect(
      safetyError({ body_html: "<p>Use reflective gear and check the fit.</p>" }),
    ).toBeNull();
    expect(
      safetyError({ body_html: "<p>This guide does not diagnose or treat conditions and cannot guarantee safety.</p>" }),
    ).toBeNull();
    expect(
      safetyError({ body_html: "<p>This device is completely safe.</p>" }),
    ).toMatch(/blocked safety language/);
  });

  it("instructs the model to avoid unsafe pet advice", () => {
    const prompt = buildPrompt(TOPICS[0], ["Existing guide"]);
    expect(prompt).toContain("Do not diagnose, treat or cure");
    expect(prompt).toContain("Do not recommend medicines, supplements");
    expect(prompt).toContain("Existing guide");
  });
});
