'use client';

import { useEffect, useState } from 'react';

// Kitchen-screen helpers on every Food Hub page:
//  - "No connection" banner the moment the device goes offline
//  - keeps the screen awake when "Keep this screen on" is ticked in 🔔 Alerts (kitchen tablet)
export default function KitchenShell() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const wanted = () => { try { return Boolean(JSON.parse(window.localStorage.getItem('takatak.notify.v1') || '{}').keepAwake); } catch { return false; } };
    const acquire = async () => {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (!wl || !wanted() || document.visibilityState !== 'visible') return;
      try { lock = await wl.request('screen'); } catch { /* not allowed (battery saver) */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('takatak:keepawake', acquire);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('takatak:keepawake', acquire); lock?.release().catch(() => undefined); };
  }, []);

  if (!offline) return null;
  return <div className="app-offline" role="alert">No internet connection — orders keep arriving on the platform tablets and in Clover. Reconnecting…</div>;
}
