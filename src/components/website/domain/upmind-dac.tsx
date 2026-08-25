"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { DomainRequestFallback } from "@/components/website/domain/DomainRequestFallback";
import { UpmindScripts } from "@/components/website/domain/upmind-scripts";
import {
  UPMIND_ACCOUNT_ID,
  UPMIND_BRAND_ID,
  UPMIND_CURRENCY,
  UPMIND_DOMAIN_SEARCH_MODE,
  UPMIND_ORDER_CONFIG_URL,
} from "@/lib/website/upmind-config";

export function UpmindDac({
  clientId,
}: {
  clientId?: string | null;
}) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const [ready, setReady] =
    useState(false);

  const [failed, setFailed] =
    useState(false);

  const [
    diagnosticCode,
    setDiagnosticCode,
  ] =
    useState<string | null>(null);

  useEffect(() => {
    if (ready) {
      return;
    }

    const timeout =
      window.setTimeout(() => {
        if (!ready) {
          setDiagnosticCode(
            "upmind_script_timeout",
          );

          setFailed(true);
        }
      }, 8000);

    return () =>
      window.clearTimeout(timeout);
  }, [ready]);

  useEffect(() => {
    if (
      !ready ||
      !containerRef.current
    ) {
      return;
    }

    const container =
      containerRef.current;

    container.innerHTML = "";

    const element =
      document.createElement(
        "upm-dac",
      );

    element.setAttribute(
      "order-config-url",
      UPMIND_ORDER_CONFIG_URL,
    );

    element.setAttribute(
      "currency-code",
      UPMIND_CURRENCY,
    );

    element.setAttribute(
      "currency",
      UPMIND_CURRENCY,
    );

    element.setAttribute(
      "mode",
      UPMIND_DOMAIN_SEARCH_MODE,
    );

    element.setAttribute(
      "domain-search-mode",
      UPMIND_DOMAIN_SEARCH_MODE,
    );

    if (UPMIND_BRAND_ID) {
      element.setAttribute(
        "brand-id",
        UPMIND_BRAND_ID,
      );
    }

    if (UPMIND_ACCOUNT_ID) {
      element.setAttribute(
        "account-id",
        UPMIND_ACCOUNT_ID,
      );
    }

    if (clientId) {
      element.setAttribute(
        "client-id",
        clientId,
      );
    }

    element.setAttribute(
      "style",
      "display:block;width:100%;",
    );

    container.appendChild(element);

    function scanForFailure(): void {
      const text = [
        container.innerText,
        element.shadowRoot?.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (
        text.includes("oops") ||
        text.includes(
          "something went wrong",
        )
      ) {
        setDiagnosticCode(
          "upmind_widget_runtime_error",
        );

        setFailed(true);
      }
    }

    function scanForBlank(): void {
      const box =
        element.getBoundingClientRect();

      const text =
        container.innerText.trim();

      const controls =
        element.shadowRoot?.querySelectorAll(
          "input,button,select",
        ).length ?? 0;

      if (
        (!text && box.height < 80) ||
        controls === 0
      ) {
        setDiagnosticCode(
          "upmind_widget_blank",
        );

        setFailed(true);
      }
    }

    const observer =
      new MutationObserver(
        scanForFailure,
      );

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const firstScan =
      window.setTimeout(
        scanForFailure,
        1500,
      );

    const poll =
      window.setInterval(
        scanForFailure,
        500,
      );

    const blankTimer =
      window.setTimeout(
        scanForBlank,
        5000,
      );

    return () => {
      observer.disconnect();
      window.clearTimeout(firstScan);
      window.clearInterval(poll);
      window.clearTimeout(blankTimer);
    };
  }, [clientId, ready]);

  return (
    <>
      <UpmindScripts
        onReady={() =>
          setReady(true)
        }
        onError={() => {
          setDiagnosticCode(
            "upmind_script_load_failed",
          );

          setFailed(true);
        }}
      />

      {!failed ? (
        <div
          ref={containerRef}
          className="w-full"
        />
      ) : null}

      {!ready && !failed ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading TAKATAK domain
          search…
        </div>
      ) : null}

      {failed ? (
        <DomainRequestFallback
          diagnosticCode={
            diagnosticCode ??
            "upmind_widget_unavailable"
          }
        />
      ) : null}
    </>
  );
}