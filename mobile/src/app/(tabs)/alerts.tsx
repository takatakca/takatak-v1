// Alerts: new website requests and orders, approvals, invoices due, integration errors, renewals.
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Button, Card, Empty, ErrorNote, Loading, Screen, success } from '../../components/ui';
import { Icon, IconName } from '../../components/Icon';
import { api } from '../../lib/api';
import { SITE_ORIGIN } from '../../lib/config';
import { relative } from '../../lib/format';
import { useData } from '../../lib/useData';
import { useSession } from '../../lib/session';
import { colors, fonts, radius, type } from '../../lib/theme';
import type { Notification } from '../../lib/types';

const KIND: Record<string, { icon: IconName; color: string }> = {
  approval_needed: { icon: 'check', color: colors.accent },
  report_ready: { icon: 'chart', color: colors.accent },
  invoice_due: { icon: 'receipt', color: colors.amber },
  integration_error: { icon: 'info', color: colors.red },
  job_failed: { icon: 'info', color: colors.red },
  support_reply: { icon: 'message', color: colors.accent },
  service_renewal: { icon: 'clock', color: colors.amber },
  system: { icon: 'bell', color: colors.muted },
};

export default function Alerts() {
  const { me } = useSession();
  const { data, setData, error, loading, refreshing, refresh } = useData(() => api.notifications(), [me?.workspace?.id]);

  const open = async (n: Notification) => {
    if (n.status === 'unread' && data) {
      setData({ notifications: data.notifications.map(x => x.id === n.id ? { ...x, status: 'read' } : x), unread: Math.max(0, data.unread - 1) });
      api.markRead({ ids: [n.id] }).catch(() => undefined);
    }
    if (n.href) await WebBrowser.openBrowserAsync(n.href.startsWith('http') ? n.href : `${SITE_ORIGIN}${n.href}`, { toolbarColor: colors.canvas, controlsColor: colors.accent });
  };

  const readAll = async () => {
    if (!data) return;
    await api.markRead({ all: true });
    success();
    setData({ notifications: data.notifications.map(x => ({ ...x, status: 'read' })), unread: 0 });
  };

  if (loading) return <Loading />;
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: 'Alertes' }} />
      {error ? <ErrorNote message={error} onRetry={refresh} /> : null}
      {data?.unread ? <Button title={`Tout marquer comme lu (${data.unread})`} variant="ghost" icon="check" small onPress={readAll} style={{ alignSelf: 'flex-end', marginBottom: 6 }} /> : null}
      {data && !data.notifications.length ? <Empty icon="bell" title="Aucune alerte" text="Les nouvelles demandes, commandes et approbations de votre entreprise apparaîtront ici." /> : null}
      {data?.notifications.map(n => {
        const k = KIND[n.type] ?? KIND.system!;
        const unread = n.status === 'unread';
        return (
          <Card key={n.id} onPress={() => open(n)} style={{ marginBottom: 10, flexDirection: 'row', gap: 12, borderColor: unread ? 'rgba(31,139,255,0.45)' : colors.line, borderWidth: 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}><Icon name={k.icon} size={19} color={k.color} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {unread ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
                <Text style={[type.heading, { flex: 1, fontFamily: unread ? fonts.semibold : fonts.medium }]} numberOfLines={2}>{n.title}</Text>
              </View>
              {n.message ? <Text style={[type.small, { marginTop: 4 }]} numberOfLines={3}>{n.message}</Text> : null}
              <Text style={[type.small, { marginTop: 6, fontSize: 11.5, color: colors.faint }]}>{relative(n.createdAt)}</Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
