// Fictitious data for the visual preview only (EXPO_PUBLIC_DEMO=1: screenshots, store images, design review).
// Never part of a store build: the flag is off by default and the module is only required when it is on.
// Every name here is invented and marked as an example.
import type * as T from './types';

const day = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const series = (base: number, n = 14) => Array.from({ length: n }, (_, i) => Math.round(base * (0.7 + 0.5 * Math.abs(Math.sin(i * 0.9)) + i * 0.02)));
const wait = <V,>(v: V) => new Promise<V>(r => setTimeout(() => r(v), 120));

const me: T.Me = {
  user: { id: 'u', email: 'camille@exemple.ca', firstName: 'Camille', lastName: 'Exemple', displayName: null },
  mode: 'client_scoped', platformAdmin: false,
  workspace: { id: 'w1', name: 'Boulangerie Exemple', role: 'owner' },
  workspaces: [{ id: 'w1', name: 'Boulangerie Exemple' }, { id: 'w2', name: 'Café Exemple Plateau' }],
  can: { invoices: true, dashboard: true },
};

const home: T.Home = {
  source: 'database', sourceLabel: '', welcomeName: 'Camille',
  range: { from: day(-30).slice(0, 10), to: day(0).slice(0, 10) },
  kpis: {
    reach: { label: 'Reach', value: 18420, previous: 15100, series: series(1300), hint: '', available: true },
    engagement: { label: 'Engagement', value: 1236, previous: 1310, series: series(90), hint: '', available: true },
    websiteTraffic: { label: 'Traffic', value: 3912, previous: 3200, series: series(260), hint: '', available: true },
    conversions: { label: 'Leads', value: 47, previous: 38, series: series(3), hint: '', available: true },
    avgRating: { label: 'Rating', value: 4.8, previous: 4.7, series: [], hint: '', available: true, reviewCount: 126 },
  },
  integrations: [
    { key: 'website', label: 'Site Web', href: '/dashboard/web-hosting', detail: 'boulangerie-exemple.ca', platforms: [], status: 'connected' },
    { key: 'social', label: 'Réseaux sociaux', href: '/dashboard/social', detail: 'Facebook, Instagram', platforms: [], status: 'connected' },
    { key: 'advertising', label: 'Publicité', href: '/dashboard/advertising', detail: 'Aucune campagne reliée', platforms: [], status: 'not_connected' },
    { key: 'reviews', label: 'Avis Google', href: '/dashboard/growth/reviews', detail: 'Reconnexion demandée', platforms: [], status: 'expired' },
  ],
  performance: [],
  topPages: [
    { path: '/', sessions: 1840, changePct: 12 },
    { path: '/menu', sessions: 960, changePct: 31 },
    { path: '/commander', sessions: 512, changePct: -4 },
  ],
  topPosts: [],
  reviews: [
    { id: 'r1', reviewerName: 'Client exemple', rating: 5, body: 'Le meilleur pain au levain du quartier, service toujours souriant.', provider: 'Google', reviewedAt: day(-2) },
    { id: 'r2', reviewerName: 'Autre client exemple', rating: 4, body: 'Très bons croissants. Un peu d’attente le samedi matin.', provider: 'Google', reviewedAt: day(-6) },
  ],
};

const notifications: T.Notification[] = [
  { id: 'n1', type: 'approval_needed', title: '3 publications à approuver', message: 'Les publications de la semaine sont prêtes pour Facebook et Instagram.', status: 'unread', createdAt: day(-0.05), href: '/dashboard/social' },
  { id: 'n2', type: 'system', title: 'Nouvelle demande sur votre site', message: 'Commande de traiteur pour 40 personnes (exemple).', status: 'unread', createdAt: day(-0.3), href: '/dashboard/leads' },
  { id: 'n3', type: 'invoice_due', title: 'Facture à payer', message: 'Hébergement et entretien du site, novembre.', status: 'read', createdAt: day(-2), href: '/dashboard/invoices' },
  { id: 'n4', type: 'report_ready', title: 'Votre rapport mensuel est prêt', message: 'Octobre : portée +22 %, visites +18 %.', status: 'read', createdAt: day(-5), href: '/dashboard/growth/report' },
];

const invoices: T.Invoices = { status: 'ok', partial: false, invoices: [
  { id: 'i1', source: 'stripe', number: 'EX-0042', description: 'Hébergement et entretien du site (exemple)', issuedAt: day(-2), dueAt: day(12), paidAt: null, currency: 'cad', totalMinor: 8900, amountDueMinor: 8900, amountPaidMinor: 0, status: 'open', payUrl: 'https://takatak.ca', pdfUrl: 'https://takatak.ca' },
  { id: 'i2', source: 'stripe', number: 'EX-0037', description: 'Gestion des réseaux sociaux (exemple)', issuedAt: day(-33), dueAt: day(-19), paidAt: day(-20), currency: 'cad', totalMinor: 34900, amountDueMinor: 0, amountPaidMinor: 34900, status: 'paid', payUrl: null, pdfUrl: 'https://takatak.ca' },
] };

export const demoApi = {
  me: () => wait(me),
  home: () => wait(home),
  notifications: () => wait({ notifications, unread: notifications.filter(n => n.status === 'unread').length }),
  markRead: () => wait({ updated: 1 }),
  invoices: () => wait(invoices),
};
