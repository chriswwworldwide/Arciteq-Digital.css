# Project Notes — Missing Nudges, SEO, and Automation

This is a living list of opportunities to push the project toward profitability through nudges, SEO, and automation. Revisit it when planning the next block.

> **Session start:** check the "Chat notes" section in `BILLIONS.md` — it defines our conversation tone (dry British sarcasm, banter in Q&A, humour suspended during debugging/complex work).

## Working rules (hard-won, keep these)

These exist because the same two failure patterns keep costing hours. Follow them even when the guess feels certain — the guesses that feel like memory are the worst ones.

1. **Verify, don't recall.** Never state a fact from memory when a tool call can check it — quote the file, the doc, the curl output. This applies most of all to things Devin itself wrote earlier (prices, config values, port numbers), which feel like established fact and aren't. A confident guess and a verified fact look identical in the transcript; only the wrong ones get found, later, expensively.
2. **Use the reference, don't reinvent it.** For non-trivial UI/effect work, find the established open-source implementation first and build from that. Hand-rolled is only acceptable if it clearly beats the reference — "it renders" is not beating it. Correctness that can't be checked by compiling (does it *look* like the real effect?) needs the reference implementation, not a bespoke approximation.

**Worked example — the hero pic effect saga (Nov 2026):** roughly two hours went in circles hand-rolling shimmer/sparkle/mosaic hero-reveal effects. Every iteration passed "does it compile/render" and failed "does it look like the real thing" — a check only the user's eyes could run. The fix that landed was building on the actual Codrops/open-source implementation that had been available from the start. Lesson: when the goal is "look like X", start from X's implementation, not from a guess at its recipe.

## On-site nudges and lifecycle

We have one abandoned-cart nudge. Still missing:

- **Product-page nudge** for long dwell / scroll without add-to-cart.
- **Browse-abandonment** capture for users who view products but never add them.
- **Exit-intent email capture** on shop, product, and category pages.
- **Back-in-stock alerts** for out-of-stock products.
- **Low-stock urgency** badges on product cards.
- **Replenishment reminders** for consumable/wellness products.
- **Win-back** campaign for past customers.
- **Wishlist nudges** — `wishlist.html` exists but may not be wired into the cart/checkout flow.

## SEO and content

Foundations exist (`public/sitemap.xml`, product JSON-LD, canonicals) but several high-leverage pieces are missing:

- **Local landing page engine** — the biggest long-tail SEO play. Not built yet.
- **Review/UGC system** — `data/reviews.json` and product-page review mounts exist, but reviews are not shown on shop/category cards and UGC upload is not wired.
- **Per-tenant sitemap** and auto-regeneration on product changes.
- **robots.txt** at project root.
- **A/B testing framework** for headlines, prices, and trust strips.
- **Content hub / topical authority pages** beyond the three category landing pages.
- **Blog or guide feed** tied to the niche keyword silos.

## Automation and dashboards

- **Supplier QA autopilot** — guardrails exist in data but not enforced on publish.
- **Catalog QA** — missing `petType`, `lifeStage`, `sizeRequirement` etc. does not block publish.
- **Inventory/pricing sync** from supplier feeds.
- **Order and fulfilment alerts** for stuck orders, missed webhooks, and refunds.
- **Pulse/CWV monitoring** dashboard.

## How to make Google work for us (without bending it)

We cannot trick Google long-term. The levers that actually move the needle:

- **Page speed** and Core Web Vitals (LCP < 2.0s, CLS < 0.1, INP < 200ms).
- **Topical authority** — original guides, FAQs, comparisons, and how-to content.
- **Genuine reviews and UGC** with `Product` and `Review` structured data.
- **Useful local landing pages** tied to real shipping, stock, or support signals (not just city-name spam).
- **Strong internal linking** and clear category/product architecture.
- **Freshness** — regular product, review, and content updates.
- **Video and rich media** with schema markup.
- **Real backlinks** from pet/health/vet sites, not PBNs.
- **Mobile-first parity** and accessibility.

## Recommended next quick wins

1. Wire `data/reviews.json` into product cards and shop/category pages.
2. Add `robots.txt` and a per-tenant sitemap generator.
3. Build one local landing page template and generate 5–10 real local pages.
4. Add low-stock urgency and back-in-stock email capture.
5. A/B test the cart trust strip headline.
6. Publish one content hub page for a target keyword silo (e.g., "senior dog mobility").

## Pre-launch execution rules

Before launch, polish the current single storefront. Do not expand to more sites or big new features. Each block must follow this loop:

1. **Execute the block** — one small, safe change at a time.
2. **Analyse the result** — check for missing profit, engagement, SEO, and automation opportunities before moving on.
3. **Benchmark against current best** — search for envelope-pushing examples in that exact space (e.g., best pet e-commerce trust strips, highest-converting cart nudges, strongest product-page FAQ schema).
4. **Marketer's eye check** — review the change for soul, storefront feel, and marketability. We are a pet site: the angle should always be safety, comfort, the pet-owner bond, or peace of mind.
5. **Raise findings immediately** — do not wait. Surface any thought, gap, or risk to the user and the board as we go.
6. **Do not let analysis block launch** — if a benchmark does not reveal a clear 10x fix in 30 minutes, move on. Launch is the real benchmark.

This is worth doing only as a final pre-flight, not a replacement for going live.

## iPhone / headless execution charter

The iPhone version of Devin is a **read-only indexed-search assistant**. It cannot edit files, run `npm start`, run `git`, run `curl`, open browser previews, or persist across turns. Use it only for:

- Reading `AGENTS.md` and `PROJECT_STATUS.md`
- Searching the repo and answering one-off questions
- Reviewing a specific file or diff

The execution charter below applies to a desktop/terminal Devin session that has filesystem, shell, and browser access:

When the user has said "go", "do it", "execute", or similar, desktop Devin has blanket permission to:

- Start and stop the local server (`npm start`, `node server.js`, etc.) for testing.
- Run `curl`, `gh`, `git`, and other CLI commands without per-step approval.
- Open browser previews, run lint/type-check, and make multiple file edits in one block.
- Proceed with the next logical pre-launch block without asking for confirmation on every tool call.
- Touch Global files (server.js, script.js, product.html templates, etc.) and report the impact after.

Guardrails that still apply:
- Do not run destructive commands (`rm -rf`, force push, drop tables, delete files) without explicit user confirmation.
- Avoid exposing or logging secrets.
- Keep the final summary concise: what changed, why, and what's next.

### Where the "no approval buttons" setting lives

Two separate things control whether you get prompted:

1. **Devin CLI / Devin Desktop (running on your machine).** `.devin/config.json` in this repo pre-approves the commands used here (git, gh, npm, npx, node, make, curl, file reads/writes) so they run without a prompt. `rm -rf` and force-with-lease pushes still ask, and `sudo`, `rm -rf /`, `rm -rf ~`, `git push --force`, `git reset --hard` and writes to `.env` are blocked outright. For a completely prompt-free local run, start the CLI in bypass mode: `devin --permission-mode bypass` (or `/bypass` inside a session) — note it still cannot override the deny rules above.
2. **Cloud sessions (app.devin.ai, Slack, ACP).** These never show per-command approval buttons; the agent runs commands, starts local servers, and commits on its own. `.devin/config.json` does not apply there, so it is expected behaviour that nothing asks you to click Accept.

Practical upshot: you can hand over a block of work and walk away in either place. Approval is only ever needed for the deny/ask cases above, or when the agent needs something only you have (a secret, a production setting).
