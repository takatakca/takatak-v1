// Bottom tabs: home, alerts, tools, account.
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon, IconName } from '../../components/Icon';
import { colors, fonts } from '../../lib/theme';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color }: { color: unknown }) => <Icon name={icon} size={23} color={String(color)} />,
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: '#081430', borderTopColor: colors.line, ...(Platform.OS === 'android' ? { height: 64, paddingBottom: 8 } : {}) },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ ...tab('Accueil', 'home'), headerShown: false }} />
      <Tabs.Screen name="alerts" options={tab('Alertes', 'bell')} />
      <Tabs.Screen name="tools" options={tab('Outils', 'grid')} />
      <Tabs.Screen name="account" options={tab('Compte', 'user')} />
    </Tabs>
  );
}
