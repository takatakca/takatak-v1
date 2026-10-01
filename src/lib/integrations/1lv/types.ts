export const ONELV_SOURCE_APPLICATION = "1LV" as const;

export type OneLvEventType =
  | "customer.created"
  | "customer.updated"
  | "merchant.application.created"
  | "merchant.approved"
  | "merchant.suspended"
  | "merchant.updated"
  | "customer.vendor.first_order"
  | "customer.vendor.order_completed"
  | "customer.vendor.dispute_opened"
  | "order.created"
  | "order.paid"
  | "order.fulfilled"
  | "order.refunded";

export type OneLvAggregateType =
  | "customer"
  | "merchant"
  | "order"
  | "relationship";

export type OneLvEvent = {
  event_id: string;
  event_type: OneLvEventType;
  aggregate_type: OneLvAggregateType;
  aggregate_id: string;
  source_application: "1lv";
  payload: Record<string, unknown>;
};
