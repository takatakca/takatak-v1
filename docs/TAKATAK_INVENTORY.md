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

## Owned wraparound label studio

The permission-gated `/dashboard/inventory/quebec` page provides the sourced French honey-sale preparation dossier and blank register templates. The MIEL AISSA preset enables nine per-product evidence-reference sections saved in the existing JSON layout. Missing references, a non-mass honey quantity or a missing distribution lot keep the label in draft. Product metadata edits reset review statuses while retaining references. These are owner-maintained preparation records, not a legal approval engine or a complete lot-traceability database. The separate register templates must be completed and retained with source documents; the current 100-movement stock view does not supply the legal upstream/downstream trail. See [the Québec dossier](MIEL_AISSA_REQUIS_QUEBEC.md).

The PDF, XLSX and ZIP snapshots in `public/inventory` are generated from that Markdown dossier, `docs/inventory-quebec-templates` and the typed requirements catalog. To update these documentation artifacts, use `python3 scripts/build-inventory-quebec-dossier.py` with the development tools `reportlab`, `openpyxl` and the installed npm dependencies. Python is not part of the application runtime. Update the source-review date when rechecking the official requirements.

Hexagonal jars are supported through saved jar-shape and flat-face measurements. The renderer refuses an unmeasured hexagonal face or a complete barcode that cannot fit the entered flat width, including white space and an extra 2 mm application allowance on each side. Ladder orientation also rotates internal Code 39 labels in this mode. The user centres the symbol on the actual flat face during application; this does not map all folds or certify optical quality. Existing saved layouts without these fields retain their round-jar behaviour. See [the MIEL AISSA hexagonal jar guide](MIEL_AISSA_HEX_JAR.md) for the owner’s 288 mL screenshot reference and measurements still needed.

Open `/dashboard/inventory/labels` or choose **Label studio** on a product. The owner-supplied MIEL AISSA preset includes its name, website, address and “Produit du Québec” wording. Product-specific layouts persist in the workspace database, behind existing inventory permissions. General inventory listings omit artwork; the studio fetches one scoped product/layout at a time. Editing product metadata resets the saved GS1/text review attestations.

The studio generates vector PDFs locally in the browser with pdf-lib; no hosted label service or recurring EDI account is required. Letter/A4 sheets include crop marks; roll output rotates a long wrap along the feed direction and enforces a 104 mm cross-feed limit. Actual driver/media length support still must be confirmed for the chosen printer. Dimensions are in millimetres, print quantity is 1–100, and the output must be printed at 100% / Actual size.

Barcode modules align to whole dots for the selected 203/300/600 DPI profile. Retail EAN/UPC artwork retains quiet zones and proportional bar height, and offers ladder orientation for round jars. Text overflow and undersized layouts block export rather than clipping text or compressing bars. An exact-match scanner test recognizes equivalent UPC-A/EAN-13 input and internal SKUs.

A draft banner remains until the owner checklist is complete. The app checks a GTIN check digit, not GS1 ownership, food-label compliance, retailer acceptance or physical barcode quality. It can embed an approved PNG/JPEG Nutrition Facts panel at an explicit physical width or record a reviewed exemption; it does not calculate nutrition facts or determine exemptions. Optional grade/colour/origin wording is supplied and reviewed by the business. No retailer GTIN was assigned to MIEL AISSA from this session.

Additional migration: `20261020154310_inventory_label_layout` adds the product JSON layout field; existing inventory RLS/grants apply to it. It was applied only to the disposable local database. Tests cover persisted tenant-scoped layouts, metadata review invalidation, PDF dimensions/rotation/copies, overflow, and scan matching. Generated barcode test PDFs were rasterized and decoded in software at 203/300/600 DPI profiles in both orientations; physical jar/scanner testing remains outstanding.

See [MIEL AISSA’s practical start guide](MIEL_AISSA_START_HERE.md) for registration, measured-label setup, equipment prices and retailer starting points. `npm run qa:inventory-labels` runs PDF/geometry tests; optional `INVENTORY_LABEL_ARTIFACTS` writes local fixtures. Test GTINs in generated QA files are never assigned to the business. The shared public proof uses an internal SKU and clearly marks its example size as draft.

## Retail EDI reference

The owner-provided Orderful reference is assessed in [Retail EDI for TAKATAK Inventory](TAKATAK_INVENTORY_RETAIL_EDI.md). It maps purchase orders, shipments, invoices, packaging and traceability gaps for future work. The owner clarified that this must be an owned solution. Orderful is background research only; the implementation has no Orderful dependency or account. EDI is a separate future requirement only when a buyer requests it.

## Remaining scope

No expiry tracking, per-lot balances, recalls, recipe depletion, purchasing, warehouse/location allocation, retailer connectors, fractional units or inventory billing entitlement are implemented. Existing workspace permission grants determine module access; it is not activated as a separately billed service. New inventory models restrict parent deletion to preserve ledger history; archive businesses instead of deleting them while inventory exists. No inventory-specific delete endpoint exists.
