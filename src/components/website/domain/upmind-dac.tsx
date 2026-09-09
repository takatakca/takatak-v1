"use client";

import { useEffect, useRef } from "react";

import { UpmindScripts } from "@/components/website/domain/upmind-scripts";
import {
  UPMIND_CURRENCY,
  UPMIND_ORDER_CONFIG_URL,
} from "@/lib/website/upmind-config";

/**
 * Former TAKATAK checkout widget: native `upm-dac` with order-config-url,
 * currency-code, and optional client-id. Do not swap this for a TAKATAK form.
 */
export function UpmindDac({
  clientId,
  onTyped,
}: {
  clientId?: string | null;
  quiet?: boolean;
  onTyped?: (hasTyped: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onTypedRef = useRef(onTyped);

  useEffect(() => {
    onTypedRef.current = onTyped;
  }, [onTyped]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const element = host.querySelector("upm-dac");
    if (element) {
      element.setAttribute("order-config-url", UPMIND_ORDER_CONFIG_URL);
      element.setAttribute("currency-code", UPMIND_CURRENCY);
      if (clientId) {
        element.setAttribute("client-id", clientId);
      } else {
        element.removeAttribute("client-id");
      }
    }

    const interval = window.setInterval(() => {
      const element = host.querySelector("upm-dac");
      const input = element?.shadowRoot?.querySelector("input");
      if (
        !(input instanceof HTMLInputElement) ||
        input.dataset.takatakTyped === "1"
      ) {
        return;
      }

      input.dataset.takatakTyped = "1";
      input.addEventListener("input", () => {
        onTypedRef.current?.(input.value.trim().length > 0);
      });
    }, 500);

    return () => window.clearInterval(interval);
  }, [clientId]);

  return (
    <>
      <UpmindScripts />
      <div ref={hostRef} className="w-full">
        <upm-dac
          order-config-url={UPMIND_ORDER_CONFIG_URL}
          currency-code={UPMIND_CURRENCY}
          {...(clientId ? { "client-id": clientId } : {})}
          style={{ display: "block", width: "100%" }}
        />
      </div>
    </>
  );
}
