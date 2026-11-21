// Sign in or create an account with a code sent by email (same Supabase identity as takatak.ca).
import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { Button, ErrorNote, Field, Screen } from '../components/ui';
import { CodeStep } from '../components/CodeStep';
import { api } from '../lib/api';
import { LINKS } from '../lib/config';
import { useSession } from '../lib/session';
import { colors, type } from '../lib/theme';

export default function SignIn() {
  const { completeSignIn } = useSession();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const send = async () => {
    setBusy(true); setError(null);
    try {
      const isReview = await api.isReviewEmail(email.trim());
      setReview(isReview);
      if (!isReview) await api.requestCode(email.trim());
      setStep('code');
    } catch (e: any) { setError(e?.message ?? 'Envoi impossible.'); } finally { setBusy(false); }
  };

  if (step === 'code') {
    return (
      <Screen>
        <CodeStep
          email={email.trim()}
          onVerify={async code => { await api.verifyCode(email.trim(), code); await completeSignIn(); }}
          onResend={async () => { if (!review) await api.requestCode(email.trim()); }}
          onBack={() => setStep('email')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={type.display}>Connexion</Text>
      <Text style={[type.body, { marginTop: 8, marginBottom: 26, color: colors.muted }]}>Entrez votre courriel. Nous vous envoyons un code à usage unique. Pas de mot de passe à retenir.</Text>
      <Field label="Courriel" value={email} onChangeText={setEmail} placeholder="vous@entreprise.ca" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={() => valid && send()} autoFocus />
      {error ? <ErrorNote message={error} /> : null}
      <Button title="Recevoir mon code" icon="send" onPress={send} disabled={!valid} loading={busy} style={{ marginTop: 6 }} />
      <Text style={[type.small, { marginTop: 22, textAlign: 'center', fontSize: 12 }]}>
        En continuant, vous acceptez les <Text style={{ color: colors.accent }} onPress={() => Linking.openURL(LINKS.terms)}>conditions</Text> et la <Text style={{ color: colors.accent }} onPress={() => Linking.openURL(LINKS.privacy)}>politique de confidentialité</Text> de TAKATAK.
      </Text>
    </Screen>
  );
}
