export const ONE_LV_EVENTS = [
  "customer.created",
  "customer.updated",
  "merchant.application.created",
  "merchant.approved",
  "merchant.suspended",
  "merchant.updated",
  "customer.vendor.first_order",
  "customer.vendor.order_completed",
  "customer.vendor.dispute_opened",
  "order.created",
  "order.paid",
  "order.fulfilled",
  "order.refunded",
] as const;

export type OneLvEventType = (typeof ONE_LV_EVENTS)[number];
export type OneLvAggregateType = "customer" | "merchant" | "order" | "relationship";

export type OneLvEnvelope = {
  event_id: string;
  event_type: OneLvEventType;
  aggregate_type: OneLvAggregateType;
  aggregate_id: string;
  source_application: "1lv";
  payload: Record<string, unknown>;
};
