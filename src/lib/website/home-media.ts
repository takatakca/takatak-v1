// Picture (and future video loop) for each service on the homepage.
// Photos are the licensed ones in public/photos (see CREDITS.md); one picture
// can frame two services with a different focus and zoom. `chip` is the one
// line of product UI shown over the picture: no icons, no fake numbers.

import type { CategoryKey } from "./core-categories";
import { pricing } from "./pricing";
import type { Bi } from "./service-pages";

export interface ServiceMedia {
  photo: string;
  focus: string;
  zoom: number;
  /** Key in media-manifest.json once a video loop exists. */
  video: string;
  alt: Bi;
  chip: Bi;
}

const CAFE = "/photos/commerce-cafe.webp";
const CUSTOMER = "/photos/hero-cafe.webp";
const OFFICE = "/photos/pro-bureau.webp";
const STUDIO = "/photos/studio-design.webp";
const WORKSHOP = "/photos/artisan-atelier.webp";

const domainPrice = (lang: "en" | "fr") =>
  new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol" }).format(
    pricing.domain.register.amount,
  );

export const SERVICE_MEDIA: Record<CategoryKey, ServiceMedia> = {
  website: {
    photo: CAFE,
    focus: "45% 50%",
    zoom: 1,
    video: "website",
    alt: { en: "A café owner behind his counter", fr: "Un propriétaire de café derrière son comptoir" },
    chip: { en: "yourcafe.ca · Live", fr: "votrecafe.ca · En ligne" },
  },
  domains: {
    photo: CUSTOMER,
    focus: "55% 40%",
    zoom: 1,
    video: "domains",
    alt: { en: "A woman smiling at her phone in a café", fr: "Une femme sourit à son téléphone dans un café" },
    chip: { en: `yourbrand.ca · Available · ${domainPrice("en")}/yr`, fr: `votremarque.ca · Disponible · ${domainPrice("fr")}/an` },
  },
  hosting: {
    photo: OFFICE,
    focus: "70% 50%",
    zoom: 1,
    video: "hosting",
    alt: { en: "A professional on the phone at her laptop", fr: "Une professionnelle au téléphone devant son portable" },
    chip: { en: "SSL on · Backed up today", fr: "SSL actif · Sauvegardé aujourd’hui" },
  },
  marketing: {
    photo: STUDIO,
    focus: "55% 40%",
    zoom: 1,
    video: "marketing",
    alt: { en: "A designer on the phone in her studio", fr: "Une designer au téléphone dans son atelier" },
    chip: { en: "Meta campaign · Running", fr: "Campagne Meta · En cours" },
  },
  social: {
    photo: CUSTOMER,
    focus: "50% 78%",
    zoom: 1.35,
    video: "social",
    alt: { en: "Hands holding a phone over a café table", fr: "Des mains tiennent un téléphone au-dessus d’une table de café" },
    chip: { en: "One post · Every network", fr: "Une publication · Tous vos réseaux" },
  },
  local: {
    photo: WORKSHOP,
    focus: "40% 40%",
    zoom: 1,
    video: "local",
    alt: { en: "A craftsman in his workshop", fr: "Un artisan dans son atelier" },
    chip: { en: "Google profile · Up to date", fr: "Fiche Google · À jour" },
  },
  reviews: {
    photo: WORKSHOP,
    focus: "62% 58%",
    zoom: 1.35,
    video: "reviews",
    alt: { en: "A craftsman reading his phone", fr: "Un artisan qui lit son téléphone" },
    chip: { en: "New Google review · ★★★★★", fr: "Nouvel avis Google · ★★★★★" },
  },
  ai: {
    photo: STUDIO,
    focus: "78% 62%",
    zoom: 1.3,
    video: "ai",
    alt: { en: "A laptop open on a designer’s desk", fr: "Un portable ouvert sur le bureau d’une designer" },
    chip: { en: "Draft ready to approve", fr: "Brouillon prêt à valider" },
  },
  billing: {
    photo: OFFICE,
    focus: "40% 55%",
    zoom: 1.25,
    video: "billing",
    alt: { en: "A professional working at her desk", fr: "Une professionnelle à son bureau" },
    chip: { en: "Invoice #1042 · Paid", fr: "Facture #1042 · Payée" },
  },
  voip: {
    photo: CAFE,
    focus: "68% 38%",
    zoom: 1.3,
    video: "voip",
    alt: { en: "A café owner on the phone", fr: "Un propriétaire de café au téléphone" },
    chip: { en: "Incoming call · Sales", fr: "Appel entrant · Ventes" },
  },
};
