// Leads for this business: every request from the website, forms and campaigns. Tap a lead to read it and
// call or write back from the phone. Changing a lead's stage stays on the website for now.
import { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Badge, Button, Card, Empty, ErrorNote, Loading, Notice, Screen, Segmented, tap } from '../components/ui';
import { api } from '../lib/api';
import { SITE_ORIGIN } from '../lib/config';
import { formatDate, LEAD_STATUS, PRIORITY } from '../lib/format';
import { useData } from '../lib/useData';
import { useSession } from '../lib/session';
import { colors, fonts, type } from '../lib/theme';
import type { Lead } from '../lib/types';

type Filter = 'all' | 'new' | 'follow' | 'qualified';
const MATCH: Record<Filter, (l: Lead) => boolean> = {
  all: () => true,
  new: l => l.status === 'new_internal',
  follow: l => l.status === 'follow_up_planned' || l.status === 'contacted_internal' || l.status === 'proposal_planned',
  qualified: l => l.status === 'qualified_internal' || l.status === 'won_internal',
};
const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export default function Leads() {
  const { me } = useSession();
  const { data, error, loading, refreshing, refresh } = useData(() => api.leads(), [me?.workspace?.id]);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => (data?.leads ?? []).filter(MATCH[filter]), [data, filter]);
  if (loading) return <Loading />;
  const count = (f: Filter) => (data?.leads ?? []).filter(MATCH[f]).length;
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorNote message={error} onRetry={refresh} /> : null}
      {data && !data.available ? <Notice icon="info">Les demandes ne sont pas disponibles pour le moment. Réessayez plus tard.</Notice> : null}
      {data?.available ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {[{ k: 'Demandes', v: data.kpis?.leads ?? 0 }, { k: 'À suivre', v: data.kpis?.followUpsPlanned ?? 0 }, { k: 'Qualifiées', v: data.kpis?.qualifiedLeads ?? 0 }].map(x => (
              <Card key={x.k} style={{ flex: 1, paddingVertical: 14 }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink }}>{x.v}</Text>
                <Text style={type.small}>{x.k}</Text>
              </Card>
            ))}
          </View>
          <Segmented value={filter} onChange={setFilter} options={[
            { id: 'all', label: 'Toutes', count: count('all') }, { id: 'new', label: 'Nouvelles', count: count('new') },
            { id: 'follow', label: 'En suivi', count: count('follow') }, { id: 'qualified', label: 'Qualifiées', count: count('qualified') },
          ]} />
          <View style={{ height: 14 }} />
          {!shown.length ? <Empty icon="inbox" title="Aucune demande ici" text="Les nouvelles demandes de votre site et de vos campagnes apparaîtront ici." /> : null}
          {shown.map(l => {
            const s = LEAD_STATUS[l.status] ?? { label: l.status, tone: 'muted' as const };
            const expanded = open === l.id;
            return (
              <Card key={l.id} style={{ marginBottom: 12 }} accent={l.priority === 'high' || l.priority === 'urgent'} onPress={() => { tap(); setOpen(expanded ? null : l.id); }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.heading} numberOfLines={1}>{l.name}</Text>
                    <Text style={[type.small, { marginTop: 3 }]} numberOfLines={1}>{[l.company, l.source, formatDate(l.createdAt)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Badge label={s.label} tone={s.tone} />
                </View>
                {l.message ? <Text style={[type.body, { marginTop: 10, color: colors.ink2 }]} numberOfLines={expanded ? undefined : 2}>{l.message}</Text> : null}
                {expanded ? (
                  <>
                    <Text style={[type.small, { marginTop: 10 }]}>Priorité : {PRIORITY[l.priority] ?? l.priority}{l.campaign ? ` · Campagne : ${l.campaign}` : ''}{l.followUpAt ? ` · Suivi le ${formatDate(l.followUpAt)}` : ''}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                      {l.phone ? <Button title="Appeler" icon="phone" small onPress={() => Linking.openURL(tel(l.phone!))} style={{ flex: 1 }} /> : null}
                      {l.email ? <Button title="Écrire" icon="send" variant="secondary" small onPress={() => Linking.openURL(`mailto:${l.email}`)} style={{ flex: 1 }} /> : null}
                    </View>
                  </>
                ) : null}
              </Card>
            );
          })}
          {data.total > data.leads.length ? <Notice icon="info">Les {data.leads.length} demandes les plus récentes sont affichées. Les autres sont sur takatak.ca.</Notice> : null}
        </>
      ) : null}
      <Button title="Pipeline complet sur takatak.ca" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(`${SITE_ORIGIN}/dashboard/leads/pipeline`, { toolbarColor: colors.canvas, controlsColor: colors.accent })} style={{ marginTop: 6 }} />
    </Screen>
  );
}
