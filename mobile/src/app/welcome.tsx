// First screen: the TAKATAK promise and one way in (the same email code signs in and creates an account).
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { Icon, IconName } from '../components/Icon';
import { Logo } from '../components/Logo';
import { colors, fonts, type } from '../lib/theme';

const PILLARS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'chart', title: 'Vos résultats en direct', text: 'Portée, visites, demandes et avis de votre entreprise.' },
  { icon: 'bell', title: 'Rien ne vous échappe', text: 'Nouvelles demandes, approbations et renouvellements.' },
  { icon: 'grid', title: 'Tous vos outils', text: 'Site Web, réseaux sociaux, publicité, SEO, Food Hub et plus.' },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#0B1B3D', colors.canvas, colors.canvas]} locations={[0, 0.55, 1]} style={{ flex: 1, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
      <Logo size={1.05} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[type.label, { marginBottom: 14 }]}>Digital Solutions · Real Results</Text>
        <Text style={[type.display, { fontSize: 34, lineHeight: 40 }]}>Votre entreprise,{'\n'}plus forte en ligne.</Text>
        <Text style={[type.body, { marginTop: 14, color: colors.muted }]}>Suivez vos résultats et gérez vos services TAKATAK, où que vous soyez.</Text>
        <View style={{ marginTop: 34, gap: 18 }}>
          {PILLARS.map(p => (
            <View key={p.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(31,139,255,0.35)' }}>
                <Icon name={p.icon} size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink }}>{p.title}</Text>
                <Text style={[type.small, { marginTop: 2 }]}>{p.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <Button title="Se connecter ou créer un compte" icon="arrow" onPress={() => router.push('/sign-in')} />
      <Text style={[type.small, { textAlign: 'center', marginTop: 14, fontSize: 12 }]}>Le même compte que sur takatak.ca.</Text>
    </LinearGradient>
  );
}
