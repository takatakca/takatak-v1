"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";

import { useCopy } from "@/components/website/premium/ui";

type Server = { enabled: false } | { enabled: true; publicKey: string; version: string; text: { fr: string; en: string } };
type State = "hidden" | "idle" | "asking" | "working" | "on" | "denied" | "failed";

const t = {
  offer: { fr: "Ou recevoir une alerte sur cet appareil", en: "Or get an alert on this device" },
  yes: { fr: "Oui, m'alerter", en: "Yes, alert me" },
  no: { fr: "Non merci", en: "No thanks" },
  on: { fr: "Alertes promo activées sur cet appareil.", en: "Deal alerts are on for this device." },
  stop: { fr: "Arrêter", en: "Stop" },
  denied: {
    fr: "Votre navigateur bloque les notifications pour takatak.ca. Vous pouvez les permettre dans ses réglages.",
    en: "Your browser blocks notifications for takatak.ca. You can allow them in its settings.",
  },
  failed: { fr: "Ça n'a pas fonctionné sur cet appareil. Les alertes par courriel restent possibles.", en: "That did not work on this device. Email alerts are still available." },
};

const SW_URL = "/takatak-push-sw.js";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Device deal alerts. Our own question comes first; the browser's permission
 * prompt only opens after "Yes". Never shown on its own, never pre-accepted,
 * and separate from email consent.
 */
export function PushAlert({ sourcePage }: { sourcePage: string }) {
  const { lang } = useCopy();
  const [server, setServer] = useState<Server>({ enabled: false });
  const [state, setState] = useState<State>("hidden");

  useEffect(() => {
    if (!supported()) return;
    let live = true;
    (async () => {
      try {
        const d = (await (await fetch("/api/public/push", { cache: "no-store" })).json()) as {
          enabled?: boolean;
          publicKey?: string;
          consentVersion?: string;
          consentText?: { fr: string; en: string };
        };
        if (!live || !d.enabled || !d.publicKey || !d.consentVersion || !d.consentText) return;
        setServer({ enabled: true, publicKey: d.publicKey, version: d.consentVersion, text: d.consentText });
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (!live) return;
        setState(sub && Notification.permission === "granted" ? "on" : Notification.permission === "denied" ? "denied" : "idle");
      } catch {
        /* stays hidden */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state === "hidden" || !server.enabled) return null;

  async function accept() {
    if (!server.enabled) return;
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "idle");
      await navigator.serviceWorker.register(SW_URL, { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(server.publicKey) }));
      const res = await fetch("/api/public/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), consent: true, consentVersion: server.version, language: lang, sourcePage }),
      });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => undefined);
        return setState("failed");
      }
      setState("on");
    } catch {
      setState("failed");
    }
  }

  async function stop() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/public/push/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="hp-line mt-6 border-t pt-5">
      {state === "idle" && (
        <button type="button" onClick={() => setState("asking")} className="hp-ink-2 hp-focus inline-flex items-center gap-2 text-[14px] font-semibold hover:text-[var(--hp-ink)]">
          <BellRing size={16} aria-hidden /> {t.offer[lang]}
        </button>
      )}
      {state === "asking" && (
        <div role="dialog" aria-label={t.offer[lang]}>
          <p className="hp-ink-2 text-[13.5px] leading-6">{server.text[lang]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={accept} className="hp-cta hp-focus rounded-full px-5 py-2.5 text-[14px] font-semibold">
              {t.yes[lang]}
            </button>
            <button type="button" onClick={() => setState("idle")} className="hp-ghost hp-focus rounded-full px-5 py-2.5 text-[14px] font-semibold">
              {t.no[lang]}
            </button>
          </div>
        </div>
      )}
      {state === "working" && <Loader2 size={18} className="hp-ink-3 animate-spin" aria-label="…" />}
      {state === "on" && (
        <p className="hp-ink flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-medium" role="status">
          <BellRing size={16} className="hp-accent" aria-hidden /> {t.on[lang]}
          <button type="button" onClick={stop} className="hp-ink-2 hp-focus underline underline-offset-4 hover:text-[var(--hp-ink)]">
            {t.stop[lang]}
          </button>
        </p>
      )}
      {state === "denied" && <p className="hp-ink-3 text-[13px] leading-6">{t.denied[lang]}</p>}
      {state === "failed" && <p className="hp-ink-3 text-[13px] leading-6">{t.failed[lang]}</p>}
    </div>
  );
}
