// Food Hub permissions. Who someone is comes from the TAKATAK session
// (src/lib/food-hub/access.ts); this file only says what each role may do.
import type { RoleKey } from '@/lib/security/roles';
import type { Role } from './types';

// ---------- Roles (Atlas standard roles, simplified to what a multi-brand restaurant group needs) ----------

export type Permission =
  | 'view'            // Command Center, order board
  | 'orders:act'      // accept / reject / ready / cancel / print
  | 'stores:toggle'   // pause / resume, busy mode
  | 'items:toggle'    // 86 items and modifiers
  | 'menu:edit'       // menus, prices, hours, publish
  | 'stores:map'      // store mappings, Uber store activation
  | 'analytics:view'  // analytics, reports, activity log, payouts & reconciliation (read)
  | 'finance:edit'    // statement imports, commission settings, disputes, deposits, ledger approval
  | 'admin';          // users, brands/locations, secrets, report schedules

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ['view', 'orders:act', 'stores:toggle', 'items:toggle', 'menu:edit', 'stores:map', 'analytics:view', 'finance:edit', 'admin'],
  manager: ['view', 'orders:act', 'stores:toggle', 'items:toggle', 'menu:edit', 'stores:map', 'analytics:view', 'finance:edit'],
  operator: ['view', 'orders:act', 'stores:toggle', 'items:toggle'],
  menu: ['view', 'items:toggle', 'menu:edit'],
  analyst: ['view', 'analytics:view'],
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner — everything',
  manager: 'Manager — operations, menus, stores, analytics',
  operator: 'Store operator — orders, 86, pause',
  menu: 'Menu editor — menus, prices, hours, 86',
  analyst: 'Analyst — analytics and reports (read-only)',
};

export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

/** TAKATAK workspace role (Team & Permissions) → Food Hub role. */
export const WORKSPACE_ROLE_TO_FOOD_HUB: Record<RoleKey, Role> = {
  owner: 'owner',
  admin: 'owner',
  manager: 'manager',
  editor: 'menu',
  staff: 'operator',
  viewer: 'analyst',
};

/** Location scope: [] = everything. */
export function inScope(actor: { locations: string[] }, locationCode?: string | null): boolean {
  return actor.locations.length === 0 || (!!locationCode && actor.locations.includes(locationCode));
}

export function scopeFilter(actor: { locations: string[] }, requested?: string[]): string[] | undefined {
  if (actor.locations.length === 0) return requested?.length ? requested : undefined;
  const allowed = requested?.length ? requested.filter((c) => actor.locations.includes(c)) : actor.locations;
  return allowed.length ? allowed : ['__none__'];
}
