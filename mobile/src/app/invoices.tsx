// TAKATAK invoices for this business. Paying or downloading opens the secure Stripe page (no card entry in the app).
import { Linking, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Badge, Button, Card, Empty, ErrorNote, Loading, Notice, Screen } from '../components/ui';
import { api } from '../lib/api';
import { LINKS } from '../lib/config';
import { amount, formatDate, INVOICE_STATUS } from '../lib/format';
import { useData } from '../lib/useData';
import { useSession } from '../lib/session';
import { colors, fonts, type } from '../lib/theme';

export default function Invoices() {
  const { me } = useSession();
  const { data, error, loading, refreshing, refresh } = useData(() => api.invoices(), [me?.workspace?.id]);
  if (loading) return <Loading />;
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorNote message={error} onRetry={refresh} /> : null}
      {data?.status === 'no_billing_account' ? <Empty icon="receipt" title="Aucune facture" text="Vos factures TAKATAK apparaîtront ici dès la première." /> : null}
      {data?.status === 'unavailable' ? <Notice icon="info">Les factures ne sont pas disponibles pour le moment. Réessayez plus tard.</Notice> : null}
      {data?.status === 'ok' ? (
        <>
          {data.partial ? <Notice icon="info">Une partie des factures n’a pas pu être chargée.</Notice> : null}
          {!data.invoices.length ? <Empty icon="receipt" title="Aucune facture" text="Vos factures TAKATAK apparaîtront ici." /> : null}
          {data.invoices.map(inv => {
            const s = INVOICE_STATUS[inv.status] ?? { label: inv.status, tone: 'muted' as const };
            const due = inv.amountDueMinor > 0 && (inv.status === 'open' || inv.status === 'overdue');
            return (
              <Card key={inv.id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.heading} numberOfLines={2}>{inv.description || (inv.number ? `Facture ${inv.number}` : 'Facture')}</Text>
                    <Text style={[type.small, { marginTop: 3 }]}>{inv.number ? `${inv.number} · ` : ''}{formatDate(inv.issuedAt)}</Text>
                  </View>
                  <Badge label={s.label} tone={s.tone} />
                </View>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink, marginTop: 12 }}>{amount(due ? inv.amountDueMinor : inv.totalMinor, inv.currency)}</Text>
                {inv.dueAt && due ? <Text style={[type.small, { color: inv.status === 'overdue' ? colors.red : colors.muted }]}>À payer avant le {formatDate(inv.dueAt)}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  {due && inv.payUrl ? <Button title="Payer" icon="arrow" small onPress={() => WebBrowser.openBrowserAsync(inv.payUrl!)} style={{ flex: 1 }} /> : null}
                  {inv.pdfUrl ? <Button title="PDF" icon="download" variant="secondary" small onPress={() => Linking.openURL(inv.pdfUrl!)} style={{ flex: 1 }} /> : null}
                </View>
              </Card>
            );
          })}
        </>
      ) : null}
      <Button title="Forfaits et moyens de paiement" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(LINKS.billing)} style={{ marginTop: 6 }} />
    </Screen>
  );
}
