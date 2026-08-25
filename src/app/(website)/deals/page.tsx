import type { Metadata } from "next";
import { Tag } from "lucide-react";
import { Link } from "@/lib/website/nav";

export const metadata: Metadata = {
  title: "Today's Deals",
  description:
    "Limited-time bundles and discounts across TAKATAK services.",
};

export default function DealsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <Tag className="mx-auto text-accent" />
        <h1 className="mt-4 text-4xl font-bold text-foreground">Today&apos;s Deals</h1>
        <p className="mt-3 text-muted-foreground">
          Curated bundles across domains, hosting, websites and marketing.
        </p>
      </div>
      <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          No active promotions right now
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          TAKATAK runs seasonal deals on hosting, domains and marketplace bundles.
          Subscribe from your dashboard to be notified.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            to="/services/websites"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary/50"
          >
            Browse services
          </Link>
          <Link
            to="/marketplace"
            className="rounded-md px-4 py-2 text-sm font-medium text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-hero)" }}
          >
            Visit marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
