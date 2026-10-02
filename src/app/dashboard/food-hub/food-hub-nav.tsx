'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type FoodHubNavGroup = { title: string; links: Array<{ href: string; label: string }> };

export default function FoodHubNav({ groups }: { groups: FoodHubNavGroup[] }) {
  const path = usePathname();
  const active = (href: string) =>
    href === '/dashboard/food-hub' ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <nav className="fh-subnav no-print" aria-label="Food Hub">
      {groups.map((g) => (
        <div key={g.title} className="fh-subnav-group">
          <span className="fh-subnav-title">{g.title}</span>
          {g.links.map((l) => (
            <Link key={l.href} href={l.href} className={active(l.href) ? 'on' : ''} aria-current={active(l.href) ? 'page' : undefined}>{l.label}</Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
