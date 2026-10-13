import { describe, it, expect } from "vitest";
import { validateGymInput } from "../server/hq.js";

const tenantIds = new Set(["pacegym", "roxjaya"]);

describe("validateGymInput", () => {
  it("requires a name on create", () => {
    expect(validateGymInput({}, { requireName: true, tenantIds }).error).toBe(
      "name is required",
    );
  });

  it("accepts a full valid gym and trims text", () => {
    const { fields, error } = validateGymInput(
      {
        name: "  Pace Gym ",
        stage: "demo_sent",
        lane: "replace",
        score: "22",
        tenant_id: "pacegym",
        setup_fee_minor: 25000,
        monthly_minor: 6000,
        next_action_at: "2026-11-01",
        currency: "GBP",
      },
      { requireName: true, tenantIds },
    );
    expect(error).toBeUndefined();
    expect(fields).toMatchObject({
      name: "Pace Gym",
      stage: "demo_sent",
      lane: "replace",
      score: 22,
      tenant_id: "pacegym",
      setup_fee_minor: 25000,
      monthly_minor: 6000,
      next_action_at: "2026-11-01",
      currency: "gbp",
    });
  });

  it.each([
    [{ name: "x", stage: "nope" }, "invalid stage"],
    [{ name: "x", lane: "sideways" }, "invalid lane"],
    [{ name: "x", score: 500 }, "score must be 0-100"],
    [{ name: "x", tenant_id: "nosuch" }, "unknown tenant_id"],
    [{ name: "x", monthly_minor: -5 }, "monthly_minor must be a whole number"],
    [{ name: "x", next_action_at: "tomorrow" }, "next_action_at must be YYYY-MM-DD"],
    [{ name: "x", currency: "pounds" }, "currency must be 3 letters"],
  ])("rejects %j", (body, message) => {
    expect(validateGymInput(body, { requireName: true, tenantIds }).error).toBe(
      message,
    );
  });

  it("only returns fields present in a partial update", () => {
    const { fields } = validateGymInput(
      { stage: "live" },
      { requireName: false, tenantIds },
    );
    expect(fields).toEqual({ stage: "live" });
  });

  it("clears optional values with empty strings", () => {
    const { fields } = validateGymInput(
      { tenant_id: "", lane: "", score: "", monthly_minor: "", next_action_at: "" },
      { requireName: false, tenantIds },
    );
    expect(fields).toEqual({
      tenant_id: null,
      lane: null,
      score: null,
      monthly_minor: null,
      next_action_at: null,
    });
  });

  it("ignores unknown keys (no column injection)", () => {
    const { fields } = validateGymInput(
      { name: "x", "id; DROP TABLE hq_gyms": 1, created_at: "2020-01-01" },
      { requireName: true, tenantIds },
    );
    expect(Object.keys(fields)).toEqual(["name"]);
  });
});
