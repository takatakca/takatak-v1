// Second step of sign-in and sign-up: the 6-digit code received by email. Auto-fills from the keyboard suggestion.
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, ErrorNote, success } from './ui';
import { colors, fonts, radius, type } from '../lib/theme';

export function CodeStep({ email, onVerify, onResend, onBack }: { email: string; onVerify: (code: string) => Promise<void>; onResend: () => Promise<void>; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const verify = async (value = code) => {
    if (value.length < 6) return;
    setBusy(true); setError(null);
    try { await onVerify(value); success(); } catch (e: any) { setError(e?.message ?? 'Code refusé.'); } finally { setBusy(false); }
  };

  return (
    <View>
      <Text style={type.title}>Vérifiez vos courriels</Text>
      <Text style={[type.body, { marginTop: 8 }]}>Nous avons envoyé un code à 6 chiffres à <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{email}</Text>.</Text>
      <TextInput
        value={code}
        onChangeText={v => { const digits = v.replace(/\D/g, '').slice(0, 6); setCode(digits); if (digits.length === 6) verify(digits); }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        accessibilityLabel="Code à 6 chiffres"
        placeholder="••••••"
        placeholderTextColor={colors.faint}
        style={{ marginTop: 24, height: 64, borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: radius.md, backgroundColor: colors.surface, textAlign: 'center', fontSize: 30, letterSpacing: 12, fontFamily: fonts.semibold, color: colors.ink }}
      />
      {error ? <ErrorNote message={error} /> : null}
      <Button title="Confirmer" onPress={() => verify()} loading={busy} disabled={code.length < 6} style={{ marginTop: 18 }} />
      <Button title={resent ? 'Code renvoyé' : 'Renvoyer le code'} variant="ghost" disabled={resent} onPress={async () => { try { await onResend(); setResent(true); } catch (e: any) { setError(e?.message); } }} style={{ marginTop: 6 }} />
      <Button title="Changer d’adresse" variant="ghost" onPress={onBack} />
      <Text style={[type.small, { textAlign: 'center', marginTop: 8 }]}>Le code expire après quelques minutes. Pensez à vérifier vos indésirables.</Text>
    </View>
  );
}
