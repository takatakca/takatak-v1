// Small loader hook: first load, pull-to-refresh, reload when the screen comes back into focus.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const first = useRef(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await load();
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Chargement impossible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => { run('initial'); }, [run]);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    run('silent');
  }, [run]));

  return { data, setData, error, loading, refreshing, refresh: () => run('refresh'), reload: () => run('silent') };
}
