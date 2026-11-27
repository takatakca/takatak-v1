# Per-brand access for team members

Owner's decision of 2026-11-27: a workspace owner can limit a team member to some
of the workspace's brands. The code ships first. The migration is applied later, by
the owner.

## Rules

- **The default is every brand.** If no brand is stored for a member, that member
  sees every brand of the workspace, as before.
- **Owners and admins always see every brand.** They cannot be limited.
- **A limited member keeps at least one brand.** Selecting every brand stores
  nothing, which brings back the default.
- **Who can change a member's brands.** The person needs all of these:
  - the `manage_permissions` permission;
  - a plan that includes team management;
  - access to every brand themselves.
- **Who cannot be changed.** Nobody can change their own brands, or the brands of a
  member with a higher role.
- **Audit log.** Every change is written to the audit log as
  `workspace_member_brands_changed`.

## Where the limit applies

- **Brand selector** (top bar and `/api/social/brand-selector`). A limited member
  only sees their brands. A saved brand cookie that points to another brand is
  cleared.
- **Brand switch** (`setActiveBrand`). A limited member cannot switch to a brand
  outside their list.
- **Brand lists and pages.** These answer "not found" for brands outside the list:
  - `/dashboard/brands` and `/dashboard/brands/<id>`;
  - the brand options in the Locations screens;
  - Social → Brands → Settings.
- **Routes that receive a brand id.** These answer `404` for a brand outside the list:
  - brand settings and AI instructions;
  - website, blog and Bluesky connections;
  - the social OAuth start;
  - the social connections list;
  - creating an analytics site or a chat widget.
- **Routes that receive a social connection id.** These check the connection's brand:
  - disconnect;
  - sync;
  - cancel a pending connection;
  - capabilities.
- **Pages that read the active brand** use the filtered brand selector, so they
  follow the same limit.

## Activation

- **Migration** `prisma/migrations/20261127080000_member_brand_access` creates
  `client_membership_brand_access`. The table is server-only: row-level security is
  on, and access is revoked from `PUBLIC`, `anon` and `authenticated`.
- **It is not on the production deploy list.**
- **Until it is applied, nothing changes:**
  - every member keeps every brand;
  - the switches in the member access window stay on and read-only, with the
    message "L’accès par marque sera activé bientôt".
- **If the check itself fails** (a database error other than the missing table),
  the member gets no brand at all. This fails closed.

## Code

- **Rules (pure, tested):** `src/lib/security/brand-access-policy.ts`.
- **Server reads and writes:** `src/lib/security/member-brand-access.ts`.
- **Team API:** `PUT /api/team/members/<membershipId>/brands`, with body
  `{ "brandIds": [...] }`.
- **Switches:** `src/components/team/member-access-modal.tsx`.
- **Checks:** `npm run qa:member-brand-access`, which runs in CI.
