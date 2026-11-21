// French names of the dashboard menu (sections and items), keyed by the
// English label used in dashboard-config.ts. Shown when the account language
// is French; the English label stays the key, the tooltip and the page title.
// Product names (TAKATAK ADS, SC4NNER, BEH4VIOR, Food Hub, AI Studio…) keep
// their name.

export type DashboardLanguage = "en" | "fr";

export const NAV_FR: Record<string, string> = {
  // Sections
  "Clients & Services": "Clients et services",
  Integrations: "Intégrations",
  "Growth Suite": "Croissance",
  Learning: "Formation",
  Services: "Services",
  "SEO & Citations": "SEO et citations",
  Reports: "Rapports",
  Settings: "Paramètres",
  // Items
  Dashboard: "Tableau de bord",
  Clients: "Clients",
  "Customer Database": "Base de clients",
  "Businesses / Brands": "Entreprises et marques",
  Inventory: "Inventaire",
  Locations: "Emplacements",
  "Web Integration": "Web",
  Overview: "Vue d’ensemble",
  Websites: "Sites web",
  "Website Monitoring": "Surveillance des sites",
  Domains: "Domaines",
  "SSL Certificates": "Certificats SSL",
  Hosting: "Hébergement",
  "Social Media": "Réseaux sociaux",
  "TAKATAK ADS": "TAKATAK ADS",
  Reviews: "Avis",
  "Local Listings": "Fiches locales",
  Leads: "Prospects",
  "AI Studio": "AI Studio",
  "Content Moderation": "Modération du contenu",
  "Growth Hub": "Centre de croissance",
  Analytics: "Statistiques",
  "Monthly Report": "Bilan mensuel",
  "Reputation & Reviews": "Réputation et avis",
  Conversations: "Conversations",
  "Ads Manager": "Gestion des publicités",
  "Retargeting & Geo": "Reciblage et géociblage",
  "AI Engine & Credits": "Moteur IA et crédits",
  Connectors: "Connecteurs",
  "Plans & Pricing": "Forfaits et prix",
  "TAKATAK Academy": "Académie TAKATAK",
  BEH4VIOR: "BEH4VIOR",
  "Food Hub": "Food Hub",
  "Command Center": "Centre de commande",
  "Order Board": "Tableau des commandes",
  Orders: "Commandes",
  Menus: "Menus",
  Stores: "Magasins",
  "Payouts & Money": "Versements et argent",
  "Channels & Setup": "Canaux et configuration",
  Rentauto: "Rentauto",
  "ALKAO — Billetterie": "ALKAO — Billetterie",
  "My Hosting": "Mon hébergement",
  Servers: "Serveurs",
  Backups: "Sauvegardes",
  "Email Accounts": "Comptes courriel",
  Security: "Sécurité",
  "Business phone": "Téléphonie d’affaires",
  SC4NNER: "SC4NNER",
  "SEO Overview": "SEO : vue d’ensemble",
  Citations: "Citations",
  Backlinks: "Liens entrants",
  Keywords: "Mots-clés",
  "Analytics Reports": "Rapports",
  "Monthly Reports": "Rapports mensuels",
  Invoices: "Factures",
  "Bill my customers": "Facturer mes clients",
  Files: "Fichiers",
  Support: "Soutien",
  "Account settings": "Paramètres du compte",
  "User management": "Utilisateurs",
  "Team & Permissions": "Équipe et permissions",
  Notifications: "Notifications",
  "Billing & Plans": "Facturation et forfaits",
  Jobs: "Tâches",
  Activity: "Activité",
  "Facturations — Administration": "Facturations — Administration",
  "Go-live checklist": "Mise en service",
  "AI Control Center": "Centre de contrôle IA",
  Admin: "Administration",
};

/** The menu label to show in the account's language (English when no French name exists). */
export function navLabel(label: string, language: DashboardLanguage): string {
  return language === "fr" ? (NAV_FR[label] ?? label) : label;
}

export function asDashboardLanguage(value: unknown): DashboardLanguage {
  return value === "fr" ? "fr" : "en";
}
