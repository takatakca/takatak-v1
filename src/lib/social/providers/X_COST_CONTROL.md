# X API cost control

X OAuth connection remains available, but every billable X read or write must
pass through `x-cost-control.ts` before a provider request is added.

Production requirements:

- `X_PAID_API_ENABLED` must remain unset/false until the prepaid balance and
  internal monthly budget are approved.
- Every company/brand/account/operation emits `createXCostAuditEvent(...)` to
  the structured application log before the request.
- The caller supplies the current monthly spend and a strictly positive cap;
  the guard fails closed when either activation or budget is missing.
- Writes require a durable idempotency key. The publishing repository must
  claim that key uniquely before calling X and reuse the stored result on retry.
- Profile responses are cached for 24 hours and post reads for 15 minutes.
- URL publications use the distinct `post.create_with_url` operation. Its
  estimated catalog cost is intentionally separate and must be revalidated
  against X's console before enabling production or changing customer prices.

The catalog uses USD micros to avoid floating-point rounding. It is an internal
estimate for guardrails and customer cost attribution, not an invoice from X.
Update the catalog version and tests whenever X changes its official pricing.

No test in this module sends an X request or needs an access token.
