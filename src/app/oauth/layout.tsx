import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "800"],
});

export default function OAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${montserrat.className} flex min-h-screen flex-1 flex-col bg-[#060D1F] text-[#F5F8FC]`}>
      {children}
    </div>
  );
}
