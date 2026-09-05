import { describe, it, expect } from "vitest";
import {
  subscriptionIdFromInvoice,
  metadataFromInvoice,
  subscriptionIdFromSession,
  customerIdOf,
  priceFromSubscription,
  periodEndFromSubscription,
  isoFromUnix,
  isRenewalInvoice,
} from "../src/subscriptions.js";

describe("subscriptionIdFromInvoice", () => {
  it("reads the 2025+ parent.subscription_details shape", () => {
    expect(
      subscriptionIdFromInvoice({
        parent: { subscription_details: { subscription: "sub_new" } },
      }),
    ).toBe("sub_new");
  });
  it("falls back to the legacy invoice.subscription field (string or object)", () => {
    expect(subscriptionIdFromInvoice({ subscription: "sub_old" })).toBe(
      "sub_old",
    );
    expect(subscriptionIdFromInvoice({ subscription: { id: "sub_obj" } })).toBe(
      "sub_obj",
    );
  });
  it("returns empty for one-off invoices", () => {
    expect(subscriptionIdFromInvoice({})).toBe("");
  });
});

describe("metadataFromInvoice", () => {
  it("prefers parent.subscription_details.metadata then subscription_details.metadata", () => {
    expect(
      metadataFromInvoice({
        parent: { subscription_details: { metadata: { tenant_id: "a" } } },
        subscription_details: { metadata: { tenant_id: "b" } },
      }),
    ).toEqual({ tenant_id: "a" });
    expect(
      metadataFromInvoice({ subscription_details: { metadata: { x: 1 } } }),
    ).toEqual({ x: 1 });
    expect(metadataFromInvoice({})).toEqual({});
  });
});

describe("session + customer ids", () => {
  it("handles string and expanded objects", () => {
    expect(subscriptionIdFromSession({ subscription: "sub_1" })).toBe("sub_1");
    expect(subscriptionIdFromSession({ subscription: { id: "sub_2" } })).toBe(
      "sub_2",
    );
    expect(subscriptionIdFromSession({})).toBe("");
    expect(customerIdOf({ customer: "cus_1" })).toBe("cus_1");
    expect(customerIdOf({ customer: { id: "cus_2" } })).toBe("cus_2");
  });
});

describe("priceFromSubscription", () => {
  it("multiplies unit_amount by quantity and reads the interval", () => {
    expect(
      priceFromSubscription({
        items: {
          data: [
            {
              quantity: 2,
              price: {
                unit_amount: 59900000,
                currency: "idr",
                recurring: { interval: "month" },
              },
            },
          ],
        },
      }),
    ).toEqual({ amountMinor: 119800000, currency: "idr", interval: "month" });
  });
  it("returns nulls when there are no items", () => {
    expect(priceFromSubscription({ currency: "eur" })).toEqual({
      amountMinor: null,
      currency: "eur",
      interval: null,
    });
  });
});

describe("periods", () => {
  it("converts unix seconds to ISO and ignores junk", () => {
    expect(isoFromUnix(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
    expect(isoFromUnix(undefined)).toBeNull();
    expect(isoFromUnix("nope")).toBeNull();
  });
  it("prefers the item-level current_period_end (2025 API) over the legacy top-level one", () => {
    expect(
      periodEndFromSubscription({
        current_period_end: 1_700_000_000,
        items: { data: [{ current_period_end: 1_800_000_000 }] },
      }),
    ).toBe("2027-01-15T08:00:00.000Z");
    expect(
      periodEndFromSubscription({ current_period_end: 1_700_000_000 }),
    ).toBe("2023-11-14T22:13:20.000Z");
  });
});

describe("isRenewalInvoice", () => {
  const sub = { parent: { subscription_details: { subscription: "sub_1" } } };
  it("is true for subscription_cycle invoices", () => {
    expect(
      isRenewalInvoice({ ...sub, billing_reason: "subscription_cycle" }),
    ).toBe(true);
  });
  it("is false for the first invoice, manual invoices and one-off invoices", () => {
    expect(
      isRenewalInvoice({ ...sub, billing_reason: "subscription_create" }),
    ).toBe(false);
    expect(isRenewalInvoice({ ...sub, billing_reason: "manual" })).toBe(false);
    expect(isRenewalInvoice({ billing_reason: "subscription_cycle" })).toBe(
      false,
    );
  });
});
