'use client';

import { useState } from 'react';

export default function ActivateButton({ workspaceName }: { workspaceName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function activate() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/food-hub/activate', { method: 'POST' }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && body.ok) { window.location.reload(); return; }
    setError(body.error || 'Activation failed.');
    setBusy(false);
  }
  return (
    <div>
      <button onClick={activate} disabled={busy}>{busy ? 'Activating…' : `Activate Food Hub for “${workspaceName}”`}</button>
      {error && <div className="fh-banner warn" role="alert" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
