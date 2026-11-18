"use client";

import { useEffect } from "react";

// Makes takatak.ca installable as an app (phones, tablets, computers). Same worker and scope as the
// deal alerts (public/takatak-push-sw.js), so registering it here never replaces the alert subscription.
export const PWA_SW_URL = "/takatak-push-sw.js";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const register = () => {
      navigator.serviceWorker.register(PWA_SW_URL, { scope: "/" }).catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
