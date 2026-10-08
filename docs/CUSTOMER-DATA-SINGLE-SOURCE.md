# Customer Data Single Source of Truth

Status: architecture decision proposed for review on 2026-10-08.

## Decision

TAKATAK's production database is the system of record for identities, tenants, customer profiles, reservations, interactions, source evidence, and future customer registrations.

GitHub repositories store code, migrations, schemas, integration contracts, and operational notes. They must not store customer PII or bulk customer datasets.

Promo Havana is a TAKATAK tenant/integration, not a separate customer-data authority.

## Data ownership

- `profiles` / `master_identities`: people who authenticate to TAKATAK.
- `clients`: TAKATAK workspaces/tenants.
- `client_memberships`: which authenticated users may access a workspace.
- `business_brands`: brands operated by a client.
- `customer_profiles`: end-customers owned by a TAKATAK client.
- `customer_reservations`: reservations linked to end-customers.
- `customer_interactions`: communication/activity history.
- `customer_source_evidence`: traceability back to source records/messages.
- `customer_import_batches`: import audit trail.

All customer tables are tenant-scoped by `clientId`.

## Promo Havana

Promo Havana should connect to TAKATAK through a server-side integration/API using its assigned TAKATAK client/workspace identity.

Promo Havana may read/write only rows belonging to its own `clientId`, subject to RLS/server authorization.

The `takatakca/promohavanaca` repository must not contain the 21k+ imported customer dataset. It should contain only the connector code, configuration contract, and documentation.

## Current state

As verified 2026-10-08:
- TAKATAK production already contains core identity/tenant tables.
- The Havana CRM tables and imported dataset currently exist in TAKATAK STAGING only.
- Staging Havana import counts: 21,083 customer profiles; 25,925 reservations; 18,663 source-evidence rows; 5,801 interactions; 1 completed import batch.
- PR #128 contains the CRM schema/UI work and remains draft.

## Required migration path

1. Review PR #128 against current `main`.
2. Reconcile the CRM schema with the production migration history.
3. Apply only the approved CRM schema to TAKATAK production.
4. Create/confirm the Promo Havana client and brand identity in production.
5. Copy the verified Havana dataset from staging into production with the production Promo Havana `clientId`.
6. Validate row counts, referential integrity, RLS, and tenant isolation.
7. Expose a narrow server-side integration contract for Promo Havana.
8. Point Promo Havana to that contract.
9. Keep staging only as a test environment, never as the permanent system of record.

No production data copy should occur until the schema review and access model are approved.

## Registration rule

Any future TAKATAK signup follows the same identity control plane. A login identity is not automatically an end-customer record. When a product/business needs that person as a customer, link/create a tenant-scoped `customer_profile` while retaining the global TAKATAK identity separately.

This prevents one person's identity from being duplicated across every TAKATAK business while still keeping each business's customer data isolated.

## Agent continuity rule

Before changing customer-data architecture:
1. Read `AGENTS.md`.
2. Read the top of `WORKLOG.md`.
3. Read this document.
4. Read open PR titles, especially customer/auth/data work.
5. Claim work in `WORKLOG.md`.
6. Never push directly to `main`; use a branch and PR.
7. Before stopping, update `WORKLOG.md` with status and next step.
8. If this architecture changes, update this document in the same PR.

The database is the source of truth for customer data; GitHub notes are the source of truth for implementation intent and history.
