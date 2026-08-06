"use client";

import {
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";

import { ServiceThumbnail } from "@/components/website/marketplace/service-thumbnail";

const quickPicks = [
  "Logo design",
  "Website",
  "Social media",
  "Shopify store",
  "Local SEO",
  "Menu design",
];

const heroCollage = [
  {
    thumb: "website" as const,
    title: "Business website build",
    price: "$180",
    rating: "4.9",
    delivery: "5 days",
    position:
      "top-0 left-0 w-[62%] rotate-[-3deg] z-20",
  },
  {
    thumb: "logo" as const,
    title: "Brand logo design",
    price: "$25",
    rating: "5.0",
    delivery: "2 days",
    position:
      "top-[8%] right-0 w-[42%] rotate-[4deg] z-10",
  },
  {
    thumb: "seo" as const,
    title: "Local SEO dashboard",
    price: "$99",
    rating: "4.8",
    delivery: "5 days",
    position:
      "bottom-0 left-[6%] w-[44%] rotate-[2deg] z-30",
  },
  {
    thumb: "mobile" as const,
    title: "Mobile app design",
    price: "$250",
    rating: "4.9",
    delivery: "7 days",
    position:
      "bottom-[6%] right-[2%] w-[44%] rotate-[-4deg] z-20",
  },
];

export function MarketplaceHero() {
  const router = useRouter();

  const [query, setQuery] =
    useState("");

  function search(
    value = query,
  ) {
    const normalized =
      value.trim();

    if (!normalized) {
      return;
    }

    router.push(
      `/marketplace/search?q=${encodeURIComponent(
        normalized,
      )}`,
    );
  }

  return (
    <section className="brand-dark relative overflow-hidden border-b border-white/10">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 md:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-[56px]">
            Find the right freelancer
            <br />
            for any service.
          </h1>

          <p className="mt-5 max-w-xl text-base text-slate-300 md:text-lg">
            Websites, branding, content,
            marketing, automation and more —
            delivered through TAKATAK with
            escrow protection on every project.
          </p>

          <div className="mt-7 max-w-xl">
            <div className="flex items-stretch overflow-hidden rounded-lg border border-white/15 bg-white shadow-xl">
              <span className="flex items-center pl-4 text-slate-500">
                <Search size={18} />
              </span>

              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    search();
                  }
                }}
                placeholder='Search for "logo design"'
                className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-[15px] text-slate-950 outline-none"
              />

              <button
                type="button"
                onClick={() =>
                  search()
                }
                className="bg-emerald-600 px-6 text-sm font-semibold text-white"
              >
                Search
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">
                Popular:
              </span>

              {quickPicks.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    search(item);
                  }}
                  className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-white/90 transition hover:bg-white/10"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-7 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck
              size={14}
              className="text-emerald-400"
            />

            Escrow protection — funds only
            released when you approve the work.
          </p>
        </div>

        <div className="hidden lg:block">
          <div className="relative h-[520px] w-full">
            <div className="absolute inset-6 rounded-3xl border border-white/10 bg-white/[0.04]" />

            {heroCollage.map(
              (card) => (
                <div
                  key={card.title}
                  className={`absolute ${card.position} overflow-hidden rounded-xl border border-black/5 bg-white shadow-2xl transition-transform duration-300 hover:rotate-0`}
                >
                  <ServiceThumbnail
                    kind={card.thumb}
                  />

                  <div className="p-3">
                    <p className="line-clamp-1 text-[13px] font-semibold text-slate-950">
                      {card.title}
                    </p>

                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                      <Star
                        size={11}
                        className="fill-slate-950 text-slate-950"
                      />

                      <span className="font-semibold text-slate-950">
                        {card.rating}
                      </span>

                      <span className="mx-1">
                        ·
                      </span>

                      <Clock size={10} />
                      <span>
                        {card.delivery}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[13px] font-bold text-slate-950">
                      From {card.price}
                    </p>
                  </div>
                </div>
              ),
            )}

            <div className="absolute left-[44%] top-[42%] z-40 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-lg">
              <ShieldCheck
                size={13}
                className="text-emerald-700"
              />

              TAKATAK escrow
            </div>
          </div>
        </div>

        <div className="lg:hidden">
          <div className="relative mt-2 h-[320px] w-full">
            {heroCollage
              .slice(0, 3)
              .map((card, index) => (
                <div
                  key={card.title}
                  className="absolute overflow-hidden rounded-xl border border-black/5 bg-white shadow-xl"
                  style={{
                    width: "62%",
                    left: `${index * 16}%`,
                    top: `${index * 22}px`,
                    transform: `rotate(${
                      [-4, 2, 5][index]
                    }deg)`,
                    zIndex: 10 + index,
                  }}
                >
                  <ServiceThumbnail
                    kind={card.thumb}
                  />

                  <div className="p-2.5">
                    <p className="line-clamp-1 text-[12px] font-semibold text-slate-950">
                      {card.title}
                    </p>

                    <p className="mt-1 text-[11px] font-bold text-slate-950">
                      From {card.price}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}