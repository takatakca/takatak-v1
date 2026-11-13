import type { ReactNode } from "react";
import localFont from "next/font/local";

const montserrat = localFont({
  src: "../../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2",
  style: "normal",
  display: "swap",
  weight: "100 900",
});

export default function OAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${montserrat.className} flex min-h-screen flex-1 flex-col bg-[#060D1F] text-[#F5F8FC]`}>
      {children}
    </div>
  );
}
