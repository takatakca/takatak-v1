// Home: greeting, active business, the four results of the last 30 days, rating, connections, top pages, latest reviews.
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Empty, ErrorNote, Eyebrow, Loading, Notice, Row, Screen, tap } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Mark } from '../../components/Logo';
import { KpiTile } from '../../components/Kpi';
import { api, ApiError } from '../../lib/api';
import { LINKS, SITE_ORIGIN } from '../../lib/config';
import { formatShort } from '../../lib/format';
import { useData } from '../../lib/useData';
import { useSession } from '../../lib/session';
import { colors, fonts, glow, radius, type } from '../../lib/theme';
import type { Integration } from '../../lib/types';

const STATUS: Record<Integration['status'], { label: string; tone: 'green' | 'muted' | 'red' | 'gold' }> = {
  connected: { label: 'Relié', tone: 'green' },
  not_connected: { label: 'À relier', tone: 'muted' },
  error: { label: 'Erreur', tone: 'red' },
  expired: { label: 'À renouveler', tone: 'gold' },
};
const INTEGRATION_ICON = { website: 'globe', social: 'users', advertising: 'megaphone', reviews: 'star' } as const;

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; };
const openWeb = (href: string) => WebBrowser.openBrowserAsync(href.startsWith('http') ? href : `${SITE_ORIGIN}${href}`, { toolbarColor: colors.canvas, controlsColor: colors.accent });

export default function Home() {
  const insets = useSafeAreaInsets();
  const { me } = useSession();
  const { data, error, loading, refreshing, refresh } = useData(async () => {
    const [home, alerts] = await Promise.all([api.home(), api.notifications().catch(() => null)]);
    return { home, unread: alerts?.unread ?? 0 };
  }, [me?.workspace?.id]);

  const needsWorkspace = error && me && !me.workspace;
  const name = data?.home.welcomeName || me?.user.firstName || '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <LinearGradient colors={['#0E2453', colors.canvas]} style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={glow}><Mark size={34} /></View>
          <Pressable onPress={() => { tap(); router.push('/(tabs)/alerts'); }} hitSlop={10} accessibilityLabel="Alertes" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={21} color={colors.ink} />
            {data?.unread ? <View style={{ position: 'absolute', top: 7, right: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}><Text style={{ color: colors.white, fontFamily: fonts.bold, fontSize: 10 }}>{data.unread > 9 ? '9+' : data.unread}</Text></View> : null}
          </Pressable>
        </View>
        <Text style={[type.small, { marginTop: 18, color: colors.muted }]}>{greeting()}{name ? ',' : ''}</Text>
        <Text style={[type.display, { marginTop: 2 }]} numberOfLines={1}>{name || 'TAKATAK'}</Text>
        {me?.workspace ? (
          <Pressable onPress={() => { tap(); router.push('/workspaces'); }} disabled={me.workspaces.length < 2} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: 'rgba(31,139,255,0.14)', borderWidth: 1, borderColor: 'rgba(31,139,255,0.35)' }}>
            <Icon name="briefcase" size={15} color={colors.accent} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, maxWidth: 230 }} numberOfLines={1}>{me.workspace.name}</Text>
            {me.workspaces.length > 1 ? <Icon name="swap" size={14} color={colors.accent} /> : null}
          </Pressable>
        ) : null}
      </LinearGradient>

      {loading ? <Loading /> : (
        <Screen refreshing={refreshing} onRefresh={refresh}>
          {needsWorkspace ? (
            <Card>
              <Empty icon="briefcase" title="Choisissez une entreprise" text="Votre compte donne accès à plusieurs entreprises. Choisissez celle à afficher." action={<Button title="Choisir" onPress={() => router.push('/workspaces')} small />} />
            </Card>
          ) : error ? <ErrorNote message={error} onRetry={refresh} /> : data ? (
            <>
              {data.home.source === 'unavailable' ? <Notice icon="info">{data.home.sourceLabel || 'Les résultats ne sont pas disponibles pour le moment.'}</Notice> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 }}>
                <Eyebrow style={{ marginBottom: 0 }}>Vos résultats</Eyebrow>
                <Text style={[type.small, { fontSize: 12 }]}>{formatShort(data.home.range.from)} – {formatShort(data.home.range.to)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <KpiTile label="Portée" kpi={data.home.kpis.reach} />
                <KpiTile label="Engagement" kpi={data.home.kpis.engagement} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <KpiTile label="Visites du site" kpi={data.home.kpis.websiteTraffic} />
                <KpiTile label="Demandes reçues" kpi={data.home.kpis.conversions} />
              </View>

              <Card style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }} onPress={() => openWeb('/dashboard/growth/reviews')}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.amberBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={22} color={colors.amber} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={type.small}>Note moyenne</Text>
                  <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink }}>
                    {data.home.kpis.avgRating.available && data.home.kpis.avgRating.value !== null ? data.home.kpis.avgRating.value.toFixed(1).replace('.', ',') : '—'}
                    <Text style={[type.small, { fontFamily: fonts.regular }]}>  {data.home.kpis.avgRating.reviewCount} avis</Text>
                  </Text>
                </View>
                <Icon name="chevron" size={18} color={colors.faint} />
              </Card>

              <Eyebrow style={{ marginTop: 26 }}>Connexions</Eyebrow>
              <Card style={{ paddingVertical: 4 }}>
                {data.home.integrations.map((it, i) => (
                  <Row key={it.key} icon={INTEGRATION_ICON[it.key] ?? 'link'} title={it.label} subtitle={it.detail} last={i === data.home.integrations.length - 1}
                    right={<Badge label={STATUS[it.status]?.label ?? it.status} tone={STATUS[it.status]?.tone ?? 'muted'} />} onPress={() => openWeb(it.href)} />
                ))}
              </Card>

              {data.home.topPages.length ? (
                <>
                  <Eyebrow style={{ marginTop: 26 }}>Pages les plus visitées</Eyebrow>
                  <Card style={{ paddingVertical: 4 }}>
                    {data.home.topPages.slice(0, 5).map((p, i, arr) => (
                      <Row key={p.path} icon="globe" title={p.path} subtitle={`${p.sessions.toLocaleString('fr-CA')} visites`} last={i === arr.length - 1}
                        right={p.changePct !== null ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: p.changePct >= 0 ? colors.green : colors.red }}>{p.changePct >= 0 ? '+' : ''}{Math.round(p.changePct)} %</Text> : undefined} />
                    ))}
                  </Card>
                </>
              ) : null}

              {data.home.reviews.length ? (
                <>
                  <Eyebrow style={{ marginTop: 26 }}>Derniers avis</Eyebrow>
                  {data.home.reviews.slice(0, 3).map(r => (
                    <Card key={r.id} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={type.heading} numberOfLines={1}>{r.reviewerName}</Text>
                        <Text style={{ color: colors.amber, fontFamily: fonts.semibold }}>{r.rating !== null ? '★'.repeat(Math.round(r.rating)) : ''}</Text>
                      </View>
                      {r.body ? <Text style={[type.body, { marginTop: 6 }]} numberOfLines={3}>{r.body}</Text> : null}
                      <Text style={[type.small, { marginTop: 8, fontSize: 12 }]}>{r.provider}{r.reviewedAt ? ` · ${formatShort(r.reviewedAt)}` : ''}</Text>
                    </Card>
                  ))}
                </>
              ) : null}

              <Eyebrow style={{ marginTop: 26 }}>Raccourcis</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {me?.can.invoices ? <Button title="Factures" icon="receipt" variant="secondary" onPress={() => router.push('/invoices')} style={{ flex: 1 }} /> : null}
                <Button title="Soutien" icon="support" variant="secondary" onPress={() => openWeb(LINKS.support)} style={{ flex: 1 }} />
              </View>
            </>
          ) : null}
        </Screen>
      )}
    </View>
  );
}
