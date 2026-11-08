# Gym builds and pitches — Station 9

Companion strategy file to [BILLIONS.md](BILLIONS.md).

Status: future gym-phase product and pitch direction. These notes do not authorise implementation, integrations, advertising spend or outreach. Current delivery remains the coach-site work Chris has explicitly approved.

## The proposition

A branded gym platform that brings people in, helps turn them into members, and gives them reasons to stay.

Not just a passive website, and not merely an AI ad generator:

**Campaign → matching landing page → enquiry → trial booked → trial attended → membership → retention.**

The platform combines the public brand, useful athlete tools, community, booking and the acquisition system. Marketing funnels often stop being useful once somebody joins; race tools, events, coaching and community can keep the platform relevant afterwards.

Pitch lines to test, not proven performance promises:

- “Your branded gym platform, with a system for launching local campaigns, capturing enquiries and following them through to trial bookings.”
- “Your platform helps fill the right sessions—and shows you which campaigns produce paying members.”
- “Your business's platform, already built—see it before you pay.” Keep the existing demo-first approach.

## What the system could do

1. Owner selects an offer: seven-day trial, beginners' HYROX course, assessment or seasonal intake.
2. A controlled marketing agent prepares Instagram/Facebook ad copy, approved-photo layouts, Story variations and short-video scripts.
3. It prepares a matching branded landing page with a clear enquiry or booking action.
4. Enquiries enter a lead dashboard with appropriate consent and their campaign source.
5. Follow-up answers practical questions, helps people book, reminds them before trials and follows up afterwards.
6. The dashboard tracks enquiries, bookings, attendance, memberships, retention and advertising costs where connected.

Example: “Six-week beginner HYROX course, 20 spaces.” Prepare several ad variations, a landing page and a follow-up sequence; the owner approves before launch. Space counts must reflect real allocated capacity, not invented scarcity.

### Marketing agent, not unrestricted coding agent

Gyms need a simple campaign screen, not an unrestricted build agent. Use approved templates, the gym's own assets, confirmed prices and offers, controlled publishing, approval queues and reporting. Run the underlying system centrally and sell subscription access.

Generating creative, publishing organic posts and launching paid campaigns are distinct capabilities. Paid deployment requires authorised platform accounts, suitable permissions, supported integrations and compliance with advertising rules. None of these integrations was implemented or technically audited in this discussion.

## Subscription ladder

Proposed structure; Station 9 prices are not yet set.

| Tier | Responsibility |
|---|---|
| Platform | Branded site, enquiry capture, useful tools and reporting. |
| Campaign Assistant | Generate ads, matching pages and follow-up sequences; owner approves and publishes. |
| Campaign Autopilot | Publish approved campaigns and manage delivery within an authorised budget and permitted changes. |
| Managed Growth | Add human campaign review, creative judgement and intervention when results weaken. |

Charge setup and a monthly system/service fee. Keep advertising spend separate. Prefer the gym's own ad account and payment method: the platform charges the gym for advertising; Station 9 charges for its service.

Autopilot needs explicit campaign budgets, daily/lifetime limits, dates, permitted adjustments, pause rules and an owner stop control. It must not independently raise the authorised spend. Do not promise guaranteed leads or memberships.

## Four priorities that make it stronger

### 1. Advertise available capacity

Promote the sessions the gym actually wants to fill. Example: Tuesday beginners' HYROX has spare capacity → advertise that offer → show suitable trial slots → stop when the allocated places fill.

Requires reliable booking data and clear capacity rules. This makes the system operationally useful rather than merely increasing enquiry volume.

### 2. Optimise for members, not cheap form submissions

Connect ad source to enquiry, booking, attendance, joining and later retention. A cheap lead who never attends may be worth less than a more expensive lead who stays.

Where lawful, consented and platform-compliant, feed appropriate membership outcomes back to ad platforms. This capability already exists in competitors; it is not an exclusive idea. Do not send health or detailed training information to advertising platforms.

### 3. Recover missed opportunities before buying more traffic

Permission-based follow-up for unanswered enquiries, no-shows, trial visitors who have not joined and suitable former members. Use opt-outs, sensible frequency limits and human escalation.

Recommendation: this may be the best first commercial test—convert demand the gym has already attracted before charging it to buy more.

### 4. Create from the gym's real life

Use approved coach demonstrations, member stories, testimonials, beginner classes, community events and race weekends. Produce several formats and matching pages. Obtain permission for member images and testimonials; do not manufacture endorsements.

Chris's editorial judgement is part of the differentiation: real stories, relevant offers and good presentation, rather than interchangeable AI fitness graphics.

## Data stitching — the strategic differentiator

This is the **sites → rails → network** thesis applied to gyms.

Potential journey:

**Race-tool use → coach community → session booking → race participation → purchase → gym membership.**

If these actions connect to the same consented athlete identity, useful context can carry across the journey instead of every enquiry being treated as a stranger.

### Within one gym

Join campaign source, enquiries, booking, attendance, membership and retention to answer:

- Which offers bring members who stay?
- Which sessions turn beginners into regulars?
- Should the gym acquire more people, or follow up with those already interested?

This is valuable, but competitors already offer parts of it. Joining advertising to membership data alone does not make Station 9 unique.

### Across participating coaches and gyms

Branded sites become entry points into an athlete ecosystem. Tools and community give athletes reasons to return between purchases. With the right permissions, identity and relevant context can connect participating services.

Example: an athlete chooses to share their race target and training preferences when enquiring about a participating gym, rather than starting again.

The potential is to create demand and relevant introductions, not merely process leads bought from Meta. This is a hypothesis, not a proven network advantage.

### What has to be true before claiming a moat

- Enough coaches and gyms participate.
- Athletes actually use the tools.
- Identity matching and event data are reliable and useful.
- Permissions, tenant boundaries and coach ownership are respected.
- Better conversion, attendance or retention is demonstrated.

**A shared database is infrastructure. A useful, active network is the advantage.**

Use central athlete identity, tenant attribution and source tracking as discussed in BILLIONS.md, but do not claim all of this is already implemented or operating end-to-end. This discussion did not audit the codebase to establish that.

### Ownership and consent

- Coaches retain their client relationships; no quiet pooling of one coach's clients for another gym's advertising.
- Cross-business sharing must be explicit, optional and appropriate to the purpose.
- Respect access boundaries, deletion and opt-out requests.
- Training or health information must not become advertising-targeting material.
- Tracking and messaging need the applicable consent and privacy handling; connecting data does not remove those obligations.

## Existing competitors — checked during this discussion

These are providers' published offers and prices, not independent validation of their results. Recheck before using them in a pitch; software, managed service and advertising spend are not interchangeable price comparisons.

| Provider | Published offering | Published pricing at research |
|---|---|---|
| [Stronger Systems](https://stronger.systems/) | UK group-training gyms; HighLevel-based landing pages, AI WhatsApp, bookings, conversion journeys, reactivation and booking-software connections. Higher tier adds managed ads, copy and creative. | Engine £269/month including VAT, plus £1,800 setup. Fuel £969/month including VAT, setup waived, six-month initial term; ad spend extra. Usage charges also apply. |
| [GymGlitch](https://gymglitch.ai/features) | UK clubs; lead capture, automated conversations, booking and follow-up. Managed Meta/Google ads, landing pages and membership-outcome tracking in the higher tier. | Full-service marketing advertised at £697/month; verify full terms and exclusions before comparison. |
| [Pilotium](https://pilotium.cc/en/) | Advertises fitness-specific AI creative, campaign launching, optimisation and WhatsApp follow-up. | Advertises entry pricing from €79/month. Do not assume the entire service or advertising spend is included at that price. |
| [Gym Launch / ABC Fitness](https://abcfitness.com/partners/gymlaunch/) | Managed Facebook/Instagram campaigns, lead follow-up and sales support for gyms. | Not verified here. |
| [Loud Rumor](https://www.loudrumor.com/gym-marketing-program/) | Gym marketing strategy, acquisition and conversion services. | Not verified here. |

Conclusion: active acquisition systems are an established category. “AI ads plus follow-up” is not novel by itself. Station 9's potential distinction is the branded athlete platform, ongoing community utility and consented connected journeys.

## Recommended first gym pilot

Prove one full journey with one gym and one offer, rather than build the entire suite first.

1. Confirm the offer, capacity, consent, assets and responsibility for replying.
2. Create ad drafts, matching landing page and a short follow-up sequence.
3. Keep owner approval and manual publishing initially; set a real budget.
4. Track enquiry → booking → attendance → paid membership, plus retention when enough time has passed.
5. Measure actual software costs, support effort and results before setting subscription prices.
6. Automate publishing and budget optimisation only after a working connection and measurable benefit are demonstrated.

The hard parts are booking/membership integrations, accurate attribution, ad-account access, reliable data and campaigns that spend without converting—not generating ten variants of copy.

Do not start a gym marketing build merely because this file exists. Return to it when Chris explicitly starts the gym builds and pitches phase.
