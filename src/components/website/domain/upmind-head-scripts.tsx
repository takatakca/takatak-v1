import Script from "next/script";

import {
  UPMIND_DAC_SCRIPT_URL,
  UPMIND_WIDGET_SCRIPT_URL,
} from "@/lib/website/upmind-config";

/** Same Upmind script tags the former TAKATAK checkout used in root layout. */
export function UpmindHeadScripts() {
  return (
    <>
      <link rel="preconnect" href="https://embed.upmind.app" />
      <link rel="dns-prefetch" href="https://embed.upmind.app" />
      <link rel="preconnect" href="https://widgets.upmind.app" />
      <link rel="dns-prefetch" href="https://widgets.upmind.app" />
      <Script
        type="module"
        src={UPMIND_WIDGET_SCRIPT_URL}
        strategy="afterInteractive"
      />
      <Script
        src={UPMIND_DAC_SCRIPT_URL}
        strategy="afterInteractive"
      />
    </>
  );
}
