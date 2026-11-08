// Record a subtitled Loom-style walkthrough of a tenant demo site.
// Usage: node scripts/record-demo.mjs <slug> [base_url] [output_path]
// Uses a subtitle-script JSON file at scripts/reskin/<slug>.pitch.json
// if it exists, otherwise falls back to a generic page tour.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2] || "getfitgabby";
const base = process.argv[3] || "http://localhost:3000";
const outPath = process.argv[4] || `/tmp/${slug}-pitch.webm`;

// Pitch script: array of scenes. Each scene = page + subtitle lines + scroll.
const pitchFile =
  process.env.PITCH_SCENES_FILE ||
  path.join(root, "scripts", "reskin", `${slug}.pitch.json`);
let scenes;
if (fs.existsSync(pitchFile)) {
  scenes = JSON.parse(fs.readFileSync(pitchFile, "utf8"));
} else {
  // Fallback: silent page tour
  scenes = [
    { path: "", subs: [], scrollMs: 4000 },
    { path: "stations-prep.html", subs: [], scrollMs: 3000 },
    { path: "coaching.html", subs: [], scrollMs: 2000 },
    { path: "desk.html", subs: [], scrollMs: 3000 },
    { path: "events.html", subs: [], scrollMs: 2000 },
    { path: "splits.html", subs: [], scrollMs: 2000 },
    { path: "find-a-partner.html", subs: [], scrollMs: 2000 },
    { path: "news.html", subs: [], scrollMs: 2000 },
  ];
}

const plannerSceneFile = path.join(
  root,
  "scripts",
  "reskin",
  "planner.segment.json",
);
const deskIndex = scenes.findIndex((scene) => scene.path === "desk.html");
if (
  deskIndex >= 0 &&
  !scenes.some((scene) => scene.path.startsWith("planner.html")) &&
  fs.existsSync(plannerSceneFile)
) {
  scenes.splice(
    deskIndex,
    0,
    ...JSON.parse(fs.readFileSync(plannerSceneFile, "utf8")),
  );
}

// Inject a fixed-position subtitle bar into the page
async function injectSubtitleBar(page) {
  await page.evaluate(() => {
    if (document.getElementById("pitch-sub")) return;
    const bar = document.createElement("div");
    bar.id = "pitch-sub";
    Object.assign(bar.style, {
      position: "fixed",
      bottom: "32px",
      left: "50%",
      transform: "translateX(-50%)",
      maxWidth: "85%",
      padding: "14px 28px",
      background: "rgba(0,0,0,0.82)",
      color: "#fff",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: "19px",
      fontWeight: "600",
      lineHeight: "1.45",
      textAlign: "center",
      borderRadius: "12px",
      zIndex: "999999",
      opacity: "0",
      transition: "opacity 0.35s ease",
      pointerEvents: "none",
      letterSpacing: "0.01em",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    });
    document.body.appendChild(bar);
    // Keep the caption above whichever dialog is open. Mutation callbacks run
    // before the next paint, so opening/closing a dialog never hides it.
    const place = () => {
      const open = [...document.querySelectorAll("dialog[open]")];
      const layer = open[open.length - 1] || document.body;
      if (bar.parentElement !== layer) layer.appendChild(bar);
    };
    window.__placePitchSub = place;
    new MutationObserver(place).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
  });
}

async function showSub(page, text) {
  await page.evaluate((t) => {
    const bar = document.getElementById("pitch-sub");
    if (!bar) return;
    window.__placePitchSub?.();
    bar.textContent = t;
    bar.style.opacity = t ? "1" : "0";
  }, text);
}

async function smoothScroll(page, totalMs) {
  const steps = Math.max(10, Math.round(totalMs / 200));
  const delay = totalMs / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() =>
      window.scrollBy({ top: window.innerHeight / 4, behavior: "smooth" }),
    );
    await page.waitForTimeout(delay);
  }
}

async function scrollToSelector(page, selector, pauseMs, block = "center") {
  await page.evaluate(
    ({ sel, align }) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: "smooth", block: align });
    },
    { sel: selector, align: block },
  );
  await page.waitForTimeout(pauseMs || 1500);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: "/tmp/pw-videos/",
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  // startAt scenes stay invisible until scrolled into position, so the top
  // of the page never flashes before the framed shot.
  await page.addInitScript(() => {
    if (window.name !== "pitch-hide") return;
    const style = document.createElement("style");
    style.id = "pitch-hide";
    style.textContent = "html{visibility:hidden!important}";
    document.documentElement.appendChild(style);
  });
  // Pre-accept Google-style consent walls so external click-throughs
  // land on the partner site, not an interstitial.
  await context
    .addCookies([
      { name: "SOCS", value: "CAI", domain: ".google.com", path: "/" },
      { name: "CONSENT", value: "YES+", domain: ".google.com", path: "/" },
    ])
    .catch((error) => {
      if (process.env.PITCH_STRICT === "1") throw error;
    });

  for (const scene of scenes) {
    const url = `${base}/${slug}/${scene.path}`;
    console.log(`→ ${scene.path || "index"}`);
    // skip_nav: let a previous click handle navigation instead of goto
    if (!scene.skip_nav) {
      if (scene.startAt)
        await page.evaluate(() => (window.name = "pitch-hide")).catch(() => {});
      await page
        .goto(url, {
          waitUntil: scene.waitUntil || "networkidle",
          timeout: 15000,
        })
        .catch((error) => {
          if (process.env.PITCH_STRICT === "1") throw error;
        });
      // startAt: frame a section the moment the page loads (e.g. so the
      // hero picture reveal plays in shot), offset clears the sticky menu.
      if (scene.startAt) {
        await page
          .waitForSelector(scene.startAt.selector, { state: "attached" })
          .catch(() => {});
        await page.evaluate(({ selector, offset }) => {
          const el = document.querySelector(selector);
          if (el)
            window.scrollTo({
              top: el.getBoundingClientRect().top + window.scrollY - offset,
              behavior: "instant",
            });
        }, { selector: scene.startAt.selector, offset: scene.startAt.offset || 0 });
        await page.evaluate(() => {
          window.name = "";
          document.getElementById("pitch-hide")?.remove();
        });
      }
    } else {
      await page.waitForTimeout(800);
    }
    await injectSubtitleBar(page);
    await page.waitForTimeout(800);

    // Show subtitle lines with timing + optional interactions
    if (scene.subs && scene.subs.length) {
      for (const sub of scene.subs) {
        await showSub(page, sub.text);

        // Run actions before/during the hold (fill fields, click, select)
        if (sub.actions) {
          for (const act of sub.actions) {
            if (act.scrollTo) {
              await scrollToSelector(
                page,
                act.scrollTo,
                800,
                act.align || "center",
              );
            }
            if (act.fill) {
              await page.fill(act.selector, act.fill).catch((error) => {
                if (process.env.PITCH_STRICT === "1") throw error;
              });
              await page.waitForTimeout(act.pause || 400);
            }
            if (act.select) {
              await page
                .selectOption(act.selector, act.select)
                .catch((error) => {
                  if (process.env.PITCH_STRICT === "1") throw error;
                });
              await page.waitForTimeout(act.pause || 400);
            }
            if (act.click) {
              await page.click(act.click).catch((error) => {
                if (process.env.PITCH_STRICT === "1") throw error;
              });
              await page.waitForTimeout(act.pause || 600);
            }
            if (act.navClick) {
              // Click-through for external/target=_blank links: force same-tab
              // so the recording follows the navigation, then go back.
              await page
                .evaluate((sel) => {
                  const a = document.querySelector(sel);
                  if (a) a.removeAttribute("target");
                }, act.navClick)
                .catch((error) => {
                  if (process.env.PITCH_STRICT === "1") throw error;
                });
              await Promise.all([
                page
                  .waitForNavigation({
                    timeout: 12000,
                    waitUntil: "domcontentloaded",
                  })
                  .catch(() => {}),
                page.click(act.navClick).catch(() => {}),
              ]);
              // Keep the caption on screen over the partner page too.
              await injectSubtitleBar(page).catch(() => {});
              await showSub(page, sub.text).catch(() => {});
              await page.waitForTimeout(act.holdMs || 2500);
              await page
                .goBack({ waitUntil: "domcontentloaded" })
                .catch((error) => {
                  if (process.env.PITCH_STRICT === "1") throw error;
                });
              await page.waitForTimeout(800);
              await injectSubtitleBar(page);
              await showSub(page, sub.text);
            }
            if (act.type) {
              // Slow-type for visual effect
              await page.click(act.selector).catch((error) => {
                if (process.env.PITCH_STRICT === "1") throw error;
              });
              for (const ch of act.type) {
                await page.keyboard.type(ch, { delay: 60 });
              }
              await page.waitForTimeout(act.pause || 400);
            }
          }
        }

        await showSub(page, sub.text);

        // Optional: scroll to a specific element while sub is showing
        if (sub.scrollTo) {
          await scrollToSelector(
            page,
            sub.scrollTo,
            sub.holdMs || 2500,
            sub.align || "center",
          );
        } else if (sub.scroll) {
          await smoothScroll(page, sub.holdMs || 2500);
        } else {
          await page.waitForTimeout(sub.holdMs || 2500);
        }
      }
      await showSub(page, "");
      await page.waitForTimeout(400);
    } else {
      // No subs — just scroll
      await smoothScroll(page, scene.scrollMs || 3000);
    }

    // Scroll back to top for clean transition
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForTimeout(600);
  }

  // End card
  if (process.env.PITCH_NO_END_CARD !== "1") {
    await page.evaluate((s) => {
      document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100vh;background:#0f0f11;color:#fff;font-family:-apple-system,sans-serif">
        <div style="font-size:2.2rem;font-weight:800;margin-bottom:0.8rem">Station 9</div>
        <div style="font-size:1.1rem;color:rgba(255,255,255,0.6);margin-bottom:2rem">
          Built for ${s}
        </div>
        <div style="font-size:1.5rem;margin-bottom:1rem;text-align:center;line-height:1.6">
          Your platform is ready to explore.<br>
          Tap <b>Explore your live platform</b> below this video.<br>↓
        </div>
        <div style="font-size:1.1rem;color:rgba(255,255,255,0.7)">
          https://www.station9studio.co.uk/${s}/
        </div>
      </div>`;
    }, slug);
    await page.waitForTimeout(3000);
  }

  await page.close();
  const video = await page.video();
  const videoPath = await video.path();

  fs.copyFileSync(videoPath, outPath);

  await context.close();
  await browser.close();
  console.log(`✅ Video saved: ${outPath}`);
})();
