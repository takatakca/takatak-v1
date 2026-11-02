import "server-only";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/social/stripe-client";
import { ensureSocialStripeCustomer } from "@/lib/billing/social/stripe-service";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";
import { MONITORING_BILLING_DOMAIN, MONITORING_PATH, MONITORING_PRICE_CENTS, monitoringDomainWhere, monitoringEntitled, record } from "./policy";
import { monitoringDb, updateMonitoringMetadata } from "./store";

export function monitoringBillingEnabled() {
  return process.env.MONITORING_BILLING_ENABLED === "true" && Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.MONITORING_SYNC_KEYS);
}

export async function startMonitoringCheckout(clientId: string, domainId: string, accepted: boolean) {
  if (!accepted) throw new ServiceError("invalid_input", "Confirm the recurring price and service terms.");
  if (!monitoringBillingEnabled()) throw new ServiceError("unavailable", "Monitoring enrollment is not open yet.");
  const db = monitoringDb();
  const domain = await db.domainAsset.findFirst({ where: monitoringDomainWhere(clientId, domainId), select: { domainName: true, metadata: true } });
  if (!domain) throw new ServiceError("not_found", "Website not found in this workspace.");
  // A sync grant is required before selling checks for this particular website.
  let grants: Record<string, unknown> = {};
  try { grants = record(JSON.parse(process.env.MONITORING_SYNC_KEYS ?? "{}")); } catch { /* unavailable below */ }
  if (!/^[0-9a-f]{64}$/.test(String(grants[domainId] ?? ""))) throw new ServiceError("unavailable", "Contact support to prepare monitoring for this website before subscribing.");
  const token = randomUUID();
  const now = Date.now();
  const priorCheckout = record(record(domain.metadata).monitoringCheckout);
  let expiredToken: unknown = null;
  if (priorCheckout.token && typeof priorCheckout.expiresAt === "number" && priorCheckout.expiresAt <= now) {
    // An old completed session may have a delayed webhook. Expiry alone never permits a second charge.
    if (typeof priorCheckout.sessionId !== "string") throw new ServiceError("conflict", "A previous checkout needs support reconciliation before retrying.");
    const previousSession = await getStripe().checkout.sessions.retrieve(priorCheckout.sessionId);
    if (previousSession.status !== "expired") throw new ServiceError("conflict", "The previous checkout is still open or awaiting payment confirmation.");
    expiredToken = priorCheckout.token;
  }
  // CAS reservation precedes external checkout creation. Concurrent requests cannot create two subscriptions.
  await updateMonitoringMetadata(clientId, domainId, meta => {
    const billing = record(meta.monitoringBilling), checkout = record(meta.monitoringCheckout);
    if (monitoringEntitled(billing) || (billing.subscriptionId && !["canceled", "incomplete_expired"].includes(String(billing.status)))) {
      throw new ServiceError("conflict", "This website already has a monitoring subscription. Manage it through billing.");
    }
    if (checkout.token && checkout.token !== expiredToken) throw new ServiceError("conflict", "A checkout is already in progress. Complete it or wait for its expiry before retrying.");
    return { ...meta, monitoringCheckout: { token, expiresAt: now + 31 * 60000 } };
  });
  const metadata = { billingDomain: MONITORING_BILLING_DOMAIN, clientId, domainAssetId: domainId, checkoutToken: token };
  const customer = await ensureSocialStripeCustomer(clientId);
  const origin = getApplicationOrigin();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription", customer, client_reference_id: clientId,
    expires_at: Math.floor(now / 1000) + 1800,
    line_items: [{ quantity: 1, price_data: { currency: "cad", unit_amount: MONITORING_PRICE_CENTS,
      recurring: { interval: "month" }, product_data: { name: "TAKATAK Website Monitoring", description: `Website availability monitoring for ${domain.domainName}` } } }],
    metadata, subscription_data: { metadata }, billing_address_collection: "required",
    automatic_tax: { enabled: true },
    success_url: `${origin}${MONITORING_PATH}?checkout=success`, cancel_url: `${origin}${MONITORING_PATH}?checkout=canceled`,
  }, { idempotencyKey: `monitoring-checkout:${token}` });
  await updateMonitoringMetadata(clientId, domainId, current => {
    const checkout = record(current.monitoringCheckout);
    return checkout.token === token ? { ...current, monitoringCheckout: { ...checkout, sessionId: session.id } } : current;
  });
  if (!session.url) throw new ServiceError("unavailable", "Checkout could not be started.");
  return session.url;
}

export async function monitoringPortal(clientId: string, domainId: string) {
  const row = await monitoringDb().domainAsset.findFirst({ where: monitoringDomainWhere(clientId, domainId), select: { metadata: true } });
  const billing = record(record(row?.metadata).monitoringBilling);
  if (!billing.subscriptionId || typeof billing.customerId !== "string") throw new ServiceError("not_found", "No monitoring billing account was found.");
  const session = await getStripe().billingPortal.sessions.create({ customer: billing.customerId, return_url: `${getApplicationOrigin()}${MONITORING_PATH}` });
  return session.url;
}

/** Called only after the shared Stripe endpoint has verified the event signature. */
export async function applyMonitoringStripeEvent(event: Stripe.Event): Promise<boolean> {
  const object = event.data.object as unknown as Record<string, unknown>;
  let metadata = record(object.metadata);
  let subscriptionId: string | null = null;
  if (event.type.startsWith("customer.subscription.")) subscriptionId = typeof object.id === "string" ? object.id : null;
  if (event.type === "checkout.session.completed") subscriptionId = typeof object.subscription === "string" ? object.subscription : null;
  if (event.type.startsWith("invoice.")) {
    const details = record(record(object.parent).subscription_details);
    metadata = record(details.metadata);
    subscriptionId = typeof details.subscription === "string" ? details.subscription : null;
  }
  if (metadata.billingDomain !== MONITORING_BILLING_DOMAIN) return false;
  if (!subscriptionId) return true; // This module's unrelated events never reach Social billing.
  // Fetch current provider state: out-of-order/replayed events cannot restore an old paid status.
  const sub = await getStripe().subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
  const meta = sub.metadata;
  if (meta.billingDomain !== MONITORING_BILLING_DOMAIN) return true;
  const domain = await monitoringDb().domainAsset.findFirst({ where: monitoringDomainWhere(meta.clientId, meta.domainAssetId), select: { id: true } });
  if (!domain) throw new ServiceError("not_found", "Monitoring subscription website is unavailable.");
  const item = sub.items.data[0];
  const expectedPrice = sub.items.data.length === 1 && item?.quantity === 1 && item.price.currency === "cad"
    && item.price.unit_amount === MONITORING_PRICE_CENTS && item.price.recurring?.interval === "month" && item.price.recurring.interval_count === 1;
  const invoice = typeof sub.latest_invoice === "object" && sub.latest_invoice ? sub.latest_invoice : null;
  const paidUntil = expectedPrice && invoice?.status === "paid" && sub.status === "active" ? item.current_period_end : null;
  await updateMonitoringMetadata(meta.clientId, domain.id, current => {
    const previous = record(current.monitoringBilling), checkout = record(current.monitoringCheckout);
    if (checkout.token && checkout.token !== meta.checkoutToken) return current;
    if (previous.subscriptionId && previous.subscriptionId !== sub.id && checkout.token !== meta.checkoutToken) return current;
    if (!previous.subscriptionId && checkout.token !== meta.checkoutToken) throw new ServiceError("conflict", "Subscription does not match the website checkout.");
    if (previous.subscriptionId === sub.id && (Number(previous.eventCreated ?? 0) > event.created || (previous.status === "canceled" && sub.status !== "canceled"))) return current;
    return { ...current, monitoringBilling: { subscriptionId: sub.id, customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      status: sub.status, paidUntil, cancelAtPeriodEnd: sub.cancel_at_period_end, eventCreated: event.created }, monitoringCheckout: null };
  });
  return true;
}
