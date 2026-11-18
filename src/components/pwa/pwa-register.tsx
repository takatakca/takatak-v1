"use client";

import { useEffect } from "react";

import { enableTvMode } from "@/lib/pwa/tv-mode";

// Makes takatak.ca installable as an app (phones, tablets, computers) and usable with a TV remote.
// Same worker and scope as the deal alerts (public/takatak-push-sw.js), so registering it here never
// replaces the alert subscription.
export const PWA_SW_URL = "/takatak-push-sw.js";

export function PwaRegister() {
  useEffect(() => {
    let stopTv: () => void = () => undefined;
    const start = () => {
      if ("serviceWorker" in navigator && window.isSecureContext) {
        navigator.serviceWorker.register(PWA_SW_URL, { scope: "/" }).catch(() => undefined);
      }
      stopTv = enableTvMode();
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      stopTv();
    };
  }, []);
  return null;
}
