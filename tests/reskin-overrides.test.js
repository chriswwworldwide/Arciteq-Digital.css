import { describe, it, expect } from "vitest";
import { overrideReplacement } from "../src/reskin-overrides.js";

describe("reskin replacement captures and literal token values", () => {
  it("restores captured image markup rather than printing replacement syntax", () => {
    const html = '<figure><img src="/joshharrison/images/old.jpg" alt="old" /></figure>';
    expect(html.replace(/(<figure><img )src="(\/joshharrison\/images\/)old.jpg" alt="old"/, overrideReplacement('$1src="$2station-row.jpg" alt="Rowing"'))).toBe('<figure><img src="/joshharrison/images/station-row.jpg" alt="Rowing" /></figure>');
  });
  it("preserves literal dollar sequences in token values while expanding authored captures", () => {
    expect("before".replace(/(before)/, overrideReplacement('$1 {{PRICE}} {{VALUE}}', { PRICE: "$199", VALUE: "$1 $& $$" }))).toBe("before $199 $1 $& $$");
  });
  it("retains unknown tokens for the existing unfilled-token guard", () => {
    expect(overrideReplacement("{{MISSING}}", {})).toBe("{{MISSING}}");
  });
  it("handles numeric tokens and repeated references", () => {
    expect("a".replace(/(a)/, overrideReplacement('$1 {{COUNT}} {{COUNT}}', { COUNT: 7 }))).toBe("a 7 7");
  });
});
