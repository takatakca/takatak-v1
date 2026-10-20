# TAKATAK Inventory — native V1 module

Route: `/dashboard/inventory`. Navigation: **Clients & Services → Inventory**.

This implements inventory inside the existing Next.js application. It uses the existing Supabase session, active Client workspace, effective permissions, BusinessBrand records, Prisma/PostgreSQL connection and audit log. There is no second owner password, SQLite database, or embedded external application. The earlier standalone Python pilot is not imported and its demo data is not seeded into V1.

## Product workflow

1. Select the intended client workspace using the existing dashboard selector.
2. Create a business in Businesses / Brands if necessary.
3. Open Inventory, select a business, and add a product: name, SKU, honey type/category, package size, ingredients, CAD selling price, optional retail UPC/EAN and low stock threshold.
4. Products start at zero stock. Use **± Stock** to receive units or record opening stock with a reason and optional lot reference. Negative changes remove units; scanning alone never changes stock.
5. Focus search and scan with a keyboard-emulating USB/Bluetooth scanner. Enable Code 39 on the scanner for internal SKU labels. UPC scans match the equivalent stored leading-zero EAN-13.
6. Use **Label** to open a printable barcode and **Export CSV** for the selected business catalog.

The module supports products beyond honey. Quantities are whole packaged units, not fractional recipe ingredients or weight-based stock. Price is CAD only. Catalogs are limited to 5,000 displayed products per workspace; exceeding that limit fails explicitly rather than producing incomplete totals or exports. The activity tab shows the latest 100 movements workspace-wide, then filters that window by business. It is not a complete movement-history export.

## Permissions and tenant boundaries

- `view_inventory`: list/search products and movement history; print labels; export the visible catalog. Included in all standard workspace roles.
- `manage_inventory`: create/edit products and receive/remove units. Included for owner/admin/manager; not editor/staff/viewer. Existing custom-role, override and denied-permission handling still applies.
- Every API route derives `clientId` from `requireWorkspaceApiPermission`. Browser-supplied workspace IDs are never used.
- Product writes verify the brand belongs to that client and is not archived. Edits cannot move products between brands. Metadata editing cannot change stock quantity.
- Composite database foreign keys bind each product to its brand and tenant, and each movement to its product and tenant.
- Stock bounds are evaluated in one conditional `UPDATE` against current stock, followed by movement + audit creation in the same transaction. Two competing withdrawals cannot oversell.
- A client-generated UUID identifies each stock request. Repeating the same payload returns the existing movement; concurrent duplicates roll back their extra update. Reusing that ID for another payload is rejected. On an ambiguous network result, retry the unchanged adjustment before closing its dialog; closing starts a new request.
- Inventory tables have RLS enabled and PUBLIC/anon/authenticated privileges revoked. Only the existing privileged server database connection accesses them. No browser Data API grants or permissive policies are added.
- Writes use the existing JSON/origin guard. Foundation mode cannot read or mutate real inventory; it redirects to the dashboard or returns the existing unavailable response. No fake inventory appears in production.

## Retail barcode requirements

Internal Code 39 SKUs are not GS1 product identifiers. Obtain legitimate GS1 GTINs for each retail product and package size. This version accepts UPC-A (12 digits) and EAN-13 (13 digits), validates the check digit, and normalizes UPC-A to the equivalent leading-zero EAN-13. A check digit does not establish ownership or retailer approval. A GTIN is unique within the workspace; SKU is unique within the business.

Super C, Maxi, Walmart and other stores require supplier onboarding and product data submissions. The barcode identifies the product; it does not embed ingredients or stock. There is no retailer/POS synchronization in this release.

Labels retain quiet zones and use nominal 0.33 mm EAN modules / 0.25 mm Code 39 narrow elements. Print at actual size; long internal SKUs need wider stock/printers. Physical print quality and scanner verification are still required. Barcode artwork tests do not certify printed label quality. This is not a compliant nutrition/ingredient packaging-label generator.

## Migration and Contabo

Migration: `prisma/migrations/20261020152736_takatak_inventory/migration.sql`. It creates only inventory tables, constraints, indexes and access restrictions. It does not change customer records, seed inventory, grant browser access or configure another database.

The migration has been applied and tested only on a disposable local PostgreSQL 17 database. No hosted Supabase project, Contabo server, DNS or Coolify deployment was changed. The release coordinator must review/approve the migration through the repository's existing deployment process; this branch does **not** edit approved migration lists.

Run V1 through its existing Contabo/Coolify deployment. The module requires no separate service, exposed port or new credentials. Its data uses V1's configured PostgreSQL `DATABASE_URL`; if that points to hosted Supabase, the data remains there. Moving database storage onto Contabo is a separate infrastructure decision and has not been performed.

## Validation

```sh
npm run db:generate
npm run typecheck
npm run lint
npm run qa:access
npm run test:auth
npm run qa:inventory
npm run qa:inventory-db
npm run qa:rls:static
npm run build
```

`qa:inventory-db` refuses non-loopback databases. It requires the existing V1 schema plus this migration on a disposable PostgreSQL database with Supabase-compatible anon/authenticated roles. It creates synthetic clients, brands, products and an actor profile and removes those fixtures afterward. Checks include cross-tenant reads/writes, duplicate GTIN/SKU, stock bounds, competing sales, duplicate request replay, preserved quantity during edits, atomic ledger/audit records, composite foreign keys, RLS and denied Data API grants.

Browser checks were also run on the actual React component with a temporary fixture transport: product creation/editing, stock adjustment, scanner search, label popup, CSV download, activity, mobile layout and read-only controls. This is component verification, not a live Supabase sign-in E2E or a physical scanner test. CI now runs both inventory scripts alongside the existing access and database suites.

## Remaining scope

No expiry tracking, per-lot balances, recalls, recipe depletion, purchasing, warehouse/location allocation, retailer connectors, fractional units or inventory billing entitlement are implemented. Existing workspace permission grants determine module access; it is not activated as a separately billed service. New inventory models restrict parent deletion to preserve ledger history; archive businesses instead of deleting them while inventory exists. No inventory-specific delete endpoint exists.
