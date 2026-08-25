"use client";

import type { ReactNode } from "react";

import { WebsiteAuthProvider } from "@/lib/website/auth-context";
import { LanguageProvider } from "@/lib/website/use-language";

export function WebsiteProviders({
  isAuthenticated,
  email = null,
  children,
}: {
  isAuthenticated: boolean;
  email?: string | null;
  children: ReactNode;
}) {
  return (
    <LanguageProvider>
      <WebsiteAuthProvider isAuthenticated={isAuthenticated} email={email}>
        {children}
      </WebsiteAuthProvider>
    </LanguageProvider>
  );
}
