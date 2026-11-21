// Websites, domains and hosting for this business, with what needs attention first (expiring domains,
// DNS or certificate problems). Changing DNS or renewing stays on the website for now.
import { Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Badge, Button, Card, Empty, ErrorNote, Eyebrow, Loading, Notice, Screen } from '../components/ui';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { SITE_ORIGIN } from '../lib/config';
import { daysUntil, formatDate, statusOf } from '../lib/format';
import { useData } from '../lib/useData';
import { useSession } from '../lib/session';
import { colors, type } from '../lib/theme';
import type { Domain } from '../lib/types';

const attention = (d: Domain) => {
  const left = daysUntil(d.expiresAt);
  return (left !== null && left <= 30 && !d.autoRenew) || statusOf(d.dns).tone === 'red' || statusOf(d.ssl).tone === 'red';
};

export default function Web() {
  const { me } = useSession();
  const { data, error, loading, refreshing, refresh } = useData(() => api.web(), [me?.workspace?.id]);
  if (loading) return <Loading />;
  const domains = [...(data?.domains ?? [])].sort((a, b) => Number(attention(b)) - Number(attention(a)));
  const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${SITE_ORIGIN}${path}`, { toolbarColor: colors.canvas, controlsColor: colors.accent });
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorNote message={error} onRetry={refresh} /> : null}
      {data && !data.available ? <Notice icon="info">Vos sites ne sont pas disponibles pour le moment. Réessayez plus tard.</Notice> : null}
      {data?.available ? (
        <>
          <Eyebrow>Domaines</Eyebrow>
          {!domains.length ? <Empty icon="globe" title="Aucun domaine" text="Vos noms de domaine TAKATAK apparaîtront ici." /> : null}
          {domains.map(d => {
            const s = statusOf(d.status);
            const left = daysUntil(d.expiresAt);
            const warn = attention(d);
            return (
              <Card key={d.id} style={{ marginBottom: 12 }} accent={warn}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.heading} numberOfLines={1}>{d.name}</Text>
                    {d.brand ? <Text style={[type.small, { marginTop: 3 }]} numberOfLines={1}>{d.brand}</Text> : null}
                  </View>
                  <Badge label={s.label} tone={s.tone} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  <Badge label={`DNS : ${statusOf(d.dns).label}`} tone={statusOf(d.dns).tone} />
                  <Badge label={`Sécurité HTTPS : ${statusOf(d.ssl).label}`} tone={statusOf(d.ssl).tone} />
                </View>
                {d.expiresAt ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <Icon name="clock" size={15} color={warn ? colors.red : colors.faint} />
                    <Text style={[type.small, warn && left !== null && left <= 30 ? { color: colors.red } : null]}>
                      {d.autoRenew ? 'Renouvellement automatique le ' : 'Expire le '}{formatDate(d.expiresAt)}{left !== null && left >= 0 && left <= 60 ? ` (dans ${left} j)` : ''}
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          })}
          <Eyebrow style={{ marginTop: 10 }}>Hébergement</Eyebrow>
          {!data.hosting.length ? <Empty icon="server" title="Aucun hébergement" text="Vos forfaits d’hébergement apparaîtront ici." /> : null}
          {data.hosting.map(h => {
            const s = statusOf(h.server || h.status);
            return (
              <Card key={h.id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.heading} numberOfLines={1}>{h.plan}</Text>
                    <Text style={[type.small, { marginTop: 3 }]} numberOfLines={1}>{[h.domain, h.brand].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Badge label={s.label} tone={s.tone} />
                </View>
                {h.renewsAt ? <Text style={[type.small, { marginTop: 10 }]}>Renouvellement le {formatDate(h.renewsAt)}</Text> : null}
              </Card>
            );
          })}
        </>
      ) : null}
      <Button title="Gérer DNS et renouvellements sur takatak.ca" variant="ghost" onPress={() => openWeb('/dashboard/web-hosting/domains')} style={{ marginTop: 6 }} />
    </Screen>
  );
}
