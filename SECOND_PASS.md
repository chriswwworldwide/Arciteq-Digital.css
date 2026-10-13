# Second-pass review brief

Paste this into a fresh Devin session started with `devin --model opus`.

---

You are doing a read-only review pass on `/Users/chri/Desktop/roxjaya` — a multi-tenant Node/Express platform (gym/community sites + an ecommerce layer). Do NOT edit any files. Output a findings list only, each item with `file:line` and ranked by risk (high/medium/low).

Focus areas, in priority order:

1. **`server.js` (231KB monolith)** — the primary target:
   - Dead routes: endpoints no HTML/JS file or doc references. Verify before flagging — check `grep` across all tenant dirs, not just root.
   - Duplicated logic that should be shared (there is a known history of copy-paste growth; e.g., multiple near-identical admin GET endpoints).
   - Webhook correctness: paths that can throw *before* the `stripeEventId` idempotency write, causing unprocessed Stripe retries to re-run side effects. The webhook handler starts near the top of the file.
   - Split candidates: cohesive groups of functions/routes that could become modules (email layer, admin routes, webhook handler, receptionist). Sketch the module boundary, don't implement.

2. **Webhook/event integrity** — `charge.refunded`, `checkout.session.*`, `invoice.*`, `payment_intent.payment_failed` handlers: any path where an order state transition can be missed, double-applied, or race a retry.

3. **Multi-tenant leakage** — anywhere a query or file read could cross tenant boundaries unintentionally (missing `tenant_id` scoping, `resolveTenantFromRequest` bypasses).

4. **Data layer** — migrations 001–012 vs live queries: columns referenced in code that no migration creates, missing indexes on hot paths (`orders`, `email_events`, `inventory_movements`).

5. **Anything that would embarrass us in front of a paying tenant** — correctness bugs > style nits. Skip formatting entirely; prettier owns that.

Skip: `node_modules/`, `coverage/`, `archive/`, generated tenant copies beyond one representative file (`roxjaya/` is the source tenant — review it, don't re-review all 11 generated copies).

End with a short "top 5 fixes to do first" summary.
