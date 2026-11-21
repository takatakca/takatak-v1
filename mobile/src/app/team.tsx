// The people who can open this business, with their role. Inviting someone or changing a role stays on the
// website for now (it needs the full permission screen).
import { Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Badge, Button, Card, Empty, ErrorNote, Loading, Notice, Screen } from '../components/ui';
import { api } from '../lib/api';
import { SITE_ORIGIN } from '../lib/config';
import { formatDate, initials, ROLE } from '../lib/format';
import { useData } from '../lib/useData';
import { useSession } from '../lib/session';
import { colors, fonts, type } from '../lib/theme';

export default function Team() {
  const { me } = useSession();
  const { data, error, loading, refreshing, refresh } = useData(() => api.team(), [me?.workspace?.id]);
  if (loading) return <Loading />;
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorNote message={error} onRetry={refresh} /> : null}
      {data && !data.available ? <Notice icon="info">L’équipe n’est pas disponible pour le moment. Réessayez plus tard.</Notice> : null}
      {data?.available ? (
        <>
          {data.pendingInvitations ? <Notice icon="info">{data.pendingInvitations === 1 ? '1 invitation attend une réponse.' : `${data.pendingInvitations} invitations attendent une réponse.`}</Notice> : null}
          {!data.members.length ? <Empty icon="users" title="Aucun membre" text="Invitez votre équipe depuis takatak.ca." /> : null}
          <Card style={{ paddingVertical: 4 }}>
            {data.members.map((m, i) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === data.members.length - 1 ? 0 : 1, borderBottomColor: colors.line }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.semibold, color: colors.primary }}>{initials(m.name || m.email || '?')}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={type.heading} numberOfLines={1}>{m.name || m.email}{m.me ? ' (vous)' : ''}</Text>
                  <Text style={type.small} numberOfLines={1}>{m.name && m.email ? `${m.email} · ` : ''}depuis le {formatDate(m.joinedAt)}</Text>
                </View>
                <Badge label={m.status === 'suspended' ? 'Suspendu' : ROLE[m.role] ?? m.role} tone={m.status === 'suspended' ? 'red' : m.role === 'owner' ? 'wine' : 'muted'} />
              </View>
            ))}
          </Card>
        </>
      ) : null}
      <Button title="Inviter ou changer un rôle sur takatak.ca" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(`${SITE_ORIGIN}/dashboard/team`, { toolbarColor: colors.canvas, controlsColor: colors.accent })} style={{ marginTop: 10 }} />
    </Screen>
  );
}
