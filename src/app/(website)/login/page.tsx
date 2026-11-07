import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginPanel } from "@/components/auth/login-panel";
import { isSupabaseConfigured } from "@/lib/auth/env";
import { loginCopy } from "@/lib/auth/login-copy";
import { HOME_LANGUAGE_HEADER } from "@/lib/website/home-seo";

export async function generateMetadata() {
  const lang = (await headers()).get(HOME_LANGUAGE_HEADER) === "fr" ? "fr" : "en";
  return {
    title: loginCopy(lang).metaTitle,
    robots: { index: false, follow: false },
  };
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <Suspense>
        <LoginPanel configured={isSupabaseConfigured()} />
      </Suspense>
    </div>
  );
}
