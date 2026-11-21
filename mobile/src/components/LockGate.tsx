// Optional Face ID / Touch ID / fingerprint lock. When enabled in "Mon compte", the app hides its content each time it
// returns from the background after 60 seconds, until the person unlocks it. The session itself never leaves the
// phone's secure storage.
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSession } from '../lib/session';
import { colors, fonts, type } from '../lib/theme';
import { Button } from './ui';
import { Logo } from './Logo';

const GRACE_MS = 60_000;

export function LockGate({ active, children }: { active: boolean; children: ReactNode }) {
  const { lockEnabled } = useSession();
  const [locked, setLocked] = useState(active && lockEnabled);
  const leftAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Déverrouiller TAKATAK', cancelLabel: 'Annuler', disableDeviceFallback: false });
    if (result.success) setLocked(false);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current && Date.now() - leftAt.current > GRACE_MS && active && lockEnabled) setLocked(true);
    });
    return () => sub.remove();
  }, [active, lockEnabled]);

  useEffect(() => { if (locked) unlock(); }, [locked, unlock]);
  useEffect(() => { if (!active || !lockEnabled) setLocked(false); }, [active, lockEnabled]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked ? (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
          <Logo size={1.1} />
          <Text style={[type.title, { marginTop: 28, textAlign: 'center' }]}>Votre espace est verrouillé</Text>
          <Text style={[type.small, { marginTop: 8, textAlign: 'center' }]}>Vos données restent protégées sur cet appareil.</Text>
          <Button title="Déverrouiller" icon="fingerprint" onPress={unlock} style={{ marginTop: 28, alignSelf: 'stretch' }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: fonts.regular },
});
