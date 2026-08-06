# Project Status — L’Art de la Séduction (current repo)

## What this project is
This repository currently contains a static website (multiple HTML pages + theme CSS files) and a small Node/Express server used to run the site locally. It’s evolving toward a multi-site e‑commerce platform.

## Origins (how it was built)
- Built from a “human in the loop orchestrating AI” workflow.
- A lot of code was created by iterating with AI, copying code between browser/editor, and patching issues as they appeared.
- This explains why the project historically accumulated:
  - placeholder files
  - backup folders
  - duplicated structures
  - partially-integrated features

On 2026-04-28 we performed an aggressive cleanup by archiving redundant content locally (not committed) to reduce clutter and make the project easier to evolve.

## Current goals (where this is going)
High-level objective:
- Build a curated expert shop e‑commerce engine with a private trust/QA layer.
- Run ~14 branded storefronts from one shared codebase.
- Each storefront has its own branding + SEO content and focuses on two niches.
- Pivot category focus from lingerie toward home tech.
- Use Stripe (or similar) for checkout.
- Add memberships with tiered perks (membership is optional; customers can still buy without it).
- Optimize for mobile + desktop performance and SEO.
- Support marketing workflows (TikTok/IG) via Gumloop and other automation.

Operating model (for now):
- Fulfilment is dropship (no staff). Overheads are mainly domains + hosting + payment processing fees + lightweight SaaS (e.g. email tool).

### Standing goal: fully data-stitch the site (single customer view)
Every visitor/buyer should be tracked as one stitched record across the whole funnel, so we can measure real pick-up/profit and later plug marketing tools (Mailchimp first) straight in. This is now an active goal (previously parked under "Later"):
- One `customers` record per person (per tenant) as the source of truth: email, first/last seen, order count + total spend, first-touch UTM, subscribe state.
- A unified `email_events` timeline stitching `cart_captured` → `nudge_sent` → `order_completed`, so each nudge and each sale ties back to the same person and cart.
- Link the currently-disconnected pieces: `cart_emails` (capture) and `orders` (Stripe webhook) share only an email today; add conversion attribution (`converted_at`, `converted_order_id`, which nudge won).
- Build the outbound sender as a provider adapter so **Mailchimp** (and others) can be wired in later without touching the funnel logic.
- Add a 3rd, later "payday" win-back nudge (gated, no/low discount, suppress purchasers) once tracking exists to measure it.
- Keep it privacy-safe and tenant-scoped so all 14 sites share one dashboard.

Direction note:
- We have pivoted away from the “mini‑Amazon” framing. The target experience is curated (limited, quality-controlled catalog), trust-first (clear safety/fit/shipping/returns), and automation-first (dashboards + guardrails so it runs with minimal day-to-day involvement).

## What works right now (confirmed)
Stripe checkout is working end-to-end locally:
- Shop page renders products and can add to cart.
- Cart page shows items and has a working Checkout button.
- Clicking Checkout creates a Stripe Checkout Session server-side.
- Stripe redirects back to a local success page.

Pages:
- Home: http://localhost:3000/
- Shop: http://localhost:3000/shop.html
- Cart: http://localhost:3000/cart.html
- Success: http://localhost:3000/success.html

## How to run locally
1) Install dependencies
- npm install

2) Create a local env file (DO NOT commit)
- Create .env.local in the project root:
  STRIPE_SECRET_KEY=sk_test_...

3) Run the server
- npm start

## Local Stripe checkout runbook (repeatable test)
Terminal setup:
- Terminal A: npm start (server)
- Terminal B: stripe listen --forward-to localhost:3000/stripe/webhook (webhooks)
- Terminal C: free terminal for curl commands

Happy-path browser flow:
- Open: http://localhost:3000/shop.html
- Add item(s) to cart
- Open: http://localhost:3000/cart.html
- Click Checkout and pay with Stripe test card 4242 4242 4242 4242

Confirm in terminal (admin API):
- List orders:
  curl -i -H "x-admin-key: <ADMIN_API_KEY>" "http://localhost:3000/admin/orders"
- List paid orders only (clean view):
  curl -i -H "x-admin-key: <ADMIN_API_KEY>" "http://localhost:3000/admin/orders?status=paid"
- Inspect one order (replace <ORDER_ID>):
  curl -i -H "x-admin-key: <ADMIN_API_KEY>" "http://localhost:3000/admin/orders/<ORDER_ID>"

Env / secret sanity check (admin-only):
- Confirm which secrets are set (does not reveal secret values):
  curl -i -H "x-admin-key: <ADMIN_API_KEY>" "http://localhost:3000/admin/env"

Admin key rotation (local):
- Generate a new random key
- Update ADMIN_API_KEY in .env.local
- Restart the server
- In the browser, open /admin.html and click “Clear saved key”, then paste the new key and click “Save key”

What “good” looks like:
- Stripe CLI shows 200 POST http://localhost:3000/stripe/webhook
- /admin/orders returns HTTP/1.1 200 OK
- The newest order shows status: paid

## Project framework (current structure)
- index.html
  - Current landing/brand page (does not run the store).
- shop.html
  - Simple product listing page that uses script.js to render products.
- cart.html
  - Cart UI wired to script.js; includes Checkout and Clear cart buttons.
- success.html
  - Return page used by Stripe Checkout success_url.
- script.js
  - Product list rendering, cart storage (localStorage), and checkout trigger (calls /create-checkout-session).
- server.js
  - Local Express server.
  - Serves static files.
  - Implements POST /create-checkout-session using Stripe.
  - Loads STRIPE_SECRET_KEY from .env.local.
- themes/
  - Theme CSS files for branded variants.
- public/, images/, images2/
  - Static assets.
- PROJECT_STATUS.md
  - This file.

## Security / hardening (current state)
- Repo includes linting/formatting/testing tooling and CI workflow configuration.
- Secrets are kept out of code by using .env.local (gitignored).

## Recent cleanup (archive)
A local-only archive was created at:
- archive/2026-04-28/

It contains backups, generated outputs, placeholder files, and other redundant content moved out of the project root.

## Known constraints / caveats
- The current store/cart implementation is minimal and uses localStorage.
- A persistent order database is implemented (Postgres).
- Stripe webhooks are implemented for reliable payment confirmation.
- Many pages still contain placeholder content and will be redesigned for the home-tech pivot.

## SEO resilience (plan)
- Expect SEO volatility and design the platform to be resilient.
- Build real topical authority per site/niche (not thin product pages).
- Maintain strong technical SEO foundations: canonical URLs, structured data (Product/Review/FAQ), and fast mobile performance (CWV).
- Build an “owned audience” early (email capture + lifecycle emails) to reduce dependence on search.
- Diversify discovery over time (SEO + light paid validation + organic social), without relying on any single channel.
- Treat supplier/merchandising automation as drafts-first with guardrails to avoid publishing low-quality pages at scale.

## Agentic operations (automation + dashboards) (plan)
Goal: make the business runnable with minimal day-to-day involvement by adding automation + dashboards (not risky “AI chat” that can hallucinate promises to customers).

Recommended order (safe and high ROI):
1) Ops dashboard + alerts
- Surface what needs attention: stuck pending orders, webhook missed, paid but not reconciled, payment failed.
- Daily digest summary: new orders, abandoned checkouts, failures.
- One-click actions for admin: reconcile order, mark shipped, view Stripe IDs.

2) Catalog QA autopilot (pre-publish checks)
- Block publishing unless required fields exist (petType, lifeStage, sizeRequirement).
- Enforce guardrails: integer minor-unit prices, safetyDisclaimer for tech, materials for wellness, warehouseLocation.
- Produce a simple “ready to publish” vs “blocked (missing X)” list.

3) Import + scoring automation (draft-first)
- Supplier feeds import to drafts.
- Hard filters + weighted scoring.
- Human approval required before publish.

4) Customer support triage (human-approved)
- Draft replies and categorize issues, but keep approval required to avoid wrong refunds/delivery promises.

Optional later blocks (only if/when we want them):
- Reviews + UGC system (upload/moderation, verified buyer, rich snippets)
- Community/social discovery (lists/boards, share flows, creator-style collections)
- Multi-seller marketplace layer (seller profiles, per-seller shipping, dispute flows)

Reminder note: revisit these optional blocks once the core store has stable traffic + reliable fulfilment + low support load.

## Next milestones (in order)
Note: this layout is a working path, not a strict sequence. We will adapt as we learn what customers respond to, what SEO rewards, and what ops load looks like.

Next build block (queued):
- Content hub v2: build 2–3 more topical guides and interlink them from the shop and product pages. Then resume with local landing pages and ops dashboards.

Recently completed:
- Speed-to-profit: email capture + abandoned cart recovery with 1-day and 7-day nudges (email provider to be wired later).
- Checkout friction: payment methods are now configurable from env, and the trust strip accurately reflects Stripe + PayPal only when PayPal is enabled.
- Ads tracking + attribution: UTM capture, persistence, order/Stripe metadata, and admin visibility were already in place; plan updated to reflect this.
- SEO resilience v1: per-tenant sitemap.xml and robots.txt, product JSON-LD with reviews, UGC review videos, and one "Senior Dog Mobility" content hub page.

Future execution (not next; revisit after sitemap / schema):
- See AGENTS.md for the full SEO + nudge + automation backlog.
- Priority candidates: reviews on product cards (already partially in place), local landing pages, ops dashboard + alerts.

Speed-to-profit module (build blocks, in recommended order):
- Offer + trust strip across key pages (shop, product, cart): delivery window, returns promise, support response time, secure checkout
- Cart AOV lift: free-shipping threshold progress + 2–4 relevant add-ons (rule-based, pet-layer safe)
- Curated bundles / starter kits (problem-based: travel safety, home safety, anxiety, hygiene)
- Reduce checkout friction (when available in Stripe Checkout): enable Apple Pay + Google Pay + PayPal
  - Guardrail: only mention payment methods in the trust strip if they are actually enabled and visible at checkout
  - Risk note (future): dynamic pricing (frequent price changes, per-user pricing, inconsistent totals) can trigger fraud/risk flags at the payment gateway
    - Mitigation: price is always server-authoritative and signed; keep line items + shipping + taxes deterministic; avoid changing totals between cart and checkout; log/audit price rules; roll out gradually per tenant
- Ads tracking + attribution (minimal, privacy-safe):
  - Capture UTM params on landing (utm_source, utm_campaign, utm_content, utm_term) and persist per tenant
  - Attach attribution to orders + Stripe metadata (source of truth for paid ROI)
  - Track funnel events: add_to_cart, begin_checkout, purchase (server-side where possible)
  - Admin visibility: show utm_source/utm_campaign on orders list to spot what’s actually working
- SEO follow-on for bundles/kits (so bundles become real growth pages):
  - Create 1–3 kit landing pages (one page per kit) with problem-first copy and internal links to included products
  - Add dynamic kit FAQs (product-safe, pet-safe) + FAQ schema on kit pages for long-tail capture
  - Add ItemList schema on kit pages and strong internal linking (shop -> kits -> products)
- SEO machine v1 (2–3 solid pages/week, minimal ongoing effort):
  - Standard page templates:
    - Kit landing page template (problem -> solution -> included products -> FAQs)
    - Problem page template (single concern page that links to 3–6 relevant products)
    - Comparison page template (only where factual; avoid claims)
  - Publishing cadence:
    - Target 2–3 pages/week for Site #1 until first 30–60 pages are live
    - Start with kits + problem pages in the first niche silo
  - Measurement loop (low overhead):
    - Weekly check: Google Search Console impressions/clicks + top pages gaining traction
    - Track: pages published/week, pages indexed, top 10 queries per silo
- Build-your-own bundle tiers (e.g. 3 items = 10% off, 4 = 15%, 5 = 20% — only if margins allow)
- Proof stack on product pages (guarantee/warranty badges + “why trust this” claims; add real reviews/UGC later)
- Lead magnet + email capture (pet safety checklist / travel safety guide) + welcome email
- First-order incentive OR free-shipping threshold (choose one primary offer to avoid confusion)
- Problem-based collection navigation (shop by problem, not just product type)
- Abandoned cart email automation (delay + dedupe + 1–2 touches; provider: Mailchimp once onboarded)

Speed-to-profit module (extra tactics from UK/US leaders):
- Guided bundles (problem/concern-first): choose a goal first, then recommend a kit (avoid “pick anything” overwhelm)
- Gift-with-purchase thresholds (simple freebies at spend thresholds; often better than % discounts)
- Shipping protection toggle (optional add-on; choose provider later; keep wording careful)
- Proof upgrades: quantified claims (where justified), “as seen in”/awards (only when real), and clearer warranty/guarantee terms
- Membership-lite perks (later): free shipping + small extra discount; avoid heavy account complexity early
- Pet Passport (later, safe V1): no-login profile stored in browser + used for recommendations/segments
- BYO box / subscription-style bundles (later): discovery + repeats model; only after core store is stable

14-site viability foundations (bake in early, in logical order):
- Tenant/site separation (brand name, support email, currency, catalog allowlists) so each site can differ without forking code
- Canonical + redirect discipline so cloned sites don’t create duplicate-index chaos
- Shared ops events/flags so one dashboard can run the whole portfolio (orders + order_events + needs-attention)
- Offer system as configuration (free-shipping threshold, trust strip copy, first-order offer) so future sites can vary safely
- Product data guardrails stay strict (pet layer, safety/materials, warehouse/shipping) to prevent a low-trust “dropship farm” outcome

Later (only once traffic + ops are stable):
- Community/chat and engagement points
- Advanced personalisation (“others bought”), heavy AI recommenders
- Full single-customer-view CDP-style data stitching — NOW ACTIVE, see "Standing goal: fully data-stitch the site" near the top

Note: implement these as small, safe blocks. The exact order can adapt, but the general principle is: trust first, then AOV lift, then automation.

## Profit milestones (updated with shipping progress + add-ons + starter kits)
These features typically increase AOV and reduce checkout drop-off. They do not create traffic by themselves, but they improve the value of each visitor and make paid experiments/SEO traffic more profitable.

- $1k/month profit (Site #1): target month 4–6 after launch if publishing cadence (2–3 pages/week) is sustained and fulfilment/support is stable
- $2k/month profit (Site #1): target month 7–9 after launch once kit pages + problem pages begin ranking consistently (SEO machine v1)

Wallet payments impact note (Apple Pay + Google Pay + PayPal): if enabled and used by the audience, expect roughly ~0–1 month faster to $1k and ~1–2 months faster to $2k due to reduced mobile checkout friction.

1) Membership tiers (Stripe subscriptions)
- Decide tier count, names, pricing, and perks.
- Add a membership page and Stripe subscription checkout flow.
- Add a webhook endpoint (later) to confirm subscription status reliably.

2) Multi-site engine (14 sites from one codebase)
- Per-domain configuration: theme, copy, niche selection, SEO meta.
- Clear separation between "site config" vs "engine".

3) SEO + marketing foundation
- Unique landing pages per site/niche.
- Structured data (JSON-LD) strategy.
- Sitemap strategy for multi-site.

4) Dropshipper product ingestion (curated launch)
- Start with curated product lists (20–50 per niche).
- Upgrade to automated feeds after v1.

## Quick troubleshooting
- If checkout fails:
  - Confirm .env.local exists and contains STRIPE_SECRET_KEY=sk_test_...
  - Restart npm start
  - Retry: shop.html -> add to cart -> cart.html -> checkout

