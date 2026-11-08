import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const digest = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const run = (...args) => spawnSync(process.execPath, ["scripts/reskin-tenant.js", ...args], { encoding: "utf8", timeout: 30000 });

describe("isolated tenant build safety", () => {
  it("builds pages and planner outside the live tenant without changing its registry or files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "s9-stage-test-"));
    const output = path.join(tmp, "site");
    const originals = ["data/tenants.json", "trainedbytr/index.html", "trainedbytr/planner.html"].map((file) => [file, digest(file)]);
    const result = run("scripts/reskin/trainedbytr.demo.json", `--output-dir=${output}`);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(fs.existsSync(path.join(output, "planner.html"))).toBe(true);
    expect(fs.readFileSync(path.join(output, "planner.html"), "utf8")).toContain("Tom Redmond");
    for (const [file, hash] of originals) expect(digest(file)).toBe(hash);
    const existing = run("scripts/reskin/trainedbytr.demo.json", `--output-dir=${output}`);
    expect(existing.status).not.toBe(0);
    expect(existing.stderr).toContain("Staged output directory must be new");
    expect(fs.existsSync(path.join(output, "planner.html"))).toBe(true);
  });
  it("builds the neutral showcase with canonical data instead of asset-pack code or metadata", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "s9-showcase-test-"));
    const output = path.join(tmp, "site");
    const result = run(".devin/template-preview.json", `--output-dir=${output}`);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const read = name => fs.readFileSync(path.join(output, name), "utf8");
    expect(JSON.parse(read("build-provenance.json")).source).toBe("chassis");
    expect(JSON.parse(read("data/cities.json")).cities).toHaveLength(6);
    expect(JSON.parse(read("data/news.json")).items).toHaveLength(6);
    const gallery = JSON.parse(read("data/gallery.json"));
    expect(gallery.photos).toHaveLength(4);
    expect(gallery.photos.every(p => p.src.startsWith("/template-preview/"))).toBe(true);
    expect(read("index.html")).not.toContain("<strong>TBA</strong>");
    expect(read("desk.html")).not.toContain("var £");
    expect(read("desk.html")).not.toContain('id="campaign-form"');
    expect(read("campaigns.html")).toContain('id="campaign-form"');
    expect(read("campaigns.html")).toContain('id="client-success"');
    for (const file of ["desk.html", "campaigns.html", "manage-programmes.html", "manage-videos.html", "platform-setup.html"]) expect(read(file)).not.toContain('id="menu"');
    expect(read("splits.html")).toContain('data-preview="true"');
    expect(read("stations-prep.html")).not.toContain("/images/station-sandbag-lunges.jpg");
    expect(read("run-zone.html")).not.toContain("/images/run-compromised.jpg");
    expect(fs.existsSync(path.join(output, "shop.html"))).toBe(true);
    expect(fs.existsSync(path.join(output, "podcast.html"))).toBe(true);
    expect(read("index.html")).not.toContain('id="platform"');
    expect(read("index.html")).toContain('data-coach-view');
    expect(read("index.html").indexOf('data-coach-view')).toBeLessThan(read("index.html").indexOf('<div class="nav">'));
    expect(read("planner.html")).toContain('data-coach-view');
    expect(fs.existsSync(path.join(output, "manage-videos.html"))).toBe(true);
    expect(fs.existsSync(path.join(output, "manage-programmes.html"))).toBe(true);
    const training = JSON.parse(read("data/training-platform.json"));
    expect(training.name).toBe("ABC Trainerize");
    expect(training.coachURL).toBe("https://www.trainerize.com/login/");
    expect(JSON.parse(read("data/campaign-offers.json")).offers.find(offer => offer.id === "programme").destination).toBe(training.programmesURL);
  });
  it("omits demo management pages and the coach bar when coach preview is disabled", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "s9-public-audience-"));
    const config = JSON.parse(fs.readFileSync(".devin/template-preview.json", "utf8"));
    config.coachPreview = false;
    const configFile = path.join(tmp, "public.json");
    fs.writeFileSync(configFile, JSON.stringify(config));
    const output = path.join(tmp, "site");
    const result = run(configFile, `--output-dir=${output}`);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(output, "index.html"), "utf8")).not.toContain('data-coach-view');
    expect(fs.existsSync(path.join(output, "manage-videos.html"))).toBe(false);
    expect(fs.existsSync(path.join(output, "manage-programmes.html"))).toBe(false);
    expect(fs.readFileSync(path.join(output, "watch.html"), "utf8")).toContain('data-coach-preview="false"');
  });
  it("refuses a new legacy tenant even when the maintenance flag is passed", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "s9-source-guard-"));
    const config = path.join(tmp, "new.json");
    fs.writeFileSync(config, JSON.stringify({ slug: "new-site-template-guard", brand: "New site" }));
    const result = run(config, "--legacy-maintenance", `--output-dir=${path.join(tmp, "output")}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("canonical template");
    expect(fs.existsSync(path.join(tmp, "output"))).toBe(false);
  });
  it("refuses a donor build without an isolated output directory", () => {
    const result = run("scripts/reskin/joshharrison.demo.json", "--template-donor");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Template donor builds require an isolated --output-dir");
  });
});
