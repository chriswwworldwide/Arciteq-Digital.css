BEGIN;

-- Fulfilment is tracked alongside status, not as a status: a shipped order
-- is still a paid order for revenue, tax and account views.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfilment_tracking text;

-- Any order already moved to the short-lived 'fulfilled' status goes back
-- to 'paid' with its fulfilment time preserved.
UPDATE orders
   SET status = 'paid', fulfilled_at = COALESCE(fulfilled_at, updated_at)
 WHERE status = 'fulfilled';

-- Hot-path lookups: payment-failed / refund webhooks match by payment
-- intent; email dedup + exception sweep match by (tenant, order, type);
-- stock release + leak checks match reservations by order.
CREATE INDEX IF NOT EXISTS orders_payment_intent_idx
  ON orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_events_tenant_order_type_idx
  ON email_events (tenant_id, order_id, type)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_movements_order_idx
  ON inventory_movements (tenant_id, order_id)
  WHERE order_id IS NOT NULL;

COMMIT;
