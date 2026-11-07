"use client";

import { TriangleAlert } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { MasterPhoneLoginForm } from "@/components/auth/master-phone-login-form";
import { loginCopy, loginPath } from "@/lib/auth/login-copy";
import { useLanguage } from "@/lib/website/use-language";

export function LoginPanel({ configured }: { configured: boolean }) {
  const { lang } = useLanguage();
  const copy = loginCopy(lang);

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
      <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{copy.intro}</p>
      <div className="mt-6">
        {configured ? (
          <MasterPhoneLoginForm />
        ) : (
          <div className="space-y-3 text-center">
            <TriangleAlert className="mx-auto h-6 w-6 text-warning" />
            <p className="text-sm font-medium text-foreground">{copy.authMissingTitle}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{copy.authMissingBody}</p>
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {copy.newPrompt}{" "}
        <Link to={loginPath("/register", lang)} className="text-primary">
          {copy.createAccount}
        </Link>
      </p>
    </div>
  );
}
