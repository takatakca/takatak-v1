import CommandCenter from './command-center';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Command Center — TAKATAK Food Hub' };

// One screen for the whole business: orders from every app, sales, Clover, store status, alerts.
export default function FoodHubCommandCenterPage() {
  return <CommandCenter />;
}
