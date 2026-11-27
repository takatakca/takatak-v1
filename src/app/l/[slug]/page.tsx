import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { normalizeSmartLinkSlug } from "@/lib/social/smartlinks/policy";
import { countSmartLinkEvent, getPublishedSmartLink } from "@/lib/social/smartlinks/store";

export const dynamic = "force-dynamic";

// Public SmartLink page (link in bio): the brand's title, a short text and its
// buttons. Each button goes through /l/<slug>/go/<button> to be counted.

type Props = { params: Promise<{ slug: string }> };

async function load(raw: string) {
  const slug = normalizeSmartLinkSlug(raw);
  if (!slug || slug !== raw) return null;
  return getPublishedSmartLink(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const link = await load((await params).slug);
  if (!link) return { title: "TAKATAK", robots: { index: false, follow: false } };
  return {
    title: { absolute: `${link.title} · ${link.brandName}` },
    description: link.bio || link.title,
  };
}

export default async function SmartLinkPage({ params }: Props) {
  const link = await load((await params).slug);
  if (!link) notFound();

  const h = await headers();
  const prefetch = h.get("next-router-prefetch") || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch");
  if (!prefetch) await countSmartLinkEvent({ smartLinkId: link.id, clientId: link.clientId, buttonId: null });

  return (
    <main className="flex min-h-screen items-start justify-center bg-[#07111f] px-4 py-12 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1d6bff] text-2xl font-bold" aria-hidden>
          {link.brandName.slice(0, 1).toUpperCase()}
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{link.title}</h1>
        {link.bio ? <p className="mt-2 text-sm leading-6 text-white/70">{link.bio}</p> : null}
        <ul className="mt-8 space-y-3">
          {link.buttons.map((button) => (
            <li key={button.id}>
              <a
                href={`/l/${link.slug}/go/${button.id}`}
                rel="nofollow noopener"
                className="block w-full rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-4 text-sm font-semibold transition hover:border-[#1d6bff] hover:bg-[#1d6bff]/20"
              >
                {button.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-[11px] text-white/40">
          <Link href="/" className="hover:text-white/70">
            Créé avec TAKATAK · Made with TAKATAK
          </Link>
        </p>
      </div>
    </main>
  );
}
