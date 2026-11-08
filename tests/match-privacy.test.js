import { describe, it, expect } from "vitest";
import {
  displayName,
  paceBand,
  publicCard,
  travelCard,
  buildTravelCandidate,
  buildPartnerCandidate,
} from "../src/match.js";

const now = new Date("2026-01-01T00:00:00Z");
const email = "athlete@example.test";
const payload = {
  name: "Sarah Example",
  format: "mixed",
  gender: "f",
  event: "London",
  total: 4700,
  whatsapp: "000-example-only",
  note: "Looking for a partner",
  consent: "yes",
};

describe("public matching-board consent and privacy", () => {
  it("only displays a first name and last initial", () => {
    expect(displayName(" Sarah   Example ")).toBe("Sarah E.");
    expect(displayName("Sarah")).toBe("Sarah");
    expect(displayName("1234")).toBe("");
    expect(displayName(null)).toBe("");
  });
  it.each([
    [null, "no time yet"],
    [0, "no time yet"],
    ["invalid", "no time yet"],
    [4199, "sub-1:10"],
    [4200, "1:10–1:20"],
    [4800, "1:20–1:30"],
    [5400, "1:30–1:45"],
    [6300, "1:45–2:00"],
    [7200, "2:00+"],
  ])("formats pace %s without exposing a precise result", (input, expected) => {
    expect(paceBand(input)).toBe(expected);
  });
  it("keeps contact fields out of public partner cards and deduplicates case-insensitive email", () => {
    const card = publicCard({ email, payload, now });
    expect(card.name).toBe("Sarah E.");
    expect(card.gender).toBe("woman");
    expect(JSON.stringify(card)).not.toContain(email);
    expect(JSON.stringify(card)).not.toContain(payload.whatsapp);
    expect(publicCard({ email: email.toUpperCase(), payload, now }).id).toBe(
      card.id,
    );
    expect(
      publicCard({ email, payload: { ...payload, gender: "m" }, now }).gender,
    ).toBe("man");
    expect(
      publicCard({ email, payload: { ...payload, gender: "x" }, now }).gender,
    ).toBe("");
  });
  it("rejects incomplete public cards and caps their expiry", () => {
    expect(publicCard({ email, now })).toBeNull();
    expect(
      publicCard({ email, payload: { ...payload, name: "" }, now }),
    ).toBeNull();
    expect(
      publicCard({ email, payload: { ...payload, format: "unknown" }, now }),
    ).toBeNull();
    expect(
      publicCard({ email, payload: { ...payload, until: "2030-01-01" }, now })
        .until,
    ).toBe("2026-06-30");
    expect(
      publicCard({ email, payload: { ...payload, until: "2026-02-01" }, now })
        .until,
    ).toBe("2026-02-01");
    expect(
      publicCard({ email, payload: { ...payload, until: "2020-01-01" }, now })
        .until,
    ).toBe("2026-05-01");
  });
  it("never generates a public partner patch without explicit consent", () => {
    expect(
      buildPartnerCandidate({ email, payload, boardFile: null }),
    ).toBeNull();
    expect(
      buildPartnerCandidate({
        email,
        payload: { ...payload, consent: "no" },
        boardFile: "matchboard.json",
      }).apply,
    ).toEqual([]);
    expect(
      buildPartnerCandidate({
        email,
        payload: { ...payload, name: "" },
        boardFile: "matchboard.json",
      }),
    ).toBeNull();
    expect(
      buildPartnerCandidate({ email, boardFile: "matchboard.json" }).apply,
    ).toEqual([]);
    const approved = buildPartnerCandidate({
      email,
      payload,
      boardFile: "matchboard.json",
    });
    expect(approved.apply).toHaveLength(1);
    expect(approved.data.email).toBe(email);
    expect(approved.apply[0].value.email).toBeUndefined();
  });
  it("keeps travel contact data private and validates the public card", () => {
    const travel = {
      ...payload,
      mode: "have",
      race: "London",
      dates: "May",
      hotel: "Example hotel",
    };
    const card = travelCard({ email, payload: travel, now });
    expect(card.name).toBe("Sarah E.");
    expect(card.email).toBeUndefined();
    expect(card.whatsapp).toBeUndefined();
    expect(
      travelCard({
        email,
        payload: { ...travel, mode: "looking", race: "" },
        now,
      }).race,
    ).toBe("London");
    expect(travelCard({ email, now })).toBeNull();
    expect(
      travelCard({ email, payload: { ...travel, mode: "bad" }, now }),
    ).toBeNull();
    expect(
      travelCard({ email, payload: { ...travel, race: "", event: "" }, now }),
    ).toBeNull();
  });
  it("requires explicit consent before creating a public travel patch", () => {
    const travel = {
      ...payload,
      mode: "looking",
      race: "London",
      dates: "May",
      hotel: "Example hotel",
    };
    expect(
      buildTravelCandidate({ email, payload: travel, boardFile: null }),
    ).toBeNull();
    expect(
      buildTravelCandidate({
        email,
        payload: { ...travel, name: "" },
        boardFile: "travel.json",
      }),
    ).toBeNull();
    expect(
      buildTravelCandidate({
        email,
        payload: { ...travel, consent: "no" },
        boardFile: "travel.json",
      }).apply,
    ).toEqual([]);
    expect(
      buildTravelCandidate({ email, boardFile: "travel.json" }).apply,
    ).toEqual([]);
    const approved = buildTravelCandidate({
      email,
      payload: travel,
      boardFile: "travel.json",
    });
    expect(approved.apply).toHaveLength(1);
    expect(approved.data.email).toBe(email);
    expect(approved.apply[0].value.name).toBe("Sarah E.");
    expect(approved.apply[0].value.whatsapp).toBeUndefined();
  });
});
