import { Redirect } from 'expo-router';
import { useSession } from '../lib/session';

export default function Index() {
  const { signedIn } = useSession();
  return <Redirect href={signedIn ? '/(tabs)' : '/welcome'} />;
}
