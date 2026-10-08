"use client";

import { useEffect, useRef, useState } from "react";

import { UpmindScripts } from "@/components/website/domain/upmind-scripts";
import { HostingRequestFallback } from "@/components/website/hosting/HostingRequestFallback";
import {
  UPMIND_CURRENCY,
  UPMIND_HOSTING_PLANS,
} from "@/lib/website/upmind-config";

function UpmindPlanCard({
  planId,
  clientId,
}: {
  planId: string;
  clientId?: string | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = hostRef.current?.querySelector("upm-widget");
    if (!element) {
      return;
    }

    element.setAttribute("as", "PlanCard");
    element.setAttribute("locale", "en");
    element.setAttribute(
      "bind",
      JSON.stringify({
        id: planId,
        currencyCode: UPMIND_CURRENCY.toLowerCase(),
      }),
    );

    if (clientId) {
      element.setAttribute("client-id", clientId);
    } else {
      element.removeAttribute("client-id");
    }
  }, [clientId, planId]);

  return (
    <div ref={hostRef} className="w-full">
      <upm-widget
        as="PlanCard"
        locale="en"
        bind={JSON.stringify({
          id: planId,
          currencyCode: UPMIND_CURRENCY.toLowerCase(),
        })}
        {...(clientId ? { "client-id": clientId } : {})}
      />
    </div>
  );
}

/** Time allowed for the Upmind widget script to register before falling back. */
const WIDGET_LOAD_TIMEOUT_MS = 10_000;

export function UpmindHostingPlans({
  clientId = null,
}: {
  clientId?: string | null;
}) {
  const [widgetsUnavailable, setWidgetsUnavailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.customElements) return;
    if (window.customElements.get("upm-widget")) return;
    let settled = false;
    void window.customElements.whenDefined("upm-widget").then(() => {
      settled = true;
    });
    const timer = window.setTimeout(() => {
      if (!settled && !window.customElements.get("upm-widget")) setWidgetsUnavailable(true);
    }, WIDGET_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (widgetsUnavailable) return <HostingRequestFallback />;

  return (
    <>
      <UpmindScripts />
      <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2 lg:grid-cols-4">
        {UPMIND_HOSTING_PLANS.map((plan) => (
          <UpmindPlanCard
            key={plan.id}
            planId={plan.id}
            clientId={clientId}
          />
        ))}
      </div>
    </>
  );
}
