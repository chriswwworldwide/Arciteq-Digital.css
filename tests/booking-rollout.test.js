import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  injectBookingNavigation,
  installBookingPlanner,
} from "../scripts/booking-planner.js";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
function fixture(slug = "example") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "s9-booking-test-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, slug));
  fs.mkdirSync(path.join(root, "scripts", "reskin"), { recursive: true });
  fs.cpSync(
    path.join(process.cwd(), "scripts", "reskin", "booking-template"),
    path.join(root, "scripts", "reskin", "booking-template"),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(root, slug, "index.html"),
    '<html><head></head><body><ul class="menu" id="menu"><li><a href="/example/coaching.html">Coaching</a></li></ul><section class="hero"><div class="actions">Existing coaching action</div></section></body></html>',
  );
  return root;
}

describe("Booking planner rollout", () => {
  it("adds a first menu item and removes the legacy booking strip", () => {
    const initial =
      '<head></head><ul class="menu" id="menu"><li>Coaching</li></ul><section class="hero">Photo</section><div class="booking-entry">Old CTA</div>';
    const once = injectBookingNavigation(initial, "example", true);
    const twice = injectBookingNavigation(once, "example", true);
    expect(twice).toBe(once);
    expect(twice.match(/data-booking-navigation(?=>)/g)).toHaveLength(1);
    expect(twice).not.toContain('class="booking-entry"');
    expect(twice).toContain('Photo</section>');
  });
  it("keeps editorial booking buttons below the photograph", () => {
    const html =
      '<head></head><section class="hero hero--editorial"><div class="hero-visual">Photo</div><div class="hero-footer"><div class="actions"><a href="/example/planner.html">Book a slot</a></div></div></section>';
    const result = injectBookingNavigation(html, "example", true);
    expect(result.match(/>Book a slot</g)).toHaveLength(1);
    expect(result.indexOf('href="/example/planner.html"')).toBeGreaterThan(
      result.indexOf('class="hero-footer"'),
    );
  });
  it("leaves the neutral template without a photograph or watermark", () => {
    const root = fixture("chassis");
    const profile = installBookingPlanner({
      root,
      slug: "chassis",
      template: true,
    });
    expect(profile.watermark).toBe("");
    expect(profile.portrait).toBe("");
    const html = fs.readFileSync(
      path.join(root, "chassis", "planner.html"),
      "utf8",
    );
    expect(html).not.toContain("trainedbytr");
    expect(html).not.toContain('src="/chassis/images/');
    expect(html).toContain('"watermark":""');
  });
  it("preserves the existing race-trip planner and escapes tenant metadata", () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, "example", "planner.js"),
      "original race planner",
    );
    installBookingPlanner({
      root,
      slug: "example",
      config: {
        brand: "A <coach>",
        coachFull: "Coach Example",
        coachFirst: "Example",
      },
    });
    expect(
      fs.readFileSync(path.join(root, "example", "planner.js"), "utf8"),
    ).toBe("original race planner");
    const html = fs.readFileSync(
      path.join(root, "example", "planner.html"),
      "utf8",
    );
    expect(html).toContain("A &lt;coach&gt;");
    expect(html).toContain("A \\u003ccoach\\u003e");
  });
  it("uses Jakarta for Dina and allows explicit timezone overrides", () => {
    const root = fixture("roxjaya");
    expect(installBookingPlanner({ root, slug: "roxjaya" }).timeZone).toBe(
      "Asia/Jakarta",
    );
    expect(
      installBookingPlanner({
        root,
        slug: "roxjaya",
        config: { booking: { timeZone: "Australia/Sydney" } },
      }).timeZone,
    ).toBe("Australia/Sydney");
  });
  it("rejects paths outside a tenant when choosing an optional watermark", () => {
    const root = fixture();
    expect(
      installBookingPlanner({
        root,
        slug: "example",
        config: { booking: { watermark: "../private.jpg" } },
      }).watermark,
    ).toBe("");
  });
});
