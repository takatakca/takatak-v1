// Choose which business to look at (only the ones this account is an active member of).
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Card, Empty, ErrorNote, Row, Screen, success } from '../components/ui';
import { Icon } from '../components/Icon';
import { useSession } from '../lib/session';
import { colors } from '../lib/theme';

export default function Workspaces() {
  const { me, switchWorkspace } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = me?.workspaces ?? [];

  const choose = async (id: string) => {
    setBusy(id); setError(null);
    try { await switchWorkspace(id); success(); router.back(); } catch (e: any) { setError(e?.message ?? 'Changement impossible.'); } finally { setBusy(null); }
  };

  return (
    <Screen>
      {error ? <ErrorNote message={error} /> : null}
      {!list.length ? <Empty icon="briefcase" title="Aucune entreprise" text="Votre compte n’est relié à aucune entreprise pour le moment." /> : (
        <Card style={{ paddingVertical: 4 }}>
          {list.map((w, i) => (
            <Row key={w.id} icon="briefcase" title={w.name} onPress={() => choose(w.id)} last={i === list.length - 1}
              right={busy === w.id ? <ActivityIndicator color={colors.primary} /> : me?.workspace?.id === w.id ? <Icon name="check" size={20} color={colors.primary} /> : undefined} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
