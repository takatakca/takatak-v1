// French (Québec) formatting helpers.
const dateFmt = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)) : '');
export const formatShort = (iso: string | null | undefined) => (iso ? shortFmt.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)) : '');
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`;

export function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return formatShort(iso);
}

export function bytes(n: number | undefined | null) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} Mo`;
  return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} Go`;
}

export const money = (cents: number) => `${(cents / 100).toLocaleString('fr-CA', { minimumFractionDigits: cents % 100 ? 2 : 0 })} $`;

export function daysLabel(daysLeft: number) {
  if (daysLeft < 0) return `En retard de ${-daysLeft} j`;
  if (daysLeft === 0) return 'Aujourd’hui';
  if (daysLeft === 1) return 'Demain';
  return `Dans ${daysLeft} jours`;
}

export const initials = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'T';

export function compact(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)} k`;
  return n.toLocaleString('fr-CA', { maximumFractionDigits: 1 });
}

/** Change against the previous period, or null when there is nothing to compare. */
export function change(value: number | null, previous: number | null) {
  if (value === null || previous === null || previous === 0) return null;
  return Math.round(((value - previous) / Math.abs(previous)) * 100);
}

export const amount = (minor: number, currency = 'CAD') =>
  (minor / 100).toLocaleString('fr-CA', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 2 });

export const INVOICE_STATUS: Record<string, { label: string; tone: 'green' | 'gold' | 'red' | 'muted' }> = {
  paid: { label: 'Payée', tone: 'green' },
  open: { label: 'À payer', tone: 'gold' },
  overdue: { label: 'En retard', tone: 'red' },
  void: { label: 'Annulée', tone: 'muted' },
  uncollectible: { label: 'Non recouvrable', tone: 'muted' },
  refunded: { label: 'Remboursée', tone: 'muted' },
};

type Tone = 'green' | 'gold' | 'red' | 'muted' | 'wine';
export const LEAD_STATUS: Record<string, { label: string; tone: Tone }> = {
  new_internal: { label: 'Nouveau', tone: 'wine' },
  follow_up_planned: { label: 'Suivi prévu', tone: 'gold' },
  contacted_internal: { label: 'Contacté', tone: 'muted' },
  qualified_internal: { label: 'Qualifié', tone: 'green' },
  proposal_planned: { label: 'Soumission', tone: 'gold' },
  won_internal: { label: 'Gagné', tone: 'green' },
  lost_internal: { label: 'Perdu', tone: 'muted' },
  archived: { label: 'Archivé', tone: 'muted' },
};
export const PRIORITY: Record<string, string> = { low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente' };
const OK = ['active', 'connected', 'verified', 'valid', 'issued', 'ok', 'online', 'running', 'healthy'];
const BAD = ['error', 'expired', 'suspended', 'failed', 'offline', 'down', 'cancelled'];
const WARN = ['warning', 'pending', 'pending_connection', 'planned', 'provisioning', 'expiring'];
const WORDS: Record<string, string> = {
  active: 'Actif', connected: 'Relié', verified: 'Vérifié', valid: 'Valide', issued: 'Émis', ok: 'OK', online: 'En ligne', running: 'En marche', healthy: 'En santé',
  error: 'Erreur', expired: 'Expiré', suspended: 'Suspendu', failed: 'Échec', offline: 'Hors ligne', down: 'En panne', cancelled: 'Annulé',
  warning: 'À vérifier', pending: 'En attente', pending_connection: 'À relier', planned: 'Prévu', provisioning: 'En préparation', expiring: 'Expire bientôt',
  not_configured: 'Non configuré', not_connected: 'Non relié', unknown: 'Inconnu',
};
export function statusOf(value: string | null | undefined): { label: string; tone: Tone } {
  const v = (value ?? 'unknown').toLowerCase();
  const tone: Tone = OK.includes(v) ? 'green' : BAD.includes(v) ? 'red' : WARN.includes(v) ? 'gold' : 'muted';
  return { label: WORDS[v] ?? v.replace(/_/g, ' '), tone };
}
export function daysUntil(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  return Math.ceil((new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).getTime() - now) / 86400000);
}
export const ROLE: Record<string, string> = { owner: 'Propriétaire', admin: 'Administrateur', manager: 'Gestionnaire', editor: 'Rédacteur', staff: 'Employé', viewer: 'Lecture seule' };
