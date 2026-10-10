"use client";

import { useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { ALKAO_MESSAGES } from "@/lib/ticketing/alkao-config";

/**
 * Frames the ALKAO Operations app and hands it the user's Supabase access
 * token, so staff sign in once, in TAKATAK.
 *
 * - Only messages from the ALKAO origin and from this iframe are answered.
 * - The session is posted only to the ALKAO origin.
 * - The refresh token never leaves TAKATAK: ALKAO asks again
 *   (alkao.session_expired) and TAKATAK refreshes on its side.
 */
export function AlkaoFrame({ opsOrigin }: { opsOrigin: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      return;
    }
    let handshake = false;

    const sendSession = async () => {
      const target = frame.current?.contentWindow;
      if (!target) return;
      // getSession() refreshes a token close to expiry before returning it.
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        setError("Your session has ended. Sign in again to open ALKAO.");
        return;
      }
      setError(null);
      target.postMessage(
        {
          type: ALKAO_MESSAGES.session,
          accessToken: session.access_token,
          expiresAt: (session.expires_at ?? 0) * 1000,
          email: session.user?.email ?? null,
        },
        opsOrigin,
      );
    };

    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== opsOrigin ||
        event.source !== frame.current?.contentWindow
      ) {
        return;
      }
      const type = (event.data as { type?: unknown } | null)?.type;
      if (
        type === ALKAO_MESSAGES.ready ||
        type === ALKAO_MESSAGES.sessionExpired
      ) {
        handshake = true;
        void sendSession();
      }
    };

    window.addEventListener("message", onMessage);
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (handshake && event === "TOKEN_REFRESHED") void sendSession();
    });

    return () => {
      window.removeEventListener("message", onMessage);
      subscription.subscription.unsubscribe();
    };
  }, [opsOrigin]);

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {error}
        </div>
      ) : null}
      <iframe
        ref={frame}
        src={`${opsOrigin}/ops#/`}
        title="ALKAO — Billetterie"
        referrerPolicy="strict-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
        className="h-[calc(100vh-11rem)] min-h-[640px] w-full rounded-2xl border border-slate-200 bg-white"
      />
    </div>
  );
}
