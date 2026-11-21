// All TAKATAK tools. The everyday screens are native; the specialist tools open the secure TAKATAK dashboard in an
// in-app browser until each one is rebuilt natively (owner decision 2026-11-21: native core first, the rest in rounds).
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Card, Eyebrow, Notice, Row, Screen } from '../../components/ui';
import type { IconName } from '../../components/Icon';
import { SITE_ORIGIN } from '../../lib/config';
import { useSession } from '../../lib/session';
import { colors, type } from '../../lib/theme';

type Tool = { title: string; subtitle: string; icon: IconName; href?: string; native?: '/invoices' };
const GROUPS: { title: string; tools: Tool[] }[] = [
  { title: 'Croissance', tools: [
    { title: 'Réseaux sociaux', subtitle: 'Publications, approbations, statistiques', icon: 'users', href: '/dashboard/social' },
    { title: 'Publicité TAKATAK ADS', subtitle: 'Campagnes et résultats', icon: 'megaphone', href: '/dashboard/advertising' },
    { title: 'Avis et réputation', subtitle: 'Lire et répondre aux avis', icon: 'star', href: '/dashboard/growth/reviews' },
    { title: 'Demandes reçues', subtitle: 'Prospects du site et des formulaires', icon: 'inbox', href: '/dashboard/leads' },
    { title: 'Référencement local', subtitle: 'Fiches et citations', icon: 'pin', href: '/dashboard/local-listings' },
    { title: 'SEO', subtitle: 'Mots-clés, liens, occasions', icon: 'search', href: '/dashboard/seo' },
    { title: 'AI Studio', subtitle: 'Textes et visuels par IA', icon: 'sparkle', href: '/dashboard/ai-studio' },
  ] },
  { title: 'Web', tools: [
    { title: 'Mes sites Web', subtitle: 'Sites, surveillance, sauvegardes', icon: 'globe', href: '/dashboard/web-hosting/websites' },
    { title: 'Domaines', subtitle: 'Noms de domaine et renouvellements', icon: 'link', href: '/dashboard/web-hosting/domains' },
    { title: 'Hébergement', subtitle: 'Comptes, courriels, sécurité', icon: 'server', href: '/dashboard/hosting' },
  ] },
  { title: 'Commerce', tools: [
    { title: 'Food Hub', subtitle: 'Commandes, menus, versements', icon: 'food', href: '/dashboard/food-hub' },
    { title: 'Téléphone d’affaires', subtitle: 'Lignes et appels', icon: 'phone', href: '/dashboard/voip' },
  ] },
  { title: 'Administration', tools: [
    { title: 'Factures', subtitle: 'Vos factures TAKATAK', icon: 'receipt', native: '/invoices' },
    { title: 'Rapports', subtitle: 'Rapports mensuels et sur mesure', icon: 'chart', href: '/dashboard/reports' },
    { title: 'Fichiers', subtitle: 'Documents partagés avec l’équipe', icon: 'folder', href: '/dashboard/files' },
    { title: 'Équipe et permissions', subtitle: 'Membres, rôles, invitations', icon: 'users', href: '/dashboard/team' },
    { title: 'Forfaits et paiement', subtitle: 'Abonnements et moyens de paiement', icon: 'briefcase', href: '/dashboard/billing' },
    { title: 'Soutien', subtitle: 'Écrire à l’équipe TAKATAK', icon: 'support', href: '/dashboard/support' },
  ] },
];

export default function Tools() {
  const { me } = useSession();
  const open = (t: Tool) => {
    if (t.native) { router.push(t.native); return; }
    WebBrowser.openBrowserAsync(`${SITE_ORIGIN}${t.href}`, { toolbarColor: colors.canvas, controlsColor: colors.accent });
  };
  return (
    <Screen>
      <Text style={[type.body, { color: colors.muted, marginBottom: 16 }]}>Tous vos services TAKATAK. Les outils spécialisés s’ouvrent dans votre tableau de bord sécurisé, sans quitter l’app.</Text>
      {GROUPS.map(g => {
        const tools = g.tools.filter(t => !t.native || me?.can.invoices);
        return (
          <View key={g.title} style={{ marginBottom: 22 }}>
            <Eyebrow>{g.title}</Eyebrow>
            <Card style={{ paddingVertical: 4 }}>
              {tools.map((t, i) => <Row key={t.title} icon={t.icon} title={t.title} subtitle={t.subtitle} onPress={() => open(t)} last={i === tools.length - 1} />)}
            </Card>
          </View>
        );
      })}
      <Notice icon="info">La première ouverture d’un outil Web peut vous demander de vous connecter sur takatak.ca avec le même courriel.</Notice>
    </Screen>
  );
}
