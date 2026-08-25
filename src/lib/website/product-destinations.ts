import { MapPin, Target, type LucideIcon } from "lucide-react";

/**
 * Canonical destinations for the TAKATAK ecosystem products.
 *
 * Rule of thumb used across the site:
 *  - a control that names the product (QMAPS / FLEXS / "Open QMAPS") goes to
 *    `productUrl` — the real product website;
 *  - a control that names the TAKATAK service ("Local visibility",
 *    "Lead generation packages") goes to `serviceUrl` — the sales page.
 */
export interface ProductDestination {
  key: "qmaps" | "flexs";
  /** Normalized service key shared with the intent/handoff contract. */
  serviceKey: "local-listings" | "lead-generation";
  name: string;
  productUrl: string;
  serviceUrl: "/services/local-listings" | "/services/lead-generation";
  icon: LucideIcon;
  en: { desc: string; open: string; service: string };
  fr: { desc: string; open: string; service: string };
}

export const productDestinations: Record<"qmaps" | "flexs", ProductDestination> = {
  qmaps: {
    key: "qmaps",
    serviceKey: "local-listings",
    name: "QMAPS",
    productUrl: "https://qmaps.ca/",
    serviceUrl: "/services/local-listings",
    icon: MapPin,
    en: {
      desc: "Local visibility: listings, maps and directory consistency.",
      open: "Explore QMAPS",
      service: "View Local Visibility",
    },
    fr: {
      desc: "Visibilité locale : fiches, cartes et cohérence des annuaires.",
      open: "Découvrir QMAPS",
      service: "Voir Visibilité locale",
    },
  },
  flexs: {
    key: "flexs",
    serviceKey: "lead-generation",
    name: "FLEXS",
    productUrl: "https://flexs.ca/",
    serviceUrl: "/services/lead-generation",
    icon: Target,
    en: {
      desc: "Capture and follow up on the opportunities visibility creates.",
      open: "Explore FLEXS",
      service: "View Lead Generation",
    },
    fr: {
      desc: "Captez et suivez les occasions générées par votre visibilité.",
      open: "Découvrir FLEXS",
      service: "Voir Génération de prospects",
    },
  },
};

export const QMAPS = productDestinations.qmaps;
export const FLEXS = productDestinations.flexs;

/** Props applied to every external product link for safe new-tab behavior. */
export const externalLinkProps = { target: "_blank", rel: "noopener noreferrer" } as const;
