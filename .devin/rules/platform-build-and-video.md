---
trigger: always_on
---
# Mandatory platform-build and walkthrough plan

Read this file BEFORE every site build, template change, recording or video splice. A fresh session must follow the pointers in AGENTS.md and HANDOVER.md here before acting. These instructions do not authorise new work without Chris's approval.

## MUST build from the canonical template

- Every NEW tenant MUST use `mode: "chassis"` and the canonical `chassis/` template through `scripts/reskin-tenant.js`. Never copy another tenant's generated directory, use the previous prospect as a donor, or silently fall back to legacy pair mode.
- The canonical template consists of `chassis/` plus its shared showcase/build logic. It is maintained directly. Historical donor regeneration is retired; it must not overwrite the master with an older coach snapshot.
- A different site's approved design may be a reference, not a build source. Apply only the new prospect's verified branding, images, content, destinations and explicitly agreed feature choices.
- Fix reusable defects in the master and test an isolated generated tenant first. Never rebuild existing tenants as a side effect of a template task. Legacy maintenance requires explicit scope and the explicit legacy-maintenance build flag; that is not permission to create a new tenant from legacy code.
- Use a new isolated `--output-dir` for review. Existing output replacement requires specific approval; never overwrite a coach's work or modify the tenant registry merely to preview a template.
- For an explicitly approved upgrade of an EXISTING personalised demo, port selected canonical components onto a staged working copy of THAT same demo, preserving its approved content and layout. This is targeted maintenance, not permission to use it as another coach's donor or rebuild it wholesale. Keep durable page/config sources in step with the patch. The nine-prospect backlog in HANDOVER.md is planning only; no automatic rollout is authorised.

## Showcase acceptance plan

1. Build from the canonical template; verify the provenance receipt and that no branding/token ghosts survive.
2. Populate the complete platform so it sells as one experience: coaching, race tools, Results, station/running/fuelling/taper guidance, Calendar & Travel, news with coach voice, race-mates/crew, booking and Desk/campaigns. Show optional shop/podcast/watch capability without claiming the coach has an unverified business or published episodes. Never solve missing demo content by quietly hiding the feature.
3. Use verified, future, dated races with specific official links. Prefer relevant regional events, then a relevant international race. No TBA/TBC hero cards or invented dates. Homepage cards, calendar, predictor and countdown share one city/event data shape. Refresh the checked event snapshot before it becomes stale; if no confirmed future choice is available, stop the build rather than publish a shabby placeholder.
4. News uses source-linked factual briefings plus concise coach-voice draft commentary for review. Original training notes are labelled editorial rather than presented as sourced reporting. Never invent personal experiences or coach quotations. Do not imply automatic collection or live advertising/calendar integrations are connected when only previews exist.
5. Keep the public voice buzzy and inspirational: show the prospect how good they look and how the platform helps them. The coach already knows this is a showcase, so do not turn visible copy into a build handover with "supplied", "sample", "fictional", "unverified", photo-slot notes or repeated preview rules. Keep necessary local-storage/integration caveats short and only where the workflow genuinely needs them; coach-only tools may be more explicit.
6. Check actual photographs, activity labels, cropping and rights/source records. Keep text-only station content where no appropriate image exists rather than substituting an unrelated movement. Do not cover faces with headlines. Avoid reusing the same hero photograph for unrelated modules unless it is intentionally part of a recognised campaign.
7. Exercise the predictor, split analyser, Results filters, city guides, booking request/approval/calendar export, Desk controls and campaign prepare/edit/approval-reset/launch preview. Check desktop and phone layouts, touch navigation, images, scripts and local links.
8. Report review links and what actually passed. Build, recording, commit, push and deployment are different actions; do not conflate them.

## Public site and Coach's View — mandatory audience separation

- The homepage and ordinary navigation speak to athletes/clients. Do not mix a coach-sales or business-management card grid into the public homepage.
- In the sales demo, show a signature-colour **The Desk** panel with supporting text **Your coaching tools**. Its tools are **Bookings, Finance, Campaigns, Programmes and Content**. On public pages in the coach preview it sits ABOVE the public menu. Private Finance/Campaigns/Programmes/Content/setup pages have no competing public menu; retain the booking planner's own controls. Finance and Campaigns are separate pages. The Desk heading links to the coach homepage; phone tools expand behind a touch-friendly Show tools button. Toolbar colours must remain readable on dark booking and ordinary site backgrounds.
- Client booking opens `planner.html?view=client`; coach booking management opens `planner.html?view=coach`. Client training access belongs on the public coaching/training pages; programme management belongs in Coach's View.
- `trainingPlatform` can provide `name`, `coachURL`, `clientURL`, `programmesURL`, `applicationURL`, `offerTitle`, `offerDescription` and a private setup `note`. Use verified destinations for the actual coach's provider (Trainerize, FITR or another). Never guess a coach's account subdomain, collect provider credentials, or imply client/workout/progress sync. The neutral Trainerize example uses the verified official account finder, not a connected coach account. Public offer links and programme-campaign destinations must agree.
- Watch & Learn is PUBLIC viewing content. Manage videos is the COACH publishing workspace: hosted video/clip link, title, thumbnail, category, draft, preview and explicit publish. Draft edits must not change the last published version until published. Unpublishing is reversible and retains a draft. Reject unsafe URLs and HTML injection.
- Browser-only publishing previews may persist metadata locally and show it on the public preview in the same browser; state this accurately. Do not claim a live website update or authenticated private workspace exists. `coachPreview: false` omits the demo toolbar and management pages and makes the public library ignore local publishing previews; it does not implement production authentication or private storage.
- The coach homepage with The Desk tools is the default landing/return destination (`audience=coach`). **Preview public site** opens a separate client-preview tab (`audience=public`) with coach tools hidden. A clearly labelled preview banner provides **Back to coach view** on every public-preview page. Normal management return links go to the coach homepage; public-preview navigation stays public until that explicit return. These controls appear only in the enabled coach demo, not a production public build. Do not confuse this presentation switch with access control.
- Content provides Videos and optional Podcast sections, including hosted full episodes and teaser-to-episode links. Enable podcast capability only as appropriate for the coach; do not invent an existing podcast/channel or seed unverified clips. G&H's protected public podcast remains separate from its owner-only card preview.
- Client-success campaigns come after the business's existing offer/product promotion, with actual result/timeframe and optional client-approved quote/photos. Require explicit permission, result verification and exact-creative approval; edits reset approval. Do not duplicate provider-held client records or invent transformations. The sharing workflow is an organic social draft/preview; paid weight-loss/before-after creative requires separate policy review.
- Podcast clips/Instagram teasers are optional content types where the coach actually has them. Connect a teaser to a full episode when a verified link exists; do not invent recordings or add them to Gregor & Hattie's wrapped site.

## Mandatory video rules

### Purpose and coverage
- Sell the whole branded platform, not a list of page headings. Plan the feature sequence before recording and show benefits alongside useful actions and outcomes.
- Open full tours with the commercial promise before the page tour: **one site, two jobs** — give clients the coaching/race tools that build trust, then show the coach how The Desk turns that attention into enquiries, replies, bookings, campaign results and a profitable, scalable, growing business. Preview the Desk payoff in the first 20–30 seconds so viewers know why it is worth staying for the full walkthrough.
- Do not compress a comprehensive tour just to hit an arbitrary duration. A clear 10–12 minute walkthrough is better than a rushed 6-minute blur; group smaller features, keep the public journey brisk, and give the Lead Desk/campaign business loop enough time to register. If a shorter cut is needed, make it a separate cut rather than speeding through the full tour.
- Core tour: brand/home, coaching and real offer destinations, race-mates, predictor and splits, Results, Stations Prep, Run/Taper and agreed Fuel content, combined Calendar & Travel, crew, populated news with coach takes, booking, Lead Desk and campaign workflow, then a clear closing invitation.
- Include shop, podcast, Watch, partner links or other prospect-specific modules where relevant. Product-led tours may lead with commerce; coaching-led tours lead with the coaching journey. A shorter tour may group features, not imply unshown functionality is missing.
- Show the public/client journey first, then make a clear transition into Coach's View for business tools. When demonstrating video publishing, pair the coach's draft/preview/publish actions with the resulting public video card. Show programme-management links as a launchpad into the existing provider, not a fabricated synced dashboard. Never record provider credentials, sign-in secrets or real client records.

### Movement, photography and text
- Stations Prep is a page walkthrough, NOT a slideshow. Move steadily between stations so coaching text and its relationship to each photograph are visible. Do not jump over the photos to land repeatedly on text, and do not exclude the text to show only photographs.
- Pause primarily on photos, photo-plus-text compositions or a deliberate mix. Let intervening text pass during slower scrolling without stopping at every paragraph. Respect text-only station sections rather than inventing an image.
- Frame the actual element being described before or as its caption appears. Keep subjects and relevant controls above the caption bar; never leave the advertised feature below the screen. Prefer smooth forward movement over unnecessary backtracking.
- Allow image reveals, scrolling and dialogs to settle. Avoid recording loading screens, blank initial frames, unfinished animations or abrupt jumps between distant anchors.

### Captions and pacing
- Captions explain the action and its business value in plain English. Do not narrate implementation details, template mechanics or lists of things a demo cannot do.
- Avoid repeated obvious demo qualifications: fictional appointments, fictional Desk figures and calendar-account caveats do not each need a caption. Keep capability claims accurate; a simulation must not be sold as a connected live service.
- Match each hold to reading length and visual complexity. Typical photo holds are about 5–7 seconds; longer captions need longer holds. Do not impose a universal timing on every scene.
- Keep captions above dialogs and previews, consistent in font, position and appearance. Do not let a popup hide them.

### Variations, splices and final verification
- Prospect-specific scripts implement these rules; they do not replace them. Vary the route for product/coaching businesses, shorter/full tours and photo-rich/text-heavy pages.
- Retain approved unaffected footage. Re-record changed sections, cut at natural page boundaries, remove obsolete duplicate pages and standalone end cards, and trim loading/return-to-top tails. Match framing, caption style, resolution and pace.
- Compare site and recording dates AND inspect affected content. A recent video can still show a broken tool; timestamps alone are not proof.
- Decode the final file, play and seek it, inspect both sides of every join, verify caption/feature alignment and photograph holds, and check the ending. Give Chris three useful review timestamps.
- Preserve previous Desktop copies. Name the new deliverable unmistakably with `LATEST`, subject and date. Do not call a video uploaded or deployed without verification.

## Current boundary

Gregor & Hattie's public content/photos and `Gregor and Hattie - LATEST full pitch - 25 Oct 2026.mp4` remain protected. Chris approved their owner-workspace refinements and subsequently the selected canonical-template/eight-other-video-site rollout on 26 October; see the latest HANDOVER.md for work actually completed. That approval is for targeted local site maintenance, not a full rebuild, new news commentary, public podcast redesign, photo swaps, video edits, outreach or deployment. Their Race to Frame campaign remains first and intact; podcast publishing remains an owner-only preview. The station pacing clarification applies to FUTURE recordings, not a new recording authorisation.
