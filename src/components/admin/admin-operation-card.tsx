import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

export function AdminOperationCard({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: LucideIcon }) {
  return (
    <Link href={href} className="group block">
      <Card>
        <CardBody className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-semibold text-slate-900">
              {title}
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
