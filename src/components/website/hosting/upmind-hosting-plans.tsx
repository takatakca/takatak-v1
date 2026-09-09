"use client";

import { useEffect, useRef } from "react";

import { UpmindScripts } from "@/components/website/domain/upmind-scripts";
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

export function UpmindHostingPlans({
  clientId = null,
}: {
  clientId?: string | null;
}) {
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
