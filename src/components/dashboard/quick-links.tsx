import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";

/** Quick actions that all lead somewhere real (no "Coming soon" buttons). */
export function QuickLinks({
  links,
  subtitle = "Go straight to each part of this space.",
}: {
  links: ReadonlyArray<{ label: string; href: string }>;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader title="Quick Actions" subtitle={subtitle} />
      <CardBody className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-blue-50 hover:ring-blue-200"
          >
            {link.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}
