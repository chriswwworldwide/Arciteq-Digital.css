# Chassis — neutral tenant base (agreed direction)

Decided: new tenants should be generated from a neutral "chassis" source
instead of patching the previous tenant (the Dina→Gregor→Josh inheritance
chain). Agreed approach and rationale below.

## Plan

1. Keep `joshharrison/` untouched — it's a live demo and the regression
   reference for the chassis.
2. Fork the generated `joshharrison/` folder into `chassis/` (most complete
   feature set, already fully English and pronoun-consistent).
3. Tokenise persona values mechanically: `{{COACH}}`, `{{BRAND}}`,
   `{{CITY}}`, `{{IG_HANDLE}}`, `{{ACCENT}}` etc. Verification: `grep -ri
   josh chassis/` must return zero hits.
4. Empty `images/` + a `REQUIRED.md` contract: fixed slot names (hero.jpg,
   story.jpg, coach.jpg + optional extras) so authored pages never change.
5. Then a full code review for dead machinery (WhatsApp deep-links,
   gender-reveal remnants, unused JS, styles.css + guide.css split,
   duplicated footer markup).

## Generator decision (agreed)

Add a slim "chassis mode" branch to `reskin-tenant.js`
(`if (cfg.mode === "chassis")`): token substitution + asset copy + menu
injection + feature toggles only — skip the regex pair engine entirely.
The old pair path stays for roxjaya/racetoframe/joshharrison so they keep
regenerating identically.

- Chassis configs become ~30 lines of token values, not ~600 lines of
  regex patches.
- Unfilled tokens fail loudly (visible `{{TOKEN}}`); missed regex pairs
  fail silently (inherited persona text) — that's the main bug class
  this removes.
- Keep feature copy authored-but-neutral (no lorem ipsum); persona voice
  is filled per tenant and is the part we actually sell.

## Hero system lesson (learned on Josh, Oct 16)

The hero has THREE layers that each compute where the photo sits
independently: CSS (`hero--bleed`/`hero--full`), `app.js`'s runtime feather
mask (contain-math hardcoded — must skip `.hero--full`), and `emerge.js`'s
baked composite (has its own hardcoded gradient literals, ignores CSS
filters). Changing one without the others produces silent mismatches —
Josh's pillarbox was exactly this. In the chassis, collapse this into one
"hero mode" contract (ambient | full) that all three layers read from the
same flag, and treat bake gradient/scrim strength as a single token.

## Status

- [x] Direction agreed
- [ ] joshharrison/ browser review by user (in progress)
- [ ] Fork to chassis/ + tokenise
- [ ] Image contract + REQUIRED.md
- [ ] Code review pass
- [ ] Chassis mode in reskin-tenant.js
- [ ] Regenerate a test tenant and diff-compare against a hand-built demo
