import './food-hub.css';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getFoodHubAccess } from '@/lib/food-hub/access';
import { can, type Permission } from '@/lib/food-hub/session';
import ActivateButton from './activate-button';
import FoodHubNav, { type FoodHubNavGroup } from './food-hub-nav';
import KitchenShell from './kitchen-shell';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Food Hub — TAKATAK' };

// [href, label, permission, only for people who see every location]
type Entry = [string, string, Permission, boolean?];
const GROUPS: Array<[string, Entry[]]> = [
  ['Operations', [
    ['/dashboard/food-hub', 'Command Center', 'view'],
    ['/dashboard/food-hub/board', 'Order Board', 'view'],
    ['/dashboard/food-hub/orders', 'Orders', 'view'],
    ['/dashboard/food-hub/menu', 'Menus', 'menu:edit'],
    ['/dashboard/food-hub/availability', '86 Board', 'items:toggle'],
    ['/dashboard/food-hub/hours', 'Hours', 'menu:edit'],
    ['/dashboard/food-hub/stores', 'Stores', 'stores:toggle'],
    ['/dashboard/food-hub/tgtg', 'TGTG Bags', 'orders:act'],
  ]],
  ['Insights', [
    ['/dashboard/food-hub/analytics', 'Analytics', 'analytics:view'],
    ['/dashboard/food-hub/reports', 'Reports', 'analytics:view'],
    ['/dashboard/food-hub/activity', 'Activity', 'analytics:view'],
    ['/dashboard/food-hub/finance', 'Payouts & Money', 'analytics:view', true],
  ]],
  ['Setup', [
    ['/dashboard/food-hub/channels', 'Channels', 'stores:map'],
    ['/dashboard/food-hub/business', 'Brands & Locations', 'admin'],
    ['/dashboard/food-hub/users', 'Users & Roles', 'admin'],
    ['/dashboard/food-hub/go-live', 'Go-Live', 'stores:map'],
  ]],
];

function Gate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fh-scope">
      <div className="card fh-gate">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

// Food Hub inside the TAKATAK Dashboard: the TAKATAK session decides who you are,
// your workspace role decides what you can do (see src/lib/food-hub/access.ts).
export default async function FoodHubLayout({ children }: { children: ReactNode }) {
  const access = await getFoodHubAccess();
  if (access.state === 'signed_out') redirect('/login?next=%2Fdashboard%2Ffood-hub');
  if (access.state === 'no_workspace') redirect('/dashboard/select-client?next=%2Fdashboard%2Ffood-hub');

  if (access.state === 'not_enabled') {
    return (
      <Gate title="Activate TAKATAK Food Hub">
        <p className="small" style={{ fontSize: 14 }}>
          Food Hub connects Uber Eats, DoorDash, SkipTheDishes, Too Good To Go and Clover to one screen — orders, menus, store status and payouts.
          It runs for one TAKATAK workspace: the one that owns your restaurants. Everyone you invite to that workspace signs in with their TAKATAK account.
        </p>
        {access.canActivate ? (
          <ActivateButton workspaceName={access.workspaceName ?? 'this workspace'} />
        ) : (
          <div className="fh-banner info">
            Only the owner of the restaurants&apos; workspace can activate Food Hub (a TAKATAK platform owner, or an email listed in FOOD_HUB_OWNER_EMAILS on the server).
          </div>
        )}
      </Gate>
    );
  }
  if (access.state !== 'ok') {
    return (
      <Gate title="Food Hub">
        <p className="small" style={{ fontSize: 14 }}>{access.message}</p>
        <Link className="button" href="/dashboard/select-client?next=%2Fdashboard%2Ffood-hub">Switch workspace</Link>
      </Gate>
    );
  }

  const { actor } = access;
  const groups: FoodHubNavGroup[] = GROUPS
    .map(([title, entries]) => ({
      title,
      links: entries
        .filter(([, , perm, allLocations]) => can(actor.role, perm) && !(allLocations && actor.locations.length > 0))
        .map(([href, label]) => ({ href, label })),
    }))
    .filter((g) => g.links.length > 0);

  return (
    <div className="fh-scope">
      <KitchenShell />
      <FoodHubNav groups={groups} />
      {children}
    </div>
  );
}
