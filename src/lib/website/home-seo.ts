import type { Metadata } from "next";

export type HomeLanguage = "en" | "fr";
export const HOME_LANGUAGE_HEADER = "x-takatak-home-language";

export function homeLanguage(value: unknown): HomeLanguage {
  return value === "fr" ? "fr" : "en";
}

export const HOME_SEO = {
  en: {
    title: "TAKATAK — Websites, Hosting & Digital Marketing in Montréal",
    description: "Grow your business with TAKATAK in Montréal: websites, domains, secure hosting, digital marketing, social media and AI tools in one bilingual dashboard.",
  },
  fr: {
    title: "TAKATAK — Sites web, hébergement et marketing à Montréal",
    description: "Développez votre entreprise avec TAKATAK à Montréal : sites web, domaines, hébergement, marketing numérique, réseaux sociaux et outils IA dans un seul espace.",
  },
} as const;

export function homeLanguageAlternates(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return { "en-CA": `${base}/`, "fr-CA": `${base}/?lang=fr`, "x-default": `${base}/` };
}

export function homeMetadata(lang: HomeLanguage, origin: string): Metadata {
  const copy = HOME_SEO[lang];
  const canonical = lang === "fr" ? "/?lang=fr" : "/";
  return {
    title: { absolute: copy.title },
    description: copy.description,
    alternates: { canonical, languages: homeLanguageAlternates(origin) },
    openGraph: {
      type: "website", siteName: "TAKATAK", ...copy, url: canonical,
      locale: lang === "fr" ? "fr_CA" : "en_CA",
      alternateLocale: lang === "fr" ? "en_CA" : "fr_CA",
    },
    twitter: { card: "summary_large_image", ...copy },
  };
}
