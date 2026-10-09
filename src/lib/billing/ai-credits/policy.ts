// AI credit purchases — pure Stripe session policy (no I/O; safe for QA).
// A paid Checkout Session grants credits only if every field matches the
// server-side pack catalog, so a tampered or stale session can never mint credits.

import { AI_CREDIT_PACKS } from "@/lib/growth/ai-engine";

export const AI_CREDITS_BILLING_DOMAIN = "ai_credits";

export interface CreditSessionLike {
  id: string;
  mode?: string | null;
  payment_status?: string | null;
  currency?: string | null;
  amount_total?: number | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}

export type CreditGrantDecision =
  | { grant: true; clientId: string; credits: number; packKey: string; idempotencyKey: string }
  | { grant: false; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function packPriceCents(packKey: string): number | null {
  const pack = AI_CREDIT_PACKS.find((p) => p.key === packKey);
  return pack ? Math.round(pack.priceCad * 100) : null;
}

export function decideCreditGrant(session: CreditSessionLike): CreditGrantDecision {
  const meta = session.metadata ?? {};
  if (meta.billingDomain !== AI_CREDITS_BILLING_DOMAIN) return { grant: false, reason: "not_ai_credits" };
  if (session.mode !== "payment") return { grant: false, reason: "not_one_time_payment" };
  if (session.payment_status !== "paid") return { grant: false, reason: "not_paid" };
  const pack = AI_CREDIT_PACKS.find((p) => p.key === meta.packKey);
  if (!pack) return { grant: false, reason: "unknown_pack" };
  const clientId = meta.clientId ?? "";
  if (!UUID.test(clientId) || session.client_reference_id !== clientId) return { grant: false, reason: "client_mismatch" };
  if ((session.currency ?? "").toLowerCase() !== "cad") return { grant: false, reason: "currency_mismatch" };
  if (session.amount_total !== Math.round(pack.priceCad * 100)) return { grant: false, reason: "amount_mismatch" };
  if (meta.credits !== String(pack.credits)) return { grant: false, reason: "credits_mismatch" };
  return { grant: true, clientId, credits: pack.credits, packKey: pack.key, idempotencyKey: `stripe:${session.id}` };
}
