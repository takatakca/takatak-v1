// Account: who is signed in, active business, biometric lock, help and legal links, sign-out, data deletion.
import { useEffect, useState } from 'react';
import { Alert, Linking, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import { Card, Eyebrow, Row, Screen } from '../../components/ui';
import { LINKS } from '../../lib/config';
import { initials } from '../../lib/format';
import { useSession } from '../../lib/session';
import { colors, fonts, radius, type } from '../../lib/theme';

const ROLE: Record<string, string> = { owner: 'Propriétaire', admin: 'Administrateur', manager: 'Gestionnaire', member: 'Membre', viewer: 'Lecture seule', client: 'Client' };

export default function Account() {
  const { me, lockEnabled, setLockEnabled, signOut } = useSession();
  const [bio, setBio] = useState<{ ok: boolean; label: string }>({ ok: false, label: 'Verrouillage biométrique' });

  useEffect(() => {
    (async () => {
      const [hardware, enrolled, kinds] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]).catch(() => [false, false, []] as const);
      const face = (kinds as number[]).includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      setBio({ ok: Boolean(hardware && enrolled), label: face ? 'Verrouiller avec Face ID' : 'Verrouiller avec l’empreinte' });
    })();
  }, []);

  const name = [me?.user.firstName, me?.user.lastName].filter(Boolean).join(' ') || me?.user.displayName || me?.user.email || 'Mon compte';

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 19, color: colors.white }}>{initials(name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.heading} numberOfLines={1}>{name}</Text>
          <Text style={type.small} numberOfLines={1}>{me?.user.email}</Text>
        </View>
      </Card>

      <Eyebrow style={{ marginTop: 24 }}>Entreprise</Eyebrow>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="briefcase" title={me?.workspace?.name ?? 'Aucune entreprise choisie'} subtitle={me?.workspace ? ROLE[me.workspace.role] ?? me.workspace.role : 'Choisissez l’entreprise à afficher'}
          onPress={me && me.workspaces.length > 1 ? () => router.push('/workspaces') : undefined} last />
      </Card>

      <Eyebrow style={{ marginTop: 24 }}>Sécurité</Eyebrow>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="fingerprint" title={bio.label} subtitle={bio.ok ? 'Après une minute hors de l’app' : 'Non configuré sur cet appareil'} last
          right={<Switch value={lockEnabled} disabled={!bio.ok} onValueChange={async on => {
            if (on) { const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Activer le verrouillage' }); if (!r.success) return; }
            setLockEnabled(on);
          }} trackColor={{ true: colors.primary, false: colors.raised }} thumbColor={colors.white} />} />
      </Card>

      <Eyebrow style={{ marginTop: 24 }}>Aide et informations</Eyebrow>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="support" title="Soutien TAKATAK" subtitle="Écrire à l’équipe" onPress={() => Linking.openURL(LINKS.support)} />
        <Row icon="globe" title="Tableau de bord Web" subtitle="takatak.ca" onPress={() => Linking.openURL(LINKS.dashboard)} />
        <Row icon="shield" title="Confidentialité" onPress={() => Linking.openURL(LINKS.privacy)} />
        <Row icon="file" title="Conditions d’utilisation" onPress={() => Linking.openURL(LINKS.terms)} last />
      </Card>

      <Card style={{ paddingVertical: 4, marginTop: 24 }}>
        <Row icon="logout" title="Se déconnecter" tint={colors.accent} onPress={() => Alert.alert('Se déconnecter', 'Vous devrez entrer un nouveau code pour revenir.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Se déconnecter', style: 'destructive', onPress: signOut }])} />
        <Row icon="trash" title="Supprimer mon compte et mes données" tint={colors.red} onPress={() => Linking.openURL(LINKS.deleteData)} last />
      </Card>

      <Text style={[type.small, { textAlign: 'center', marginTop: 24, fontSize: 12, color: colors.faint }]}>Groupe TAKATAK · version {Constants.expoConfig?.version ?? ''}</Text>
    </Screen>
  );
}
