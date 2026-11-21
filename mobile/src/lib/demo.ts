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
  can: { invoices: true, dashboard: true, team: true },
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

const leads: T.Leads = {
  available: true, total: 4,
  kpis: { leads: 4, sources: 2, campaigns: 1, followUpsPlanned: 1, qualifiedLeads: 1 },
  pipeline: [{ status: 'new_internal', count: 2 }, { status: 'follow_up_planned', count: 1 }, { status: 'qualified_internal', count: 1 }],
  leads: [
    { id: 'l1', name: 'Julie Exemple', email: 'julie@exemple.ca', phone: '+15145550101', company: 'Traiteur Exemple', message: 'Bonjour, je cherche un traiteur pour 40 personnes le 12 décembre.', status: 'new_internal', priority: 'high', source: 'Formulaire du site', campaign: null, followUpAt: null, createdAt: day(-1).slice(0, 10) },
    { id: 'l2', name: 'Marc Exemple', email: 'marc@exemple.ca', phone: null, company: null, message: 'Faites-vous la livraison au Plateau ?', status: 'new_internal', priority: 'normal', source: 'Google', campaign: null, followUpAt: null, createdAt: day(-2).slice(0, 10) },
    { id: 'l3', name: 'Sofia Exemple', email: null, phone: '+15145550102', company: 'Bureau Exemple', message: 'Commande de boîtes à lunch chaque vendredi.', status: 'follow_up_planned', priority: 'normal', source: 'Formulaire du site', campaign: 'Traiteur des Fêtes', followUpAt: day(2).slice(0, 10), createdAt: day(-5).slice(0, 10) },
    { id: 'l4', name: 'Paul Exemple', email: 'paul@exemple.ca', phone: null, company: null, message: 'Gâteau de mariage pour juin.', status: 'qualified_internal', priority: 'low', source: 'Facebook', campaign: null, followUpAt: null, createdAt: day(-9).slice(0, 10) },
  ],
};
const web: T.Web = {
  available: true,
  domains: [
    { id: 'd1', name: 'boulangerie-exemple.ca', brand: 'Boulangerie Exemple', registrar: 'TAKATAK', status: 'active', dns: 'ok', ssl: 'active', autoRenew: true, expiresAt: day(240).slice(0, 10) },
    { id: 'd2', name: 'cafe-exemple.ca', brand: 'Café Exemple Plateau', registrar: 'TAKATAK', status: 'active', dns: 'warning', ssl: 'pending', autoRenew: false, expiresAt: day(21).slice(0, 10) },
  ],
  hosting: [{ id: 'h1', plan: 'Hébergement Affaires', brand: 'Boulangerie Exemple', domain: 'boulangerie-exemple.ca', status: 'active', server: 'online', renewsAt: day(240).slice(0, 10) }],
};
const team: T.Team = {
  available: true, pendingInvitations: 1,
  members: [
    { id: 't1', name: 'Camille Exemple', email: 'camille@exemple.ca', role: 'owner', status: 'active', joinedAt: day(-400), me: true },
    { id: 't2', name: 'Léo Exemple', email: 'leo@exemple.ca', role: 'manager', status: 'active', joinedAt: day(-120), me: false },
    { id: 't3', name: 'Nora Exemple', email: 'nora@exemple.ca', role: 'editor', status: 'active', joinedAt: day(-30), me: false },
  ],
};

export const demoApi = {
  leads: () => wait(leads),
  web: () => wait(web),
  team: () => wait(team),
  me: () => wait(me),
  home: () => wait(home),
  notifications: () => wait({ notifications, unread: notifications.filter(n => n.status === 'unread').length }),
  markRead: () => wait({ updated: 1 }),
  invoices: () => wait(invoices),
};
