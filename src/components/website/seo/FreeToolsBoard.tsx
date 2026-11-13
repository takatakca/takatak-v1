"use client";

import Link from "next/link";

import { SEO_CATEGORIES, SEO_FREE_TOOLS } from "@/lib/seo/free-tools-catalog";
import { SEO_CATEGORY_FR, SEO_TOOL_FR } from "@/lib/seo/free-tools-fr";
import { useLanguage } from "@/lib/website/use-language";

const COPY = {
  eyebrow: { fr: "GROUPE TAKATAK · SEO et visibilité IA", en: "GROUPE TAKATAK · SEO & AI Visibility" },
  title: { fr: "Des outils SEO gratuits pour grandir sur Google", en: "Free SEO tools for smarter organic growth" },
  lead: {
    fr: "Vérifiez si votre site est bien trouvé, inspectez vos balises et préparez des documents utiles aux moteurs de recherche. Un seul compte TAKATAK sécurisé donne accès à ces outils pour votre entreprise.",
    en: "Audit technical discoverability, inspect metadata and build useful search-friendly documents. Use one secure TAKATAK account to access these tools for your business.",
  },
  create: { fr: "Créer mon compte TAKATAK", en: "Create your TAKATAK account" },
  signin: { fr: "Me connecter pour utiliser les outils", en: "Sign in to use free tools" },
  note: {
    fr: "Pas de compte SEO séparé, pas de carte de paiement. Un compte et un espace client sont nécessaires pour lancer les outils.",
    en: "No separate SEO login or payment card. Account authentication and a client workspace are required to run tools.",
  },
  provider: { fr: "Source de données vérifiée requise", en: "Verified data connection required" },
  free: { fr: "Outil gratuit", en: "Free tool" },
  open: { fr: "Ouvrir l’outil →", en: "Open tool →" },
  honest: {
    fr: "Nos vérifications techniques ne prouvent pas une place dans ChatGPT, Perplexity ou Google. Les vraies mesures de citation, d’indexation et de concurrents demandent des sources de données branchées et vérifiées.",
    en: "Our technical readiness checks are not proof of ChatGPT, Perplexity or Google placement. True citation, indexing and competitor measurements require supported data connections and verification.",
  },
} as const;

/** /free-tools: the free SEO tools catalog, in the visitor's language. */
export function FreeToolsBoard() {
  const { lang } = useLanguage();
  const fr = lang === "fr";
  return (
    <main className="tk-page brand-dark min-h-screen bg-[#060D1F] text-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#060D1F] via-[#0B1B3D] to-[#1565D8] px-5 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">{COPY.eyebrow[lang]}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight sm:text-6xl">{COPY.title[lang]}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-blue-100">{COPY.lead[lang]}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#0B1B3D] hover:bg-blue-50">
              {COPY.create[lang]}
            </Link>
            <Link
              href="/login?next=%2Fdashboard%2Fseo%2Ffree-tools"
              className="rounded-xl border border-white/60 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              {COPY.signin[lang]}
            </Link>
          </div>
          <p className="mt-5 text-xs text-blue-200">{COPY.note[lang]}</p>
        </div>
      </section>
      <section className="bg-slate-50 px-5 py-14 text-slate-900">
        <div className="mx-auto max-w-6xl space-y-10">
          {SEO_CATEGORIES.map((category) => (
            <div key={category}>
              <h2 className="mb-4 text-2xl font-bold text-[#0B1B3D]">{fr ? SEO_CATEGORY_FR[category] ?? category : category}</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {SEO_FREE_TOOLS.filter((tool) => tool.category === category).map((tool) => {
                  const copy = fr ? SEO_TOOL_FR[tool.id] : undefined;
                  return (
                    <div key={tool.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-3 flex justify-between gap-2">
                        <span
                          className={
                            "rounded-full px-2 py-1 text-[11px] font-semibold " +
                            (tool.mode === "provider" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700")
                          }
                        >
                          {tool.mode === "provider" ? COPY.provider[lang] : COPY.free[lang]}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-950">{copy?.title ?? tool.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{copy?.description ?? tool.description}</p>
                      <Link href="/dashboard/seo/free-tools" className="mt-4 inline-flex text-sm font-bold text-blue-700 hover:underline">
                        {COPY.open[lang]}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-sm leading-7 text-blue-950">{COPY.honest[lang]}</div>
        </div>
      </section>
    </main>
  );
}
