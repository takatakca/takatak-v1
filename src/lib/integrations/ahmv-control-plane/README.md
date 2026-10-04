# TAKATAK → AHMV managed-association control contract

Backend-only preparation for the detachable AHMV control plane.

This directory intentionally does **not** add:

- a dashboard route;
- a sidebar item;
- a browser API;
- a production fetch to AHMV;
- a new billing table;
- a hard-coded price.

It prepares the TAKATAK-owned half of the server-to-server contract implemented by AHMV PR #303.

## Authority

TAKATAK remains authoritative for:

- organization/workspace identity;
- commercial subscription status;
- enabled managed services;
- actor/workspace role;
- provider connector/vault references;
- usage/credit/billing decisions.

AHMV remains authoritative for its standalone application records and official hockey-data boundaries.

## Grant

A trusted server-side association grant binds:

- organization;
- actor;
- mapped control role;
- subscription ID;
- product code;
- subscription state;
- enabled services;
- expiry.

Only `trialing`, `active` and `grace` grants are usable. Suspended/cancelled/expired grants fail closed.

The default product code is `managed_hockey_association`; callers can supply an expected configured product code when the catalog is finalized.

## Roles

TAKATAK workspace roles map conservatively:

- owner → owner;
- admin → admin;
- manager → manager;
- editor/staff → operator;
- viewer → viewer.

This avoids granting publish/delete authority merely because someone can edit ordinary dashboard content.

## Outbound envelope

`buildAhmvControlEnvelope()` validates the grant, service/action scope, IDs, idempotency key, revision and payload before producing server-only headers plus the future command body.

It does not perform a network request. A route/client is mounted only after the AHMV server endpoint, entitlement resolver and production authorization contract are explicitly connected.
